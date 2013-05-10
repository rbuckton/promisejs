/// <reference path="../lib/node.d.ts" />
import futures = module("futures");
import tasks = module("tasks");
import events = module("events");
import assert = module("assert");
import domain = module("domain");

var _ = events.EventEmitter;
var Future = futures.Future;
var CancellationSource = tasks.CancellationSource;

var tests = [
    function Future_accept_value() {
        Future.accept(1).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_accept_Future() {
        var F = Future.accept(1);
        Future.accept(F).done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function Future_resolve_value() {
        Future.resolve(1).done(
            v => assert.equal(v, 1),
            assert.ifError)
    },
    function Future_resolve_Future() {
        var F = Future.accept(1);
        Future.resolve(F).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_resolve_FutureFuture() {
        var F = Future.accept(1);
        var FF = Future.accept(F);
        Future.resolve(FF).done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function Future_reject_value() {
        Future.reject("error").done(
            assert.ifError,
            e => assert.equal(e, "error"));
    },
    function Future_reject_Future() {
        var F = Future.accept("error");
        Future.reject(F).done(
            assert.ifError,
            e => assert.equal(e, F));
    },
    function FutureResolver_accept_value() {
        new Future(resolver => resolver.accept(1)).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function FutureResolver_accept_Future() {
        var F = Future.accept(1);
        new Future(resolver => resolver.accept(F)).done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function FutureResolver_resolve_value() {
        new Future(resolver => resolver.resolve(1)).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function FutureResolver_resolve_Future() {
        var F = Future.accept(1);
        new Future(resolver => resolver.resolve(F)).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function FutureResolver_resolve_FutureFuture() {
        var F = Future.accept(1);
        var FF = Future.accept(F);
        new Future(resolver => resolver.resolve(FF)).done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function FutureResolver_reject_value() {
        new Future(resolver => resolver.reject("error")).done(
            assert.ifError,
            e => assert.equal(e, "error"))
    },
    function FutureResolver_reject_Future() {
        var F = Future.accept("error");
        new Future(resolver => resolver.reject(F)).done(
            assert.ifError,
            e => assert.equal(e, F))
    },
    function Future_accept_value_then() {
        Future.accept(1).then(v => v).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_accept_value_then_throw() {
        Future.accept(1).then(v => { throw "error" }).done(
            assert.ifError,
            e => assert.equal(e, "error"));
    },
    function Future_accept_Future_then_none() {
        var F = Future.accept(1);
        Future.accept(F).then().done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function Future_accept_Future_then_idish() {
        var F = Future.accept(1);
        Future.accept(F).then(v => v).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_accept_FutureFuture_then() {
        var F = Future.accept(1);
        var FF = Future.accept(F);
        Future.accept(FF).then(v => v).done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function Future_accept_Future_then_accept() {
        var F = Future.accept(1);
        Future.accept(F).then(v => Future.accept(v)).done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function Future_accept_Future_then_resolve() {
        var F = Future.accept(1);
        Future.accept(F).then(v => Future.resolve(v)).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_accept_Future_then_reject() {
        var F = Future.accept(1);
        Future.accept(F).then(v => Future.reject("error")).done(
            assert.ifError,
            e => assert.equal(e, "error"));
    },
    function Future_resolve_value_then() {
        Future.resolve(1).then(v => v).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_resolve_Future_then() {
        var F = Future.accept(1);
        Future.resolve(F).then(v => v).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_resolve_FutureFuture_then() {
        var F = Future.accept(Future.accept(1));
        Future.resolve(F).then(v => v).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_resolve_Future_then_accept() {
        var F = Future.accept(1);
        Future.resolve(F).then(v => Future.accept(v)).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_resolve_Future_then_resolve() {
        var F = Future.accept(1);
        Future.resolve(F).then(v => Future.resolve(v)).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_resolve_Future_then_reject() {
        var F = Future.accept(1);
        Future.resolve(F).then(v => Future.reject("error")).done(
            assert.ifError,
            e => assert.equal(e, "error"));
    },
    function Future_reject_value_then_resolve() {
        Future.reject("error")
            .then(null, e => 1)
            .done(
                v => assert.equal(v, 1),
                assert.ifError);
    },
    function any_accept1_reject1() {        
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");        
        Future
            .any(F0, F1)
            .done(
                v => assert.equal(v, 1),
                assert.ifError);
    },
    function any_reject1_accept1() {
        var F0 = Future.reject("error");
        var F1 = Future.accept(1);
        Future
            .any(F0, F1)
            .done(
                assert.ifError,
                e => assert.equal(e, "error"));
    },
    function any_reject2() {
        var F0 = Future.reject("error0");
        var F1 = Future.reject("error1");
        Future
            .any(F0, F1)
            .done(
                assert.ifError,
                e => assert.equal(e, "error0"));
    },
    function any_accept2() {
        var F0 = Future.accept(1);
        var F1 = Future.accept(2);
        Future
            .any(F0, F1)
            .done(
                v => assert.equal(v, 1),
                assert.ifError);
    },
    function any_none() {
        Future.any().done(
            v => assert.ok(v === undefined),
            assert.ifError);
    },
    function some_accept1_reject1() {        
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future
            .some(F0, F1)
            .done(
                v => assert.equal(v, 1),
                assert.ifError);
    },
    function some_reject1_accept1() { 
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future
            .some(F1, F0)
            .done(
                v => assert.equal(v, 1),
                assert.ifError);
    },
    function some_reject2() {
        var F0 = Future.reject("error0");
        var F1 = Future.reject("error1");
        Future
            .some(F0, F1)
            .done(
                assert.ifError,
                e => {
                    assert.ok(Array.isArray(e), "not array");
                    assert.equal(e[0], "error0");
                    assert.equal(e[1], "error1");
                });
    },
    function some_none() {
        Future.some().done(
            v => assert.ok(v === undefined),
            assert.ifError);
    },
    function every_accept1_reject1() {
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future
            .every(F0, F1)
            .done(
                assert.ifError,
                e => assert.equal(e, "error"));
    },
    function every_accept2() {
        var F0 = Future.accept(1);
        var F1 = Future.accept(2);
        Future
            .every(F0, F1)
            .done(
                v => assert.ok(Array.isArray(v) && v[0] == 1 && v[1] == 2),
                assert.ifError);
    },
    function every_reject2() {
        var F0 = Future.reject("error0");
        var F1 = Future.reject("error1");
        Future
            .every(F0, F1)
            .done(
                assert.ifError,
                e => assert.equal(e, "error0"));
    },
    function every_none() {
        Future.every().done(
            v => assert.ok(v === undefined),
            assert.ifError);
    },
    function FutureFutureFuture_then_then_done() {
        var F = Future.accept(1);
        var FF = Future.accept(F);
        var FFF = Future.accept(FF);
        FFF.then().then().done(
            v => assert.equal(v, FF),
            assert.ifError);
    },
    function FutureForThenable_accept() {
        var T = { then: function() { assert.ok(false, "should not be called") } };
        var F = Future.accept(T);
        F.done(
            v => assert.equal(v, T),
            assert.ifError);
    },
    function FutureForThenable_resolve() {
        var T = { then: function() { assert.ok(false, "should not be called") } };
        var F = Future.resolve(T);
        F.done(
            v => assert.equal(v, T),
            assert.ifError);
    },
    function FutureForAssimilatedThenable_accept() {
        var T = { then: function(resolve, reject) { resolve(1); } }
        var F = Future.from(T);
        var FF = Future.accept(F);
        FF.done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function FutureForAssimilatedThenable_resolve() {
        var T = { then: function(resolve, reject) { resolve(1); } }
        var F = Future.from(T);
        var FF = Future.resolve(F);
        FF.done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function FutureForAssimilatedNestedThenable_accept() {
        var T1 = { then: function(resolve, reject) { resolve(1); } }
        var T2 = { then: function(resolve, reject) { resolve(T1); } }
        var F = Future.from(T2);
        var FF = Future.accept(F);
        FF.done(
            v => assert.equal(v, F),
            assert.ifError);
    },
    function FutureForAssimilatedNestedThenable_resolve() {
        var T1 = { then: function(resolve, reject) { resolve(1); } }
        var T2 = { then: function(resolve, reject) { resolve(T1); } }
        var F = Future.from(T2);
        var FF = Future.resolve(F);
        FF.done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Cancel_Future() {
        var C = new CancellationSource();
        var R;
        var F = new Future(function(resolver) { R = resolver; }, C.token);
        C.cancel();
        F.done(
            assert.ifError,
            assert.ifError);
    },
    function Cancel_Future_setTimeout() {
        var C = new CancellationSource();
        var F = new Future(function (resolver) {
            var timerId = setTimeout(() => {
                resolver.resolve(1);
                C.token.unregister(handle);
            }, 1);
            var handle = C.token.register(() => {
                clearTimeout(timerId);
            });
        }, C.token);
        C.cancel();
        F.done(
            assert.ifError,
            assert.ifError);
    }
];

class TestCase extends events.EventEmitter {
    public test: () => void;
    public name: string;
    public requested: number = 0;
    public completed: number = 0;
    public nextTick: Function;
    public domain: domain.Domain;
    
    constructor(test: () => void) {
        super();
        this.test = test;
        this.name = (<any>test).name;
    }
    
    public run(): void {
        this.domain = domain.create();
        this.domain.on("error", e => { 
            this.emit("fail", e);
            this.emit("done");
        });
        this.domain.run(() => {
            this.nextTick = process.nextTick;
            process.nextTick = (task: () => void) => {
                this.requested++;
                this.nextTick.call(process, () => {
                    this.completed++;
                    this.exec(task);
                });
            }

            this.emit("start");
            this.exec(this.test);
        });
    }

    public exec(task: () => void) {
        task();
        if (this.completed === this.requested) {
            this.emit("pass");
            this.emit("done");
        }
    }
}

class TestRun {
    public errors = [];
    public requested = 0;
    public completed = 0;
    public passed = 0;
    public failed = 0;
    public testCases: TestCase[];
    
    constructor(tests: { (): void; }[]) {
        this.testCases = tests.map(test => {
            var testCase = new TestCase(test);
            testCase.on("start", () => { 
                this.requested++; 
            });
            testCase.on("pass", () => { 
                this.passed++; 
            });
            testCase.on("fail", (e) => {
                this.failed++;
                this.errors.push("Test failed: " + testCase.name + ". Message:", (e && e.stack) ? e.stack : e, "");                
            });
            testCase.on("done", () => {
                this.completed++;
                if (this.requested === this.completed) {
                    this.done();
                }
            });
            return testCase;
        });
    }

    public run() {
        this.testCases.forEach(testCase => testCase.run());
    }

    public done() {
        console.log("\r\n%sdone. succeeded: %s, failed: %s, total: %s\r\n", this.errors.concat("").join("\r\n"), this.passed, this.failed, this.requested);
    }

    public static run(tests: { (): void; }[]) {
        var list = new TestRun(tests)
        list.run();
    }
}

TestRun.run(tests);