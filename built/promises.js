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
        definition(
            function (name) { 
                name = String(name)
                    .replace(/^\s+|\s+$/g, "")
                    .replace(/\\+|\/+/g, "/")
                    .replace(/^\.\/|\/\.(\/)/g, "$1");
                return global[name]; 
            }, global["promises"] = { });
    }
})
(function (require, exports) {
    var Promise = (function () {
        function Promise(init) {
            var resolver = Object.create(PromiseResolver.prototype);
            resolver.fulfill = resolver.fulfill.bind(resolver);
            resolver.resolve = resolver.resolve.bind(resolver);
            resolver.reject = resolver.reject.bind(resolver);
    
            $PromiseCreate(this, resolver);
    
            try  {
                init.call(this, resolver);
            } catch (e) {
                $PromiseReject(this._promiseData, e);
            }
        }
        Promise.fulfill = function (value) {
            return new Promise(function (resolver) {
                resolver.fulfill(value);
            });
        };
    
        Promise.resolve = function (value) {
            return new Promise(function (resolver) {
                resolver.resolve(value);
            });
        };
    
        Promise.reject = function (value) {
            return new Promise(function (resolver) {
                resolver.reject(value);
            });
        };
    
        Promise.any = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Promise(function (resolver) {
                var data = $PromiseGetData(resolver);
                var resolveCallback = function (value) {
                    return $PromiseFulfill(data, value, true);
                };
                var rejectCallback = function (value) {
                    return $PromiseReject(data, value, true);
                };
                if (values.length <= 0) {
                    resolver.fulfill(void 0);
                } else {
                    values.forEach(function (value) {
                        Promise.resolve(value).done(resolveCallback, rejectCallback);
                    });
                }
            });
        };
    
        Promise.every = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Promise(function (resolver) {
                var data = $PromiseGetData(resolver);
                var countdown = values.length;
                var results = new Array(countdown);
                var rejectCallback = function (value) {
                    return $PromiseReject(data, value, true);
                };
                values.forEach(function (value, index) {
                    var resolveCallback = function (value) {
                        results[index] = value;
                        if (--countdown === 0) {
                            $PromiseFulfill(data, results, true);
                        }
                    };
                    Promise.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
    
        Promise.some = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Promise(function (resolver) {
                var data = $PromiseGetData(resolver);
                var countdown = values.length;
                var results = new Array(countdown);
                var resolveCallback = function (value) {
                    return $PromiseFulfill(data, value, true);
                };
                values.forEach(function (value, index) {
                    var rejectCallback = function (value) {
                        results[index] = value;
                        if (--countdown === 0) {
                            $PromiseReject(data, results, true);
                        }
                    };
                    Promise.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
    
        Promise.from = function (value) {
            if (Promise.isPromise(value)) {
                return value;
            }
    
            return new Promise(function (resolver) {
                var resolve = function (value) {
                    try  {
                        if (Promise.isPromise(value)) {
                            value.done(resolver.fulfill, resolver.reject);
                        } else if (Object(value) === value && typeof value.then === "function") {
                            value.then(resolve, resolver.reject);
                        } else {
                            resolver.fulfill(value);
                        }
                    } catch (e) {
                        resolver.reject(e);
                    }
                };
    
                resolve(value);
            });
        };
    
        Promise.isPromise = function (value) {
            return value instanceof Promise;
        };
    
        Promise.prototype.then = function (resolve, reject) {
            var _this = this;
            return new Promise(function (resolver) {
                var resolverData = $PromiseGetData(resolver);
                $PromiseAppend(_this._promiseData, resolve ? $WrapResolveCallback(resolverData, resolve) : function (value) {
                    $PromiseFulfill(resolverData, value, true);
                }, reject ? $WrapResolveCallback(resolverData, reject) : function (value) {
                    $PromiseReject(resolverData, value, true);
                });
            });
        };
    
        Promise.prototype.catch = function (reject) {
            return this.then(null, reject);
        };
    
        Promise.prototype.done = function (resolve, reject) {
            $PromiseAppend(this._promiseData, resolve, reject || function (e) {
                throw e;
            });
        };
        return Promise;
    })();
    exports.Promise = Promise;
    
    var PromiseResolver = (function () {
        function PromiseResolver() {
            throw new TypeError("Object doesn't support this action");
        }
        PromiseResolver.prototype.fulfill = function (value) {
            $PromiseFulfill(this._promiseData, value);
        };
    
        PromiseResolver.prototype.resolve = function (value) {
            $PromiseResolve(this._promiseData, value);
        };
    
        PromiseResolver.prototype.reject = function (value) {
            $PromiseReject(this._promiseData, value);
        };
        return PromiseResolver;
    })();
    exports.PromiseResolver = PromiseResolver;
    
    var PromiseState;
    (function (PromiseState) {
        PromiseState[PromiseState["pending"] = 0] = "pending";
        PromiseState[PromiseState["fulfilled"] = 1] = "fulfilled";
        PromiseState[PromiseState["rejected"] = 2] = "rejected";
    })(PromiseState || (PromiseState = {}));
    
    function $PromiseGetData(promise) {
        return promise._promiseData;
    }
    
    function $PromiseCreate(promise, resolver) {
        var data = {
            promise: promise,
            resolver: resolver,
            state: PromiseState.pending
        };
        Object.defineProperty(promise, "_promiseData", { value: data });
        Object.defineProperty(resolver, "_promiseData", { value: data });
    }
    
    function $PromiseFulfill(data, value, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if (data.state !== PromiseState.pending) {
            return;
        }
    
        data.state = PromiseState.fulfilled;
        data.result = value;
    
        $PromiseProcess(data.resolveCallbacks, value, synchronous);
    }
    
    function $PromiseResolve(data, value, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if (data.state !== PromiseState.pending) {
            return;
        }
    
        if (value === data.promise) {
            throw new TypeError("Promise cannot be resolved with itself");
        }
    
        if (Promise.isPromise(value)) {
            var resolve = function (value) {
                return $PromiseFulfill(data, value, true);
            };
            var reject = function (value) {
                return $PromiseReject(data, value, true);
            };
    
            try  {
                value.done(resolve, reject);
            } catch (e) {
                $PromiseReject(data, e, synchronous);
            }
    
            return;
        }
    
        $PromiseFulfill(data, value, synchronous);
    }
    
    function $PromiseReject(data, value, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if (data.state !== PromiseState.pending) {
            return;
        }
    
        data.state = PromiseState.rejected;
        data.result = value;
    
        $PromiseProcess(data.rejectCallbacks, value, synchronous);
    }
    
    function $PromiseAppend(data, resolveCallback, rejectCallback) {
        if (data.state === PromiseState.pending || data.state === PromiseState.fulfilled) {
            if (typeof resolveCallback === "function") {
                if (data.resolveCallbacks == null) {
                    data.resolveCallbacks = [];
                }
    
                data.resolveCallbacks.push(resolveCallback);
            }
        }
    
        if (data.state === PromiseState.pending || data.state === PromiseState.rejected) {
            if (typeof rejectCallback === "function") {
                if (data.rejectCallbacks == null) {
                    data.rejectCallbacks = [];
                }
    
                data.rejectCallbacks.push(rejectCallback);
            }
        }
    
        if (data.state === PromiseState.fulfilled) {
            $PromiseProcess(data.resolveCallbacks, data.result, false);
        } else if (data.state === PromiseState.rejected) {
            $PromiseProcess(data.rejectCallbacks, data.result, false);
        }
    }
    
    function $PromiseProcess(callbacks, result, synchronous) {
        if (callbacks) {
            var callback;
            while (callback = callbacks.shift()) {
                $SchedulerPostTask(callback.bind(null, result), synchronous);
            }
        }
    }
    
    function $WrapResolveCallback(data, callback) {
        var wrapper = function (value) {
            try  {
                value = callback.call(data.promise, value);
            } catch (e) {
                $PromiseReject(data, e, true);
                return;
            }
    
            $PromiseResolve(data, value, true);
        };
    
        return wrapper;
    }
    
    function $SchedulerPostTask(task, synchronous) {
        if (typeof synchronous === "undefined") { synchronous = false; }
        if (synchronous) {
            try  {
                task();
            } catch (e) {
                $SchedulerPostTask(function () {
                    throw e;
                });
            }
    
            return;
        }
    
        var domain = isNode && process.domain;
        if (domain) {
            task = domain.bind(task);
        }
    
        if (!schedulerNextQueue) {
            schedulerNextQueue = [];
        }
    
        schedulerNextQueue.push(task);
    
        $SchedulerRequestTick();
    }
    
    function $SchedulerRequestTick() {
        if (!schedulerTickRequested) {
            if (!schedulerRequestTickCore) {
                if (typeof setImmediate === "function") {
                    schedulerRequestTickCore = function () {
                        setImmediate($SchedulerTick);
                    };
                } else if (typeof MessageChannel === "function") {
                    schedulerChannel = new MessageChannel();
                    schedulerChannel.port1.onmessage = $SchedulerTick;
                    schedulerRequestTickCore = function () {
                        schedulerChannel.port2.postMessage(null);
                    };
                } else if (isNode) {
                    schedulerRequestTickCore = function () {
                        process.nextTick($SchedulerTick);
                    };
                } else {
                    schedulerRequestTickCore = function () {
                        setTimeout($SchedulerTick);
                    };
                }
            }
    
            schedulerRequestTickCore();
            schedulerTickRequested = true;
        }
    }
    
    function $SchedulerTick() {
        schedulerTickRequested = false;
    
        if (schedulerActiveQueue) {
            try  {
                var task;
                while (task = schedulerActiveQueue.shift()) {
                    task();
                }
            } finally {
                if (schedulerActiveQueue.length) {
                    $SchedulerRequestTick();
                    return;
                }
            }
        }
    
        schedulerActiveQueue = schedulerNextQueue;
        schedulerNextQueue = null;
    
        if (schedulerActiveQueue) {
            $SchedulerRequestTick();
        }
    }
    
    var isNode = typeof process === "object" && Object.prototype.toString.call(process) === "[object process]" && typeof process.nextTick === "function";
    
    var schedulerActiveQueue;
    var schedulerNextQueue;
    var schedulerTickRequested = false;
    var schedulerChannel;
    var schedulerRequestTickCore;
    
    if (typeof window !== "undefined" && typeof (window).Promise === "undefined") {
        (window).Promise = Promise;
        (window).PromiseResolver = PromiseResolver;
    }
}, this);