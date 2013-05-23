/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./futures"], definition);
    }
    else if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
        definition(require, module["exports"] || exports);
    }
    else {
        definition(
            function (name) { 
                name = String(name)
                    .replace(/^\s+|\s+$/g, "")
                    .replace(/\\+|\/+/g, "/")
                    .replace(/^\.\/|\/\.(\/)/g, "$1");
                return global[name]; 
            }, global["httpclient"] = { });
    }
})
(function (require, exports) {
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
                var baseUri = args[0] instanceof Uri ? args[0] : Uri.parse(args[0]);
                var uri = args[0] instanceof Uri ? args[1] : Uri.parse(args[1]);
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
            var uri = uriAny instanceof Uri ? uriAny : Uri.parse(String(uriAny));
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
    
        Uri.combine = function (baseUri, uri) {
            return new Uri(baseUri, uri);
        };
        return Uri;
    })();
    exports.Uri = Uri;
    
    var HttpRequest = (function () {
        function HttpRequest(method, urlAny) {
            if (typeof method === "undefined") { method = "GET"; }
            if (typeof urlAny === "undefined") { urlAny = null; }
            Object.defineProperty(this, "_headers", { value: Object.create(null) });
            this.method = method;
            if (urlAny) {
                this.url = urlAny instanceof Uri ? urlAny : Uri.parse(urlAny);
            }
        }
        HttpRequest.prototype.setRequestHeader = function (key, value) {
            if (key !== "__proto__") {
                this._headers[key] = value;
            }
        };
        return HttpRequest;
    })();
    exports.HttpRequest = HttpRequest;
    
    var HttpResponse = (function () {
        function HttpResponse(request, xhr) {
            this._request = request;
            this._xhr = xhr;
        }
        Object.defineProperty(HttpResponse.prototype, "request", {
            get: function () {
                return this._request;
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(HttpResponse.prototype, "status", {
            get: function () {
                return this._xhr.status;
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(HttpResponse.prototype, "statusText", {
            get: function () {
                return this._xhr.statusText;
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(HttpResponse.prototype, "responseText", {
            get: function () {
                return this._xhr.responseText;
            },
            enumerable: true,
            configurable: true
        });
    
        HttpResponse.prototype.getAllResponseHeaders = function () {
            return this._xhr.getAllResponseHeaders();
        };
    
        HttpResponse.prototype.getResponseHeader = function (header) {
            return this._xhr.getResponseHeader(header);
        };
        return HttpResponse;
    })();
    exports.HttpResponse = HttpResponse;
    
    var HttpClient = (function () {
        function HttpClient(baseUrl) {
            Object.defineProperties(this, {
                _headers: { value: Object.create(null) },
                _cts: { value: new futures.CancellationSource() },
                _closed: { value: false, writable: true }
            });
    
            if (baseUrl) {
                this.baseUrl = baseUrl instanceof Uri ? baseUrl : Uri.parse(baseUrl);
            }
        }
        HttpClient.prototype.close = function () {
            if (this._closed)
                throw new Error("Object doesn't support this action");
            this._closed = true;
            this._cts.cancel();
            this._cts.close();
        };
    
        HttpClient.prototype.setRequestHeader = function (key, value) {
            if (this._closed)
                throw new Error("Object doesn't support this action");
            if (key !== "__proto__") {
                this._headers[key] = value;
            }
        };
    
        HttpClient.prototype.getStringAsync = function (url) {
            return this.getAsync(url).then(function (r) {
                return r.responseText;
            });
        };
    
        HttpClient.prototype.getAsync = function (url, token) {
            return this.sendAsync(new HttpRequest("GET", url), token);
        };
    
        HttpClient.prototype.postAsync = function (url, body, token) {
            var request = new HttpRequest("POST", url);
            request.body = body;
            return this.sendAsync(request, token);
        };
    
        HttpClient.prototype.postJsonAsync = function (url, value, jsonReplacer, token) {
            var request = new HttpRequest("POST", url);
            request.body = JSON.stringify(value, jsonReplacer);
            request.setRequestHeader("Content-Type", "application/json");
            return this.sendAsync(request, token);
        };
    
        HttpClient.prototype.putAsync = function (url, body, token) {
            var request = new HttpRequest("PUT", url);
            request.body = body;
            return this.sendAsync(request, token);
        };
    
        HttpClient.prototype.putJsonAsync = function (url, value, jsonReplacer, token) {
            var request = new HttpRequest("PUT", url);
            request.body = JSON.stringify(value, jsonReplacer);
            request.setRequestHeader("Content-Type", "application/json");
            return this.sendAsync(request, token);
        };
    
        HttpClient.prototype.deleteAsync = function (url, token) {
            return this.sendAsync(new HttpRequest("DELETE", url), token);
        };
    
        HttpClient.prototype.sendAsync = function (request, token) {
            var _this = this;
            if (this._closed)
                throw new Error("Object doesn't support this action");
    
            var cts = new futures.CancellationSource(token, this._cts.token);
            if (this.timeout > 0) {
                cts.cancelAfter(this.timeout);
            }
    
            var requestHeaders = (request)._headers;
            var clientHeaders = this._headers;
    
            return new futures.Future(function (resolver) {
                var xhr = new XMLHttpRequest();
                var response = new HttpResponse(request, xhr);
    
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
    
                Object.getOwnPropertyNames(clientHeaders).forEach(function (key) {
                    xhr.setRequestHeader(key, clientHeaders[key]);
                });
    
                Object.getOwnPropertyNames(requestHeaders).forEach(function (key) {
                    xhr.setRequestHeader(key, requestHeaders[key]);
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
    
    var UriParser = /^((?:(https?:)\/\/)(?:[^:@]*(?:\:[^@]*)?@)?(([a-z\d-\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF\.]+)(?:\:(\d+))?)?)?(?![a-z\d-]+\:)((?:^|\/)[^\?\#]*)?(\?[^#]*)?(#.*)?$/i;
    var UriParts = { "protocol": 2, "hostname": 4, "port": 5, "pathname": 6, "search": 7, "hash": 8 };
    var UriPorts = { "http:": 80, "https:": 443 };
}, this);