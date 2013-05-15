/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import symbols = module("symbols");
import lists = module("lists");
import tasks = module("tasks");
import futures = module("futures");

/**
 * A Uri
 */
export class Uri {
    /**
     * The protocol for the Uri (e.g. 'http:')
     * @type {String}
     */
    public protocol: string = "";

    /**
     * The hostname for the Uri
     * @type {String}
     */
    public hostname: string = "";

    /**
     * The port number for the Uri
     * @type {Number}
     */
    public port: number = null;

    /**
     * The path name for the Uri
     * @type {String}
     */
    public pathname: string = "";

    /**
     * The search portion of the path, also known as the querystring
     * @type {String}
     */
    public search: string = "";

    /**
     * The fragment portion of the path
     * @type {String}
     */
    public hash: string = "";

    /**
     * A value indicating whether the Url is an absolute url
     * @type {Boolean}
     */
    public absolute: boolean = false;

    /**
     * Creates a new Uri by parsing a string
     * @param uri {String} The uri string to parse
     */
    constructor(uri: string);

    /**
     * Creates a new Uri by combining a base Uri and a relative Uri
     * @param baseUri {Uri} The base uri
     * @param uri {Uri} The relative uri
     */
    constructor(baseUri: Uri, uri: Uri);

    /**
     * Creates a new Uri by combining a base Uri and a relative Uri
     * @param baseUri {Uri} The base uri
     * @param uri {String} The relative uri
     */
    constructor(baseUri: Uri, uri: string);

    /**
     * Creates a new Uri by combining a base Uri and a relative Uri
     * @param baseUri {String} The base uri
     * @param uri {Uri} The relative uri
     */
    constructor(baseUri: string, uri: Uri);

    /**
     * Creates a new Uri by combining a base Uri and a relative Uri
     * @param baseUri {String} The base uri
     * @param uri {String} The relative uri
     */
    constructor(baseUri: string, uri: string);

    constructor(...args: any[]) {
        if (args.length === 0) throw new Error("Argument missing");
        if (args.length === 1) {
            var m = UriParser.exec(args[0]);
            if (!m) throw new URIError();
            
            for (var name in UriParts) {
                var index = UriParts[name];
                var part: any = m[index];
                if (part) {
                    if (index < 5) part = part.toLowerCase();
                    else if (index === 5) part = parseInt(part);
                }
                else {
                    if (index === 5) part = m[1] ? UriPorts[this.protocol] : null;
                }
                
                this[name] = part;
            }
            
            this.absolute = !!m[1];         
        }
        else {
            var baseUri: Uri = symbols.hasBrand(args[0], Uri) ? args[0] : Uri.parse(args[0]);
            var uri: Uri = symbols.hasBrand(args[1], Uri) ? args[1] : Uri.parse(args[1]);           
            if (uri.absolute) {         
                this.protocol = uri.protocol;
                this.hostname = uri.hostname;
                this.port = uri.port;
                this.pathname = uri.pathname;
                this.search = uri.search;
                this.hash = uri.hash;
                this.absolute = uri.absolute;
            }
            else {
                this.protocol = baseUri.protocol;
                this.hostname = baseUri.hostname;
                this.port = baseUri.port;
                this.pathname = baseUri.pathname;
                this.search = baseUri.search;
                this.hash = baseUri.hash;
                this.absolute = baseUri.absolute;
                if (uri.pathname) {
                    if (uri.pathname[0] !== '/') {
                        if ((baseUri.absolute && !baseUri.pathname) || baseUri.pathname === "/") {
                            this.pathname = '/' + uri.pathname;
                        }
                        else if (baseUri.pathname) {
                            var parts = baseUri.pathname.split('/');
                            parts[parts.length - 1] = uri.pathname;
                            this.pathname = parts.join('/');
                        }
                    }
                }
                else {
                    this.pathname = baseUri.pathname;
                    if (!uri.search) {
                        this.search = baseUri.search;
                        if (!uri.hash) {
                            this.hash = baseUri.hash;
                        }
                    }
                }
            }
        }

        Object.freeze(this);
    }
    
    /**
     * Gets the origin of the Uri
     */
    public get origin(): string {
        return this.toString("origin");
    }

    /**
     * Gets the host for the uri, including the hostname and port
     */
    public get host(): string {
        return this.toString("host");
    }

