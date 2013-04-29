/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
declare function setImmediate(callback: Function, ...args: any[]): number;
declare var process;

/** FutureResolver 
  * http://dom.spec.whatwg.org/#futureresolver
  */
export class FutureResolver {
    private _future: FutureFriend;
    private _resolved: bool = false;
    
    constructor() {
        throw new TypeError("Object doesn't support this action");
    }

    /** Accepts a value as the completion value of the Future. If the Future has already been resolved, no changes will be made.
      * @param value The value to accept
      *
      * http://dom.spec.whatwg.org/#dom-futureresolver-accept
      */
    accept(value: any): void {
        this._accept(value);
    }
    
    /** Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
      * @param value The value to resolve
      *
      * http://dom.spec.whatwg.org/#dom-futureresolver-resolve
      */
    resolve(value: any): void {
        this._resolve(value);
    }
    
    /** Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
      * @param err The reason for the rejection.
      *
      * http://dom.spec.whatwg.org/#dom-futureresolver-reject
      */
    reject(value: any): void {
        this._reject(value);
    }    
    
    /** accept algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      *
      * http://dom.spec.whatwg.org/#concept-resolver-accept
      */
    private _accept (value: any, synchronous?: bool = false) {
        if (this._resolved) return;
        
        this._future._state = "accepted";
        this._future._result = value;
        this._resolved = true;
        
        Process(this._future._resolveCallbacks, value, synchronous);
    }

    /** resolve algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      *
      * http://dom.spec.whatwg.org/#concept-resolver-resolve (modified)
      */
    private _resolve (value: any, synchronous?: bool = false) {
        if (this._resolved) return;
        
        // TODO: Assumes only Future, if using symbols this needs to be updated
        if (Future.isFuture(value)) {
            var resolve = MakeFutureCallback(this, this._accept);
            var reject = MakeFutureCallback(this, this._reject);
            try {
                // using Future#done to reduce overhead of allocating an unneeded future.
                value.done(resolve, reject);
            }
            catch (e) {
                this._reject(e, synchronous);
            }

            return;
        }
        
        this._accept(value, synchronous);
    }
    
    /** reject algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      *
      * http://dom.spec.whatwg.org/#concept-resolver-reject
      */
    private _reject (value: any, synchronous?: bool = false) {
        if (this._resolved) return;
        
        this._future._state = "rejected";
        this._future._result = value;
        this._resolved = true;

        Process(this._future._rejectCallbacks, value, synchronous);
    }
}

/** A Future value
  * 
  * http://dom.spec.whatwg.org/#future
  */
export class Future {
    private _resolver: FutureResolverFriend;
    private _resolveCallbacks: { (value: any): void; }[] = [];
    private _rejectCallbacks: { (value: any): void; }[] = [];
    private _state: string = "pending";
    private _result: any;

