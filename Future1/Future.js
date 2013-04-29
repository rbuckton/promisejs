/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
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
        var future = this._future;
        future._state = "accepted";
        future._result = value;
        this._resolved = true;
        (Future)._dispatch(function () {
            return (Future)._process(future._resolveCallbacks, value);
        }, synchronous);
    };
    FutureResolver.prototype._resolve = function (value, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if(this._resolved) {
            return;
        }
        if(Future.isFuture(value)) {
            var resolve = (Future)._makeFutureCallback(this, "_accept");
            var reject = (Future)._makeFutureCallback(this, "_reject");
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
        var future = this._future;
        future._state = "rejected";
        future._result = value;
        this._resolved = true;
        (Future)._dispatch(function () {
            return (Future)._process(future._rejectCallbacks, value);
        }, synchronous);
    };
    return FutureResolver;
})();
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
            (this._resolver)._reject(e);
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
            var resolveCallback = Future._makeFutureCallback(resolver, "_accept");
            var rejectCallback = Future._makeFutureCallback(resolver, "_reject");
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
            var rejectCallback = Future._makeFutureCallback(resolver, "_reject");
            values.forEach(function (value, index) {
                var resolveCallback = function (value) {
                    results[index] = value;
                    if(--countdown === 0) {
                        (resolver)._accept(results, true);
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
            var resolveCallback = Future._makeFutureCallback(resolver, "_accept");
            values.forEach(function (value, index) {
                var rejectCallback = function (value) {
                    results[index] = value;
                    if(--countdown === 0) {
                        (resolver)._reject(results, true);
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
        if(Object(value) === value && typeof value.then === "function") {
            return new Future(function (resolver) {
                value.then(resolver.accept, resolver.reject);
            });
        }
        return Future.resolve(value);
    };
    Future.isFuture = function isFuture(value) {
        return value instanceof Future;
    };
    Future.prototype.then = function (resolve, reject) {
        if (typeof resolve === "undefined") { resolve = null; }
        if (typeof reject === "undefined") { reject = null; }
        var _this = this;
        return new Future(function (resolver) {
            var resolveCallback;
            var rejectCallback;
            if(resolve != null) {
                resolveCallback = Future._makeFutureWrapperCallback(resolver, resolve);
            } else {
                resolveCallback = Future._makeFutureCallback(resolver, "_accept");
            }
            if(reject != null) {
                rejectCallback = Future._makeFutureWrapperCallback(resolver, reject);
            } else {
                rejectCallback = Future._makeFutureCallback(resolver, "_reject");
            }
            _this._append(resolveCallback, rejectCallback);
        });
    };
    Future.prototype.catch = function (reject) {
        if (typeof reject === "undefined") { reject = null; }
        var _this = this;
        return new Future(function (resolver) {
            var resolveCallback = function (value) {
                return (resolver)._resolve(value, true);
            };
            ;
            var rejectCallback;
            if(reject != null) {
                rejectCallback = Future._makeFutureWrapperCallback(resolver, reject);
            } else {
                rejectCallback = Future._makeFutureCallback(resolver, "_reject");
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
        var _this = this;
        this._resolveCallbacks.push(resolveCallback);
        this._rejectCallbacks.push(rejectCallback);
        if(this._state === "accepted") {
            Future._dispatch(function () {
                return Future._process(_this._resolveCallbacks, _this._result);
            });
        } else if(this._state === "rejected") {
            Future._dispatch(function () {
                return Future._process(_this._rejectCallbacks, _this._result);
            });
        }
    };
    Future._dispatch = function _dispatch(block, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if(synchronous) {
            block();
        } else {
            if(typeof setImmediate === "function") {
                setImmediate(block);
            } else if(typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function") {
                process.nextTick(block);
            } else {
                if(Future._queue == null) {
                    Future._queue = [];
                }
                Future._queue.push(block);
                if(Future._handle == null) {
                    Future._handle = setInterval(function () {
                        var count = 2;
                        while(Future._queue.length && --count) {
                            var block = Future._queue.shift();
                            block();
                        }
                        if(!Future._queue.length) {
                            clearInterval(Future._handle);
                            Future._handle = null;
                        }
                    }, 0);
                }
            }
        }
    };
    Future._process = function _process(callbacks, result) {
        while(callbacks.length) {
            var callback = callbacks.shift();
            callback(result);
        }
    };
    Future._makeFutureCallback = function _makeFutureCallback(resolver, algorithm) {
        return function (value) {
            resolver[algorithm](value, true);
        };
    };
    Future._makeFutureWrapperCallback = function _makeFutureWrapperCallback(resolver, callback) {
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
    };
    return Future;
})();