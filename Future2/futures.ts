/// <reference path="../lib/timers.d.ts" />
/// <reference path="../lib/node.d.ts" />
/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import symbols = module('symbols');
var Symbol = symbols.Symbol;

// pseudo-private symbols for private data
var __FutureResolverData__ = new Symbol();
var __FutureData__ = new Symbol();
var __Brand__ = new Symbol("Brand");

/** Private data for a Future and its Resolver
  */
class FutureData {
    public resolved: bool = false;
    public future: Future;
    public resolver: FutureResolver;
    public state: string = "pending";
    public result: any;
    public resolveCallbacks: { (value: any): void; }[] = [];
    public rejectCallbacks: { (value: any): void; }[] = [];
    
    /** Private data for a Future and its Resolver
      * @param future The Future associated with this data
      * @param resolver The resolver associated with this data
      */
    constructor(future: Future, resolver: FutureResolver) {
        this.future = future;
        this.resolver = resolver;
    }
    
    /** accept algorithm
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      *
      * http://dom.spec.whatwg.org/#concept-resolver-accept
      */
    accept(value: any, synchronous?: bool) {
        if (this.resolved) {
            return;
        }
        
        this.state = "accepted";
        this.result = value;
        this.resolved = true;
        
        Process(this.resolveCallbacks, value, synchronous);
    }
    
    /** resolve algorithm
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      *
      * http://dom.spec.whatwg.org/#concept-resolver-resolve (modified)
      */
    resolve(value: any, synchronous?: bool) {
        if (this.resolved) {
            return;
        }
        
        if (Future.isFuture(value)) {
            var resolve = value => this.accept(value, true);
            var reject = value => this.reject(value, true);
            
            try {
                value.done(resolve, reject);
            }
            catch (e) {
                this.reject(e, synchronous);
            }
            
            return;
        }
        
        this.accept(value, synchronous);
    }

    /** reject algorithm
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      *
      * http://dom.spec.whatwg.org/#concept-resolver-reject
      */
    reject(value: any, synchronous?: bool) {
        if (this.resolved) {
            return;
        }
        
        this.state = "rejected";
        this.result = value;
        this.resolved = true;
        
        Process(this.rejectCallbacks, value, synchronous);
    };

    /** append algorithm
      *
      * http://dom.spec.whatwg.org/#concept-future-append
      */
    append(resolveCallback: (value: any) => void, rejectCallback: (value: any) => void) {
        if (typeof resolveCallback === "function") this.resolveCallbacks.push(resolveCallback);
        if (typeof rejectCallback === "function") this.rejectCallbacks.push(rejectCallback);
        
        if (this.state === "accepted") {
            Process(this.resolveCallbacks, this.result);
        }
        else if (this.state === "rejected") {
            Process(this.rejectCallbacks, this.result);
        }
    }
     
    /** future wrapper callback algorithm: http://dom.spec.whatwg.org/#concept-future-wrapper-callback
      */
    wrapCallback(callback: (value: any) => any): (value: any) => void {        
        return (argument: any) => {
            var value;
            try {
                value = callback.call(this.future, argument);
            }
            catch (e) {
                this.reject(e, true);
                return;
            }
            
            this.resolve(value, true);
        }
    }
}

/** A resolver for a Future
  * http://dom.spec.whatwg.org/#futureresolver
  */
export class FutureResolver {
    
    /** Creates a new FFutureResolver instance.
      * http://dom.spec.whatwg.org/#futureresolver
      */
    constructor() {
        throw new TypeError("Object doesn't support this action");
    }

    /** Accepts a value as the completion value of the Future. If the Future has already been resolved, no changes will be made.
      * @param value The value to accept
      *
      * http://dom.spec.whatwg.org/#dom-futureresolver-accept
      */
    accept(value: any): void {
        var data: FutureData = __FutureResolverData__.get(this);
        if (!data) throw new TypeError("'this' is not a FutureResolver object");
        
        data.accept(value);
    }
    
    /** Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
      * @param value The value to resolve
      *
      * http://dom.spec.whatwg.org/#dom-futureresolver-resolve
      */
    resolve(value: any): void {
        var data: FutureData = __FutureResolverData__.get(this);
        if (!data) throw new TypeError("'this' is not a FutureResolver object");
        
        data.resolve(value);
    }
    
    /** Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
      * @param err The reason for the rejection.
      *
      * http://dom.spec.whatwg.org/#dom-futureresolver-reject
      */
    reject(value: any): void {
        var data: FutureData = __FutureResolverData__.get(this);
        if (!data) throw new TypeError("'this' is not a FutureResolver object");
        
        data.reject(value);
    }
}

/** A Future value
  * 
  * http://dom.spec.whatwg.org/#future
  */