    /** A DOM-compliant Future
      * @param init A callback whose first argument is the resolver for the future
      *
      * http://dom.spec.whatwg.org/#dom-future
      */
    constructor (init: (resolver: FutureResolver) => void) {
        if (init == null) throw new Error("Argument missing: init");
        
        // create resolver
        this._resolver = Object.create(FutureResolver.prototype, { _future: { value: this } });
        
        // convenience, bind the methods to the instance
        this._resolver.accept = this._resolver.accept.bind(this._resolver);
        this._resolver.resolve = this._resolver.resolve.bind(this._resolver);
        this._resolver.reject = this._resolver.reject.bind(this._resolver);
        
        try {
            init.call(this, this._resolver);
        }
        catch (e) {
            this._resolver._reject(e);
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
        return new Future((resolver: FutureResolverFriend) => {
            var resolveCallback = MakeFutureCallback(resolver, resolver._accept);
            var rejectCallback = MakeFutureCallback(resolver, resolver._reject);
            
            if (values.length <= 0) {
                resolver.accept(undefined);
            }
            else {
                values.forEach(value => { 
                    Future.resolve(value)._append(resolveCallback, rejectCallback); 
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
        return new Future((resolver: FutureResolverFriend) => {
            var countdown = values.length;
            var results = new Array(countdown);
            var rejectCallback = MakeFutureCallback(resolver, resolver._reject);
            values.forEach((value, index) => {
                var resolveCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        resolver._accept(results, true);
                    }
                };
                Future.resolve(value)._append(resolveCallback, rejectCallback);
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
        return new Future((resolver: FutureResolverFriend) => {
            var countdown = values.length;
            var results = new Array(countdown);
            var resolveCallback = MakeFutureCallback(resolver, resolver._accept);
            values.forEach((value, index) => {
                var rejectCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        resolver._reject(results, true);
                    }
                };
                Future.resolve(value)._append(resolveCallback, rejectCallback);
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
        
        if (Object(value) === value && typeof value.then === "function") {
            return new Future(function(resolver) { value.then(resolver.accept, resolver.reject); });
        }
        
        return Future.resolve(value);
    }
    
    /** Determines if a value is a Future
      * @param value The value to test
      * @returns True if the value is a Future instance; otherwise, false.
      *
      * (not currently specified)
      */
    static isFuture(value: any): bool {
        
        // TODO: This needs to be done by checking for a symbol or branding to support Futures from other realms.
        return value instanceof Future;
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
        return new Future((resolver: FutureResolverFriend) => {
            var resolveCallback: (value: any) => void;
            var rejectCallback: (value: any) => void;
            
            if (resolve != null) {
                resolveCallback = MakeFutureWrapperCallback(resolver, resolve);
            }
            else {
                resolveCallback = MakeFutureCallback(resolver, resolver._accept);
            }
            
            if (reject != null) {
                rejectCallback = MakeFutureWrapperCallback(resolver, reject);
            }
            else {
                rejectCallback = MakeFutureCallback(resolver, resolver._reject);
            }
            
            this._append(resolveCallback, rejectCallback);
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
        return new Future((resolver: FutureResolverFriend) => {
            var resolveCallback = MakeFutureCallback(resolver, resolver._resolve);
            var rejectCallback: (value: any) => void;
            
            if (reject != null) {
                rejectCallback = MakeFutureWrapperCallback(resolver, reject);
            }
            else {
                rejectCallback = MakeFutureCallback(resolver, resolver._reject);
            }
            
            this._append(resolveCallback, rejectCallback);
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
        this._append(resolve, reject);
    }
    
    /** append algorithm: http://dom.spec.whatwg.org/#concept-future-append
      */
    private _append(resolveCallback: (value: any) => void, rejectCallback: (value: any) => void): void {
        this._resolveCallbacks.push(resolveCallback);
        this._rejectCallbacks.push(rejectCallback);
        
        if (this._state === "accepted") {
            Process(this._resolveCallbacks, this._result);
        }
        else if (this._state === "rejected") {
            Process(this._rejectCallbacks, this._result);
        }
    }
}

interface FutureResolverFriend {
    _future: FutureFriend;
    _resolved: bool;
    _accept(value: any, synchronous?: bool): void;
    _resolve(value: any, synchronous?: bool): void;
    _reject(value: any, synchronous?: bool): void;
    accept(value: any): void;
    resolve(value: any): void;
    reject(value: any): void;
}

interface FutureFriend {
    _resolver: FutureResolverFriend;
    _resolveCallbacks: { (value: any): void; }[];
    _rejectCallbacks: { (value: any): void; }[];
    _state: string;
    _result: any;
    _append(resolveCallback: (value: any) => void, rejectCallback: (value: any) => void): void;
    
    then(resolve?: (value: any) => any, reject?: (value: any) => any): Future;
    catch(reject?: (value: any) => any): Future;
    done(resolve?: (value: any) => any, reject?: (value: any) => any): void;
}

/** process algorithm: http://dom.spec.whatwg.org/#concept-future-process
  */
function Process(callbacks: { (value: any): any; }[], result: any, synchronous?: bool = false): void {
    if (!synchronous) {
        Dispatch(() => Process(callbacks, result, true));
    }
    else {
        while (callbacks.length) {
            var callback = callbacks.shift();
            callback(result);
        }
    }
}
    
/** future callback algorithm: http://dom.spec.whatwg.org/#concept-future-callback
  */
function MakeFutureCallback(resolver: any, algorithm: (value: any, synchronous?: bool) => void): (value: any) => void {
    return value => { algorithm.call(resolver, value, true); };
}
    
/** future wrapper callback algorithm: http://dom.spec.whatwg.org/#concept-future-wrapper-callback
  */
function MakeFutureWrapperCallback(resolver: FutureResolverFriend, callback: (value: any) => any): (value: any) => void {        
    return (argument: any) => {
        var value;
        try {
            value = callback.call(resolver._future, argument);
        }
        catch (e) {
            resolver._reject(e, true);
            return;
        }
        
        resolver._resolve(value, true);
    }
}

/** Dispatches a callback to the local event-loop for processing in a later turn
  */
function Dispatch(block: () => void, synchronous?: bool = false): void {
    if (synchronous) {
        block();
    }
    else {
        if (typeof setImmediate === "function") {
            setImmediate(block);
        }
        else if (typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function") {
            process.nextTick(block);
        }
        else {
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
        }
    }
}

/** Queue used to reduce overhead when processing in environments without setImmediate/process.nextTick
  */
var queue: { (): void; }[];

/** Handle for a queue processor timer
  */
var handle: number;
