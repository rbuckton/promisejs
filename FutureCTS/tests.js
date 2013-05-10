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
            }, global["tests"] = { });
    }
})
(function (require, exports) {
    var __extends = this.__extends || function (d, b) {
        function __() { this.constructor = d; }
        __.prototype = b.prototype;
        d.prototype = new __();
    };
    var futures = require("./futures");
    var tasks = require("./tasks");
    var events = require("events");
    var assert = require("assert");
    var domain = require("domain");
    var _ = events.EventEmitter;
    var Future = futures.Future;
    var CancellationSource = tasks.CancellationSource;
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
            }).done(assert.ifError, function (e) {
                return assert.equal(e, "error");
            });
        }, 
        function FutureResolver_reject_Future() {
            var F = Future.accept("error");
            new Future(function (resolver) {
                return resolver.reject(F);
            }).done(assert.ifError, function (e) {
                return assert.equal(e, F);
            });
        }, 
        function Future_accept_value_then() {
            Future.accept(1).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_accept_value_then_throw() {
            Future.accept(1).then(function (v) {
                throw "error";
            }).done(assert.ifError, function (e) {
                return assert.equal(e, "error");
            });
        }, 
        function Future_accept_Future_then_none() {
            var F = Future.accept(1);
            Future.accept(F).then().done(function (v) {
                return assert.equal(v, F);
            }, assert.ifError);
        }, 
        function Future_accept_Future_then_idish() {
            var F = Future.accept(1);
            Future.accept(F).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_accept_FutureFuture_then() {
            var F = Future.accept(1);
            var FF = Future.accept(F);
            Future.accept(FF).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, F);
            }, assert.ifError);
        }, 
        function Future_accept_Future_then_accept() {
            var F = Future.accept(1);
            Future.accept(F).then(function (v) {
                return Future.accept(v);
            }).done(function (v) {
                return assert.equal(v, F);
            }, assert.ifError);
        }, 
        function Future_accept_Future_then_resolve() {
            var F = Future.accept(1);
            Future.accept(F).then(function (v) {
                return Future.resolve(v);
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_accept_Future_then_reject() {
            var F = Future.accept(1);
            Future.accept(F).then(function (v) {
                return Future.reject("error");
            }).done(assert.ifError, function (e) {
                return assert.equal(e, "error");
            });
        }, 
        function Future_resolve_value_then() {
            Future.resolve(1).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_resolve_Future_then() {
            var F = Future.accept(1);
            Future.resolve(F).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_resolve_FutureFuture_then() {
            var F = Future.accept(Future.accept(1));
            Future.resolve(F).then(function (v) {
                return v;
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_resolve_Future_then_accept() {
            var F = Future.accept(1);
            Future.resolve(F).then(function (v) {
                return Future.accept(v);
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_resolve_Future_then_resolve() {
            var F = Future.accept(1);
            Future.resolve(F).then(function (v) {
                return Future.resolve(v);
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Future_resolve_Future_then_reject() {
            var F = Future.accept(1);
            Future.resolve(F).then(function (v) {
                return Future.reject("error");
            }).done(assert.ifError, function (e) {
                return assert.equal(e, "error");
            });
        }, 
        function Future_reject_value_then_resolve() {
            Future.reject("error").then(null, function (e) {
                return 1;
            }).done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
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
        }, 
        function FutureForAssimilatedNestedThenable_accept() {
            var T1 = {
                then: function (resolve, reject) {
                    resolve(1);
                }
            };
            var T2 = {
                then: function (resolve, reject) {
                    resolve(T1);
                }
            };
            var F = Future.from(T2);
            var FF = Future.accept(F);
            FF.done(function (v) {
                return assert.equal(v, F);
            }, assert.ifError);
        }, 
        function FutureForAssimilatedNestedThenable_resolve() {
            var T1 = {
                then: function (resolve, reject) {
                    resolve(1);
                }
            };
            var T2 = {
                then: function (resolve, reject) {
                    resolve(T1);
                }
            };
            var F = Future.from(T2);
            var FF = Future.resolve(F);
            FF.done(function (v) {
                return assert.equal(v, 1);
            }, assert.ifError);
        }, 
        function Cancel_Future() {
            var C = new CancellationSource();
            var R;
            var F = new Future(function (resolver) {
                R = resolver;
            }, C.token);
            C.cancel();
            F.done(assert.ifError, assert.ifError);
        }, 
        function Cancel_Future_setTimeout() {
            var C = new CancellationSource();
            var F = new Future(function (resolver) {
                var timerId = setTimeout(function () {
                    resolver.resolve(1);
                    C.token.unregister(handle);
                }, 1);
                var handle = C.token.register(function () {
                    clearTimeout(timerId);
                });
            }, C.token);
            C.cancel();
            F.done(assert.ifError, assert.ifError);
        }];
    var TestCase = (function (_super) {
        __extends(TestCase, _super);
        function TestCase(test) {
            _super.call(this);
            this.requested = 0;
            this.completed = 0;
            this.test = test;
            this.name = (test).name;
        }
        TestCase.prototype.run = function () {
            var _this = this;
            this.domain = domain.create();
            this.domain.on("error", function (e) {
                _this.emit("fail", e);
                _this.emit("done");
            });
            this.domain.run(function () {
                _this.nextTick = process.nextTick;
                process.nextTick = function (task) {
                    _this.requested++;
                    _this.nextTick.call(process, function () {
                        _this.completed++;
                        _this.exec(task);
                    });
                };
                _this.emit("start");
                _this.exec(_this.test);
            });
        };
        TestCase.prototype.exec = function (task) {
            task();
            if (this.completed === this.requested) {
                this.emit("pass");
                this.emit("done");
            }
        };
        return TestCase;
    })(events.EventEmitter);
    var TestRun = (function () {
        function TestRun(tests) {
            var _this = this;
            this.errors = [];
            this.requested = 0;
            this.completed = 0;
            this.passed = 0;
            this.failed = 0;
            this.testCases = tests.map(function (test) {
                var testCase = new TestCase(test);
                testCase.on("start", function () {
                    _this.requested++;
                });
                testCase.on("pass", function () {
                    _this.passed++;
                });
                testCase.on("fail", function (e) {
                    _this.failed++;
                    _this.errors.push("Test failed: " + testCase.name + ". Message:", (e && e.stack) ? e.stack : e, "");
                });
                testCase.on("done", function () {
                    _this.completed++;
                    if (_this.requested === _this.completed) {
                        _this.done();
                    }
                });
                return testCase;
            });
        }
        TestRun.prototype.run = function () {
            this.testCases.forEach(function (testCase) {
                return testCase.run();
            });
        };
        TestRun.prototype.done = function () {
            console.log("\r\n%sdone. succeeded: %s, failed: %s, total: %s\r\n", this.errors.concat("").join("\r\n"), this.passed, this.failed, this.requested);
        };
        TestRun.run = function run(tests) {
            var list = new TestRun(tests);
            list.run();
        };
        return TestRun;
    })();
    TestRun.run(tests);
}, this);