export class Future {
    /** A DOM-compliant Future
      * @param init A callback whose first argument is the resolver for the future
      *
      * http://dom.spec.whatwg.org/#dom-future
      */
    constructor (init: (resolver: FutureResolver) => void) {
        if (init == null) throw new Error("Argument missing: init");
        
        // create resolver
        var resolver = Object.create(FutureResolver.prototype);
        var data = new FutureData(this, resolver);
        __FutureResolverData__.set(resolver, data);
        __FutureData__.set(this, data);
        
        // brand this as a Future
        __Brand__.set(this, "Future");
        
        // convenience, bind the methods to the instance
        resolver.accept = resolver.accept.bind(resolver);
        resolver.resolve = resolver.resolve.bind(resolver);
        resolver.reject = resolver.reject.bind(resolver);
        
        try {
            init.call(this, resolver);
        }
        catch (e) {
            data.reject(e);
        }
    }
    
    /** Creates a new Future that is already in the accepted state with the provided value as the result.
      * @param value The value for the Future
      * @returns A Future for the value.
      * 
      * http://dom.spec.whatwg.org/#dom-future-accept
      */
    static accept(value: any): Future {
        return new Future(resolver => { resolver.accept(value) });
    }
    
    /** Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its final result.
      * @param value The value for the Future
      * @returns A Future for the value.
      *
      * http://dom.spec.whatwg.org/#dom-future-resolve
      */
    static resolve(value: any): Future {
        return new Future(resolver => { resolver.resolve(value) });
    }
    
    /** Creates a new Future that is already in the rejected state with the provided value as the result.
      * @param value The value for the Future
      * @returns A Future for the value.
      *
      * http://dom.spec.whatwg.org/#dom-future-reject
      */
    static reject(value: any): Future {
        return new Future(resolver => { resolver.reject(value) });
    }
    
    /** Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
      * @param values The values to wait upon. 
      * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
      *
      * http://dom.spec.whatwg.org/#dom-future-any (modified)
      */
    static any(...values: any[]): Future {
        return new Future(resolver => {
            var data = __FutureResolverData__.get(resolver);
            if (!data) throw new TypeError("'this' is not a FutureResolver object");

            var resolveCallback = value => data.accept(value, true);
            var rejectCallback = value => data.reject(value, true);
            
            if (values.length <= 0) {
                resolver.accept(undefined);
            }
            else {
                values.forEach(value => { 
                    Future.resolve(value).done(
                        resolveCallback, 
                        rejectCallback); 
                });
            }
        });
    }
    
