/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", './symbols'], definition);
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
            }, global["Future2/futures"] = { });
    }
})
(function (require, exports) {
    var symbols = require('./symbols')
    var Symbol = symbols.Symbol;
    var __FutureResolverData__ = new Symbol();
    var __FutureData__ = new Symbol();
    var __Brand__ = new Symbol("Brand");
    var FutureData = (function () {
        function FutureData(future, resolver) {
            this.resolved = false;
            this.state = "pending";
            this.resolveCallbacks = [];
            this.rejectCallbacks = [];
            this.future = future;
            this.resolver = resolver;
        }
        FutureData.prototype.accept = function (value, synchronous) {
            if(this.resolved) {
                return;
            }
            this.state = "accepted";
            this.result = value;
            this.resolved = true;
            Process(this.resolveCallbacks, value, synchronous);
        };
        FutureData.prototype.resolve = function (value, synchronous) {
            var _this = this;
            if(this.resolved) {
                return;
            }
            if(Future.isFuture(value)) {
                var resolve = function (value) {
                    return _this.accept(value, true);
                };
                var reject = function (value) {
                    return _this.reject(value, true);
                };
                try  {
                    value.done(resolve, reject);
                } catch (e) {
                    this.reject(e, synchronous);
                }
                return;
            }
            this.accept(value, synchronous);
        };
        FutureData.prototype.reject = function (value, synchronous) {
            if(this.resolved) {
                return;
            }
            this.state = "rejected";
            this.result = value;
            this.resolved = true;
            Process(this.rejectCallbacks, value, synchronous);
        };
        FutureData.prototype.append = function (resolveCallback, rejectCallback) {
            if(typeof resolveCallback === "function") {
                this.resolveCallbacks.push(resolveCallback);
            }
            if(typeof rejectCallback === "function") {
                this.rejectCallbacks.push(rejectCallback);
            }
            if(this.state === "accepted") {
                Process(this.resolveCallbacks, this.result);
            } else if(this.state === "rejected") {
                Process(this.rejectCallbacks, this.result);
            }
        };
        FutureData.prototype.wrapCallback = function (callback) {
            var _this = this;
            return function (argument) {
                var value;
                try  {
                    value = callback.call(_this.future, argument);
                } catch (e) {
                    _this.reject(e, true);
                    return;
                }
                _this.resolve(value, true);
            };
        };
        return FutureData;
    })();
    var FutureResolver = (function () {
        function FutureResolver() {
            throw new TypeError("Object doesn't support this action");
        }
        FutureResolver.prototype.accept = function (value) {
            var data = __FutureResolverData__.get(this);
            if(!data) {
                throw new TypeError("'this' is not a FutureResolver object");
            }
            data.accept(value);
        };
        FutureResolver.prototype.resolve = function (value) {
            var data = __FutureResolverData__.get(this);
            if(!data) {
                throw new TypeError("'this' is not a FutureResolver object");
            }
            data.resolve(value);
        };
        FutureResolver.prototype.reject = function (value) {
            var data = __FutureResolverData__.get(this);
            if(!data) {
                throw new TypeError("'this' is not a FutureResolver object");
            }
            data.reject(value);
        };
        return FutureResolver;
    })();
    exports.FutureResolver = FutureResolver;
    var Future = (function () {
        function Future(init) {
            if(init == null) {
                throw new Error("Argument missing: init");
            }
            var resolver = Object.create(FutureResolver.prototype);
            var data = new FutureData(this, resolver);
            __FutureResolverData__.set(resolver, data);
            __FutureData__.set(this, data);
            __Brand__.set(this, "Future");
            resolver.accept = resolver.accept.bind(resolver);
            resolver.resolve = resolver.resolve.bind(resolver);
            resolver.reject = resolver.reject.bind(resolver);
            try  {
                init.call(this, resolver);
            } catch (e) {
                data.reject(e);
            }
        }
        Future.accept = function accept(value) {
            return new Future(function (resolver) {
                resolver.accept(value);
            });
        };
        Future.resolve = function resolve(value) {
            return new Future(function (resolver) {
                resolver.resolve(value);
            });
        };
        Future.reject = function reject(value) {
            return new Future(function (resolver) {
                resolver.reject(value);
            });
        };
        Future.any = function any() {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if(!data) {
                    throw new TypeError("'this' is not a FutureResolver object");
                }
                var resolveCallback = function (value) {
                    return data.accept(value, true);
                };
                var rejectCallback = function (value) {
                    return data.reject(value, true);
                };
                if(values.length <= 0) {
                    resolver.accept(undefined);
                } else {
                    values.forEach(function (value) {
                        Future.resolve(value).done(resolveCallback, rejectCallback);
                    });
                }
            });
        };
        Future.every = function every() {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if(!data) {
                    throw new TypeError("'this' is not a FutureResolver object");
                }
                var countdown = values.length;
                var results = new Array(countdown);
                var rejectCallback = function (value) {
                    return data.reject(value, true);
                };
                values.forEach(function (value, index) {
                    var resolveCallback = function (value) {
                        results[index] = value;
                        if(--countdown === 0) {
                            data.accept(results, true);
                        }
                    };
                    Future.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
        Future.some = function some() {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if(!data) {
                    throw new TypeError("'this' is not a FutureResolver object");
                }
                var countdown = values.length;
                var results = new Array(countdown);
                var resolveCallback = function (value) {
                    return data.accept(value, true);
                };
                values.forEach(function (value, index) {
                    var rejectCallback = function (value) {
                        results[index] = value;
                        if(--countdown === 0) {
                            data.reject(results, true);
                        }
                    };
                    Future.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
        Future.from = function from(value) {
            if(Future.isFuture(value)) {
                return value;
            }
            return new Future(function (resolver) {
                var resolve = function (v) {
                    try  {
                        if(Future.isFuture(v)) {
                            v.done(resolver.accept, resolver.reject);
                        } else if(Object(v) === v && typeof v.then === "function") {
                            v.then(resolve, resolver.reject);
                        } else {
                            resolver.accept(v);
                        }
                    } catch (e) {
                        resolver.reject(e);
                    }
                };
                resolve(value);
            });
        };
        Future.isFuture = function isFuture(value) {
            return Object(value) === value && __Brand__.get(value) === "Future";
        };
        Future.prototype.then = function (resolve, reject) {
            if (typeof resolve === "undefined") { resolve = null; }
            if (typeof reject === "undefined") { reject = null; }
            var antecedent = this;
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if(!data) {
                    throw new TypeError("'this' is not a FutureResolver object");
                }
                var resolveCallback;
                var rejectCallback;
                if(resolve != null) {
                    resolveCallback = data.wrapCallback(resolve);
                } else {
                    resolveCallback = function (value) {
                        return data.accept(value, true);
                    };
                }
                if(reject != null) {
                    rejectCallback = data.wrapCallback(reject);
                } else {
                    rejectCallback = function (value) {
                        return data.reject(value, true);
                    };
                }
                antecedent.done(resolveCallback, rejectCallback);
            });
        };
        Future.prototype.catch = function (reject) {
            if (typeof reject === "undefined") { reject = null; }
            var antecedent = this;
            return new Future(function (resolver) {
                var data = __FutureResolverData__.get(resolver);
                if(!data) {
                    throw new TypeError("'this' is not a FutureResolver object");
                }
                var resolveCallback = function (value) {
                    return data.accept(value, true);
                };
                var rejectCallback;
                if(reject != null) {
                    rejectCallback = data.wrapCallback(reject);
                } else {
                    rejectCallback = function (value) {
                        return data.reject(value, true);
                    };
                }
                antecedent.done(resolveCallback, rejectCallback);
            });
        };
        Future.prototype.done = function (resolve, reject) {
            if (typeof resolve === "undefined") { resolve = null; }
            if (typeof reject === "undefined") { reject = null; }
            var data = __FutureData__.get(this);
            if(!data) {
                throw new TypeError("'this' is not a Future object");
            }
            data.append(resolve, reject);
        };
        return Future;
    })();
    exports.Future = Future;
    function Process(callbacks, result, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if(!synchronous) {
            QueueTask(function () {
                return Process(callbacks, result, true);
            });
        } else {
            while(callbacks.length) {
                var callback = callbacks.shift();
                callback(result);
            }
        }
    }
    var QueueTask = typeof setImmediate === "function" ? function (block) {
        setImmediate(block);
    } : typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function" ? function (block) {
        process.nextTick(block);
    } : (function () {
        var queue;
        var handle;
        return function (block) {
            if(queue == null) {
                queue = [];
            }
            queue.push(block);
            if(handle == null) {
                handle = setInterval(function () {
                    var count = 2;
                    while(queue.length && --count) {
                        var block = queue.shift();
                        block();
                    }
                    if(!queue.length) {
                        clearInterval(handle);
                        handle = null;
                    }
                }, 0);
            }
        };
    })();
    if(typeof window !== "undefined" && typeof (window).Future === "undefined") {
        (window).Future = Future;
        (window).FutureResolver = FutureResolver;
    }
}, this);