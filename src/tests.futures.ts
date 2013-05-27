/// <reference path="../lib/node.d.ts" />
/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import futures = module("futures");
import assert = module("assert");

export var name = "tests.futures";

export function Future_accept_value() {
    futures.Future.accept(1).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_Future() {
    var F = futures.Future.accept(1);
    futures.Future.accept(F).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_resolve_value() {
    futures.Future.resolve(1).done(
        v => assert.equal(v, 1),
        assert.ifError)
}

export function Future_resolve_Future() {
    var F = futures.Future.accept(1);
    futures.Future.resolve(F).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_FutureFuture() {
    var F = futures.Future.accept(1);
    var FF = futures.Future.accept(F);
    futures.Future.resolve(FF).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_reject_value() {
    futures.Future.reject("error").done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_reject_Future() {
    var F = futures.Future.accept("error");
    futures.Future.reject(F).done(
        assert.ifError,
        e => assert.equal(e, F));
}

export function FutureResolver_accept_value() {
    new futures.Future<number>(resolver => resolver.accept(1)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureResolver_accept_Future() {
    var F = futures.Future.accept(1);
    new futures.Future<futures.Future<number>>(resolver => resolver.accept(F)).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureResolver_resolve_value() {
    new futures.Future<number>(resolver => resolver.resolve(1)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureResolver_resolve_Future() {
    var F = futures.Future.accept(1);
    new futures.Future<number>(resolver => resolver.resolve(F)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureResolver_resolve_FutureFuture() {
    var F = futures.Future.accept(1);
    var FF = futures.Future.accept(F);
    new futures.Future<futures.Future<number>>(resolver => resolver.resolve(FF)).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureResolver_reject_value() {
    new futures.Future<void>(resolver => resolver.reject("error")).done(
        assert.ifError,
        e => assert.equal(e, "error"))
}

export function FutureResolver_reject_Future() {
    var F = futures.Future.accept("error");
    new futures.Future<void>(resolver => resolver.reject(F)).done(
        assert.ifError,
        e => assert.equal(e, F))
}

export function Future_accept_value_then() {
    futures.Future.accept(1).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_value_then_throw() {
    futures.Future.accept(1).then(v => { throw "error" }).done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_accept_Future_then_none() {
    var F = futures.Future.accept(1);
    futures.Future.accept(F).then().done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_accept_Future_then_idish() {
    var F = futures.Future.accept(1);
    futures.Future.accept(F).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_FutureFuture_then() {
    var F = futures.Future.accept(1);
    var FF = futures.Future.accept(F);
    futures.Future.accept(FF).then(v => v).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_accept_Future_then_accept() {
    var F = futures.Future.accept(1);
    futures.Future.accept(F).then(v => futures.Future.accept(v)).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_accept_Future_then_resolve() {
    var F = futures.Future.accept(1);
    futures.Future.accept(F).then(v => futures.Future.resolve(v)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_Future_then_reject() {
    var F = futures.Future.accept(1);
    futures.Future.accept(F).then(v => futures.Future.reject("error")).done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_resolve_value_then() {
    futures.Future.resolve(1).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then() {
    var F = futures.Future.accept(1);
    futures.Future.resolve(F).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_FutureFuture_then() {
    var F = futures.Future.accept(futures.Future.accept(1));
    futures.Future.resolve(F).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then_accept() {
    var F = futures.Future.accept(1);
    futures.Future.resolve(F).then(v => futures.Future.accept(v)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then_resolve() {
    var F = futures.Future.accept(1);
    futures.Future.resolve(F).then(v => futures.Future.resolve(v)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then_reject() {
    var F = futures.Future.accept(1);
    futures.Future.resolve(F).then(v => futures.Future.reject("error")).done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_reject_value_then_resolve() {
    futures.Future.reject("error")
        .then(null, e => 1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function any_accept1_reject1() {        
    var F0 = futures.Future.accept(1);
    var F1 = futures.Future.reject("error");        
    futures.Future
        .any(F0, F1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function any_reject1_accept1() {
    var F0 = futures.Future.reject("error");
    var F1 = futures.Future.accept(1);
    futures.Future
        .any(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error"));
}

export function any_reject2() {
    var F0 = futures.Future.reject("error0");
    var F1 = futures.Future.reject("error1");
    futures.Future
        .any(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error0"));
}

export function any_accept2() {
    var F0 = futures.Future.accept(1);
    var F1 = futures.Future.accept(2);
    futures.Future
        .any(F0, F1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function any_none() {
    futures.Future.any().done(
        v => assert.ok(v === undefined),
        assert.ifError);
}

export function some_accept1_reject1() {        
    var F0 = futures.Future.accept(1);
    var F1 = futures.Future.reject("error");
    futures.Future
        .some(F0, F1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function some_reject1_accept1() { 
    var F0 = futures.Future.accept(1);
    var F1 = futures.Future.reject("error");
    futures.Future
        .some(F1, F0)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function some_reject2() {
    var F0 = futures.Future.reject("error0");
    var F1 = futures.Future.reject("error1");
    futures.Future
        .some(F0, F1)
        .done(
            assert.ifError,
            e => {
                assert.ok(Array.isArray(e), "not array");
                assert.equal(e[0], "error0");
                assert.equal(e[1], "error1");
            });
}

export function some_none() {
    futures.Future.some().done(
        v => assert.ok(v === undefined),
        assert.ifError);
}

export function every_accept1_reject1() {
    var F0 = futures.Future.accept(1);
    var F1 = futures.Future.reject("error");
    futures.Future
        .every(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error"));
}

export function every_accept2() {
    var F0 = futures.Future.accept(1);
    var F1 = futures.Future.accept(2);
    futures.Future
        .every(F0, F1)
        .done(
            v => assert.ok(Array.isArray(v) && v[0] == 1 && v[1] == 2),
            assert.ifError);
}

export function every_reject2() {
    var F0 = futures.Future.reject("error0");
    var F1 = futures.Future.reject("error1");
    futures.Future
        .every(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error0"));
}

export function every_none() {
    futures.Future.every().done(
        v => assert.ok(v === undefined),
        assert.ifError);
}

export function FutureFutureFuture_then_then_done() {
    var F = futures.Future.accept(1);
    var FF = futures.Future.accept(F);
    var FFF = futures.Future.accept(FF);
    FFF.then().then().done(
        v => assert.equal(v, FF),
        assert.ifError);
}

export function FutureForThenable_accept() {
    var T = { then: function() { assert.ok(false, "should not be called") } };
    var F = futures.Future.accept(T);
    F.done(
        v => assert.equal(v, T),
        assert.ifError);
}

export function FutureForThenable_resolve() {
    var T = { then: function() { assert.ok(false, "should not be called") } };
    var F = futures.Future.resolve(T);
    F.done(
        v => assert.equal(v, T),
        assert.ifError);
}

export function FutureForAssimilatedThenable_accept() {
    var T = { then: function(resolve, reject) { resolve(1); } }
    var F = futures.Future.from(T);
    var FF = futures.Future.accept(F);
    FF.done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureForAssimilatedThenable_resolve() {
    var T = { then: function(resolve, reject) { resolve(1); } }
    var F = futures.Future.from(T);
    var FF = futures.Future.resolve(F);
    FF.done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureForAssimilatedNestedThenable_accept() {
    var T1 = { then: function(resolve, reject) { resolve(1); } }
    var T2 = { then: function(resolve, reject) { resolve(T1); } }
    var F = futures.Future.from(T2);
    var FF = futures.Future.accept(F);
    FF.done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureForAssimilatedNestedThenable_resolve() {
    var T1 = { then: function(resolve, reject) { resolve(1); } }
    var T2 = { then: function(resolve, reject) { resolve(T1); } }
    var F = futures.Future.from(T2);
    var FF = futures.Future.resolve(F);
    FF.done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Cancel_Future() {
    var C = new futures.CancellationSource();
    var R;
    var F = new futures.Future(function(resolver) { R = resolver; }, C.token);
    C.cancel();
    F.done(
        assert.ifError,
        assert.ifError);
}

export function Cancel_Future_setTimeout() {
    var C = new futures.CancellationSource();
    var F = new futures.Future<number>(function (resolver) {
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