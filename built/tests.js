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
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        __.prototype = b.prototype;
        d.prototype = new __();
    };
    var events = require("events");
    
    var domain = require("domain");
    var tests_promises = require("./tests.promises");
    var tests_httpclient = require("./tests.httpclient");
    
    var _tests_promises = tests_promises.name, _tests_httpclient = tests_httpclient.name;
    
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
            this.started = 0;
            this.completed = 0;
            this.passed = 0;
            this.failed = 0;
            this.testCases = tests.reduce(function (list, module) {
                return list.concat(Object.getOwnPropertyNames(module).map(function (name) {
                    return module[name];
                }).filter(function (test) {
                    return typeof test === "function";
                }));
            }, []).map(function (test) {
                var testCase = new TestCase(test);
                testCase.on("start", function () {
                    _this.started++;
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
            this.requested = this.testCases.length;
            this.testCases.forEach(function (testCase) {
                return testCase.run();
            });
        };
    
        TestRun.prototype.done = function () {
            console.log("\r\n%sdone. succeeded: %s, failed: %s, total: %s\r\n", this.errors.concat("").join("\r\n"), this.passed, this.failed, this.requested);
        };
    
        TestRun.run = function (tests) {
            var list = new TestRun(tests);
            list.run();
        };
        return TestRun;
    })();
    
    TestRun.run([tests_promises, tests_httpclient]);
}, this);