/// <reference path="..\lib\node.d.ts" />
import futures = module("futures");
import assert = module("assert");
import domain = module("domain");

var Future = futures.Future;
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
        var FF = Future.accept(Future.accept(1));
        Future.resolve(FF).done(
            v => assert.equal(v, 1),
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
        var FF = Future.accept(Future.accept(1));
        new Future(resolver => resolver.resolve(FF)).done(
            v => assert.equal(v, 1),
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
    function Future_accept_Future_then() {
        var F = Future.accept(1);
        Future.accept(F).then(v => v).done(
            v => assert.equal(v, 1),
            assert.ifError);
    },
    function Future_accept_FutureFuture_then() {
        var F = Future.accept(Future.accept(1));
        Future.accept(F).then(v => v).done(
            v => assert.equal(v, 1),
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
        Future.reject("error").then(null, e => 1).done(
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
            .some(F1, F0)
            .done(
                assert.ifError,
                e => assert.ok(Array.isArray(e) && e[0] == "error0" && e[1] == "error1"));
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
    }
];

var errors = [];
var count = 0;
var failed = 0;
tests.forEach(test => {
    count++;
    var d = domain.create();
    d.on("error", e => { 
        failed++; 
        errors.push("Test failed: " + (<any>test).name + ". Message:", e.toString(), "");
        process.nextTick(function() {
          // fixes odd test issue where exit is sometimes called before the last test is written
        });
    });
    d.run(test);
});

process.on("exit", function() {
    console.log("\r\n%sdone. succeeded: %s, failed: %s\r\n", errors.concat("").join("\r\n"), count - failed, failed);
});