/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports"], definition);
    }
    else if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
        definition(require, module["exports"] || exports);
    }
    else {
        if (!(typeof Future === 'undefined' && typeof FutureResolver === 'undefined')) return;
        definition(null, global);
    }
})
(function (require, exports) {
    var FutureResolver = (function () {
        function FutureResolver() {
            this._resolved = false;
            throw new TypeError("Object doesn't support this action");
        }
        FutureResolver.prototype.accept = function (value) {
            this._accept(value);
        };
        FutureResolver.prototype.resolve = function (value) {
            this._resolve(value);
        };
        FutureResolver.prototype.reject = function (value) {
            this._reject(value);
        };
        FutureResolver.prototype._accept = function (value, synchronous) {
            if (typeof synchronous === "undefined") { synchronous = false; }
            if(this._resolved) {
                return;
            }
            this._future._state = "accepted";
            this._future._result = value;
            this._resolved = true;
            Process(this._future._resolveCallbacks, value, synchronous);
        };
        FutureResolver.prototype._resolve = function (value, synchronous) {
            if (typeof synchronous === "undefined") { synchronous = false; }
            if(this._resolved) {
                return;
            }
            if(Future.isFuture(value)) {
                var resolve = MakeFutureCallback(this, this._accept);
                var reject = MakeFutureCallback(this, this._reject);
                try  {
                    value.done(resolve, reject);
                } catch (e) {
                    this._reject(e, synchronous);
                }
                return;
            }
            this._accept(value, synchronous);
        };
        FutureResolver.prototype._reject = function (value, synchronous) {
            if (typeof synchronous === "undefined") { synchronous = false; }
            if(this._resolved) {
                return;
            }
            this._future._state = "rejected";
            this._future._result = value;
            this._resolved = true;
            Process(this._future._rejectCallbacks, value, synchronous);
        };
        return FutureResolver;
    })();
    exports.FutureResolver = FutureResolver;
    var Future = (function () {
        function Future(init) {
            this._resolveCallbacks = [];
            this._rejectCallbacks = [];
            this._state = "pending";
            if(init == null) {
                throw new Error("Argument missing: init");
            }
            this._resolver = Object.create(FutureResolver.prototype, {
                _future: {
                    value: this
                }
            });
            this._resolver.accept = this._resolver.accept.bind(this._resolver);
            this._resolver.resolve = this._resolver.resolve.bind(this._resolver);
            this._resolver.reject = this._resolver.reject.bind(this._resolver);
            try  {
                init.call(this, this._resolver);
            } catch (e) {
                this._resolver._reject(e);
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
                var resolveCallback = MakeFutureCallback(resolver, resolver._accept);
                var rejectCallback = MakeFutureCallback(resolver, resolver._reject);
                if(values.length <= 0) {
                    resolver.accept(undefined);
                } else {
                    values.forEach(function (value) {
                        Future.resolve(value)._append(resolveCallback, rejectCallback);
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
                var countdown = values.length;
                var results = new Array(countdown);
                var rejectCallback = MakeFutureCallback(resolver, resolver._reject);
                values.forEach(function (value, index) {
                    var resolveCallback = function (value) {
                        results[index] = value;
                        if(--countdown === 0) {
                            resolver._accept(results, true);
                        }
                    };
                    Future.resolve(value)._append(resolveCallback, rejectCallback);
                });
            });
        };
        Future.some = function some() {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var countdown = values.length;
                var results = new Array(countdown);
                var resolveCallback = MakeFutureCallback(resolver, resolver._accept);
                values.forEach(function (value, index) {
                    var rejectCallback = function (value) {
                        results[index] = value;
                        if(--countdown === 0) {
                            resolver._reject(results, true);
                        }
                    };
                    Future.resolve(value)._append(resolveCallback, rejectCallback);
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
            return Object(value) === value && "@Symbol@Brand" in value && value["@Symbol@Brand"] === "Future";
        };
        Future.prototype.then = function (resolve, reject) {
            if (typeof resolve === "undefined") { resolve = null; }
            if (typeof reject === "undefined") { reject = null; }
            var _this = this;
            return new Future(function (resolver) {
                var resolveCallback;
                var rejectCallback;
                if(resolve != null) {
                    resolveCallback = MakeFutureWrapperCallback(resolver, resolve);
                } else {
                    resolveCallback = MakeFutureCallback(resolver, resolver._accept);
                }
                if(reject != null) {
                    rejectCallback = MakeFutureWrapperCallback(resolver, reject);
                } else {
                    rejectCallback = MakeFutureCallback(resolver, resolver._reject);
                }
                _this._append(resolveCallback, rejectCallback);
            });
        };
        Future.prototype.catch = function (reject) {
            if (typeof reject === "undefined") { reject = null; }
            var _this = this;
            return new Future(function (resolver) {
                var resolveCallback = MakeFutureCallback(resolver, resolver._resolve);
                var rejectCallback;
                if(reject != null) {
                    rejectCallback = MakeFutureWrapperCallback(resolver, reject);
                } else {
                    rejectCallback = MakeFutureCallback(resolver, resolver._reject);
                }
                _this._append(resolveCallback, rejectCallback);
            });
        };
        Future.prototype.done = function (resolve, reject) {
            if (typeof resolve === "undefined") { resolve = null; }
            if (typeof reject === "undefined") { reject = null; }
            this._append(resolve, reject);
        };
        Future.prototype._append = function (resolveCallback, rejectCallback) {
            this._resolveCallbacks.push(resolveCallback);
            this._rejectCallbacks.push(rejectCallback);
            if(this._state === "accepted") {
                Process(this._resolveCallbacks, this._result);
            } else if(this._state === "rejected") {
                Process(this._rejectCallbacks, this._result);
            }
        };
        return Future;
    })();
    exports.Future = Future;
    Object.defineProperty(Future.prototype, "@Symbol@Brand", {
        value: "Future"
    });
    function Process(callbacks, result, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if(!synchronous) {
            Dispatch(function () {
                return Process(callbacks, result, true);
            });
        } else {
            while(callbacks.length) {
                var callback = callbacks.shift();
                callback(result);
            }
        }
    }
    function MakeFutureCallback(resolver, algorithm) {
        return function (value) {
            algorithm.call(resolver, value, true);
        };
    }
    function MakeFutureWrapperCallback(resolver, callback) {
        return function (argument) {
            var value;
            try  {
                value = callback.call(resolver._future, argument);
            } catch (e) {
                resolver._reject(e, true);
                return;
            }
            resolver._resolve(value, true);
        };
    }
    var queue;
    var handle;
    function Dispatch(block, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if(synchronous) {
            block();
        } else {
            if(typeof setImmediate === "function") {
                setImmediate(block);
            } else if(typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function") {
                process.nextTick(block);
            } else {
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
            }
        }
    }
}, this);