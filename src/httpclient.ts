/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import cancellation = module("cancellation");
import promises = module("promises");

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
            var baseUri: Uri = args[0] instanceof Uri ? args[0] : Uri.parse(args[0]);
            var uri: Uri = args[0] instanceof Uri ? args[1] : Uri.parse(args[1]);
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
        var uri: Uri = uriAny instanceof Uri ? uriAny : Uri.parse(String(uriAny));
        if (this.absolute) {
            return this.origin === uri.origin;
        }

        return !uri.absolute;
    }

    /**
     * Gets the string representation of the Uri
     * @param format {String} A format specifier.
     * @returns {String} The string content of the Uri
     */
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
            case "hash": 
                var hash = String(this.hash || "");
                if (hash.length > 0 && hash.charAt(0) != "#") {
                    return "#" + hash;
                }
                return hash;

            case "path":
            case "pathname": 
                return String(this.pathname || "");

            case "search":
            case "query": 
                var search = String(this.search || "");
                if (search.length > 0 && search.charAt(0) != "?") {
                    return "?" + search;
                }
                return search;

            default: 
                return this.toString("origin") + this.toString("pathname") + this.toString("search") + this.toString("hash");
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

    public static combine(baseUri: any, uri: any): Uri {
        return new Uri(baseUri, uri);
    }
}

export module QueryString {

    var hasOwn = Object.prototype.hasOwnProperty;
    var QueryStringParser = /(?:\?|&|^)([^=&]*)(?:=([^&]*))?/g;

    export function stringify(obj: any): string {
        var qs = [];
        Object.getOwnPropertyNames(obj).forEach(name => {
            var value = obj[name];
            switch (typeof value) {
                case "string":
                case "number":
                case "boolean": {
                    qs.push(encodeURIComponent(name) + "=" + encodeURIComponent(String(value)));
                    return;
                }

                default: {
                    if (Array.isArray(value)) {
                        var ar = <any[]>value;
                        for (var i = 0, n = ar.length; i < n; i++) {
                            switch (typeof ar[i]) {
                                case "string":
                                case "number":
                                case "boolean":
                                    qs.push(encodeURIComponent(name) + "=" + encodeURIComponent(String(value)));
                                    break;

                                default:
                                    qs.push(encodeURIComponent(name) + "=");
                                    break;
                            }
                        }
                    }
                    else {
                        qs.push(encodeURIComponent(name) + "=");
                    }
                }
            }
        });

        if (qs.length) {
            return "?" + qs.join("&");
        }

        return "";
    }

    export function parse(text: string): any {
        var obj: any = {};
        var part: RegExpExecArray;
        while (part = QueryStringParser.exec(text)) {
            var key = decodeURIComponent(part[1]);
            if (key.length && key !== "__proto__") {
                var value = decodeURIComponent(part[2]);
                if (hasOwn.call(obj, key)) {
                    var previous = obj[key];
                    if (Array.isArray(previous)) {
                        var ar = <any[]>previous;
                        ar.push(value);
                    }
                    else {
                        obj[key] = [previous, value];
                    }
                }
                else {
                    obj[key] = value;
                }
            }
        }

        return obj;
    }
}

/**
 * An HTTP request for an HttpClient
 */
export class HttpRequest {
    private _headers: { [key: string]: string; };

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
     * @param method {String} The HTTP method for the request
     * @param url {String} The url for the request
     */
    constructor(method?: string, url?: string);

    /**
     * Creates an HTTP request for an HttpClient
     * @param method {String} The HTTP method for the request
     * @param url {Uri} The url for the request
     */
    constructor(method?: string, url?: Uri);

    constructor(method: string = "GET", urlAny: any = null) {
        Object.defineProperty(this, "_headers", { value: Object.create(null) });
        this.method = method;
        if (urlAny) {
            this.url = urlAny instanceof Uri ? urlAny : Uri.parse(urlAny);
        }
    }

    /**
     * Sets the named request header
     * @param key {String} The header name
     * @param value {String} The header value
     */
    public setRequestHeader(key: string, value: string): void {
        if (key !== "__proto__") {
            this._headers[key] = value;
        }
    }
}

