/// <reference path="Future.ts" />
declare var process, require, domain;

eval(require("fs").readFileSync("Future.js"));

var setImmediate = process.nextTick;

var tests = [
    function then() => {
        var F = new Future(resolver => { setTimeout(resolver.resolve, 500, 1); });
        F
        .then(v => v * 2)
        .done(
            v => { console.assert(v == 2, "expected: 2, actual: %s", v); }, 
            e => { console.assert(false, e); });
    },
    function _catch() {        
        var F = new Future(resolver => { setImmediate(() => { resolver.reject(new Error("error")); }); });
        F
        .catch(e => 4)
        .done(
            v => { console.assert(v === 4, "expected: 4, actual: %s", v); }, 
            e => { console.assert(false, e); });
    },
    function any_accept() {        
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");        
        Future
            .any(F0, F1)
            .done(
                v => console.assert(v === 1, "expected: 1, actual: %s", v),
                e => console.assert(false, e));
    },
    function any_reject() {
        var F0 = Future.reject("error");
        var F1 = Future.accept(1);
        Future
            .any(F0, F1)
            .done(
                v => console.assert(false, "expected reject, actual: %s", v),
                e => console.assert(e === "error", "expected: 'error', actual: '%s'", e));
    },
    function some_accept() {        
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future
            .some(F0, F1)
            .done(
                v => console.assert(v === 1, "expected: 1, actual: %s", v),
                e => console.assert(false, e));
    },
    function some_reject() { 
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future
            .some(F1, F0)
            .done(
                v => console.assert(v === 1, "expected: 1, actual: %s", v),
                e => console.assert(false, e));
    },
    function every() {
        var F0 = Future.accept(1);
        var F1 = Future.reject("error");
        Future
            .every(F0, F1)
            .done(
                v => console.assert(false, "expected reject, actual: %s", v),
                e => console.assert(e === "error", "expected: 'error', actual: '%s'", e));
    }
];

var count = 0;
var failed = 0;
tests.forEach(test => {
    count++;
    var domain = require("domain").create();
    domain.on("error", e => { failed++; console.error("Test failed: %s. Message: %s", (<any>test).name, e) });
    domain.run(test);
});

process.on("exit", function() {
    console.log("done. succeeded: %s, failed: %s", count - failed, failed);
});