/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

declare function setImmediate(callback: Function, ...args: any[]): number;
declare var process;

/** DOM FutureResolver 
  * http://dom.spec.whatwg.org/#futures - 4.3
  */
class FutureResolver {
    private _future: Future;
    private _resolved: bool = false;
    
    constructor() {
        throw new TypeError("Object doesn't support this action");
    }

    /** Accepts a value as the completion value of the Future. If the Future has already been resolved, no changes will be made.
      * @param value The value to accept
      */
    accept(value: any): void {
        this._accept(value);
    }
    
    /** Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
      * @param value The value to resolve
      */
    resolve(value: any): void {
        this._resolve(value);
    }
    
    /** Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
      * @param err The reason for the rejection.
      */
    reject(value: any): void {
        this._reject(value);
    }    
    
    /** accept algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      */
    private _accept (value: any, synchronous?: bool = false) {
        if (this._resolved) return;
        var future = <any>this._future;
        future._state = "accepted";
        future._result = value;
        this._resolved = true;
        
        (<any>Future)._dispatch(() => (<any>Future)._process(future._resolveCallbacks, value), synchronous);
    }

    /** resolve algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      * @param value The value for the result of the future
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      */
    private _resolve (value: any, synchronous?: bool = false) {
        if (this._resolved) return;
        
        var then = null;
        if (Object(value) === value) {
            then = value.then;
        }
        
        if (typeof then === "function") {
            var resolve = (value: any) => { this._resolve(value, true) };
            var reject = (value: any) => { this._reject(value, true) };
            try {
                then.call(value, resolve, reject);
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
      */
    private _reject (value: any, synchronous?: bool = false) {
        if (this._resolved) return;
        var future = <any>this._future;
        future._state = "rejected";
        future._result = value;
        this._resolved = true;

        (<any>Future)._dispatch(() => (<any>Future)._process(future._rejectCallbacks, value), synchronous);
    }
}

/** DOM Future
  * http://dom.spec.whatwg.org/#futures - 4.3
  */
class Future {
    private _resolver: FutureResolver;
    private _resolveCallbacks: { (value: any): void; }[] = [];
    private _rejectCallbacks: { (value: any): void; }[] = [];
    private _state: string = "pending";
    private _result: any;

    /** A DOM-compliant Future
      * @param init A callback whose first argument is the resolver for the future
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
            (<any>this._resolver)._reject(e);
        }
    }
    
    /** Creates a new Future that is already in the accepted state with the provided value as the result.
      * @param value The value for the Future
      * @returns A Future for the value.
      */
    static accept(value: any): Future {
        return new Future(resolver => { resolver.accept(value) });
    }
    
    /** Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its final result.
      * @param value The value for the Future
      * @returns A Future for the value.
      */
    static resolve(value: any): Future {
        return new Future(resolver => { resolver.resolve(value) });
    }
    
    /** Creates a new Future that is already in the rejected state with the provided value as the result.
      * @param value The value for the Future
      * @returns A Future for the value.
      */
    static reject(value: any): Future {
        return new Future(resolver => { resolver.reject(value) });
    }
    
    /** Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
      * @param values The values to wait upon. 
      * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
      */
    static any(...values: any[]): Future {
        return new Future(resolver => {
            var resolveCallback = value => { resolver.resolve(value) };
            var rejectCallback = value => { resolver.reject(value) };
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
      */
    static every(...values: any[]): Future {
        return new Future(resolver => {
            var countdown = values.length;
            var results = new Array(countdown);
            var rejectCallback = value => { resolver.reject(value); };
            values.forEach((value, index) => {
                var resolveCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        (<any>resolver)._resolve(results, true);
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
      */
    static some(...values: any[]): Future {
        return new Future(resolver => {
            var countdown = values.length;
            var results = new Array(countdown);
            var resolveCallback = value => { resolver.resolve(value); };
            values.forEach((value, index) => {
                var rejectCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        (<any>resolver)._reject(results, true);
                    }
                };
                Future.resolve(value)._append(resolveCallback, rejectCallback);
            });
        });
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
      */
    then(resolve?: (value: any) => any = null, reject?: (value: any) => any = null): Future {
        return new Future(resolver => {
            var resolveCallback: (value: any) => void;
            var rejectCallback: (value: any) => void;
            
            if (resolve != null) {
                resolveCallback = Future._makeWrapperCallback(resolver, resolve);
            }
            else {
                resolveCallback = value => (<any>resolver)._resolve(value, true);
            }
            
            if (reject != null) {
                rejectCallback = Future._makeWrapperCallback(resolver, reject);
            }
            else {
                rejectCallback = value => (<any>resolver)._reject(value, true);
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
      */
    catch(reject?: (value: any) => any = null): Future {
        return new Future(resolver => {
            var resolveCallback = value => (<any>resolver)._resolve(value, true);;
            var rejectCallback: (value: any) => void;
            
            if (reject != null) {
                rejectCallback = Future._makeWrapperCallback(resolver, reject);
            }
            else {
                rejectCallback = value => (<any>resolver)._reject(value, true);
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
      */
    done(resolve?: (value: any) => any = null, reject?: (value: any) => any = null): void {
        this._append(resolve, reject);
    }
    
    /** append algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      */
    private _append(resolveCallback: (value: any) => void, rejectCallback: (value: any) => void): void {
        this._resolveCallbacks.push(resolveCallback);
        this._rejectCallbacks.push(rejectCallback);
        
        if (this._state === "accepted") {
            Future._dispatch(() => Future._process(this._resolveCallbacks, this._result));
        }
        else if (this._state === "rejected") {
            Future._dispatch(() => Future._process(this._rejectCallbacks, this._result));
        }
    }
    
    private static _dispatch(block: () => void, synchronous?: bool = false): void {
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
                if (Future._queue == null) {
                    Future._queue = [];
                }

                Future._queue.push(block);
                if (Future._handle == null) {
                    Future._handle = setInterval(() => {
                        var count = 2;
                        while (Future._queue.length && --count) {
                            var block = Future._queue.shift();
                            block();
                        }
                        
                        if (!Future._queue.length) {
                            clearInterval(Future._handle);
                            Future._handle = null;
                        }
                    }, 0);
                }
            }
        }
    }
    
    private static _queue: { (): void; }[];
    private static _handle: number;
    
    /** process algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      */
    private static _process(callbacks: { (value: any): any; }[], result: any): void {
        while (callbacks.length) {
            var callback = callbacks.shift();
            callback(result);
        }
    }
    
    /** future wrapper callback algorithm: http://dom.spec.whatwg.org/#futures - 4.2
      */
    private static _makeWrapperCallback(resolver: any, callback: (value: any) => any): (value: any) => void {        
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
}