/**
 * A response from an HttpClient
 */
export class HttpResponse {
    private _request: HttpRequest;
    private _xhr: XMLHttpRequest;

    /**
     * A response from an HttpClient
     */
    constructor(request: HttpRequest, xhr: XMLHttpRequest) {
        this._request = request;
        this._xhr = xhr;
    }

    /**
     * Gets the request for this response
     */
    public get request(): HttpRequest {
        return this._request;
    }

    /**
     * Gets the status code of the response
     */
    public get status(): number {
        return this._xhr.status;
    }

    /**
     * Gets the status text of the response
     */
    public get statusText(): string {
        return this._xhr.statusText;
    }

    /**
     * Gets the response text of the response
     */
    public get responseText(): string {
        return this._xhr.responseText;
    }

    /**
     * Gets all of the response heades in a single string
     * @returns {String} A string containing all of the response headers
     */
    public getAllResponseHeaders(): string {
        return this._xhr.getAllResponseHeaders();
    }
    
    /**
     * Gets the value for the named response header
     * @param header {String} The name of the header
     * @returns {String} The value for the named header
     */
    public getResponseHeader(header: string): string {
        return this._xhr.getResponseHeader(header);
    }
}

/**
 * A client for HTTP requests
 */
export class HttpClient {

    private _headers: { [key: string]: string; };
    private _cts: cancellation.CancellationSource;
    private _closed: boolean;

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
     * @param baseUrl {String} The base url for the client
     */
    constructor(baseUrl?: string);

    /**
     * Creates a client for HTTP requests
     * @param baseUrl {Uri} The base url for the client
     */
    constructor(baseUrl?: Uri);

    constructor(baseUrl?: any) {
        Object.defineProperties(this, {
            _headers: { value: Object.create(null) },
            _cts: { value: new cancellation.CancellationSource() },
            _closed: { value: false, writable: true }
        })
                
        if (baseUrl) {
            this.baseUrl = baseUrl instanceof Uri ? baseUrl : Uri.parse(baseUrl);
        }
    }

    /**
     * Closes the client and cancels all pending requests
     */
    public close(): void {
        if (this._closed) throw new Error("Object doesn't support this action");
        this._closed = true;
        this._cts.cancel();
        this._cts.close();       
    }

    /**
     * Sets a value for a default request header
     * @param key {String} The request header key
     * @param value {String} The request header value
     */
    public setRequestHeader(key: string, value: string): void {
        if (this._closed) throw new Error("Object doesn't support this action");
        if (key !== "__proto__") {
            this._headers[key] = value;
        }
    }

    /**
     * Gets the response text from the requested url
     * @param url {String} The url for the request
     * @returns {futures.Promise<String>} A future result for the string
     */
    public getStringAsync(url: string): promises.Promise<string>;

    /**
     * Gets the response text from the requested url
     * @param url {Uri} The url for the request
     * @returns {futures.Promise<String>} A future result for the string
     */
    public getStringAsync(url: Uri): promises.Promise<string>;

