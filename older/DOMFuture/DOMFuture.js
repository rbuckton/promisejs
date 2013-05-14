/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition) {
    if (typeof Future === "undefined") {
        definition(window, Symbol);
    }
})
(function (window, Symbol, undefined) {
    var _es5 = typeof Function.prototype.bind === "function" &&
               typeof Object.create === "function" &&
               typeof Object.defineProperty === "function",
        _toArray = _es5 ? Function.prototype.call.bind(Array.prototype.slice) : function (arraylike, start, end) { 
            return Array.prototype.slice.call(arraylike, start, end); 
        },
        _uncurry = _es5 ? Function.prototype.bind.bind(Function.prototype.call) : function (target) { 
            return function (thisArg) { return target.apply(thisArg, _toArray(arguments, 1)); } 
        },
        _bind = _es5 ? _uncurry(Function.prototype.bind) : function (target, thisArg) {
            var boundArgs = _toArray(arguments, 2);
            return function() { return target.apply(thisArg, boundArgs.concat(_toArray(arguments))); }
        },
        _create = _es5 ? Object.create : function(_) { 
            return function(proto) {
                try {
                    _.prototype = proto;
                    return new _();
                }
                finally {
                    _.prototype = null;
                }
            }
        }(function() {}),
        
        // the "accept" verb used for Future completion
        VERB_ACCEPT = "accept",
        
        // the "resolve" verb used for Future completion
        VERB_RESOLVE = "resolve",
        
        // the "reject" verb used for Future completion
        VERB_REJECT = "reject";
    
    /** Implements a simple dispatcher for the engine's event-loop.
      */
    var Dispatcher = function() {
        if (typeof setImmediate === "function") {
            return { 
                post: _bind(setImmediate, null),
                cancel: _bind(clearImmediate, null)
            };
        }
        else {
            return {
                post: function (work) { return setTimeout.apply(null, [work, 0].concat(_toArray(arguments, 1)));},
                cancel: _bind(clearTimeout, null)
            }
        }
    }();
    
    var Countdown = function () {
        /** A countdown event
          * @param count {Number} The number of times the event must signal before it completes
          */
        function Countdown(count) {
            /** Signals a countdown event
              * @returns {Boolean} True if the countdown has completed; otherwise, false
              */
            this.set = function () { 
                if (count > 0) {
                    return --count <= 0; 
                }
                
                return true;
            }
        }
        
        return Countdown;
    }();

    // private symbol to brand a Future between realms
    var __FutureBrand__ = new Symbol("[[Future]]");
    
    // private symbol for the FutureData internal data property. Using a predefined symbol as this is used to brand Future
    var __FutureData__ = new Symbol();

    // private symbol for the FutureResolverData internal data property
    var __FutureResolverData__ = new Symbol();
    
    var FutureData = function() {
        /** Internal storage for a Future and its FutureResolver
          * @class
          */
        function FutureData(future, resolver) {
            this.future = future;
            this.resolver = resolver;
            this.completed = false;
        }
        
        /** Root of a chain of continuations for the future. This is called when a new descendant Future is chained to this Future.
          * @param resolver {FutureResolver} The resolver for the Future (may be null).
          * @param resolve {Function} A callback to be executed when the Future is resolved (may be null).
          * @param reject {Function} A callback to be executed when the Future is rejected (may be null).
          * @param options {Object} An optional object providing additional options for creating the chained future.
          */
        FutureData.prototype.chain = function (resolver, resolve, reject, options) {
            var link = function (verb, value) {
                self.next.call(this, verb, value);
                if (options && options.synchronous) {
                    forward(resolver, verb, value, resolve, reject);
                } else {
                    Dispatcher.post(forward, resolver, verb, value, resolve, reject);
                }
            }
            link.next = this.when;            
            this.when = link;
        }
        
        /** Root of Future completion. This is called when resolve or reject are called on the FutureResolver of the Future.
          * @param verb {String} The completion type of the Future. One of: "accept", "resolve", or "reject".
          * @param value {any} The value for the completion.
          */
        FutureData.prototype.when = function (verb, value) {
            this.chain = function (resolver, resolve, reject, options) {
                if (options && options.synchronous) {
                    forward(resolver, verb, value, resolve, reject);
                }
                else {
                    Dispatcher.post(forward, resolver, verb, value, resolve, reject);
                }
            }
        }
        
        /** Initiates completion of the Future.
          * @param verb {String} The completion type of the Future. One of: "accept", "resolve", or "reject".
          * @param value {any} The value for the completion.
          */
        FutureData.prototype.complete = function (verb, value) {
            if (verb === VERB_RESOLVE && Future.isFuture(value)) {
                try {
                    value.done(
                        _bind(this.complete, this, VERB_RESOLVE),
                        _bind(this.complete, this, VERB_REJECT)
                    );
                }
                catch (e) {
                    this.when(VERB_REJECT, e);
                }
            }
            else {
                this.when(verb, value);
            }
        }
        
        /** Attempts to initiate completion of the Future.
          * @param verb {String} The completion type of the Future. One of: "accept", "resolve", or "reject".
          * @param value {any} The value for the completion.
          */
        FutureData.prototype.tryComplete = function (verb, value) {
            if (this.completed) {
                return false;
            }
            this.completed = true;
            this.complete(verb, value);
            return true;
        }    

        /** Forwards a completion to a chained Future.
          * @param {Future} future  The Future that is forwarding the completion event.
          * @param {FutureResolver} resolver  A FutureResolver for a chained descendant Future.
          * @param {String} verb  The completion type of the Future.
          * @param value  The value for the completion type.
          * @param {Function} resolve  A callback to execute when the completion type is "accept" or "resolve".
          * @param {Function} reject  A callback to execute when the completion type is "reject".
          */
        function forward(resolver, verb, value, resolve, reject) {
            var future = null;
            if (resolver) {
                var futureData = __FutureResolverData__.get(resolver);
                if (futureData) {
                    future = futureData.future;
                }
            }
            
            try {
                if (verb === VERB_RESOLVE || verb === VERB_ACCEPT) {
                    if (resolve) {
                        value = resolve.call(future, value);
                    }
                } 
                else {
                    if (reject) {
                        value = reject.call(future, value);
                        verb = VERB_ACCEPT;
                    }
                }
            } 
            catch (e) {
                value = e;
                verb = VERB_REJECT;
            }
            
            if (resolver) {
                resolver[verb](value);
            }
            else if (verb === VERB_REJECT) {
                // need e to be thrown to window.onerror
                Dispatcher.post(function() { throw value; });
            }
        }
                
        return FutureData;
    }();
    
    var FutureResolver = function() {
        
        /** Provides the means to resolve a Future.
          * @class
          */
        function FutureResolver() {
            throw new TypeError("Type is not creatable");
        }
        
        /** Accepts a value as the completion value of the Future. If the Future has already been resolved, no changes will be made.
          * @param value {any} The value to accept
          * @returns {Boolean} True if the Future was resolved with the provided value; otherwise, false.
          */
        FutureResolver.prototype.accept = function (value) {
            var futureData = __FutureResolverData__.get(this);
            if (!futureData) throw new TypeError("'this' is not a FutureResolver object");

            return futureData.tryComplete(VERB_ACCEPT, value);
        }
        
        /** Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
          * @param value {any} The value to resolve
          * @returns {Boolean} True if the Future was resolved with the provided value; otherwise, false.
          */
        FutureResolver.prototype.resolve = function (value) {
            var futureData = __FutureResolverData__.get(this);
            if (!futureData) throw new TypeError("'this' is not a FutureResolver object");

            return futureData.tryComplete(VERB_RESOLVE, value);
        }
        
        /** Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
          * @param err {any} The reason for the rejection.
          * @returns {Boolean} True if the Future was rejected with the provided value; otherwise, false.
          */
        FutureResolver.prototype.reject = function (err) {
            var futureData = __FutureResolverData__.get(this);
            if (!futureData) throw new TypeError("'this' is not a FutureResolver object");

            return futureData.tryComplete(VERB_REJECT, err);
        }
        
        return FutureResolver;
    }();
    
    var Future = function() {
        /** A DOM-compliant Future
          * @class
          * @param init {Function} A callback whose first argument is the resolver for the future
          */
        function Future(init) {
            if (typeof init !== "function") throw new TypeError("Invalid argument: init");
            if (!(this instanceof Future) || this === Future.prototype) throw new TypeError("'this' is not a Future object");
            
            // brand the future
            __FutureBrand__.set(this);

            // initialize the future
            var resolver = _create(FutureResolver.prototype);

            // private storage object
            var data = new FutureData(this, resolver);
            __FutureData__.set(this, data);
            __FutureResolverData__.set(resolver, data);
            
            // convenience, bind the resolver functions
            resolver.accept = _bind(resolver.accept, resolver);
            resolver.resolve = _bind(resolver.resolve, resolver);
            resolver.reject = _bind(resolver.reject, resolver);

            try {
                init.call(this, resolver);
            }
            catch (e) {
                data.tryComplete(VERB_REJECT, e);
            }
        }
        
        /** Handles the resolution or rejection of the Future at the end of a chain.
          * @param resolve {Function} The callback to execute when the parent Future is resolved. 
          * @param reject {Function} The callback to execute when the parent Future is rejected. 
          * @param options {Object} An object whose own properties are used to supply additional options for the chained Future.
          * 
          * The resolve callback is invoked when this Future is resolved. The argument to the resolve callback is the value for the Future. 
          * If an error is thrown during the resolve callback, the error will be raised to the host.
          * 
          * The reject callback is invoked when this Future is rejected. The argument to the reject callback is the error for the Future.
          * If an error is thrown during the reject callback, the error will be raised to the host.
          * If the reject argument is null or undefined, the error from this Future will be raised to the host.
          * 
          * Unhandled exceptions that are not handled by a reject callback will propagate to the host. 
          */
        Future.prototype.done = function (resolve, reject, options) {
            var futureData = __FutureData__.get(this);
            if (!futureData) throw new TypeError("'this' is not a Future object");

            futureData.chain(null, resolve, reject, options);
        }

        /** Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
          * @param resolve {Function} The callback to execute when the parent Future is resolved. 
          * @param reject  {Function} The callback to execute when the parent Future is rejected. 
          * @param options {Object} An object whose own properties are used to supply additional options for the chained Future.
          * @return A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
          * 
          * The resolve callback is invoked when this Future is resolved. The argument to the resolve callback is the value for this Future. 
          * The return value of the resolve callback becomes the resolved value for the chained Future. 
          * If an error is thrown during the resolve callback, the chained Future is rejected using the error that was thrown.
          * If the resolve argument is null or undefined, the chained Future will be resolved with the value for this Future.
          * 
          * The reject callback is invoked when this Future is rejected. The argument to the reject callback is the error for this Future.
          * The return value of the reject callback becomes the resolved value for the chained Future. 
          * If an error is thrown during the reject callback, the chained Future is rejected using the error that was thrown.
          * If the reject argument is null or undefined, the chained Future will be rejected with the error for this Future.
          *
          * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
          * To handle these exceptions you must either create a new chained Future that handles the reject callback, or call Future#done.
          */
        Future.prototype.then = function (resolve, reject, options) {
            var futureData = __FutureData__.get(this);
            if (!futureData) throw new TypeError("'this' is not a Future object");

            return new Future(function (resolver) { futureData.chain(resolver, resolve, reject, options) });
        }

        /** A short form for Future#then that only handles the rejection of the Future.
          * @param reject  {Function} The callback to execute when the parent Future is rejected. 
          * @param options {Object} An object whose own properties are used to supply additional options for the chained Future.
          * @return A new chained Future.
          *
          * The reject callback is invoked when this Future is rejected. The argument to the reject callback is the error for the Future.
          * The return value of the reject callback becomes the resolved value for the chained Future. 
          * If an error is thrown during the reject callback, the chained Future is rejected using the error that was thrown.
          * If the reject argument is null or undefined, the chained Future will be rejected with the error for this Future.
          *
          * If this Future is resolved, the chained Future will be resolved with the value.
          *
          * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
          * To handle these exceptions you must either create a new chained Future that handles the reject callback, or call Future#done.
          */
        Future.prototype["catch"] = function (reject, options) {
            var futureData = __FutureData__.get(this);
            if (!futureData) throw new TypeError("'this' is not a Future object");

            return new Future(function (resolver) { futureData.chain(resolver, null, reject, options) });
        }
        
        /** A short form for Future#then that uses the same callback for both resolve and reject.
          * @param callback {Function} The callback to execute when the parent Future is either resolved or rejected. 
          * @param options {Object} An object whose own properties are used to supply additional options for the chained Future.
          * @return A new chained Future.
          *
          * The callback is invoked when this Future is resolved or rejected. No arguments are passed to the callback.
          * The return value of the callback becomes the resolved value for the chained Future. 
          * If an error is thrown during the callback, the chained Future is rejected using the error that was thrown.
          * If the callback argument is null or undefined, the chained Future will be resolved or rejected with the same value or error as this Future.
          *
          * Unhandled exceptions in the callback will not propagate to the host. 
          * To handle these exceptions you must either create a new chained Future that handles the reject callback, or call Future#done.
          */
        Future.prototype["finally"] = function (callback, options) {
            var futureData = __FutureData__.get(this);
            if (!futureData) throw new TypeError("'this' is not a Future object");
            
            var _callback = function() { return callback(); };
            return new Future(function (resolver) { futureData.chain(resolver, _callback, _callback, options); });
        }
                
        /** Converts the value provided into a Future.  If the value has a callable data property named "then", it is used to coerce the value to a Future; otherwise, a new Future is returned that is resolved with the provided value.
          * @param value {any} The value to coerce to a Future.
          * @returns {Future} A Future for the value.
          * @remarks This is an extension to the DOMFutures specification
          */
        Future.of = function (value) {
            if (Future.isFuture(value)) return value;
            if (value && typeof value.then === "function") {
                return new Future(function (resolver) {
                    if (typeof value.done === "function") { // try to use done if possible
                        value.done(resolver.resolve, resolver.reject);
                    }
                    else {
                        value.then(resolver.resolve, resolver.reject);
                    }
                });
            }
            return Future.resolve(value);
        }
        
        /** Converts the value provided into a Future.  If the value is already a Future, it is returned; otherwise, a new Future is returned that is resolved with the provided value.
          * @param value {any} The value to convert to a Future.
          * @returns {Future} A Future for the value.
          */
        Future.resolve = function (value) {
            if (Future.isFuture(value)) return value;
            return new Future(function (resolver) { resolver.accept(value); });
        }
        
        /** Creates a Future that is rejected with the provided error.
          * @param err {any} The error for the Future.
          * @returns {Future} A new rejected Future.
          */
        Future.reject = function (value) {
            return new Future(function (resolver) { resolver.reject(value); });
        }
        
        /** Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
          * @param futures {Future} The futures to wait upon. 
          * @returns {Future} A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
          *
          * Any value that is not a Future is resolved as a Future by calling the Future.of() function.
          */
        Future.any = function (/*...futures*/) {
            var futures = _toArray(arguments);
            return new Future(function (resolver) {
                if (futures.length === 0) {
                    resolver.resolve();
                }
                else {
                    for (var i = 0, l = futures.length; i < l; i++) {
                        Future
                            .resolve(futures[i])
                            .done(
                                resolver.resolve, 
                                resolver.reject, 
                                { synchronous: true });
                    }
                }
            });
        }

        /** Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or all are rejected.
          * @param futures {Future} The futures to wait upon. 
          * @returns {Future} A new Future that is either resolved with the value of the first Future to resolve, or rejected with an array of errors of all of the Futures that were rejected.
          *
          * Any value that is not a Future is resolved as a Future by calling the Future.of() function.
          * If the new Future is rejected, the order of the errors in the result will be the same as the order of the Futures provided to Future.some.
          */
        Future.some = function (/*...futures*/) {
            var futures = _toArray(arguments);
            return new Future(function (resolver) {
                if (futures.length === 0) {
                    resolver.resolve();
                }
                else {
                    var errors = new Array(futures.length);
                    var countdown = new Countdown(futures.length);
                    for (var i = 0, l = futures.length; i < l; i++) {
                        var reject = makeCallback(countdown, errors, i, resolver, VERB_RESOLVE);
                        Future
                            .resolve(futures[i])
                            .done(
                                resolver.resolve, 
                                reject, 
                                { synchronous: true });
                    }
                }
            });
        }

        /** Creates a Future that is resolved when all of the provided values have resolved, or rejected when any of the values provided are rejected.
          * @param futures {Future} The futures to wait upon. 
          * @returns {Future} A new Future that is either resolved with an array of the resolved values of all Futures, or rejected with the error of the first Future that is rejected.
          *
          * Any value that is not a Future is resolved as a Future by calling the Future.of() function.
          * When the new Future is resolved, the order of the values in the result will be the same as the order of the Futures provided to Future.every.
          */
        Future.every = function (/*...futures*/) {
            var futures = _toArray(arguments);
            return new Future(function (resolver) {
                if (futures.length === 0) {
                    resolver.resolve([]);
                }
                else {
                    var values = new Array(futures.length);
                    var countdown = new Countdown(futures.length);
                    for (var i = 0, l = futures.length; i < l; i++) {
                        var resolve = makeCallback(countdown, values, i, resolver, VERB_REJECT);
                        Future
                            .resolve(futures[i])
                            .done(
                                resolve, 
                                resolver.reject, 
                                { synchronous: true });
                    }
                }
            });
        }
        
        /** Determines whether the provided value is an instance of the Future type.
          * @param value {any} The value to test
          * @returns {Boolean} True if the value is a future; otherwise, false.
          * @remarks This is an extension to the DOMFutures specification. This is primarily useful in an "async/await" style function to give up processing time to other tasks in the dispatcher.
          */
        Future.isFuture = function(value) {
            if (value instanceof Future) {
                return true;
            }
            
            if (Object(value) === value && __FutureBrand__.has(value)) {
                return true;
            }
            
            return false;
        }
        
        /** Creates a Future that resolves in the next turn of the runtime's dispatcher
          * @returns {Future}
          * @remarks This is an extension to the DOMFutures specification. This is primarily useful in an "async/await" style function to give up processing time to other tasks in the dispatcher.
          */
        Future.yield = function() {
            return new Future(function(resolver) { 
                Dispatcher.post(resolver.accept); 
            });
        }

        /** Creates a Future that resolves after a number of milliseconds has elapsed.
          * @param ms {Number} The number of milliseconds to wait
          * @returns {Future}
          * @remarks This is an extension to the DOMFutures specification. This is primarily useful in an "async/await" style function to wait for a period of time before continuing processing.
          */
        Future.sleep = function(ms) {
            return new Future(function(resolver) {
                setTimeout(resolver.accept, ms);
            });
        }
        
        /** Creates a Future that resolves only after a callback results to true.
          * @param func {Function} The callback to execute to evaluate whether to continue sleeping.
          * @param interval {Number} Optional. The number of milliseconds to wait between checks. If the argument is null or undefined, the test will be checked every turn of the runtime's dispatcher.
          * @param timeout {Number} Optional. The number of milliseconds to wait
          * @returns {Future} A Future that resolves to <b>true</b> when the callback returns true, or <b>false</b> if the timeout elapsed prior to the condition being met.
          * @remarks This is an extension to the DOMFutures specification. This is primarily useful in an "async/await" style function to wait for a specific result.
          */
        Future.sleepUntil = function(func, interval, timeout) {            
            return new Future(function(resolver) {
                var done = false;
                
                if (timeout != null) {
                    setTimeout(function() {
                        done = true;
                        resolver.accept(false);
                    }, timeout);
                }
                
                var callback = function() {
                    if (done) return;
                    
                    try {
                        if (func()) {
                            resolver.accept(true);
                        }
                        else {
                            if (interval == null) {
                                Dispatcher.post(callback);
                            }
                            else {
                                setTimeout(callback, ms);
                            }
                        }
                    }
                    catch (e) {
                        resolver.reject(e);
                    }
                }
                
                if (interval == null) {
                    callback();
                }
                else {
                    setTimeout(callback, interval);
                }
            });
        }

        /** Creates a Future whose completion is derived from the execution of a callback either in the next turn of the dispatcher, or after a number of milliseconds has elapsed.
          * @param func {Function} the callback to execute.
          * @param ms {Number} Optional. The number of milliseconds to wait. If this value is null or undefined, it will be executed in the next turn of the runtime's dispatcher.
          * @returns {Future} A Future whose completion is based on the result or exception thrown by the provided callback.
          * @remarks This is an extension to the DOMFutures specification
          */
        Future.run = function(func, ms) {
            if (typeof func !== "function") throw new Error("Invalid argument: func");
            
            return new Future(function(resolver) {
                var callback = function() {
                    try {
                        resolver.resolve(func());
                    }
                    catch (e) {
                        resolver.reject(e);
                    }
                };

                if (ms == null) {
                    Dispatcher.post(callback);
                }
                else {
                    setTimeout(callback, ms);
                }
            });
        }

        /** makes a callback to handle the completion of a countdown event.
          * @param countdown {Countdown} A countdown event.
          * @param values {Array} An array of values
          * @param index {Number} The index for the result in the array of values
          * @param resolver {FutureResolver} The resolver for the future
          * @param verb {String} The completion type for the resolver.
          */
        function makeCallback(countdown, values, index, resolver, verb) {
            return function (value) {
                values[index] = value;
                if (countdown.set()) {
                    resolver[verb](values);
                }
            }
        }

        return Future;
    }();
    
    var Deferred = function () {
        /** A Deferred object that can be used to complete a Future.
          * @class
          * @remarks This is an extension to the DOMFutures specification
          */
        function Deferred() {
            var source;
            this.isComplete = false;
            this.future = new Future(function (resolver) { source = resolver; });
            __DeferredData__.set(this, source);

            // convenience, bind the Deferred members
            this.accept = _bind(this.accept, this);
            this.resolve = _bind(this.resolve, this);
            this.reject = _bind(this.reject, this);
        }

        /** Accepts a value as the completion value of the Future. If the Future has already been resolved, no changes will be made.
          * @param value {any} The value to accept
          * @returns {Boolean} True if the Future was resolved with the provided value; otherwise, false.
          */
        Deferred.prototype.accept = function (value) {
            var source = __DeferredData__.get(this);
            if (!source) throw new TypeError("'this' is not a Deferred object");
            if (source.accept(value)) {
                this.isComplete = true;
                return true;
            }
            return false;
        }

        /** Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
          * @param value {any} The value to resolve
          * @returns {Boolean} True if the Future was resolved with the provided value; otherwise, false.
          */
        Deferred.prototype.resolve = function (value) {
            var source = __DeferredData__.get(this);
            if (!source) throw new TypeError("'this' is not a Deferred object");
            if (source.resolve(value)) {
                this.isComplete = true;
                return true;
            }
            return false;
        }
        
        /** Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
          * @param err {any} The reason for the rejection.
          * @returns {Boolean} True if the Future was rejected with the provided value; otherwise, false.
          */        
        Deferred.prototype.reject = function (err) {
            var source = __DeferredData__.get(this);
            if (!source) throw new TypeError("'this' is not a Deferred object");
            if (source.reject(err)) {
                this.isComplete = true;
                return true;
            }
            return false;
        }

        // private symbol for DeferredData internal data property
        var __DeferredData__ = new Symbol();
        return Deferred;
    }();
    
    // polyfill Future
    window.FutureResolver = FutureResolver;
    window.Future = Future;
    window.Deferred = Deferred;

});