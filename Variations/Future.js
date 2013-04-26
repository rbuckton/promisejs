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
        if(synchronous) {
            (Future)._process(future._resolveCallbacks, value);
        } else {
            setImmediate(function () {
                return (Future)._process(future._resolveCallbacks, value);
            });
        }
    };
    FutureResolver.prototype._resolve = function (value, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        var _this = this;
        if(this._resolved) {
            return;
        }
        var then = null;
        if(Object(value) === value) {
            then = value.then;
        }
        if(typeof then === "function") {
            var resolve = function (value) {
                _this._resolve(value, true);
            };
            var reject = function (value) {
                _this._reject(value, true);
            };
            try  {
                then.call(value, resolve, reject);
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
        if(synchronous) {
            future._process(future._rejectCallbacks);
        } else {
            setImmediate(function () {
                return future._process(future.rejectCallbacks);
            });
        }
    };
    return FutureResolver;
})();
var Future = (function () {
    function Future(init) {
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
            var resolveCallback = function (value) {
                resolver.resolve(value);
            };
            var rejectCallback = function (value) {
                resolver.reject(value);
            };
            if(values.length <= 0) {
                resolver.resolve(undefined);
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
            var rejectCallback = function (value) {
                resolver.reject(value);
            };
            values.forEach(function (value, index) {
                var resolveCallback = function (value) {
                    results[index] = value;
                    if(--countdown === 0) {
                        (resolver)._resolve(results, true);
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
            var resolveCallback = function (value) {
                resolver.resolve(value);
            };
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
    Future.prototype.then = function (resolve, reject) {
        if (typeof resolve === "undefined") { resolve = null; }
        if (typeof reject === "undefined") { reject = null; }
        var _this = this;
        return new Future(function (resolver) {
            var resolveCallback;
            var rejectCallback;
            if(resolve != null) {
                resolveCallback = Future._makeWrapperCallback(resolver, resolve);
            } else {
                resolveCallback = function (value) {
                    return (resolver)._resolve(value, true);
                };
            }
            if(reject != null) {
                rejectCallback = Future._makeWrapperCallback(resolver, reject);
            } else {
                rejectCallback = function (value) {
                    return (resolver)._reject(value, true);
                };
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
                rejectCallback = Future._makeWrapperCallback(resolver, reject);
            } else {
                rejectCallback = function (value) {
                    return (resolver)._reject(value, true);
                };
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
            setImmediate(function () {
                return Future._process(_this._resolveCallbacks, _this._result);
            });
        } else if(this._state === "rejected") {
            setImmediate(function () {
                return Future._process(_this._rejectCallbacks, _this._result);
            });
        }
    };
    Future._process = function _process(callbacks, result) {
        while(callbacks.length) {
            var callback = callbacks.shift();
            callback(result);
        }
    };
    Future._makeWrapperCallback = function _makeWrapperCallback(resolver, callback) {
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