    /**
     * Gets the scheme for the uri (e.g. 'http://'')
     */
    public get scheme(): string {
        return this.toString("scheme");
    }

    /**
     * Tests whether the provided uri has the same origin as this uri
     * @param uri {Uri} The uri to compare against
     * @returns {Boolean} True if the uri's have the same origin; otherwise, false
     */
    public isSameOrigin(uri: Uri): boolean;

    /**
     * Tests whether the provided uri has the same origin as this uri
     * @param uri {String} The uri to compare against
     * @returns {Boolean} True if the uri's have the same origin; otherwise, false
     */
    public isSameOrigin(uri: string): boolean;

    public isSameOrigin(uriAny: any): boolean {
        var uri: Uri = symbols.hasBrand(uriAny, Uri) ? uriAny : Uri.parse(String(uriAny));
        if (this.absolute) {
            return this.origin === uri.origin;
        }

        return !uri.absolute;
    }

    /**
     * Gets the string representation of the Uri
     * @returns {String} The string content of the Uri
     */
    public toString(): string;

    /**
     * Gets the string representation of the Uri
     * @param format {String} A format specifier.
     * @returns {String} The string content of the Uri
     */
    public toString(format: string): string;

    public toString(format?: string): string {
        switch (format) {
            case "origin":
                if (this.protocol && this.hostname) {
                    return String(this.protocol) + "//" + this.toString("host");
                }
                return "";

            case "authority":
            case "host":
                if (this.hostname) {
                    if (this.port !== UriPorts[this.protocol]) {
                        return String(this.hostname) + ":" + this.toString("port");
                    }
                    return String(this.hostname);
                }
                return "";

            case "path+search":
                return String(this.pathname) + String(this.search);

            case "scheme": return this.toString("protocol") + "//";
            case "protocol": return String(this.protocol || "");
            case "hostname": return String(this.hostname || "");
            case "port":
                if (this.port) {
                    return String(this.port);
                }
                if (this.protocol && UriPorts[this.protocol]) {
                    return String(UriPorts[this.protocol]);
                }
                return "";

            case "file":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    if (i > 0) {
                        return this.pathname.substr(i);
                    }
                }
                return "";

            case "dir":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    if (i > 0) {
                        return this.pathname.substr(0, i);
                    }
                }
                return "";

            case "ext":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    i = this.pathname.lastIndexOf(".", i);
                    if (i > 0) {
                        return this.pathname.substr(i);
                    }
                }
                return "";

            case "file-ext":
                if (this.pathname) {
                    var i = this.pathname.lastIndexOf("/") + 1;
                    if (i) {
                        var j = this.pathname.lastIndexOf(".", i);
                        if (j > 0) {
                            return this.pathname.substring(i, j);
                        }
                        return this.pathname.substr(i);
                    }
                }
                return "";

            case "fragment":
            case "hash": return String(this.hash || "");
            case "path":
            case "pathname": return String(this.pathname || "");
            case "search":
            case "query": return String(this.search || "");

            default: return this.toString("origin") + this.toString("pathname") + this.toString("search") + this.toString("hash");
        }
    }

    /**
     * Parses the provided uri string
     * @param uri {String} The uri string to parse
     * @returns {Uri} The parsed uri
     */
    public static parse(uri: string): Uri {
        return new Uri(uri);
    }

    /**
     * Combines two uris
     * @param baseUri {Uri} The base uri
     * @param uri {Uri} The relative uri
     * @returns {Uri} The combined uri
     */
    public static combine(baseUri: Uri, uri: Uri): Uri;

    /**
     * Combines two uris
     * @param baseUri {Uri} The base uri
     * @param uri {String} The relative uri
     * @returns {Uri} The combined uri
     */
    public static combine(baseUri: Uri, uri: string): Uri;

    /**
     * Combines two uris
     * @param baseUri {String} The base uri
     * @param uri {Uri} The relative uri
     * @returns {Uri} The combined uri
     */
    public static combine(baseUri: string, uri: Uri): Uri;

    /**
     * Combines two uris
     * @param baseUri {String} The base uri
     * @param uri {String} The relative uri
     * @returns {Uri} The combined uri
     */
    public static combine(baseUri: string, uri: string): Uri;

    public static combine(baseUriAny: any, uriAny: any): Uri {
        return new Uri(baseUriAny, uriAny);
    }
}

