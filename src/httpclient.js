var symbols = require("./symbols");
var lists = require("./lists");
var tasks = require("./tasks");
var futures = require("./futures");

var Uri = (function () {
    function Uri() {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            args[_i] = arguments[_i + 0];
        }
        this.protocol = "";
        this.hostname = "";
        this.port = null;
        this.pathname = "";
        this.search = "";
        this.hash = "";
        this.absolute = false;
        if (args.length === 0)
            throw new Error("Argument missing");
        if (args.length === 1) {
            var m = UriParser.exec(args[0]);
            if (!m)
                throw new URIError();

            for (var name in UriParts) {
                var index = UriParts[name];
                var part = m[index];
                if (part) {
                    if (index < 5)
                        part = part.toLowerCase(); else if (index === 5)
                        part = parseInt(part);
                } else {
                    if (index === 5)
                        part = m[1] ? UriPorts[this.protocol] : null;
                }

                this[name] = part;
            }

            this.absolute = !!m[1];
        } else {
            var baseUri = symbols.hasBrand(args[0], Uri) ? args[0] : Uri.parse(args[0]);
            var uri = symbols.hasBrand(args[1], Uri) ? args[1] : Uri.parse(args[1]);
            if (uri.absolute) {
                this.protocol = uri.protocol;
                this.hostname = uri.hostname;
                this.port = uri.port;
                this.pathname = uri.pathname;
                this.search = uri.search;
                this.hash = uri.hash;
                this.absolute = uri.absolute;
            } else {
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
                        } else if (baseUri.pathname) {
                            var parts = baseUri.pathname.split('/');
                            parts[parts.length - 1] = uri.pathname;
                            this.pathname = parts.join('/');
                        }
                    }
                } else {
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
    Object.defineProperty(Uri.prototype, "origin", {
        get: function () {
            return this.toString("origin");
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Uri.prototype, "host", {
        get: function () {
            return this.toString("host");
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Uri.prototype, "scheme", {
        get: function () {
            return this.toString("scheme");
        },
        enumerable: true,
        configurable: true
    });

    Uri.prototype.isSameOrigin = function (uriAny) {
        var uri = symbols.hasBrand(uriAny, Uri) ? uriAny : Uri.parse(String(uriAny));
        if (this.absolute) {
            return this.origin === uri.origin;
        }

        return !uri.absolute;
    };

    Uri.prototype.toString = function (format) {
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

            case "scheme":
                return this.toString("protocol") + "//";
            case "protocol":
                return String(this.protocol || "");
            case "hostname":
                return String(this.hostname || "");
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
                return String(this.hash || "");
            case "path":
            case "pathname":
                return String(this.pathname || "");
            case "search":
            case "query":
                return String(this.search || "");

            default:
                return this.toString("origin") + this.toString("pathname") + this.toString("search") + this.toString("hash");
        }
    };

    Uri.parse = function (uri) {
        return new Uri(uri);
    };

    Uri.combine = function (baseUriAny, uriAny) {
        return new Uri(baseUriAny, uriAny);
    };
    return Uri;
})();
exports.Uri = Uri;

symbols.brand("Uri")(Uri);

var HttpRequest = (function () {
    function HttpRequest(method, urlAny) {
        if (typeof method === "undefined") { method = "GET"; }
        if (typeof urlAny === "undefined") { urlAny = null; }
        var data = new lists.Map();
        HttpRequestDataSym.set(this, data);
        this.method = method;
        if (urlAny) {
            this.url = symbols.hasBrand(urlAny, Uri) ? urlAny : Uri.parse(urlAny);
        }
    }
    HttpRequest.prototype.setRequestHeader = function (key, value) {
        var data = HttpRequestDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpRequest))
            throw new TypeError("'this' is not an HttpRequest object");

        data.set(key, value);
    };
    return HttpRequest;
})();
exports.HttpRequest = HttpRequest;

symbols.brand("HttpRequest")(HttpRequest);

var HttpResponse = (function () {
    function HttpResponse() {
        throw new Error("Object doesn't support this action;");
    }
    Object.defineProperty(HttpResponse.prototype, "request", {
        get: function () {
            var data = HttpResponseDataSym.get(this);
            if (!data || !symbols.hasBrand(this, HttpResponse))
                throw new TypeError("'this' is not an HttpResponse object");

            return data.request;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(HttpResponse.prototype, "status", {
        get: function () {
            var data = HttpResponseDataSym.get(this);
            if (!data || !symbols.hasBrand(this, HttpResponse))
                throw new TypeError("'this' is not an HttpResponse object");

            return data.xhr.status;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(HttpResponse.prototype, "statusText", {
        get: function () {
            var data = HttpResponseDataSym.get(this);
            if (!data || !symbols.hasBrand(this, HttpResponse))
                throw new TypeError("'this' is not an HttpResponse object");

            return data.xhr.statusText;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(HttpResponse.prototype, "responseText", {
        get: function () {
            var data = HttpResponseDataSym.get(this);
            if (!data || !symbols.hasBrand(this, HttpResponse))
                throw new TypeError("'this' is not an HttpResponse object");

            return data.xhr.responseText;
        },
        enumerable: true,
        configurable: true
    });

    HttpResponse.prototype.getAllResponseHeaders = function () {
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse))
            throw new TypeError("'this' is not an HttpResponse object");

        return data.xhr.getAllResponseHeaders();
    };

    HttpResponse.prototype.getResponseHeader = function (header) {
        var data = HttpResponseDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpResponse))
            throw new TypeError("'this' is not an HttpResponse object");

        return data.xhr.getResponseHeader(header);
    };
    return HttpResponse;
})();
exports.HttpResponse = HttpResponse;

symbols.brand("HttpResponse")(HttpResponse);

var HttpClient = (function () {
    function HttpClient(baseUrlAny) {
        var clientData = new HttpClientData();
        HttpClientDataSym.set(this, clientData);

        if (baseUrlAny) {
            this.baseUrl = symbols.hasBrand(baseUrlAny, Uri) ? baseUrlAny : Uri.parse(baseUrlAny);
        }
    }
    HttpClient.prototype.close = function () {
        var data = HttpClientDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpClient))
            throw new TypeError("'this' is not an HttpClient object");
        if (data.closed)
            throw new Error("Object doesn't support this action");

        data.closed = true;
        data.cts.cancel();
        data.cts.close();
    };

    HttpClient.prototype.setRequestHeader = function (key, value) {
        var data = HttpClientDataSym.get(this);
        if (!data || !symbols.hasBrand(this, HttpClient))
            throw new TypeError("'this' is not an HttpClient object");
        if (data.closed)
            throw new Error("Object doesn't support this action");

        data.headers.set(key, value);
    };

    HttpClient.prototype.getStringAsync = function (urlAny) {
        return this.getAsync(urlAny).then(function (r) {
            return r.responseText;
        });
    };

    HttpClient.prototype.getAsync = function (urlAny, token) {
        return this.sendAsync(new HttpRequest("GET", urlAny), token);
    };

    HttpClient.prototype.postAsync = function (urlAny, body, token) {
        var request = new HttpRequest("POST", urlAny);
        request.body = body;
        return this.sendAsync(request, token);
    };

    HttpClient.prototype.postJsonAsync = function (urlAny, value) {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 2); _i++) {
            args[_i] = arguments[_i + 2];
        }
        var argi = 0;
        var jsonReplacerAny;
        var token;

        if (typeof args[argi] === "function" || Array.isArray(args[argi]))
            jsonReplacerAny = args[argi++];
        if (symbols.hasBrand(args[argi], tasks.CancellationToken))
            token = args[argi];

        var request = new HttpRequest("POST", urlAny);
        request.body = JSON.stringify(value, jsonReplacerAny);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    };

    HttpClient.prototype.putAsync = function (urlAny, body, token) {
        var request = new HttpRequest("PUT", urlAny);
        request.body = body;
        return this.sendAsync(request, token);
    };

    HttpClient.prototype.putJsonAsync = function (urlAny, value) {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 2); _i++) {
            args[_i] = arguments[_i + 2];
        }
        var argi = 0;
        var jsonReplacerAny;
        var token;

        if (typeof args[argi] === "function" || Array.isArray(args[argi]))
            jsonReplacerAny = args[argi++];
        if (symbols.hasBrand(args[argi], tasks.CancellationToken))
            token = args[argi];

        var request = new HttpRequest("PUT", urlAny);
        request.body = JSON.stringify(value, jsonReplacerAny);
        request.setRequestHeader("Content-Type", "application/json");
        return this.sendAsync(request, token);
    };

    HttpClient.prototype.deleteAsync = function (urlAny, token) {
        return this.sendAsync(new HttpRequest("DELETE", urlAny), token);
    };

    HttpClient.prototype.sendAsync = function (request, token) {
        var _this = this;
        var clientData = HttpClientDataSym.get(this);
        if (!clientData || !symbols.hasBrand(this, HttpClient))
            throw new TypeError("'this' is not an HttpClient object");
        if (clientData.closed)
            throw new Error("Object doesn't support this action");

        if (!symbols.hasBrand(request, HttpRequest))
            throw new Error("Invalid argument: request");
        if (!symbols.hasBrand(this.baseUrl, Uri) && !symbols.hasBrand(request.url, Uri))
            throw new Error("Invalid argument: request");

        var cts = new tasks.CancellationSource(token, clientData.cts.token);
        if (this.timeout > 0) {
            cts.cancelAfter(this.timeout);
        }

        return new futures.Future(function (resolver) {
            var requestData = HttpRequestDataSym.get(request);
            var xhr = new XMLHttpRequest();
            var response = new HttpResponse();
            var responseData = new HttpResponseData();
            responseData.request = request;
            responseData.xhr = xhr;
            HttpResponseDataSym.set(response, responseData);

            var onload = function (e) {
                cleanup();
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolver.accept(response);
                } else {
                    resolver.reject(response);
                }
            };

            var onerror = function (e) {
                cleanup();
                resolver.reject(response);
            };

            var cleanup = function () {
                xhr.removeEventListener("load", onload, false);
                xhr.removeEventListener("error", onerror, false);
                cts.token.unregister(handle);
            };

            var handle = cts.token.register(function () {
                cleanup();
                xhr.abort();
            });

            if (_this.withCredentials) {
                xhr.withCredentials = true;
            }

            var url = null;
            if (!request.url) {
                url = _this.baseUrl;
            } else if (!request.url.absolute) {
                if (!_this.baseUrl)
                    throw new Error("Invalid argument: request");
                url = new Uri(_this.baseUrl, request.url);
            }

            if (url) {
                request.url = url;
            }

            clientData.headers.forEach(function (value, key) {
                xhr.setRequestHeader(key, value);
            });

            requestData.forEach(function (value, key) {
                xhr.setRequestHeader(key, value);
            });

            xhr.addEventListener("load", onload, false);
            xhr.addEventListener("error", onerror, false);

            xhr.open(request.method, request.url.toString(), true, _this.username, _this.password);
            xhr.send(request.body);
        }, cts.token);
    };
    return HttpClient;
})();
exports.HttpClient = HttpClient;

symbols.brand("HttpClient")(HttpClient);

var UriParser = /^((?:(https?:)\/\/)(?:[^:@]*(?:\:[^@]*)?@)?(([a-z\d-\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF\.]+)(?:\:(\d+))?)?)?(?![a-z\d-]+\:)((?:^|\/)[^\?\#]*)?(\?[^#]*)?(#.*)?$/i;
var UriParts = { "protocol": 2, "hostname": 4, "port": 5, "pathname": 6, "search": 7, "hash": 8 };
var UriPorts = { "http:": 80, "https:": 443 };

var HttpResponseData = (function () {
    function HttpResponseData() {
    }
    return HttpResponseData;
})();

var HttpClientData = (function () {
    function HttpClientData() {
        this.headers = new lists.Map();
        this.cts = new tasks.CancellationSource();
    }
    return HttpClientData;
})();

var HttpRequestDataSym = new symbols.Symbol("httpclient.HttpRequestData");
var HttpResponseDataSym = new symbols.Symbol("httpclient.HttpResponseData");
var HttpClientDataSym = new symbols.Symbol("httpclient.HttpClientData");

