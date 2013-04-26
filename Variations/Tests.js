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
            (Future)._process(future._rejectCallbacks, value);
        } else {
            setImmediate(function () {
                return (Future)._process(future._rejectCallbacks, value);
            });
        }
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
            var resolveCallback = function (value) {
                resolver.resolve(value);
            };
            var rejectCallback = function (value) {
                resolver.reject(value);
            };
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
eval(require("fs").readFileSync("Future.js"));
var setImmediate = process.nextTick;
var assert = require("assert");
var tests = [
    function Future_accept_value() {
        Future.accept(1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function Future_accept_Future() {
        var F = Future.accept(1);
        Future.accept(F).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }, 
    function Future_resolve_value() {
        Future.resolve(1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function Future_resolve_Future() {
        var F = Future.accept(1);
        Future.resolve(F).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function Future_resolve_FutureFuture() {
        var FF = Future.accept(Future.accept(1));
        Future.resolve(FF).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function Future_reject_value() {
        Future.reject("error").done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }, 
    function Future_reject_Future() {
        var F = Future.accept("error");
        Future.reject(F).done(assert.ifError, function (e) {
            return assert.equal(e, F);
        });
    }, 
    function FutureResolver_accept_value() {
        new Future(function (resolver) {
            return resolver.accept(1);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function FutureResolver_accept_Future() {
        var F = Future.accept(1);
        new Future(function (resolver) {
            return resolver.accept(F);
        }).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }, 
    function FutureResolver_resolve_value() {
        new Future(function (resolver) {
            return resolver.resolve(1);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function FutureResolver_resolve_Future() {
        var F = Future.accept(1);
        new Future(function (resolver) {
            return resolver.resolve(F);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function FutureResolver_resolve_FutureFuture() {
        var FF = Future.accept(Future.accept(1));
        new Future(function (resolver) {
            return resolver.resolve(FF);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function FutureResolver_reject_value() {
        new Future(function (resolver) {
            return resolver.reject("error");
        }).done(assert.isError, function (e) {
            return assert.equal(e, "error");
        });
    }, 
    function FutureResolver_reject_Future() {
        var F = Future.accept("error");
        new Future(function (resolver) {
            return resolver.reject(F);
        }).done(assert.isError, function (e) {
            return assert.equal(e, F);
        });
    }, 
    function Future_accept_value_then() {
        Future.accept(1).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_accept_value_then_throw() {
        Future.accept(1).then(function (v) {
            throw "error";
        }).done(assert.isError, function (e) {
            return assert.equal(e, "error");
        });
    }, 
    function Future_accept_Future_then() {
        var F = Future.accept(1);
        Future.accept(F).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_accept_FutureFuture_then() {
        var F = Future.accept(Future.accept(1));
        Future.accept(F).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_accept_Future_then_accept() {
        var F = Future.accept(1);
        Future.accept(F).then(function (v) {
            return Future.accept(v);
        }).done(function (v) {
            return assert.equal(v, F);
        }, assert.isError);
    }, 
    function Future_accept_Future_then_resolve() {
        var F = Future.accept(1);
        Future.accept(F).then(function (v) {
            return Future.resolve(v);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_accept_Future_then_reject() {
        var F = Future.accept(1);
        Future.accept(F).then(function (v) {
            return Future.reject("error");
        }).done(assert.isError, function (e) {
            return assert.equal(e, "error");
        });
    }, 
    function Future_resolve_value_then() {
        Future.resolve(1).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_resolve_Future_then() {
        var F = Future.accept(1);
        Future.resolve(F).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_resolve_FutureFuture_then() {
        var F = Future.accept(Future.accept(1));
        Future.resolve(F).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_resolve_Future_then_accept() {
        var F = Future.accept(1);
        Future.resolve(F).then(function (v) {
            return Future.accept(v);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_resolve_Future_then_resolve() {
        var F = Future.accept(1);
        Future.resolve(F).then(function (v) {
            return Future.resolve(v);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function Future_resolve_Future_then_reject() {
        var F = Future.accept(1);
        Future.resolve(F).then(function (v) {
            return Future.reject("error");
        }).done(assert.isError, function (e) {
            return assert.equal(e, "error");
        });
    }, 
    function Future_reject_value_then_resolve() {
        Future.reject("error").then(null, function (e) {
            return 1;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.isError);
    }, 
    function any_accept1_reject1() {
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future.any(F0, F1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function any_reject1_accept1() {
        var F0 = Future.reject("error");
        var F1 = Future.accept(1);
        Future.any(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }, 
    function any_reject2() {
        var F0 = Future.reject("error0");
        var F1 = Future.reject("error1");
        Future.any(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error0");
        });
    }, 
    function any_accept2() {
        var F0 = Future.accept(1);
        var F1 = Future.accept(2);
        Future.any(F0, F1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function any_none() {
        Future.any().done(function (v) {
            return assert.ok(v === undefined);
        }, assert.ifError);
    }, 
    function some_accept1_reject1() {
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future.some(F0, F1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function some_reject1_accept1() {
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future.some(F1, F0).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }, 
    function some_reject2() {
        var F0 = Future.reject("error0");
        var F1 = Future.reject("error1");
        Future.some(F1, F0).done(assert.ifError, function (e) {
            return assert.ok(Array.isArray(e) && e[0] == "error0" && e[1] == "error1");
        });
    }, 
    function some_none() {
        Future.some().done(function (v) {
            return assert.ok(v === undefined);
        }, assert.ifError);
    }, 
    function every_accept1_reject1() {
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future.every(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }, 
    function every_accept2() {
        var F0 = Future.accept(1);
        var F1 = Future.accept(2);
        Future.every(F0, F1).done(function (v) {
            return assert.ok(Array.isArray(v) && v[0] == 1 && v[1] == 2);
        }, assert.ifError);
    }, 
    function every_reject2() {
        var F0 = Future.reject("error0");
        var F1 = Future.reject("error1");
        Future.every(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error0");
        });
    }, 
    function every_none() {
        Future.every().done(function (v) {
            return assert.ok(v === undefined);
        }, assert.ifError);
    }];
var count = 0;
var failed = 0;
tests.forEach(function (test) {
    count++;
    var domain = require("domain").create();
    domain.on("error", function (e) {
        failed++;
        console.error("Test failed: %s. Message: %s", (test).name, e);
    });
    domain.run(test);
});
process.on("exit", function () {
    console.log("done. succeeded: %s, failed: %s", count - failed, failed);
});