symbols.brand("Uri")(Uri);

/**
 * An HTTP request for an HttpClient
 */
export class HttpRequest {

    /**
     * The body of the request   
     * @type {any}
     */
    public body: any;

    /**
     * The HTTP method for the request
     * @type {String}
     */
    public method: string;

    /**
     * The url for the request
     * @type {Uri}
     */
    public url: Uri;

    /**
     * Creates an HTTP request for an HttpClient
     */
    constructor();

    /**
     * Creates an HTTP request for an HttpClient
     * @param method {String} The HTTP method for the request
     * @param url {String} The url for the request
     */
    constructor(method: string, url: string);

    /**
     * Creates an HTTP request for an HttpClient
     * @param method {String} The HTTP method for the request
     * @param url {Uri} The url for the request
     */
    constructor(method: string, url: Uri);

    constructor(method: string = "GET", urlAny: any = null) {
        var data = new lists.Map<string, string>();
        HttpRequestDataSym.set(this, data);
        this.method = method;
        if (urlAny) {
            this.url = symbols.hasBrand(urlAny, Uri) ? urlAny : Uri.parse(urlAny);
        }
    }

    /**
     * Sets the named request header
     * @param key {String} The header name
     * @param value {String} The header value
     */
    public setRequestHeader(key: string, value: string): void {
        var data = HttpRequestDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpRequest)) throw new TypeError("'this' is not an HttpRequest object");

        data.set(key, value);
    }
}

symbols.brand("HttpRequest")(HttpRequest);

/**
 * A response from an HttpClient
 */
export class HttpResponse {

    /**
     * A response from an HttpClient
     */
    constructor() {
        throw new Error("Object doesn't support this action;");
    }

    /**
     * Gets the request for this response
     */
    public get request(): HttpRequest {
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

        return data.request;
    }

    /**
     * Gets the status code of the response
     */
    public get status(): number {
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

        return data.xhr.status;
    }

    /**
     * Gets the status text of the response
     */
    public get statusText(): string {
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

        return data.xhr.statusText;
    }

    /**
     * Gets the response text of the response
     */
    public get responseText(): string {
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

        return data.xhr.responseText;
    }

    /**
     * Gets all of the response heades in a single string
     * @returns {String} A string containing all of the response headers
     */
    public getAllResponseHeaders(): string {
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

        return data.xhr.getAllResponseHeaders();
    }
    
    /**
     * Gets the value for the named response header
     * @param header {String} The name of the header
     * @returns {String} The value for the named header
     */
    public getResponseHeader(header: string): string {      
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

        return data.xhr.getResponseHeader(header);
    }
}

symbols.brand("HttpResponse")(HttpResponse);

/**
 * A client for HTTP requests
 */
export class HttpClient {

    /**
     * The base url for the client
     * @type {Uri}
     */
    public baseUrl: Uri;

    /**
     * A value indicating whether cookies should be sent to a cross-origin request
     * @type {Boolean}
     */
    public withCredentials: boolean;

    /**
     * The number of milliseconds to wait before the request should time out
     * @type {Number}
     */
    public timeout: number;

    /**
     * The username for the request
     * @type {String}
     */
    public username: string;

    /**
     * The password for the request
     * @type {String}
     */
    public password: string;

    /**
     * Creates a client for HTTP requests
     */
    constructor();

    /**
     * Creates a client for HTTP requests
     * @param baseUrl {String} The base url for the client
     */
    constructor(baseUrl: string);

    /**
     * Creates a client for HTTP requests
     * @param baseUrl {Uri} The base url for the client
     */
    constructor(baseUrl: Uri);

    constructor(baseUrlAny?: any) {
        var clientData = new HttpClientData();
        HttpClientDataSym.set(this, clientData);
        
        if (baseUrlAny) {
            this.baseUrl = symbols.hasBrand(baseUrlAny, Uri) ? baseUrlAny : Uri.parse(baseUrlAny);
        }
    }