    /** Creates a Future that is resolved when all of the provided values have resolved, or rejected when any of the values provided are rejected.
      * @param values The values to wait upon. 
      * @returns A new Future that is either resolved with an array of the resolved values of all Futures, or rejected with the error of the first Future that is rejected.
      *
      * When the new Future is resolved, the order of the values in the result will be the same as the order of the Futures provided to Future.every.
      *
      * http://dom.spec.whatwg.org/#dom-future-every (modified)
      */
    static every(...values: any[]): Future {
        return new Future(resolver => {
            var data = __FutureResolverData__.get(resolver);
            if (!data) throw new TypeError("'this' is not a FutureResolver object");

            var countdown = values.length;
            var results = new Array(countdown);
            var rejectCallback = value => data.reject(value, true);
            values.forEach((value, index) => {
                var resolveCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        data.accept(results, true);
                    }
                };
                Future.resolve(value).done(
                    resolveCallback, 
                    rejectCallback);
            });
        });
    }
    
    /** Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or all are rejected.
      * @param values The values to wait upon. 
      * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with an array of errors of all of the Futures that were rejected.
      *
      * If the new Future is rejected, the order of the errors in the result will be the same as the order of the Futures provided to Future.some.
      *
      * http://dom.spec.whatwg.org/#dom-future-some (modified)
      */
    static some(...values: any[]): Future {
        return new Future(resolver => {
            var data = __FutureResolverData__.get(resolver);
            if (!data) throw new TypeError("'this' is not a FutureResolver object");

            var countdown = values.length;
            var results = new Array(countdown);
            var resolveCallback = value => data.accept(value, true);
            values.forEach((value, index) => {
                var rejectCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        data.reject(results, true);
                    }
                };
                Future.resolve(value).done(
                    resolveCallback, 
                    rejectCallback);
            });
        });
    }
    
    /** Coerces a value into a Future. 
      * If the value is an instance of Future, it is returned. 
      * If a value is a "future-like" Object that has a callable "then" method, it is assimilated into a Future.
      * In all other cases, a new Future is returned that is resolved with the provided value.
      * @param value The value to coerce
      * @returns A Future for the value.
      *
      * (not currently specified)
      */
    static from(value: any): Future {
        if (Future.isFuture(value)) {
            return value;
        }

        return new Future(function (resolver) { 
            var resolve = v => {
                try {
                    if (Future.isFuture(v)) {
                        v.done(resolver.accept, resolver.reject);
                    }            
                    else if (Object(v) === v && typeof v.then === "function") {
                        v.then(resolve, resolver.reject);
                    }
                    else {
                        resolver.accept(v);
                    }
                }
                catch (e) {
                    resolver.reject(e);
                }
            };
            
            resolve(value);
        });
    }
    
    /** Determines if a value is a Future
      * @param value The value to test
      * @returns True if the value is a Future instance; otherwise, false.
      *
      * (not currently specified)
      */
    static isFuture(value: any): bool {
        return Object(value) === value && __Brand__.get(value) === "Future";
    }
    
    /** Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
      * @param resolve {Function} The callback to execute when the parent Future is resolved. 
      * @param reject  {Function} The callback to execute when the parent Future is rejected. 
      * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
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
      *
      * http://dom.spec.whatwg.org/#dom-future-then (modified)
      */
    then(resolve?: (value: any) => any = null, reject?: (value: any) => any = null): Future {
        var antecedent = this;
        return new Future(resolver => {
            var data = __FutureResolverData__.get(resolver);
            if (!data) throw new TypeError("'this' is not a FutureResolver object");

            var resolveCallback: (value: any) => void;
            var rejectCallback: (value: any) => void;
            
            if (resolve != null) {
                resolveCallback = data.wrapCallback(resolve);
            }
            else {
                resolveCallback = value => data.accept(value, true);
            }
            
            if (reject != null) {
                rejectCallback = data.wrapCallback(reject);
            }
            else {
                rejectCallback = value => data.reject(value, true);
            }
            
            antecedent.done(resolveCallback, rejectCallback);
        });
    }
    
    /** A short form for Future#then that only handles the rejection of the Future.
      * @param reject  {Function} The callback to execute when the parent Future is rejected. 
      * @returns A new chained Future.
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
      *
      * http://dom.spec.whatwg.org/#dom-future-catch
      */
    catch(reject?: (value: any) => any = null): Future {
        var antecedent = this;
        return new Future(resolver => {
            var data = __FutureResolverData__.get(resolver);
            if (!data) throw new TypeError("'this' is not a FutureResolver object");

            var resolveCallback = value => data.accept(value, true);
            var rejectCallback: (value: any) => void;
            
            if (reject != null) {
                rejectCallback = data.wrapCallback(reject);
            }
            else {
                rejectCallback = value => data.reject(value, true);
            }
            
            antecedent.done(resolveCallback, rejectCallback);
        });
    }
    
    /** Handles the resolution or rejection of the Future at the end of a chain.
      * @param resolve {Function} The callback to execute when the parent Future is resolved. 
      * @param reject {Function} The callback to execute when the parent Future is rejected. 
      * 
      * The resolve callback is invoked when this Future is resolved. The argument to the resolve callback is the value for the Future. 
      * If an error is thrown during the resolve callback, the error will be raised to the host.
      * 
      * The reject callback is invoked when this Future is rejected. The argument to the reject callback is the error for the Future.
      * If an error is thrown during the reject callback, the error will be raised to the host.
      * If the reject argument is null or undefined, the error from this Future will be raised to the host.
      * 
      * Unhandled exceptions that are not handled by a reject callback will propagate to the host. 
      *
      * http://dom.spec.whatwg.org/#dom-future-catch
      */
    done(resolve?: (value: any) => any = null, reject?: (value: any) => any = null): void {
        var data = __FutureData__.get(this);
        if (!data) throw new TypeError("'this' is not a Future object");
        
        data.append(resolve, reject);
    }
}

/** process algorithm
  *
  * http://dom.spec.whatwg.org/#concept-future-process
  */
function Process(callbacks: { (value: any): any; }[], result: any, synchronous?: bool = false): void {
    if (!synchronous) {
        QueueTask(() => Process(callbacks, result, true));
    }
    else {
        while (callbacks.length) {
            var callback = callbacks.shift();
            callback(result);
        }
    }
}
        
/** queues a task on the local event-loop for processing in a later turn
  */
var QueueTask = 
    typeof setImmediate === "function" ? 
        (block: () => void) => { setImmediate(block); } :
    typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function" ?
        (block: () => void) => { process.nextTick(block); } :
    function() {
        /** Queue used to reduce overhead when processing in environments without setImmediate/process.nextTick
          */
        var queue: { (): void; }[];

        /** Handle for a queue processor timer
          */
        var handle: number;

        return (block: () => void) => {
            if (queue == null) {
                queue = [];
            }
            
            queue.push(block);
            if (handle == null) {
                handle = setInterval(() => {
                    var count = 2;
                    while (queue.length && --count) {
                        var block = queue.shift();
                        block();
                    }
                    
                    if (!queue.length) {
                        clearInterval(handle);
                        handle = null;
                    }
                }, 0);
            }
        };
    }();

// polyfill for Futures
if (typeof window !== "undefined" && typeof (<any>window).Future === "undefined") {
    (<any>window).Future = Future;
    (<any>window).FutureResolver = FutureResolver;
}