/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./symbols"], definition);
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
            }, global["httprequest"] = { });
    }
})
(function (require, exports) {
    var symbols = require("./symbols");
    var tasks = require("./tasks");
    var futures = require("./futures");
    var __HttpResponseData__ = new symbols.Symbol("HttpResponseData");
    var __HttpRequestData__ = new symbols.Symbol("HttpRequestData");
    var HttpRequestState;
    (function (HttpRequestState) {
        HttpRequestState._map = [];
        HttpRequestState._map[0] = "opened";
        HttpRequestState.opened = 0;
        HttpRequestState._map[1] = "sending";
        HttpRequestState.sending = 1;
        HttpRequestState._map[2] = "completed";
        HttpRequestState.completed = 2;
        HttpRequestState._map[3] = "canceled";
        HttpRequestState.canceled = 3;
    })(HttpRequestState || (HttpRequestState = {}));
    var HttpRequestData = (function () {
        function HttpRequestData(request, response) {
            this.state = HttpRequestState.opened;
            this.statusFilter = function (code) {
                return code === 200;
            };
            this.xhr = new XMLHttpRequest();
            this.onload = this.onload.bind(this);
            this.onerror = this.onerror.bind(this);
            this.request = request;
            this.response = response;
        }
        HttpRequestData.prototype.send = function (body, resolver, token) {
            var _this = this;
            if (this.state !== HttpRequestState.opened) {
                return;
            }
            this.state = HttpRequestState.sending;
            this.resolver = resolver;
            this.token = token;
            this.xhr.addEventListener("load", this.onload, false);
            this.xhr.addEventListener("error", this.onerror, false);
            if (this.token) {
                this.cancellationHandle = this.token.register(function () {
                    _this.cancel();
                });
            }
            this.xhr.send(body);
        };
        HttpRequestData.prototype.cancel = function () {
            this.cleanup();
            this.state = HttpRequestState.canceled;
            this.xhr.abort();
        };
        HttpRequestData.prototype.onload = function (e) {
            this.cleanup();
            if (this.state !== HttpRequestState.sending) {
                return;
            }
            this.state = HttpRequestState.completed;
            if (!(this.statusFilter && this.statusFilter(this.xhr.status, this.xhr.statusText))) {
                this.resolver.reject(this.response);
            } else {
                this.resolver.accept(this.response);
            }
        };
        HttpRequestData.prototype.onerror = function (e) {
            this.cleanup();
            if (this.state !== HttpRequestState.sending) {
                return;
            }
            this.state = HttpRequestState.completed;
            this.resolver.reject(this.response);
        };
        HttpRequestData.prototype.cleanup = function () {
            this.xhr.removeEventListener("load", this.onload, false);
            this.xhr.removeEventListener("error", this.onerror, false);
            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }
        };
        return HttpRequestData;
    })();
    var HttpResponse = (function () {
        function HttpResponse() {
            throw new TypeError("Object doesn't support this action");
        }
        Object.defineProperty(HttpResponse.prototype, "status", {
            get: function () {
                var data = __HttpResponseData__.get(this);
                if (!data || !symbols.hasBrand(this, HttpResponse)) {
                    throw new TypeError("'this' is not an HttpResponse object");
                }
                return data.xhr.status;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(HttpResponse.prototype, "statusText", {
            get: function () {
                var data = __HttpResponseData__.get(this);
                if (!data || !symbols.hasBrand(this, HttpResponse)) {
                    throw new TypeError("'this' is not an HttpResponse object");
                }
                return data.xhr.statusText;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(HttpResponse.prototype, "responseText", {
            get: function () {
                var data = __HttpResponseData__.get(this);
                if (!data || !symbols.hasBrand(this, HttpResponse)) {
                    throw new TypeError("'this' is not an HttpResponse object");
                }
                return data.xhr.responseText;
            },
            enumerable: true,
            configurable: true
        });
        HttpResponse.prototype.getAllResponseHeaders = function () {
            var data = __HttpResponseData__.get(this);
            if (!data || !symbols.hasBrand(this, HttpResponse)) {
                throw new TypeError("'this' is not an HttpResponse object");
            }
            return data.xhr.getAllResponseHeaders();
        };
        HttpResponse.prototype.getResponseHeader = function (header) {
            var data = __HttpResponseData__.get(this);
            if (!data || !symbols.hasBrand(this, HttpResponse)) {
                throw new TypeError("'this' is not an HttpResponse object");
            }
            return data.xhr.getResponseHeader(header);
        };
        return HttpResponse;
    })();
    exports.HttpResponse = HttpResponse;
    symbols.brand.set(HttpResponse.prototype, "HttpResponse");
    var HttpRequest = (function () {
        function HttpRequest(method, url) {
            var _this = this;
            var args = [];
            for (var _i = 0; _i < (arguments.length - 2); _i++) {
                args[_i] = arguments[_i + 2];
            }
            var argi = 0;
            var options = null;
            var token = null;
            if (!symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                options = args[argi++];
            }
            if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                token = args[argi];
            }
            var response = Object.create(HttpResponse.prototype);
            var data = new HttpRequestData(this, response);
            __HttpResponseData__.set(response, data);
            __HttpRequestData__.set(this, data);
            var username = (options && options.username) || null;
            var password = (options && options.password) || null;
            var headers = (options && options.headers) || null;
            var withCredentials = (options && options.withCredentials) || false;
            var statusFilter = (options && options.statusFilter) || null;
            var xhr = data.xhr;
            if (withCredentials) {
                xhr.withCredentials = withCredentials;
            }
            if (Object(headers) === headers) {
                Object.getOwnPropertyNames(headers).forEach(function (key) {
                    _this.setRequestHeader(key, headers[key]);
                });
            } else if (typeof headers === "string") {
            }
            if (typeof statusFilter === "function") {
                this.statusFilter = statusFilter;
            }
            xhr.open(method, url, true, username, password);
        }
        Object.defineProperty(HttpRequest.prototype, "statusFilter", {
            get: function () {
                var data = __HttpRequestData__.get(this);
                if (!data || !symbols.hasBrand(this, HttpRequest)) {
                    throw new TypeError("'this' is not an HttpRequest object");
                }
                return data.statusFilter;
            },
            set: function (value) {
                var data = __HttpRequestData__.get(this);
                if (!data || !symbols.hasBrand(this, HttpRequest)) {
                    throw new TypeError("'this' is not an HttpRequest object");
                }
                data.statusFilter = value;
            },
            enumerable: true,
            configurable: true
        });
        HttpRequest.prototype.setRequestHeader = function (header, value) {
            var data = __HttpRequestData__.get(this);
            if (!data || !symbols.hasBrand(this, HttpRequest)) {
                throw new TypeError("'this' is not an HttpRequest object");
            }
            data.setRequestHeader(header, value);
        };
        HttpRequest.prototype.send = function (body, token) {
            var data = __HttpRequestData__.get(this);
            if (!data || !symbols.hasBrand(this, HttpRequest)) {
                throw new TypeError("'this' is not an HttpRequest object");
            }
            return new futures.Future(function (resolver) {
                data.send(body, resolver, token);
            }, token);
        };
        HttpRequest.send = function send(method, url) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 2); _i++) {
                args[_i] = arguments[_i + 2];
            }
            var argi = 0;
            var body = null;
            var options = null;
            var token = null;
            if (!symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                body = args[argi++];
                if (!symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                    options = args[argi++];
                }
            }
            if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                token = args[argi];
            }
            var req = new HttpRequest(method, url, options, token);
            return req.send(body, token);
        };
        HttpRequest.get = function get(url) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            return HttpRequest.send("GET", url, null, args[0], args[1]);
        };
        HttpRequest.post = function post(url, body) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 2); _i++) {
                args[_i] = arguments[_i + 2];
            }
            return HttpRequest.send("POST", url, body, args[0], args[1]);
        };
        HttpRequest.put = function put(url, body) {
            if (typeof body === "undefined") { body = null; }
            var args = [];
            for (var _i = 0; _i < (arguments.length - 2); _i++) {
                args[_i] = arguments[_i + 2];
            }
            return HttpRequest.send("PUT", url, body, args[0], args[1]);
        };
        HttpRequest.delete = function delete(url) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            return HttpRequest.send("PUT", url, null, args[0], args[1]);
        };
        return HttpRequest;
    })();
    exports.HttpRequest = HttpRequest;
    symbols.brand.set(HttpRequest.prototype, "HttpRequest");
}, this);