/// <reference path="../lib/node.d.ts" />
/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import promises = module("promises");
import assert = module("assert");

export var name = "tests.futures";

export function Future_accept_value() {
    promises.Promise.fulfill(1).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_Future() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.fulfill(F).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_resolve_value() {
    promises.Promise.resolve(1).done(
        v => assert.equal(v, 1),
        assert.ifError)
}

export function Future_resolve_Future() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.resolve(F).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_FutureFuture() {
    var F = promises.Promise.fulfill(1);
    var FF = promises.Promise.fulfill(F);
    promises.Promise.resolve(FF).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_reject_value() {
    promises.Promise.reject("error").done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_reject_Future() {
    var F = promises.Promise.fulfill("error");
    promises.Promise.reject(F).done(
        assert.ifError,
        e => assert.equal(e, F));
}

export function FutureResolver_accept_value() {
    new promises.Promise<number>(resolver => resolver.fulfill(1)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureResolver_accept_Future() {
    var F = promises.Promise.fulfill(1);
    new promises.Promise<promises.Promise<number>>(resolver => resolver.fulfill(F)).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureResolver_resolve_value() {
    new promises.Promise<number>(resolver => resolver.resolve(1)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureResolver_resolve_Future() {
    var F = promises.Promise.fulfill(1);
    new promises.Promise<number>(resolver => resolver.resolve(F)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureResolver_resolve_FutureFuture() {
    var F = promises.Promise.fulfill(1);
    var FF = promises.Promise.fulfill(F);
    new promises.Promise<promises.Promise<number>>(resolver => resolver.resolve(FF)).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureResolver_reject_value() {
    new promises.Promise<void>(resolver => resolver.reject("error")).done(
        assert.ifError,
        e => assert.equal(e, "error"))
}

export function FutureResolver_reject_Future() {
    var F = promises.Promise.fulfill("error");
    new promises.Promise<void>(resolver => resolver.reject(F)).done(
        assert.ifError,
        e => assert.equal(e, F))
}

export function Future_accept_value_then() {
    promises.Promise.fulfill(1).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_value_then_throw() {
    promises.Promise.fulfill(1).then(v => { throw "error" }).done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_accept_Future_then_none() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.fulfill(F).then().done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_accept_Future_then_idish() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.fulfill(F).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_FutureFuture_then() {
    var F = promises.Promise.fulfill(1);
    var FF = promises.Promise.fulfill(F);
    promises.Promise.fulfill(FF).then(v => v).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_accept_Future_then_accept() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.fulfill(F).then(v => promises.Promise.fulfill(v)).done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function Future_accept_Future_then_resolve() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.fulfill(F).then(v => promises.Promise.resolve(v)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_accept_Future_then_reject() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.fulfill(F).then(v => promises.Promise.reject("error")).done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_resolve_value_then() {
    promises.Promise.resolve(1).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.resolve(F).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_FutureFuture_then() {
    var F = promises.Promise.fulfill(promises.Promise.fulfill(1));
    promises.Promise.resolve(F).then(v => v).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then_accept() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.resolve(F).then(v => promises.Promise.fulfill(v)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then_resolve() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.resolve(F).then(v => promises.Promise.resolve(v)).done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Future_resolve_Future_then_reject() {
    var F = promises.Promise.fulfill(1);
    promises.Promise.resolve(F).then(v => promises.Promise.reject("error")).done(
        assert.ifError,
        e => assert.equal(e, "error"));
}

export function Future_reject_value_then_resolve() {
    promises.Promise.reject("error")
        .then(null, e => 1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function any_accept1_reject1() {        
    var F0 = promises.Promise.fulfill(1);
    var F1 = promises.Promise.reject("error");        
    promises.Promise
        .any(F0, F1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function any_reject1_accept1() {
    var F0 = promises.Promise.reject("error");
    var F1 = promises.Promise.fulfill(1);
    promises.Promise
        .any(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error"));
}

export function any_reject2() {
    var F0 = promises.Promise.reject("error0");
    var F1 = promises.Promise.reject("error1");
    promises.Promise
        .any(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error0"));
}

export function any_accept2() {
    var F0 = promises.Promise.fulfill(1);
    var F1 = promises.Promise.fulfill(2);
    promises.Promise
        .any(F0, F1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function any_none() {
    promises.Promise.any().done(
        v => assert.ok(v === undefined),
        assert.ifError);
}

export function some_accept1_reject1() {        
    var F0 = promises.Promise.fulfill(1);
    var F1 = promises.Promise.reject("error");
    promises.Promise
        .some(F0, F1)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function some_reject1_accept1() { 
    var F0 = promises.Promise.fulfill(1);
    var F1 = promises.Promise.reject("error");
    promises.Promise
        .some(F1, F0)
        .done(
            v => assert.equal(v, 1),
            assert.ifError);
}

export function some_reject2() {
    var F0 = promises.Promise.reject("error0");
    var F1 = promises.Promise.reject("error1");
    promises.Promise
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
    promises.Promise.some().done(
        v => assert.ok(v === undefined),
        assert.ifError);
}

export function every_accept1_reject1() {
    var F0 = promises.Promise.fulfill(1);
    var F1 = promises.Promise.reject("error");
    promises.Promise
        .every(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error"));
}

export function every_accept2() {
    var F0 = promises.Promise.fulfill(1);
    var F1 = promises.Promise.fulfill(2);
    promises.Promise
        .every(F0, F1)
        .done(
            v => assert.ok(Array.isArray(v) && v[0] == 1 && v[1] == 2),
            assert.ifError);
}

export function every_reject2() {
    var F0 = promises.Promise.reject("error0");
    var F1 = promises.Promise.reject("error1");
    promises.Promise
        .every(F0, F1)
        .done(
            assert.ifError,
            e => assert.equal(e, "error0"));
}

export function every_none() {
    promises.Promise.every().done(
        v => assert.ok(v === undefined),
        assert.ifError);
}

export function FutureFutureFuture_then_then_done() {
    var F = promises.Promise.fulfill(1);
    var FF = promises.Promise.fulfill(F);
    var FFF = promises.Promise.fulfill(FF);
    FFF.then().then().done(
        v => assert.equal(v, FF),
        assert.ifError);
}

export function FutureForThenable_accept() {
    var T = { then: function() { assert.ok(false, "should not be called") } };
    var F = promises.Promise.fulfill(T);
    F.done(
        v => assert.equal(v, T),
        assert.ifError);
}

export function FutureForThenable_resolve() {
    var T = { then: function() { assert.ok(false, "should not be called") } };
    var F = promises.Promise.resolve(T);
    F.done(
        v => assert.equal(v, T),
        assert.ifError);
}

export function FutureForAssimilatedThenable_accept() {
    var T = { then: function(resolve, reject) { resolve(1); } }
    var F = promises.Promise.from(T);
    var FF = promises.Promise.fulfill(F);
    FF.done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureForAssimilatedThenable_resolve() {
    var T = { then: function(resolve, reject) { resolve(1); } }
    var F = promises.Promise.from(T);
    var FF = promises.Promise.resolve(F);
    FF.done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function FutureForAssimilatedNestedThenable_accept() {
    var T1 = { then: function(resolve, reject) { resolve(1); } }
    var T2 = { then: function(resolve, reject) { resolve(T1); } }
    var F = promises.Promise.from(T2);
    var FF = promises.Promise.fulfill(F);
    FF.done(
        v => assert.equal(v, F),
        assert.ifError);
}

export function FutureForAssimilatedNestedThenable_resolve() {
    var T1 = { then: function(resolve, reject) { resolve(1); } }
    var T2 = { then: function(resolve, reject) { resolve(T1); } }
    var F = promises.Promise.from(T2);
    var FF = promises.Promise.resolve(F);
    FF.done(
        v => assert.equal(v, 1),
        assert.ifError);
}

export function Cancel_Future() {
    var C = new promises.CancellationSource();
    var R;
    var F = new promises.Promise(function(resolver) { R = resolver; }, C.token);
    C.cancel();
    F.done(
        assert.ifError,
        assert.ifError);
}

export function Cancel_Future_setTimeout() {
    var C = new promises.CancellationSource();
    var F = new promises.Promise<number>(function (resolver) {
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