    public getStringAsync(url: any): promises.Promise<string> {
        return this.getAsync(url).then(r => r.responseText);
    }

    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url {String} The url for the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public getAsync(url: string, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP GET to the requested url
     * @param url {Uri} The url for the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public getAsync(url: Uri, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    public getAsync(url: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse> {
        return this.sendAsync(new HttpRequest("GET", url), token);
    }

    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url {String} The url for the request
     * @param body {any} The body of the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public postAsync(url: string, body: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST to the requested url
     * @param url {Uri} The url for the request
     * @param body {any} The body of the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public postAsync(url: Uri, body: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    public postAsync(url: any, body: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse> {
        var request = new HttpRequest("POST", url);
        request.body = body;
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any, jsonReplacer?: any[], token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: string, value: any, jsonReplacer?: (key: string, value: any) => any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any, jsonReplacer?: any[], token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP POST of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public postJsonAsync(url: Uri, value: any, jsonReplacer?: (key: string, value: any) => any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    public postJsonAsync(url: any, value: any, jsonReplacer?, token?: cancellation.CancellationToken): promises.Promise<HttpResponse> {
        var request = new HttpRequest("POST", url);
        request.body = JSON.stringify(value, jsonReplacer);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url {String} The url for the request
     * @param body {any} The body of the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public putAsync(url: string, body: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT to the requested url
     * @param url {Uri} The url for the request
     * @param body {any} The body of the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public putAsync(url: Uri, body: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    public putAsync(url: any, body: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse> {
        var request = new HttpRequest("PUT", url);
        request.body = body;
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any, jsonReplacer?: any[], token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {String} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: string, value: any, jsonReplacer?: (key: string, value: any) => any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {any[]} An array of replacements for the JSON serializer
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any, jsonReplacer?: any[], token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP PUT of a JSON serialized value to the requested url
     * @param url {Uri} The url for the request
     * @param value {any} The value to serialize
     * @param jsonReplacer {Function} A callback used to replace values during serialization
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public putJsonAsync(url: Uri, value: any, jsonReplacer?: (key: string, value: any) => any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    public putJsonAsync(url: any, value: any, jsonReplacer?, token?: cancellation.CancellationToken): promises.Promise<HttpResponse> {
        var request = new HttpRequest("PUT", url);
        request.body = JSON.stringify(value, jsonReplacer);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    }

    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url {String} The url for the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public deleteAsync(url: string, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    /**
     * Gets the response from issuing an HTTP DELETE to the requested url
     * @param url {Uri} The url for the request
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public deleteAsync(url: Uri, token?: cancellation.CancellationToken): promises.Promise<HttpResponse>;

    public deleteAsync(url: any, token?: cancellation.CancellationToken): promises.Promise<HttpResponse> {
        return this.sendAsync(new HttpRequest("DELETE", url), token);
    }

    /**
     * Sends the provided request and returns the response
     * @param request {HttpRequest} An HTTP request to send
     * @param token {futures.CancellationToken} A token that can be used to cancel the request
     * @returns {futures.Promise<HttpResponse>} A future result for the response
     */
    public sendAsync(request: HttpRequest, token?: cancellation.CancellationToken): promises.Promise<HttpResponse> {
        if (this._closed) throw new Error("Object doesn't support this action");

        return new promises.Promise<HttpResponse>(resolver => {

            // create a linked token
            var cts = new cancellation.CancellationSource(this._cts.token, token);

            // throw if we're already canceled, the promise will be rejected
            cts.token.throwIfCanceled();

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

            var xhr = new XMLHttpRequest();
            var response = new HttpResponse(request, xhr);
            var requestHeaders = (<any>request)._headers;
            var clientHeaders = this._headers;

            // create the onload callback
            var onload = e => {
                cleanup();

                // catch a cancellation and reject the promise
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    resolver.reject(e);
                    return;
                }
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolver.fulfill(response);
                }
                else {
                    resolver.reject(response);
                }
            };

            // create the onerror callback
            var onerror = e => {
                cleanup();

                // catch a cancellation and reject the promise
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    resolver.reject(e);
                    return;
                }

                resolver.reject(response);
            };

            // register a cleanup phase
            var handle = cts.token.register(() => {
                cleanup();

                // abort the xhr
                xhr.abort();

                // catch a cancellation and reject the promise
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    resolver.reject(e);
                }
            });

            var cleanup = () => {
                xhr.removeEventListener("load", onload, false);
                xhr.removeEventListener("error", onerror, false);
                cts.token.unregister(handle);
            };

            // add the headers from the client
            Object.getOwnPropertyNames(clientHeaders).forEach(key => {
                xhr.setRequestHeader(key, clientHeaders[key]);
            });

            // add the headers from the request
            Object.getOwnPropertyNames(requestHeaders).forEach(key => {
                xhr.setRequestHeader(key, requestHeaders[key]);
            });

            // wire up the events
            xhr.addEventListener("load", onload, false);
            xhr.addEventListener("error", onerror, false);

            // enable credentials if requested
            if (this.withCredentials) {
                xhr.withCredentials = true;
            }

            // attach a timeout
            if (this.timeout > 0) {
                cts.cancelAfter(this.timeout);
                xhr.timeout = this.timeout;
            }

            // send the request
            xhr.open(request.method, request.url.toString(), true, this.username, this.password);
            xhr.send(request.body);
        });
    }

    public getJsonpAsync<T>(url: Uri, callbackArg: string = "callback", noCache: boolean = false, token?: cancellation.CancellationToken): promises.Promise<T>;
    public getJsonpAsync<T>(url: string, callbackArg: string = "callback", noCache: boolean = false, token?: cancellation.CancellationToken): promises.Promise<T>;
    public getJsonpAsync<T>(url: any, callbackArg: string = "callback", noCache: boolean = false, token?: cancellation.CancellationToken): promises.Promise<T> {
        if (this._closed) throw new Error("Object doesn't support this action");

        return new promises.Promise<T>(resolver => {
            // create a linked token
            var cts = new cancellation.CancellationSource(this._cts.token, token);

            // throw if we're already canceled, the promise will be rejected
            cts.token.throwIfCanceled();

            // normalize the uri
            var requestUrl: Uri = null;
            if (!url) {
                requestUrl = this.baseUrl;
            }
            else {
                requestUrl = new Uri(url);
                if (!requestUrl.absolute) {
                    if (!this.baseUrl) throw new Error("Invalid argument: url");
                    requestUrl = new Uri(this.baseUrl, requestUrl);
                }
            }

            var index = jsonpRequestIndex++;
            var name = "__Promise__jsonp__" + index;
            var query = QueryString.parse(requestUrl.search);
            query[callbackArg] = name;
            if (noCache) {
                query["_t"] = Date.now();
            }
            
            requestUrl.search = QueryString.stringify(query);

            var pending = true;
            var head = document.getElementsByTagName("head")[0];
            var script = <HTMLScriptElement>document.createElement("script");
            script.type = "text/javascript";
            script.async = true;
            script.src = requestUrl.toString();
            
            // checks whether the request has been canceled
            var checkCanceled = () => {
                try {
                    cts.token.throwIfCanceled();
                }
                catch (e) {
                    resolver.reject(e);
                    return true;
                }

                return false;
            }

            // waits for the result
            var onload = result => {
                ignore();
                cts.token.unregister(handle);
                if (!checkCanceled()) {
                    resolver.fulfill(result);
                }
            }

            // ignores further calls to fulfill the result
            var ignore = () => {
                pending = false;
                delete window[name];
                disconnect();
            }

            // disconnects the script node
            var disconnect = () => {
                if (script.parentNode) {
                    head.removeChild(script);
                }
            }

            // register a cleanup phase
            var handle = cts.token.register(() => {                
                if (pending) {
                    window[name] = ignore;
                }

                disconnect();
                checkCanceled();
            });
            
            // set a timeout before we no longer care about the result.
            if (this.timeout) {
                cts.cancelAfter(this.timeout);
            }

            window[name] = onload;
            head.appendChild(script);
        });
    }
}

/**
 * An error raised during an http request
 */
export class HttpError implements Error {
    public name: string = "HttpError";

    /**
     * Initializes a new instance of the HttpError class
     * @param httpClient The HttpClient that initiated the request
     * @param response The HttpResponse for the error
     * @param message The message for the error.
     */    
    constructor(
        /**
         * Gets the HttpClient that initiated the request
         */
        public httpClient: HttpClient,

        /**
         * Gets the HttpResponse for the error
         */
        public response: HttpResponse,

        public message: string = "An error occurred while processing your request") {
    }
}

<any>HttpError.prototype = Object.create(Error.prototype);

var UriParser = /^((?:(https?:)\/\/)(?:[^:@]*(?:\:[^@]*)?@)?(([a-z\d-\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF\.]+)(?:\:(\d+))?)?)?(?![a-z\d-]+\:)((?:^|\/)[^\?\#]*)?(\?[^#]*)?(#.*)?$/i;
var UriParts = { "protocol": 2, "hostname": 4, "port": 5, "pathname": 6, "search": 7, "hash": 8 };
var UriPorts = { "http:": 80, "https:": 443 };
var jsonpRequestIndex = 0;