    /**
     * Closes the client and cancels all pending requests
     */
    public close(): void {
        var data = HttpClientDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpClient)) throw new TypeError("'this' is not an HttpClient object");
        if (data.closed) throw new Error("Object doesn't support this action");

        data.closed = true;
        data.cts.cancel();
        data.cts.close();       
    }

    /**
     * Sets a value for a default request header
     * @param key {String} The request header key
     * @param value {String} The request header value
     */
    public setRequestHeader(key: string, value: string): void {
        var data = HttpClientDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpClient)) throw new TypeError("'this' is not an HttpClient object");
        if (data.closed) throw new Error("Object doesn't support this action");

        data.headers.set(key, value);
    }

    /**
     * Gets the response text from the requested url
     * @param url {String} The url for the request
     * @returns {futures.Future<String>} A future result for the string
     */
    public getStringAsync(url: string): futures.Future<string>;

    /**
     * Gets the response text from the requested url
     * @param url {Uri} The url for the request
     * @returns {futures.Future<String>} A future result for the string
     */
    public getStringAsync(url: Uri): futures.Future<string>;

    public getStringAsync(urlAny: any): futures.Future<string> {
        return this.getAsync(urlAny).then(r => r.responseText);
    }

    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url {String} The url for the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public getAsync(url: string): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url {Uri} The url for the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public getAsync(url: Uri): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url {String} The url for the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public getAsync(url: string, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url {Uri} The url for the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public getAsync(url: Uri, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    public getAsync(urlAny: any, token?: tasks.CancellationToken): futures.Future<HttpResponse> {
        return this.sendAsync(new HttpRequest("GET", urlAny), token);
    }

    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url {String} The url for the request
     * @param body {any} The body of the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postAsync(url: string, body: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url {Uri} The url for the request
     * @param body {any} The body of the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postAsync(url: Uri, body: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url {String} The url for the request
     * @param body {any} The body of the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postAsync(url: string, body: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url {Uri} The url for the request
     * @param body {any} The body of the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postAsync(url: Uri, body: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    public postAsync(urlAny: any, body: any, token?: tasks.CancellationToken): futures.Future<HttpResponse> {
        var request = new HttpRequest("POST", urlAny);
        request.body = body;
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any, jsonReplacer: any[]): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any, jsonReplacer: any[], token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any, jsonReplacer: (key: string, value: any) => any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any, jsonReplacer: (key: string, value: any) => any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any, jsonReplacer: any[]): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any, jsonReplacer: any[], token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any, jsonReplacer: (key: string, value: any) => any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any, jsonReplacer: (key: string, value: any) => any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    public postJsonAsync(urlAny: any, value: any, ...args: any[]): futures.Future<HttpResponse> {
        var argi = 0;
        var jsonReplacerAny: any;
        var token: tasks.CancellationToken;

        if (typeof args[argi] === "function" || Array.isArray(args[argi])) jsonReplacerAny = args[argi++];
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) token = args[argi];

        var request = new HttpRequest("POST", urlAny);
        request.body = JSON.stringify(value, jsonReplacerAny);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url {String} The url for the request
     * @param body {any} The body of the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putAsync(url: string, body: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url {Uri} The url for the request
     * @param body {any} The body of the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putAsync(url: Uri, body: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url {String} The url for the request
     * @param body {any} The body of the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putAsync(url: string, body: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url {Uri} The url for the request
     * @param body {any} The body of the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putAsync(url: Uri, body: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    public putAsync(urlAny: any, body: any, token?: tasks.CancellationToken): futures.Future<HttpResponse> {
        var request = new HttpRequest("PUT", urlAny);
        request.body = body;
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any, jsonReplacer: any[]): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any, jsonReplacer: any[], token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any, jsonReplacer: (key: string, value: any) => any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any, jsonReplacer: (key: string, value: any) => any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any, jsonReplacer: any[]): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any, jsonReplacer: any[], token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any, jsonReplacer: (key: string, value: any) => any): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any, jsonReplacer: (key: string, value: any) => any, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    public putJsonAsync(urlAny: any, value: any, ...args: any[]): futures.Future<HttpResponse> {
        var argi = 0;
        var jsonReplacerAny: any;
        var token: tasks.CancellationToken;

        if (typeof args[argi] === "function" || Array.isArray(args[argi])) jsonReplacerAny = args[argi++];
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) token = args[argi];

        var request = new HttpRequest("PUT", urlAny);
        request.body = JSON.stringify(value, jsonReplacerAny);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url {String} The url for the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public deleteAsync(url: string): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url {Uri} The url for the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public deleteAsync(url: Uri): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url {String} The url for the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public deleteAsync(url: string, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url {Uri} The url for the request
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public deleteAsync(url: Uri, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    public deleteAsync(urlAny: any, token?: tasks.CancellationToken): futures.Future<HttpResponse> {
        return this.sendAsync(new HttpRequest("DELETE", urlAny), token);
    }

    /**
     * Sends the provided request and returns the response
     * @param request {HttpRequest} An HTTP request to send
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public sendAsync(request: HttpRequest): futures.Future<HttpResponse>;

    /**
     * Sends the provided request and returns the response
     * @param request {HttpRequest} An HTTP request to send
     * @param token {tasks.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Future<HttpResponse>} A future result for the response
     */
    public sendAsync(request: HttpRequest, token: tasks.CancellationToken): futures.Future<HttpResponse>;

    public sendAsync(request: HttpRequest, token?: tasks.CancellationToken): futures.Future<HttpResponse> {
        var clientData = HttpClientDataSym.get(this);
        if (!clientData || !symbols.hasBrand(this, HttpClient)) throw new TypeError("'this' is not an HttpClient object");
        if (clientData.closed) throw new Error("Object doesn't support this action");

        if (!symbols.hasBrand(request, HttpRequest)) throw new Error("Invalid argument: request");
        if (!symbols.hasBrand(this.baseUrl, Uri) && !symbols.hasBrand(request.url, Uri)) throw new Error("Invalid argument: request");

        // create a linked token
        var cts = new tasks.CancellationSource(token, clientData.cts.token);
        if (this.timeout > 0) {
            cts.cancelAfter(this.timeout);
        }

        return new futures.Future(resolver => {
            var requestData = HttpRequestDataSym.get(request);
            var xhr = new XMLHttpRequest();
            var response = new HttpResponse();
            var responseData = new HttpResponseData();
            responseData.request = request;
            responseData.xhr = xhr;
            HttpResponseDataSym.set(response, responseData);

            var onload = e => {
                cleanup();
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolver.accept(response);
                }
                else {
                    resolver.reject(response);
                }
            };

            var onerror = e => {
                cleanup();
                resolver.reject(response);
            };

            var cleanup = () => {
                xhr.removeEventListener("load", onload, false);
                xhr.removeEventListener("error", onerror, false);
                cts.token.unregister(handle);
            };

            var handle = cts.token.register(() => {
                cleanup();
                xhr.abort();
            });

            if (this.withCredentials) {
                xhr.withCredentials = true;
            }

            // normalize the uri
            var url: Uri = null;
            if (!request.url) {
                url = this.baseUrl;
            }
            else if (!request.url.absolute) {
                if (!this.baseUrl) throw new Error("Invalid argument: request");
                url = new Uri(this.baseUrl, request.url);
            }
            
            if (url) {
                request.url = url;
            }

            // add the headers from the client
            clientData.headers.forEach((value, key) => { 
                xhr.setRequestHeader(key, value); 
            });

            // add the headers from the request
            requestData.forEach((value, key) => {
                xhr.setRequestHeader(key, value);
            });

            // wire up the events
            xhr.addEventListener("load", onload, false);
            xhr.addEventListener("error", onerror, false);

            // send the request
            xhr.open(request.method, request.url.toString(), true, this.username, this.password);
            xhr.send(request.body);
        }, cts.token);
    }
}

symbols.brand("HttpClient")(HttpClient)

var UriParser = /^((?:(https?:)\/\/)(?:[^:@]*(?:\:[^@]*)?@)?(([a-z\d-\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF\.]+)(?:\:(\d+))?)?)?(?![a-z\d-]+\:)((?:^|\/)[^\?\#]*)?(\?[^#]*)?(#.*)?$/i;
var UriParts = { "protocol": 2, "hostname": 4, "port": 5, "pathname": 6, "search": 7, "hash": 8 };
var UriPorts = { "http:": 80, "https:": 443 };

class HttpResponseData {
    public request: HttpRequest;
    public xhr: XMLHttpRequest;
}

class HttpClientData {
    public headers = new lists.Map<string, string>();
    public cts = new tasks.CancellationSource();
    public closed: boolean;
}

var HttpRequestDataSym = new symbols.Symbol<lists.Map<string, string>>("httpclient.HttpRequestData");
var HttpResponseDataSym = new symbols.Symbol<HttpResponseData>("httpclient.HttpResponseData");
var HttpClientDataSym = new symbols.Symbol<HttpClientData>("httpclient.HttpClientData");