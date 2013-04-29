/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", './Future'], definition);
    }
    else if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
        definition(require, module["exports"] || exports);
    }
    else {
        definition(function (name) {
            switch (name) {
                case './Future': return global;
            }
            return global[name];
        }, global.Tests = {});
    }
})
(function (require, exports) {
    var __futures__ = require('./Future')
    var Future = __futures__.Future;
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
            var F = Future.accept(1);
            var FF = Future.accept(F);
            Future.resolve(FF).done(function (v) {
                return assert.equal(v, F);
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
            var F = Future.accept(1);
            var FF = Future.accept(F);
            new Future(function (resolver) {
                return resolver.resolve(FF);
            }).done(function (v) {
                return assert.equal(v, F);
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
        function Future_accept_Future_then_none() {
            var F = Future.accept(1);
            Future.accept(F).then().done(function (v) {
                return assert.equal(v, F);
            }, assert.isError);
        }, 
        function Future_accept_Future_then_idish() {
            var F = Future.accept(1);
            Future.accept(F).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.isError);
        }, 
        function Future_accept_FutureFuture_then() {
            var F = Future.accept(1);
            var FF = Future.accept(F);
            Future.accept(FF).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, F);
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
            Future.some(F0, F1).done(assert.ifError, function (e) {
                assert.ok(Array.isArray(e), "not array");
                assert.equal(e[0], "error0");
                assert.equal(e[1], "error1");
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
        }, 
        function FutureFutureFuture_then_then_done() {
            var F = Future.accept(1);
            var FF = Future.accept(F);
            var FFF = Future.accept(FF);
            FFF.then().then().done(function (v) {
                return assert.equal(v, FF);
            }, assert.ifError);
        }, 
        function FutureForThenable_accept() {
            var T = {
                then: function () {
                    assert.ok(false, "should not be called");
                }
            };
            var F = Future.accept(T);
            F.done(function (v) {
                return assert.equal(v, T);
            }, assert.ifError);
        }, 
        function FutureForThenable_resolve() {
            var T = {
                then: function () {
                    assert.ok(false, "should not be called");
                }
            };
            var F = Future.resolve(T);
            F.done(function (v) {
                return assert.equal(v, T);
            }, assert.ifError);
        }, 
        function FutureForAssimilatedThenable_accept() {
            var T = {
                then: function (resolve, reject) {
                    resolve(1);
                }
            };
            var F = Future.from(T);
            var FF = Future.accept(F);
            FF.done(function (v) {
                return assert.equal(v, F);
            }, assert.ifError);
        }, 
        function FutureForAssimilatedThenable_resolve() {
            var T = {
                then: function (resolve, reject) {
                    resolve(1);
                }
            };
            var F = Future.from(T);
            var FF = Future.resolve(F);
            FF.done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }];
    var errors = [];
    var count = 0;
    var failed = 0;
    tests.forEach(function (test) {
        count++;
        var domain = require("domain").create();
        domain.on("error", function (e) {
            failed++;
            errors.push("Test failed: " + (test).name + ". Message:", e.toString(), "");
            process.nextTick(function () {
            });
        });
        domain.run(test);
    });
    process.on("exit", function () {
        console.log("\r\n%sdone. succeeded: %s, failed: %s\r\n", errors.concat("").join("\r\n"), count - failed, failed);
    });
}, this);