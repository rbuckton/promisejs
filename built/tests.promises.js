/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./promises"], definition);
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
            }, global["tests.promises"] = { });
    }
})
(function (require, exports) {
    var promises = require("./promises");
    var assert = require("assert");
    
    exports.name = "tests.promises";
    
    function Future_accept_value() {
        promises.Promise.fulfill(1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_accept_value = Future_accept_value;
    
    function Future_accept_Future() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.fulfill(F).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.Future_accept_Future = Future_accept_Future;
    
    function Future_resolve_value() {
        promises.Promise.resolve(1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_resolve_value = Future_resolve_value;
    
    function Future_resolve_Future() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.resolve(F).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_resolve_Future = Future_resolve_Future;
    
    function Future_resolve_FutureFuture() {
        var F = promises.Promise.fulfill(1);
        var FF = promises.Promise.fulfill(F);
        promises.Promise.resolve(FF).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.Future_resolve_FutureFuture = Future_resolve_FutureFuture;
    
    function Future_reject_value() {
        promises.Promise.reject("error").done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }
    exports.Future_reject_value = Future_reject_value;
    
    function Future_reject_Future() {
        var F = promises.Promise.fulfill("error");
        promises.Promise.reject(F).done(assert.ifError, function (e) {
            return assert.equal(e, F);
        });
    }
    exports.Future_reject_Future = Future_reject_Future;
    
    function FutureResolver_accept_value() {
        new promises.Promise(function (resolver) {
            return resolver.fulfill(1);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.FutureResolver_accept_value = FutureResolver_accept_value;
    
    function FutureResolver_accept_Future() {
        var F = promises.Promise.fulfill(1);
        new promises.Promise(function (resolver) {
            return resolver.fulfill(F);
        }).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.FutureResolver_accept_Future = FutureResolver_accept_Future;
    
    function FutureResolver_resolve_value() {
        new promises.Promise(function (resolver) {
            return resolver.resolve(1);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.FutureResolver_resolve_value = FutureResolver_resolve_value;
    
    function FutureResolver_resolve_Future() {
        var F = promises.Promise.fulfill(1);
        new promises.Promise(function (resolver) {
            return resolver.resolve(F);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.FutureResolver_resolve_Future = FutureResolver_resolve_Future;
    
    function FutureResolver_resolve_FutureFuture() {
        var F = promises.Promise.fulfill(1);
        var FF = promises.Promise.fulfill(F);
        new promises.Promise(function (resolver) {
            return resolver.resolve(FF);
        }).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.FutureResolver_resolve_FutureFuture = FutureResolver_resolve_FutureFuture;
    
    function FutureResolver_reject_value() {
        new promises.Promise(function (resolver) {
            return resolver.reject("error");
        }).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }
    exports.FutureResolver_reject_value = FutureResolver_reject_value;
    
    function FutureResolver_reject_Future() {
        var F = promises.Promise.fulfill("error");
        new promises.Promise(function (resolver) {
            return resolver.reject(F);
        }).done(assert.ifError, function (e) {
            return assert.equal(e, F);
        });
    }
    exports.FutureResolver_reject_Future = FutureResolver_reject_Future;
    
    function Future_accept_value_then() {
        promises.Promise.fulfill(1).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_accept_value_then = Future_accept_value_then;
    
    function Future_accept_value_then_throw() {
        promises.Promise.fulfill(1).then(function (v) {
            throw "error";
        }).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }
    exports.Future_accept_value_then_throw = Future_accept_value_then_throw;
    
    function Future_accept_Future_then_none() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.fulfill(F).then().done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.Future_accept_Future_then_none = Future_accept_Future_then_none;
    
    function Future_accept_Future_then_idish() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.fulfill(F).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_accept_Future_then_idish = Future_accept_Future_then_idish;
    
    function Future_accept_FutureFuture_then() {
        var F = promises.Promise.fulfill(1);
        var FF = promises.Promise.fulfill(F);
        promises.Promise.fulfill(FF).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.Future_accept_FutureFuture_then = Future_accept_FutureFuture_then;
    
    function Future_accept_Future_then_accept() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.fulfill(F).then(function (v) {
            return promises.Promise.fulfill(v);
        }).done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.Future_accept_Future_then_accept = Future_accept_Future_then_accept;
    
    function Future_accept_Future_then_resolve() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.fulfill(F).then(function (v) {
            return promises.Promise.resolve(v);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_accept_Future_then_resolve = Future_accept_Future_then_resolve;
    
    function Future_accept_Future_then_reject() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.fulfill(F).then(function (v) {
            return promises.Promise.reject("error");
        }).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }
    exports.Future_accept_Future_then_reject = Future_accept_Future_then_reject;
    
    function Future_resolve_value_then() {
        promises.Promise.resolve(1).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_resolve_value_then = Future_resolve_value_then;
    
    function Future_resolve_Future_then() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.resolve(F).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_resolve_Future_then = Future_resolve_Future_then;
    
    function Future_resolve_FutureFuture_then() {
        var F = promises.Promise.fulfill(promises.Promise.fulfill(1));
        promises.Promise.resolve(F).then(function (v) {
            return v;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_resolve_FutureFuture_then = Future_resolve_FutureFuture_then;
    
    function Future_resolve_Future_then_accept() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.resolve(F).then(function (v) {
            return promises.Promise.fulfill(v);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_resolve_Future_then_accept = Future_resolve_Future_then_accept;
    
    function Future_resolve_Future_then_resolve() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.resolve(F).then(function (v) {
            return promises.Promise.resolve(v);
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_resolve_Future_then_resolve = Future_resolve_Future_then_resolve;
    
    function Future_resolve_Future_then_reject() {
        var F = promises.Promise.fulfill(1);
        promises.Promise.resolve(F).then(function (v) {
            return promises.Promise.reject("error");
        }).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }
    exports.Future_resolve_Future_then_reject = Future_resolve_Future_then_reject;
    
    function Future_reject_value_then_resolve() {
        promises.Promise.reject("error").then(null, function (e) {
            return 1;
        }).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.Future_reject_value_then_resolve = Future_reject_value_then_resolve;
    
    function any_accept1_reject1() {
        var F0 = promises.Promise.fulfill(1);
        var F1 = promises.Promise.reject("error");
        promises.Promise.any(F0, F1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.any_accept1_reject1 = any_accept1_reject1;
    
    function any_reject1_accept1() {
        var F0 = promises.Promise.reject("error");
        var F1 = promises.Promise.fulfill(1);
        promises.Promise.any(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }
    exports.any_reject1_accept1 = any_reject1_accept1;
    
    function any_reject2() {
        var F0 = promises.Promise.reject("error0");
        var F1 = promises.Promise.reject("error1");
        promises.Promise.any(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error0");
        });
    }
    exports.any_reject2 = any_reject2;
    
    function any_accept2() {
        var F0 = promises.Promise.fulfill(1);
        var F1 = promises.Promise.fulfill(2);
        promises.Promise.any(F0, F1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.any_accept2 = any_accept2;
    
    function any_none() {
        promises.Promise.any().done(function (v) {
            return assert.ok(v === undefined);
        }, assert.ifError);
    }
    exports.any_none = any_none;
    
    function some_accept1_reject1() {
        var F0 = promises.Promise.fulfill(1);
        var F1 = promises.Promise.reject("error");
        promises.Promise.some(F0, F1).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.some_accept1_reject1 = some_accept1_reject1;
    
    function some_reject1_accept1() {
        var F0 = promises.Promise.fulfill(1);
        var F1 = promises.Promise.reject("error");
        promises.Promise.some(F1, F0).done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.some_reject1_accept1 = some_reject1_accept1;
    
    function some_reject2() {
        var F0 = promises.Promise.reject("error0");
        var F1 = promises.Promise.reject("error1");
        promises.Promise.some(F0, F1).done(assert.ifError, function (e) {
            assert.ok(Array.isArray(e), "not array");
            assert.equal(e[0], "error0");
            assert.equal(e[1], "error1");
        });
    }
    exports.some_reject2 = some_reject2;
    
    function some_none() {
        promises.Promise.some().done(function (v) {
            return assert.ok(v === undefined);
        }, assert.ifError);
    }
    exports.some_none = some_none;
    
    function every_accept1_reject1() {
        var F0 = promises.Promise.fulfill(1);
        var F1 = promises.Promise.reject("error");
        promises.Promise.every(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error");
        });
    }
    exports.every_accept1_reject1 = every_accept1_reject1;
    
    function every_accept2() {
        var F0 = promises.Promise.fulfill(1);
        var F1 = promises.Promise.fulfill(2);
        promises.Promise.every(F0, F1).done(function (v) {
            return assert.ok(Array.isArray(v) && v[0] == 1 && v[1] == 2);
        }, assert.ifError);
    }
    exports.every_accept2 = every_accept2;
    
    function every_reject2() {
        var F0 = promises.Promise.reject("error0");
        var F1 = promises.Promise.reject("error1");
        promises.Promise.every(F0, F1).done(assert.ifError, function (e) {
            return assert.equal(e, "error0");
        });
    }
    exports.every_reject2 = every_reject2;
    
    function every_none() {
        promises.Promise.every().done(function (v) {
            return assert.ok(v === undefined);
        }, assert.ifError);
    }
    exports.every_none = every_none;
    
    function FutureFutureFuture_then_then_done() {
        var F = promises.Promise.fulfill(1);
        var FF = promises.Promise.fulfill(F);
        var FFF = promises.Promise.fulfill(FF);
        FFF.then().then().done(function (v) {
            return assert.equal(v, FF);
        }, assert.ifError);
    }
    exports.FutureFutureFuture_then_then_done = FutureFutureFuture_then_then_done;
    
    function FutureForThenable_accept() {
        var T = { then: function () {
                assert.ok(false, "should not be called");
            } };
        var F = promises.Promise.fulfill(T);
        F.done(function (v) {
            return assert.equal(v, T);
        }, assert.ifError);
    }
    exports.FutureForThenable_accept = FutureForThenable_accept;
    
    function FutureForThenable_resolve() {
        var T = { then: function () {
                assert.ok(false, "should not be called");
            } };
        var F = promises.Promise.resolve(T);
        F.done(function (v) {
            return assert.equal(v, T);
        }, assert.ifError);
    }
    exports.FutureForThenable_resolve = FutureForThenable_resolve;
    
    function FutureForAssimilatedThenable_accept() {
        var T = { then: function (resolve, reject) {
                resolve(1);
            } };
        var F = promises.Promise.from(T);
        var FF = promises.Promise.fulfill(F);
        FF.done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.FutureForAssimilatedThenable_accept = FutureForAssimilatedThenable_accept;
    
    function FutureForAssimilatedThenable_resolve() {
        var T = { then: function (resolve, reject) {
                resolve(1);
            } };
        var F = promises.Promise.from(T);
        var FF = promises.Promise.resolve(F);
        FF.done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.FutureForAssimilatedThenable_resolve = FutureForAssimilatedThenable_resolve;
    
    function FutureForAssimilatedNestedThenable_accept() {
        var T1 = { then: function (resolve, reject) {
                resolve(1);
            } };
        var T2 = { then: function (resolve, reject) {
                resolve(T1);
            } };
        var F = promises.Promise.from(T2);
        var FF = promises.Promise.fulfill(F);
        FF.done(function (v) {
            return assert.equal(v, F);
        }, assert.ifError);
    }
    exports.FutureForAssimilatedNestedThenable_accept = FutureForAssimilatedNestedThenable_accept;
    
    function FutureForAssimilatedNestedThenable_resolve() {
        var T1 = { then: function (resolve, reject) {
                resolve(1);
            } };
        var T2 = { then: function (resolve, reject) {
                resolve(T1);
            } };
        var F = promises.Promise.from(T2);
        var FF = promises.Promise.resolve(F);
        FF.done(function (v) {
            return assert.equal(v, 1);
        }, assert.ifError);
    }
    exports.FutureForAssimilatedNestedThenable_resolve = FutureForAssimilatedNestedThenable_resolve;
}, this);