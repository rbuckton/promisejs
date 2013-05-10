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
            }, global["futures"] = { });
    }
})
(function (require, exports) {
    var symbols = require("./symbols");
    var lists = require("./lists");
    var tasks = require("./tasks");
    
    var __FutureResolverData__ = new symbols.Symbol("FutureResolverData@fe75fb24-6707-43b7-9b5d-7dc9fce1d77a");
    var __FutureData__ = new symbols.Symbol("FutureData@da3786b6-9afc-4502-937e-f9d7ceda05ff");
    
    function linkTokens(x, y) {
        if (x) {
            if (y) {
                return new tasks.CancellationSource(x, y).token;
            }
            return x;
        }
        return y;
    }
    
    var FutureState;
    (function (FutureState) {
        FutureState[FutureState["pending"] = 0] = "pending";
    
        FutureState[FutureState["accepted"] = 1] = "accepted";
    
        FutureState[FutureState["rejected"] = 2] = "rejected";
    
        FutureState[FutureState["canceled"] = 3] = "canceled";
    })(FutureState || (FutureState = {}));
    
    var FutureData = (function () {
        function FutureData(future, resolver, token) {
            var _this = this;
            this.resolved = false;
            this.state = FutureState.pending;
            this.future = future;
            this.resolver = resolver;
            this.token = token;
    
            if (this.token) {
                this.cancellationHandle = this.token.register(function () {
                    _this.cancel();
                });
            }
        }
        FutureData.prototype.accept = function (value, synchronous) {
            if (this.resolved) {
                return;
            }
    
            this.state = FutureState.accepted;
            this.result = value;
            this.resolved = true;
    
            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }
    
            this.process(this.resolveCallbacks, value, synchronous);
        };
    
        FutureData.prototype.resolve = function (value, synchronous) {
            var _this = this;
            if (this.resolved) {
                return;
            }
    
            if (value === this.future) {
                throw new TypeError("Future cannot be resolved with itself");
            }
    
            if (Future.isFuture(value)) {
                var resolve = function (value) {
                    return _this.accept(value, true);
                };
                var reject = function (value) {
                    return _this.reject(value, true);
                };
    
                try  {
                    value.done(resolve, reject, this.token);
                } catch (e) {
                    this.reject(e, synchronous);
                }
    
                return;
            }
    
            this.accept(value, synchronous);
        };
    
        FutureData.prototype.reject = function (value, synchronous) {
            if (this.resolved) {
                return;
            }
    
            this.state = FutureState.rejected;
            this.result = value;
            this.resolved = true;
    
            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }
    
            this.process(this.rejectCallbacks, value, synchronous);
        };
    
        FutureData.prototype.cancel = function () {
            if (this.resolved) {
                return;
            }
    
            this.state = FutureState.canceled;
            this.resolved = true;
    
            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }
        };
    
        FutureData.prototype.append = function (resolveCallback, rejectCallback, token) {
            var _this = this;
            if (!(token && token.canceled)) {
                if (typeof resolveCallback === "function") {
                    if (this.resolveCallbacks == null) {
                        this.resolveCallbacks = new lists.LinkedList();
                    }
    
                    var resolveNode = {
                        token: token,
                        value: resolveCallback
                    };
    
                    this.resolveCallbacks.insertAfter(this.resolveCallbacks.tail, resolveNode);
    
                    if (token) {
                        token.register(function () {
                            return _this.resolveCallbacks.remove(resolveNode);
                        });
                    }
                }
    
                if (typeof rejectCallback === "function") {
                    if (this.rejectCallbacks == null) {
                        this.rejectCallbacks = new lists.LinkedList();
                    }
    
                    var rejectNode = {
                        token: token,
                        value: rejectCallback
                    };
    
                    this.rejectCallbacks.insertAfter(this.rejectCallbacks.tail, rejectNode);
    
                    if (token) {
                        token.register(function () {
                            return _this.rejectCallbacks.remove(rejectNode);
                        });
                    }
                }
    
                if (this.state === FutureState.accepted) {
                    this.process(this.resolveCallbacks, this.result, false);
                } else if (this.state === FutureState.rejected) {
                    this.process(this.rejectCallbacks, this.result, false);
                }
            }
        };
    
        FutureData.prototype.wrapCallback = function (callback) {
            var _this = this;
            var wrapper = function (value) {
                try  {
                    value = callback.call(_this.future, value);
                } catch (e) {
                    _this.reject(e, true);
                    return;
                }
    
                _this.resolve(value, true);
            };
    
            return wrapper;
        };
    
        FutureData.prototype.process = function (callbacks, result, synchronous) {
            if (callbacks) {
                while (callbacks.head) {
                    var next = callbacks.head;
                    callbacks.remove(next);
                    var callback = next.value, token = next.token;
                    if (!(token && token.canceled)) {
                        tasks.Dispatcher.current.post((function (callback) {
                            return function () {
                                callback(result);
                            };
                        })(callback), { synchronous: synchronous }, token);
                    }
                }
            }
        };
        return FutureData;
    })();
    
    var FutureResolver = (function () {
        function FutureResolver() {
            throw new TypeError("Object doesn't support this action");
        }
        FutureResolver.prototype.accept = function (value) {
            var data = __FutureResolverData__.get(this);
            if (!data || !symbols.hasBrand(this, FutureResolver))
                throw new TypeError("'this' is not a FutureResolver object");
    
            data.accept(value);
        };
    
        FutureResolver.prototype.resolve = function (value) {
            var data = __FutureResolverData__.get(this);
            if (!data || !symbols.hasBrand(this, FutureResolver))
                throw new TypeError("'this' is not a FutureResolver object");
    
            data.resolve(value);
        };
    
        FutureResolver.prototype.reject = function (value) {
            var data = __FutureResolverData__.get(this);
            if (!data || !symbols.hasBrand(this, FutureResolver))
                throw new TypeError("'this' is not a FutureResolver object");
    
            data.reject(value);
        };
        return FutureResolver;
    })();
    exports.FutureResolver = FutureResolver;
    
    symbols.brand.set(FutureResolver.prototype, "FutureResolver");
    
    var Future = (function () {
        function Future(init, token) {
            if (typeof init !== "function")
                throw new TypeError("Invalid argument: init");
            if (token != null && !symbols.hasBrand(token, tasks.CancellationToken))
                throw new TypeError("Invalid argument: token");
    
            var resolver = Object.create(FutureResolver.prototype);
            var data = new FutureData(this, resolver, token);
            __FutureResolverData__.set(resolver, data);
            __FutureData__.set(this, data);
    
            resolver.accept = resolver.accept.bind(resolver);
            resolver.resolve = resolver.resolve.bind(resolver);
            resolver.reject = resolver.reject.bind(resolver);
    
            try  {
                init.call(this, resolver);
            } catch (e) {
                data.reject(e);
            }
        }
        Future.accept = function (value) {
            return new Future(function (resolver) {
                resolver.accept(value);
            });
        };
    
        Future.resolve = function (value, token) {
            return new Future(function (resolver) {
                resolver.resolve(value);
            }, token);
        };
    
        Future.reject = function (value) {
            return new Future(function (resolver) {
                resolver.reject(value);
            });
        };
    
        Future.any = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if (!data || !symbols.hasBrand(resolver, FutureResolver))
                    throw new TypeError("'this' is not a FutureResolver object");
    
                var resolveCallback = function (value) {
                    return data.accept(value, true);
                };
                var rejectCallback = function (value) {
                    return data.reject(value, true);
                };
    
                if (values.length <= 0) {
                    resolver.accept(void 0);
                } else {
                    values.forEach(function (value) {
                        Future.resolve(value).done(resolveCallback, rejectCallback);
                    });
                }
            });
        };
    
        Future.every = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if (!data || !symbols.hasBrand(resolver, FutureResolver))
                    throw new TypeError("'this' is not a FutureResolver object");
    
                var countdown = values.length;
                var results = new Array(countdown);
                var rejectCallback = function (value) {
                    return data.reject(value, true);
                };
                values.forEach(function (value, index) {
                    var resolveCallback = function (value) {
                        results[index] = value;
                        if (--countdown === 0) {
                            data.accept(results, true);
                        }
                    };
    
                    Future.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
    
        Future.some = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if (!data || !symbols.hasBrand(resolver, FutureResolver))
                    throw new TypeError("'this' is not a FutureResolver object");
    
                var countdown = values.length;
                var results = new Array(countdown);
                var resolveCallback = function (value) {
                    return data.accept(value, true);
                };
                values.forEach(function (value, index) {
                    var rejectCallback = function (value) {
                        results[index] = value;
                        if (--countdown === 0) {
                            data.reject(results, true);
                        }
                    };
    
                    Future.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
    
        Future.from = function (value, token) {
            if (Future.isFuture(value)) {
                return value;
            }
    
            return new Future(function (resolver) {
                var resolve = function (value) {
                    if (!token || !token.canceled) {
                        try  {
                            if (Future.isFuture(value)) {
                                value.done(resolver.accept, resolver.reject);
                            } else if (Object(value) === value && typeof value.then === "function") {
                                value.then(resolve, resolver.reject);
                            } else {
                                resolver.accept(value);
                            }
                        } catch (e) {
                            resolver.reject(e);
                        }
                    }
                };
    
                resolve(value);
            }, token);
        };
    
        Future.isFuture = function (value) {
            return symbols.hasBrand(value, Future);
        };
    
        Future.yield = function (token) {
            return new Future(function (resolver) {
                tasks.Dispatcher.current.post(function () {
                    resolver.resolve(void 0);
                }, { fair: true }, token);
            }, token);
        };
    
        Future.sleep = function (ms) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            var argi = 0;
            var value = void 0;
            var token = null;
    
            if (!symbols.hasBrand(args[argi], tasks.CancellationToken))
                value = args[argi++];
            if (symbols.hasBrand(args[argi], tasks.CancellationToken))
                value = args[argi];
    
            return new Future(function (resolver) {
                tasks.Dispatcher.current.post(function () {
                    resolver.resolve(value);
                }, { delay: ms }, token);
            }, token);
        };
    
        Future.run = function (func) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            var argi = 0;
            var options = null;
            var token = null;
    
            if (typeof args[argi] === "number") {
                options = { delay: args[argi++] };
            }
    
            if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                token = args[argi];
            }
    
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if (!data || !symbols.hasBrand(resolver, FutureResolver))
                    throw new TypeError("'this' is not a FutureResolver object");
    
                tasks.Dispatcher.current.post(function () {
                    try  {
                        data.resolve(func(), true);
                    } catch (e) {
                        data.reject(e, true);
                    }
                }, options, token);
            }, token);
        };
    
        Future.prototype.then = function () {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                args[_i] = arguments[_i + 0];
            }
            var data = __FutureData__.get(this);
            if (!data || !symbols.hasBrand(this, Future))
                throw new TypeError("'this' is not a Future object");
    
            var argi = 0;
            var resolve = null;
            var reject = null;
            var token = null;
    
            if (typeof args[argi] === "function" || args[argi] == null) {
                resolve = args[argi++];
                if (typeof args[argi] === "function" || args[argi] == null) {
                    reject = args[argi++];
                }
            }
            if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                token = args[argi];
            }
    
            token = linkTokens(data.token, token);
    
            return new Future(function (resolver) {
                var resolverData = __FutureResolverData__.get(resolver);
                if (!resolverData || !symbols.hasBrand(resolver, FutureResolver))
                    throw new TypeError("'this' is not a FutureResolver object");
    
                var resolveCallback;
                if (resolve != null) {
                    resolveCallback = resolverData.wrapCallback(resolve);
                } else {
                    resolveCallback = function (value) {
                        resolverData.accept(value, true);
                    };
                }
    
                var rejectCallback;
                if (reject != null) {
                    rejectCallback = resolverData.wrapCallback(reject);
                } else {
                    rejectCallback = function (value) {
                        resolverData.reject(value, true);
                    };
                }
    
                data.append(resolveCallback, rejectCallback, token);
            }, token);
        };
    
        Future.prototype.catch = function (reject, token) {
            var data = __FutureData__.get(this);
            if (!data || !symbols.hasBrand(this, Future))
                throw new TypeError("'this' is not a Future object");
    
            token = linkTokens(data.token, token);
    
            return new Future(function (resolver) {
                var resolverData = __FutureResolverData__.get(resolver);
                if (!resolverData || !symbols.hasBrand(resolver, FutureResolver))
                    throw new TypeError("'this' is not a FutureResolver object");
    
                var resolveCallback = function (value) {
                    resolverData.accept(value, true);
                };
                var rejectCallback;
                if (reject != null) {
                    rejectCallback = resolverData.wrapCallback(reject);
                } else {
                    rejectCallback = function (value) {
                        resolverData.reject(value, true);
                    };
                }
    
                data.append(resolveCallback, rejectCallback, token);
            }, token);
        };
    
        Future.prototype.done = function () {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                args[_i] = arguments[_i + 0];
            }
            var data = __FutureData__.get(this);
            if (!data)
                throw new TypeError("'this' is not a Future object");
    
            var argi = 0;
            var resolve = null;
            var reject = null;
            var token = null;
    
            if (typeof args[argi] === "function" || args[argi] == null) {
                resolve = args[argi++];
                if (typeof args[argi] === "function" || args[argi] == null) {
                    reject = args[argi++];
                }
            }
            if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                token = args[argi];
            }
    
            token = linkTokens(data.token, token);
    
            if (reject == null) {
                reject = function (e) {
                    throw e;
                };
            }
    
            data.append(resolve, reject, token);
        };
        return Future;
    })();
    exports.Future = Future;
    
    symbols.brand.set(Future.prototype, "Future");
    
    if (typeof window !== "undefined" && typeof (window).Future === "undefined") {
        (window).Future = Future;
        (window).FutureResolver = FutureResolver;
        (window).CancellationToken = tasks.CancellationToken;
        (window).CancellationSource = tasks.CancellationSource;
    }
}, this);