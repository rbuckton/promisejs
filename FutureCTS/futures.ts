/// <reference path="../lib/timers.d.ts" />
/// <reference path="../lib/node.d.ts" />
/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import symbols = module('symbols');
import lists = module('lists');
import tasks = module('tasks');

var FutureDataSym = new symbols.Symbol("futures.FutureData");

interface ContinuationEntry {
    /** 
     * The token used for cancellation
     */
    token: tasks.CancellationToken;

    /**
     * The callback for the continuation
     * @type {Function}
     */
    callback: (value: any) => void;
}

/** 
 * The state of the future
 */
enum FutureState {
    /** 
     * The future is in a pending state and has not yet completed
     */
    pending,

    /** 
     * The future has completed and has a value
     */
    accepted,

    /** 
     * The future has completed and has an error
     */
    rejected,

    /** 
     * The future was canceled
     */
    canceled
}

/** 
 * Links two cancellation tokens
 * @param x The first cancellation token
 * @param y The second cancellation token
 * @returns A token that is canceled when either x or y ara cancelled, or null if neither argument was a token
 */
function LinkTokens(x: tasks.CancellationToken, y: tasks.CancellationToken): tasks.CancellationToken {
    if (x) {
        if (y) {
            return new tasks.CancellationSource(x, y).token;
        }
        return x;
    }
    return y;
}

/** 
 * A resolver for a Future
 * 
 * @link http://dom.spec.whatwg.org/#futureresolver
 */
export class FutureResolver<T> {
    
    /** 
     * A resolver for a Future.
     * 
     * @link http://dom.spec.whatwg.org/#futureresolver
     */
    constructor() {
        throw new TypeError("Object doesn't support this action");
    }

    /** 
     * Accepts a value as the completion value of the Future. If the Future has already been resolved, no changes will be made.
     * @param value The value to accept
     *
     * @link http://dom.spec.whatwg.org/#dom-futureresolver-accept
     */
    public accept(value: T): void {
        var data: FutureData<T> = FutureDataSym.get(this);
        if (!data || !symbols.hasBrand(this, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");
        
        data.accept(value);
    }
    
    /** 
     * Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-futureresolver-resolve
     */
    public resolve(value: Future<T>): void;
    
    /** 
     * Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-futureresolver-resolve
     */
    public resolve(value: T): void;

    /** 
     * Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-futureresolver-resolve
     */
    public resolve(value: any): void {
        var data: FutureData = FutureDataSym.get(this);
        if (!data || !symbols.hasBrand(this, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");
        
        data.resolve(value);
    }
    
    /** Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
      * @param err The reason for the rejection.
      *
      * @link http://dom.spec.whatwg.org/#dom-futureresolver-reject
      */
    public reject(value: any): void {
        var data: FutureData<T> = FutureDataSym.get(this);
        if (!data || !symbols.hasBrand(this, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");
        
        data.reject(value);
    }
}

// brand the FutureResolver class
symbols.brand("FutureResolver")(FutureResolver);

/** 
 * A Future value
 * 
 * @link http://dom.spec.whatwg.org/#future
 */
export class Future<T> {

    /** 
     * A Future value
     * @param init     A callback whose first argument is the resolver for the future
     */
    constructor (init: (resolver: FutureResolver<T>) => void);

    /** 
     * A Future value
     * @param init     A callback whose first argument is the resolver for the future
     * @param token  A cancellation token used to prevent cancel the future
     */
    constructor (init: (resolver: FutureResolver<T>) => void, token: tasks.CancellationToken);

    /** 
     * A Future value
     * @param init     A callback whose first argument is the resolver for the future
     * @param token  A cancellation token used to prevent cancel the future
     *
     * @link http://dom.spec.whatwg.org/#dom-future
     */
    constructor (init: (resolver: FutureResolver<T>) => void, token?: tasks.CancellationToken) {
        if (typeof init !== "function") throw new TypeError("Invalid argument: init");
        if (token != null && !symbols.hasBrand(token, tasks.CancellationToken)) throw new TypeError("Invalid argument: token");
        
        // create resolver object from its prototype
        var resolver: FutureResolver<T> = Object.create(FutureResolver.prototype);
        var data = new FutureData<T>(this, resolver, token);
        FutureDataSym.set(resolver, data);
        FutureDataSym.set(this, data);
                
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
    
    ///** 
    // * Creates a new Future that is already in the accepted state with the provided value as the result.
    // * @param value The value for the Future
    // * @returns A Future for the value.
    // * 
    // * @link http://dom.spec.whatwg.org/#dom-future-accept
    // */
    //public static accept<TResult>(value: TResult): Future<TResult>;

    ///** 
    // * Creates a new Future that is already in the accepted state with the provided value as the result.
    // * @param value The value for the Future
    // * @returns A Future for the value.
    // * 
    // * @link http://dom.spec.whatwg.org/#dom-future-accept
    // */
    //public static accept<TResult>(value: TResult): Future<TResult>;

    /** 
     * Creates a new Future that is already in the accepted state with the provided value as the result.
     * @param value The value for the Future
     * @returns A Future for the value.
     * 
     * @link http://dom.spec.whatwg.org/#dom-future-accept
     */
    public static accept<TResult>(value: TResult): Future<TResult> {
        return new Future<TResult>(resolver => { 
            resolver.accept(value) 
        });
    }
    
    ///** 
    // * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
    // * @param value The value for the Future
    // * @returns A Future for the value
    // */
    //public static resolve<TResult>(value: Future<TResult>): Future<TResult>;

    ///** 
    // * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
    // * @param value The value for the Future
    // * @returns A Future for the value
    // */
    //public static resolve<TResult>(value: TResult): Future<TResult>;

    ///** 
    // * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
    // * @param value The value for the Future
    // * @param token The token to use for cancellation
    // * @returns A Future for the value
    // */
    //public static resolve<TResult>(value: Future<TResult>, token: tasks.CancellationToken): Future<TResult>;

    ///** 
    // * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
    // * @param value The value for the Future
    // * @param token The token to use for cancellation
    // * @returns A Future for the value
    // */
    //public static resolve(value: any, token: tasks.CancellationToken): Future;

    /** 
     * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Future
     * @param token The token to use for cancellation
     * @returns A Future for the value
     *
     * @link http://dom.spec.whatwg.org/#dom-future-resolve
     */
    public static resolve(value: any, token?: tasks.CancellationToken): Future {
        return new Future(resolver => { 
            resolver.resolve(value) 
        }, token);
    }
    
    ///** 
    // * Creates a new Future that is already in the rejected state with the provided value as the result.
    // * @param value The value for the Future
    // * @returns A Future for the value.
    // *
    // * @link http://dom.spec.whatwg.org/#dom-future-reject
    // */
    //public static reject<TResult>(value: any): Future<TResult>;

    /** 
     * Creates a new Future that is already in the rejected state with the provided value as the result.
     * @param value The value for the Future
     * @returns A Future for the value.
     *
     * @link http://dom.spec.whatwg.org/#dom-future-reject
     */
    public static reject(value: any): Future {
        return new Future(resolver => { 
            resolver.reject(value);
        });
    }

    ///** 
    // * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
    // * @param values The values to wait upon. 
    // * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
    // *
    // * @link http://dom.spec.whatwg.org/#dom-future-any (modified)
    // */
    //public static any<TResult>(...values: Future<TResult>[]): Future<TResult>;

    ///** 
    // * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
    // * @param values The values to wait upon. 
    // * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
    // *
    // * @link http://dom.spec.whatwg.org/#dom-future-any (modified)
    // */
    //public static any<TResult>(...values: any[]): Future<TResult>;

    /** 
     * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
     * @param values The values to wait upon. 
     * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
     *
     * @link http://dom.spec.whatwg.org/#dom-future-any (modified)
     */
    public static any(...values: any[]): Future {
        return new Future(resolver => {
            var data: FutureData = FutureDataSym.get(resolver);
            if (!data || !symbols.hasBrand(resolver, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");

            var resolveCallback = value => data.accept(value, true);
            var rejectCallback = value => data.reject(value, true);
            
            if (values.length <= 0) {
                resolver.accept(void 0);
            }
            else {
                values.forEach(value => { 
                    Future
                      .resolve(value)
                      .done(resolveCallback, rejectCallback); 
                });
            }
        });
    }

    ///** 
    // * Creates a Future that is resolved when all of the provided values have resolved, or rejected when any of the values provided are rejected.
    // * @param values The values to wait upon. 
    // * @returns A new Future that is either resolved with an array of the resolved values of all Futures, or rejected with the error of the first Future that is rejected.
    // *
    // * When the new Future is resolved, the order of the values in the result will be the same as the order of the Futures provided to Future.every.
    // *
    // * @link http://dom.spec.whatwg.org/#dom-future-every (modified)
    // */
    //public static every<TResult>(...values: Future<TResult>[]): Future<TResult>;

    ///** 
    // * Creates a Future that is resolved when all of the provided values have resolved, or rejected when any of the values provided are rejected.
    // * @param values The values to wait upon. 
    // * @returns A new Future that is either resolved with an array of the resolved values of all Futures, or rejected with the error of the first Future that is rejected.
    // *
    // * When the new Future is resolved, the order of the values in the result will be the same as the order of the Futures provided to Future.every.
    // *
    // * @link http://dom.spec.whatwg.org/#dom-future-every (modified)
    // */
    //public static every<TResult>(...values: any[]): Future<TResult>;

    /** 
     * Creates a Future that is resolved when all of the provided values have resolved, or rejected when any of the values provided are rejected.
     * @param values The values to wait upon. 
     * @returns A new Future that is either resolved with an array of the resolved values of all Futures, or rejected with the error of the first Future that is rejected.
     *
     * When the new Future is resolved, the order of the values in the result will be the same as the order of the Futures provided to Future.every.
     *
     * @link http://dom.spec.whatwg.org/#dom-future-every (modified)
     */
    public static every(...values: any[]): Future {
        return new Future(resolver => {
            var data: FutureData = FutureDataSym.get(resolver);
            if (!data || !symbols.hasBrand(resolver, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");

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

                Future
                    .resolve(value)
                    .done(resolveCallback, rejectCallback);
            });
        });
    }

    ///** 
    // * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or all are rejected.
    // * @param values The values to wait upon. 
    // * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with an array of errors of all of the Futures that were rejected.
    // *
    // * If the new Future is rejected, the order of the errors in the result will be the same as the order of the Futures provided to Future.some.
    // *
    // * @link http://dom.spec.whatwg.org/#dom-future-some (modified)
    // */
    //public static some<TResult>(...values: Future<T>[]): Future<TResult>;

    ///** 
    // * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or all are rejected.
    // * @param values The values to wait upon. 
    // * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with an array of errors of all of the Futures that were rejected.
    // *
    // * If the new Future is rejected, the order of the errors in the result will be the same as the order of the Futures provided to Future.some.
    // *
    // * @link http://dom.spec.whatwg.org/#dom-future-some (modified)
    // */
    //public static some<TResult>(...values: any[]): Future<TResult>;
    
    /** 
     * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or all are rejected.
     * @param values The values to wait upon. 
     * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with an array of errors of all of the Futures that were rejected.
     *
     * If the new Future is rejected, the order of the errors in the result will be the same as the order of the Futures provided to Future.some.
     *
     * @link http://dom.spec.whatwg.org/#dom-future-some (modified)
     */
    public static some(...values: any[]): Future {
        return new Future(resolver => {
            var data: FutureData = FutureDataSym.get(resolver);
            if (!data || !symbols.hasBrand(resolver, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");

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

                Future
                    .resolve(value)
                    .done(resolveCallback, rejectCallback);
            });
        });
    }
    
    ///** 
    // * Coerces a value into a Future. 
    // * @param value The value to coerce
    // * @returns A Future for the value.
    // */
    //public static from<TResult>(value: any): Future<TResult>;

    ///** 
    // * Coerces a value into a Future. 
    // * @param value The value to coerce
    // * @param token The token to use for cancellation
    // * @returns A Future for the value.
    // */
    //public static from<TResult>(value: any, token: tasks.CancellationToken): Future<TResult>;

    /** 
     * Coerces a value into a Future. 
     * @param value The value to coerce
     * @param token The token to use for cancellation
     * @returns A Future for the value.
     *
     * If the value is an instance of Future, it is returned. 
     * If a value is a "future-like" Object that has a callable "then" method, it is assimilated into a Future.
     * In all other cases, a new Future is returned that is resolved with the provided value.
     * 
     * (not currently specified)
     */
    public static from(value: any, token?: tasks.CancellationToken): Future {
        if (Future.isFuture(value)) {
            return value;
        }

        return new Future(function (resolver) { 
            var resolve = value => {
                if (!token || !token.canceled) {
                    try {
                        if (Future.isFuture(value)) {
                            value.done(resolver.accept, resolver.reject);
                        }            
                        else if (Object(value) === value && typeof value.then === "function") {
                            value.then(resolve, resolver.reject);
                        }
                        else {
                            resolver.accept(value);
                        }
                    }
                    catch (e) {
                        resolver.reject(e);
                    }
                }
            };
            
            resolve(value);
        }, token);
    }
    
    /** 
     * Determines if a value is a Future
     * @param value The value to test
     * @returns True if the value is a Future instance; otherwise, false.
     *
     * (not currently specified)
     */
    public static isFuture(value: any): bool { 
        return symbols.hasBrand(value, Future);
    }

    /** 
     * Creates a Future that resolves as undefined in the next turn of the event loop
     * @param token The token to use for cancellation
     * @returns The new Future
     */
    public static yield(): Future<void>;

    /** 
     * Creates a Future that resolves as undefined in the next turn of the event loop
     * @param token The token to use for cancellation
     * @returns The new Future
     */
    public static yield(token: tasks.CancellationToken): Future<void>;

    /** 
     * Creates a Future that resolves as undefined in the next turn of the event loop
     * @param token An optional cancellation token to use to cancel the result
     * @returns The new Future
     *
     * (not currently specified)
     */
    public static yield(token?: tasks.CancellationToken): Future {
        return new Future(resolver => { 
            tasks.Dispatcher.current.post(() => { resolver.resolve(void 0); }, { fair: true }, token); 
        }, token);
    }

    /** 
     * Sleeps for a period of time before resolving the future
     * @param ms The number of milliseconds to wait before resolving
     * @returns The new Future
     */
    public static sleep(ms: number): Future<void>;

    /** 
     * Sleeps for a period of time before resolving the future
     * @param ms The number of milliseconds to wait before resolving
     * @param token The token to use for cancellation.
     * @returns The new Future
     */
    public static sleep(ms: number, token: tasks.CancellationToken): Future<void>;

    ///** 
    // * Sleeps for a period of time before resolving the future
    // * @param ms The number of milliseconds to wait before resolving
    // * @param value The value to use for resolution when the future resolves
    // * @returns The new Future
    // */
    //public static sleep<T>(ms: number, value: Future<T>): Future<T>;

    ///** 
    // * Sleeps for a period of time before resolving the future
    // * @param ms The number of milliseconds to wait before resolving
    // * @param value The value to use for resolution when the future resolves
    // * @returns The new Future
    // */
    //public static sleep<T>(ms: number, value: T): Future<T>;

    /** 
     * Sleeps for a period of time before resolving the future
     * @param ms The number of milliseconds to wait before resolving
     * @param value The value to use for resolution when the future resolves
     * @returns The new Future
     */
    public static sleep(ms: number, value: any): Future<any>;

    ///** 
    // * Sleeps for a period of time before resolving the future
    // * @param ms The number of milliseconds to wait before resolving
    // * @param value The value to use for resolution when the future resolves
    // * @param token The token to use for cancellation.
    // * @returns The new Future
    // */
    //public static sleep<T>(ms: number, value: Future<T>, token: tasks.CancellationToken): Future<T>;

    ///** 
    // * Sleeps for a period of time before resolving the future
    // * @param ms The number of milliseconds to wait before resolving
    // * @param value The value to use for resolution when the future resolves
    // * @param token The token to use for cancellation.
    // * @returns The new Future
    // */
    //public static sleep<T>(ms: number, value: T, token: tasks.CancellationToken): Future<T>;

    /** 
     * Sleeps for a period of time before resolving the future
     * @param ms The number of milliseconds to wait before resolving
     * @param value The value to use for resolution when the future resolves
     * @param token The token to use for cancellation.
     * @returns The new Future
     */
    public static sleep(ms: number, value: any, token: tasks.CancellationToken): Future<any>;

    /** 
     * Sleeps for a period of time before resolving the future
     * @param ms The number of milliseconds to wait before resolving
     * @param args Additional arguments from the various overloads
     * @returns The new Future
     * 
     * (not currently specified)
     */
    public static sleep(ms: number, ...args: any[]): Future {
        var argi: number = 0;
        var value: any = void 0;
        var token: tasks.CancellationToken = null;

        if (!symbols.hasBrand(args[argi], tasks.CancellationToken)) value = args[argi++];
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) value = args[argi];

        return new Future(resolver => { 
            tasks.Dispatcher.current.post(() => { resolver.resolve(value); }, { delay: ms }, token); 
        }, token);
    }

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => Future<T>): Future<T>;

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => T): Future<T>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => any): Future<any>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => void): Future<void>;

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @param token The token to use for cancellation
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => Future<T>, token: tasks.CancellationToken): Future<T>;

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @param token The token to use for cancellation
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => T, token: tasks.CancellationToken): Future<T>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param token The token to use for cancellation
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => any, token: tasks.CancellationToken): Future<any>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param token The token to use for cancellation
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => void, token: tasks.CancellationToken): Future<void>;

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @param ms The number of milliseconds to wait before executing the callback
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => Future<T>, ms: number): Future<T>;

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @param ms The number of milliseconds to wait before executing the callback
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => T, ms: number): Future<T>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param ms The number of milliseconds to wait before executing the callback
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => any, ms: number): Future<any>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param ms The number of milliseconds to wait before executing the callback
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => void, ms: number): Future<void>;

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @param ms The number of milliseconds to wait before executing the callback
    // * @param token The token to use for cancellation
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => Future<T>, ms: number, token: tasks.CancellationToken): Future<T>;

    ///** 
    // * Runs the supplied callback at the end of the current turn
    // * @param func The callback to execute
    // * @param ms The number of milliseconds to wait before executing the callback
    // * @param token The token to use for cancellation
    // * @returns A Future for the result or exception from the callback
    // */
    //public static run<T>(func: () => T, ms: number, token: tasks.CancellationToken): Future<T>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param ms The number of milliseconds to wait before executing the callback
     * @param token The token to use for cancellation
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => any, ms: number, token: tasks.CancellationToken): Future<any>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param ms The number of milliseconds to wait before executing the callback
     * @param token The token to use for cancellation
     * @returns A Future for the result or exception from the callback
     */
    public static run(func: () => void, ms: number, token: tasks.CancellationToken): Future<void>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param args Additional arguments from the various overloads
     * @returns A Future for the result or exception from the callback
     *
     * (not currently specified)
     */
    public static run(func: () => any, ...args: any[]): Future {
        var argi: number = 0;
        var options: tasks.DispatcherPostOptions = null;
        var token: tasks.CancellationToken = null;

        if (typeof args[argi] === "number") {
            options = { delay: <number>args[argi++] };
        }
        
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
            token = <tasks.CancellationToken>args[argi];
        }

        return new Future(resolver => {
            var data = FutureDataSym.get(resolver);
            if (!data || !symbols.hasBrand(resolver, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");

            tasks.Dispatcher.current.post(() => {
                try {
                    data.resolve(func(), true);
                }
                catch (e) {
                    data.reject(e, true);
                }
            }, options, token);
        }, token);
    }
    
    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then(): Future<T>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then(token: tasks.CancellationToken): Future<T>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => Future<TResult>): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => TResult): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => Future<TResult>, token: tasks.CancellationToken): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => TResult, token: tasks.CancellationToken): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => Future<TResult>, reject: (value: any) => Future<TResult>): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => Future<TResult>, reject: (value: any) => TResult): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => TResult, reject: (value: any) => Future<TResult>): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => TResult, reject: (value: any) => TResult): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => Future<TResult>, reject: (value: any) => Future<TResult>, token: tasks.CancellationToken): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => Future<TResult>, reject: (value: any) => TResult, token: tasks.CancellationToken): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => TResult, reject: (value: any) => Future<TResult>, token: tasks.CancellationToken): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future whose resolution and rejection are the result of the execution of continuations to this function.
     */
    public then<TResult>(resolve: (value: T) => TResult, reject: (value: any) => TResult, token: tasks.CancellationToken): Future<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param args Arguments for the various overloads
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
     * @link http://dom.spec.whatwg.org/#dom-future-then (modified)
     */
    public then<TResult>(...args: any[]): Future<TResult> {
        var data: FutureData<T> = FutureDataSym.get(this);
        if (!data || !symbols.hasBrand(this, Future)) throw new TypeError("'this' is not a Future object");

        var argi: number = 0;
        var resolve: (value: T) => TResult = null;
        var reject: (value: any) => TResult = null;
        var token: tasks.CancellationToken = null;

        if (typeof args[argi] === "function" || args[argi] == null) {
            resolve = args[argi++];
            if (typeof args[argi] === "function" || args[argi] == null) {
                reject = args[argi++];
            }
        }
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
            token = args[argi];
        }

        // create a linked token
        token = LinkTokens(data.token, token);

        return new Future<TResult>(resolver => {
            var resolverData: FutureData<TResult> = FutureDataSym.get(resolver);
            if (!resolverData || !symbols.hasBrand(resolver, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");

            var resolveCallback: (value: T) => void;
            if (resolve != null) {
                resolveCallback = resolverData.wrapCallback(resolve);
            }
            else {
                resolveCallback = value => { resolverData.accept(value, true); };
            }
            
            var rejectCallback: (value: any) => void;
            if (reject != null) {
                rejectCallback = resolverData.wrapCallback(reject);
            }
            else {
                rejectCallback = value => { resolverData.reject(value, true); };
            }

            data.append(resolveCallback, rejectCallback, token);
        }, token);
    }
    
    /** 
     * A short form for Future#then that only handles the rejection of the Future.
     * @param reject The callback to execute when the parent Future is rejected. 
     * @returns A new chained Future.
     */
    public catch<TResult>(reject: (value: any) => Future<TResult>): Future<TResult>;

    /** 
     * A short form for Future#then that only handles the rejection of the Future.
     * @param reject The callback to execute when the parent Future is rejected. 
     * @returns A new chained Future.
     */
    public catch<TResult>(reject: (value: any) => TResult): Future<TResult>;

    /** 
     * A short form for Future#then that only handles the rejection of the Future.
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future.
     */
    public catch<TResult>(reject: (value: any) => Future<TResult>, token: tasks.CancellationToken): Future;

    /** 
     * A short form for Future#then that only handles the rejection of the Future.
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
     * @returns A new chained Future.
     */
    public catch<TResult>(reject: (value: any) => TResult, token: tasks.CancellationToken): Future;

    /** 
     * A short form for Future#then that only handles the rejection of the Future.
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
     * @link http://dom.spec.whatwg.org/#dom-future-catch
     */
    public catch<TResult>(reject: (value: any) => any, token?: tasks.CancellationToken): Future<TResult> {
        var data: FutureData<T> = FutureDataSym.get(this);
        if (!data || !symbols.hasBrand(this, Future)) throw new TypeError("'this' is not a Future object");

        // create a linked token
        token = LinkTokens(data.token, token);
        
        return new Future(resolver => {
            var resolverData: FutureData<TResult> = FutureDataSym.get(resolver);
            if (!resolverData || !symbols.hasBrand(resolver, FutureResolver)) throw new TypeError("'this' is not a FutureResolver object");

            var resolveCallback = (value: T): void => { resolverData.accept(value, true); };
            var rejectCallback: (value: any) => void;            
            if (reject != null) {
                rejectCallback = resolverData.wrapCallback(reject);
            }
            else {
                rejectCallback = value => { resolverData.reject(value, true); };
            }
            
            data.append(resolveCallback, rejectCallback, token);
        }, token);
    }
    
    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     */
    public done(): void;

    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     * @param token A cancellation token that can be used to cancel the request.
     */
    public done(token: tasks.CancellationToken): void;

    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     * @param resolve The callback to execute when the parent Future is resolved. 
     */
    public done(resolve: (value: T) => void): void;

    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param token A cancellation token that can be used to cancel the request.
     */
    public done(resolve: (value: T) => void, token: tasks.CancellationToken): void;

    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     */
    public done(resolve: (value: T) => void, reject: (value: any) => void): void;

    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
     */
    public done(resolve: (value: T) => void, reject: (value: any) => void, token: tasks.CancellationToken): void;

    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     * @param resolve {Function} The callback to execute when the parent Future is resolved. 
     * @param reject {Function} The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
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
     * @link http://dom.spec.whatwg.org/#dom-future-catch
     */
    public done(...args: any[]): void {
        var data: FutureData<T> = FutureDataSym.get(this);
        if (!data || !symbols.hasBrand(this, Future)) throw new TypeError("'this' is not a Future object");

        var argi: number = 0;
        var resolve: (value: T) => void = null;
        var reject: (value: any) => void = null;
        var token: tasks.CancellationToken = null;

        if (typeof args[argi] === "function" || args[argi] == null) {
            resolve = args[argi++];
            if (typeof args[argi] === "function" || args[argi] == null) {
                reject = args[argi++];
            }
        }
        
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
            token = args[argi];
        }

        // create a linked token
        token = LinkTokens(data.token, token);

        if (reject == null) {
            reject = e => { throw e; };
        }
        
        data.append(resolve, reject, token);
    }
}

// brand the Future class
symbols.brand("Future")(Future);

/** 
 * Internal data for a Future and its Resolver
 */
class FutureData<T> {

    /**
     * A value indicating whether the future has resolved
     * @type {Boolean}
     */
    public resolved: bool = false;

    /**
     * The associated future
     * @type {Future}
     */
    public future: Future<T>;

    /**
     * The associated resolver
     * @type {FutureResolver}
     */
    public resolver: FutureResolver<T>;

    /**
     * The current state of the future
     * @type {FutureState}
     */
    public state: FutureState = FutureState.pending;

    /**
     * The result of the future
     * @type {any}
     */
    public result: any;

    /**
     * A linked list of resolve callbacks
     * @type {lists.LinkedList}
     */
    public resolveCallbacks: lists.LinkedList<ContinuationEntry>;

    /**
     * A linked list of reject callbacks
     * @type {lists.LinkedList}
     */
    public rejectCallbacks: lists.LinkedList<ContinuationEntry>;

    /**
     * A cancellation token used to cancel the future
     * @type {tasks.CancellationToken}
     */
    public token: tasks.CancellationToken;

    /**
     * A handle used to register with the cancellation token
     * @type {Number}
     */
    public cancellationHandle: number;
    
    /** 
     * Internal data for a Future and its Resolver
     * @constructor
     * @param future The Future associated with this data
     * @param resolver The resolver associated with this data
     * @param token The cancellation token used to manage cancellation
     */
    constructor(future: Future, resolver: FutureResolver, token: tasks.CancellationToken) {
        this.future = future;
        this.resolver = resolver;
        this.token = token;

        // register for cancellation
        if (this.token) {
            this.cancellationHandle = this.token.register(() => { this.cancel() });
        }
    }
    
    /** 
     * Accept algorithm, accepts a value as the future result
     * @param value The value for the result of the future
     * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
     *
     * @link http://dom.spec.whatwg.org/#concept-resolver-accept
     */
    public accept(value: any, synchronous?: bool) : void {
        if (this.resolved) {
            return;
        }
        
        this.state = FutureState.accepted;
        this.result = value;
        this.resolved = true;
        
        if (this.token && this.cancellationHandle) {
            this.token.unregister(this.cancellationHandle);
            this.token = null;
            this.cancellationHandle = null;
        }
        
        this.process(this.resolveCallbacks, value, synchronous);
    }
    
    /** 
     * Resolve algorithm, resolves a value that may be a future
     * @param value The value for the result of the future
     * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
     *
     * @link http://dom.spec.whatwg.org/#concept-resolver-resolve (modified)
     * 
     * The spec for DOM Futures performs a recursive unwrap and assimilation. Based on conversations on 
     * es-discuss this has been changed to a single unwrap with no assimilation. Recursive unwrap and assimilation
     * can be performed using the Future.from() method.
     */
    public resolve(value: any, synchronous?: bool): void {
        if (this.resolved) {
            return;
        }

        if (value === this.future) {
            throw new TypeError("Future cannot be resolved with itself")
        }
        
        if (Future.isFuture(value)) {
            var resolve = value => this.accept(value, true);
            var reject = value => this.reject(value, true);
            
            try {
                value.done(resolve, reject, this.token);
            }
            catch (e) {
                this.reject(e, synchronous);
            }
            
            return;
        }
        
        this.accept(value, synchronous);
    }

    /** 
     * Reject algorithm
     * @param value The value for the result of the future
     * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
     *
     * @link http://dom.spec.whatwg.org/#concept-resolver-reject
     */
    public reject(value: any, synchronous?: bool) {
        if (this.resolved) { 
            return;
        }
        
        this.state = FutureState.rejected;
        this.result = value;
        this.resolved = true;

        if (this.token && this.cancellationHandle) {
            this.token.unregister(this.cancellationHandle);
            this.token = null;
            this.cancellationHandle = null;
        }
        
        this.process(this.rejectCallbacks, value, synchronous);
    }
    
    /** 
     * Performs cancellation of the future
     */
    public cancel() {
        if (this.resolved) {
            return;
        }
        
        this.state = FutureState.canceled;
        this.resolved = true;
        
        if (this.token && this.cancellationHandle) {
            this.token.unregister(this.cancellationHandle);
            this.token = null;
            this.cancellationHandle = null;
        }
    }

    /** 
     * Appends a resolve or reject callback to the future's internal resolveCallbacks or rejectCallbacks lists.
     * @param resolveCallback The callback to execute upon resolution
     * @param rejectCallback The callback to execute upon rejection
     * @param token The cancellation token for the callbacks
     * 
     * @link http://dom.spec.whatwg.org/#concept-future-append
     */
    public append(resolveCallback: (value: any) => void, rejectCallback: (value: any) => void, token: tasks.CancellationToken): void {

        // possibly create a linked token for the callbacks
        if (!(token && token.canceled)) {
            
            if (typeof resolveCallback === "function") {
                if (this.resolveCallbacks == null) {
                    this.resolveCallbacks = new lists.LinkedList<ContinuationEntry>();
                }

                var resolveNode = this.resolveCallbacks.push({
                    token: token,
                    callback: resolveCallback
                });

                if (token) {
                    token.register(() => this.resolveCallbacks.deleteNode(resolveNode));
                }
            }
            
            if (typeof rejectCallback === "function") {
                if (this.rejectCallbacks == null) {
                    this.rejectCallbacks = new lists.LinkedList<ContinuationEntry>(); 
                }

                var rejectNode = this.rejectCallbacks.push({
                    token: token,
                    callback: rejectCallback
                });

                if (token) {
                    token.register(() => this.rejectCallbacks.deleteNode(rejectNode));
                }
            }
            
            if (this.state === FutureState.accepted) {
                // the future has already been accepted, process the resolve callbacks in a later turn
                this.process(this.resolveCallbacks, this.result, false);
            }
            else if (this.state === FutureState.rejected) {
                // the future has already been rejected, process the reject callbacks in a later turn
                this.process(this.rejectCallbacks, this.result, false);
            }
        }
    }    
     
    /** 
     * Future wrapper callback algorithm
     * @link http://dom.spec.whatwg.org/#concept-future-wrapper-callback
     */
    public wrapCallback(callback: (value: any) => any): (value: any) => void {
        var wrapper = (value: any) => {
            try {
                value = callback.call(this.future, value);
            }
            catch (e) {
                this.reject(e, true);
                return;
            }
            
            this.resolve(value, true); 
        }

        return wrapper;
    }

    /** 
     * Processes callbacks
     * @param callbacks The callbacks to process
     * @param result The result to pass to the callbacks
     * @param token The cancellation token used to manage cancellation of the task
     * @param synchronous A value indicating whether to process the callbacks synchronously
     *
     * @link http://dom.spec.whatwg.org/#concept-future-process (modified)
     */
    public process(callbacks: lists.LinkedList<ContinuationEntry>, result: any, synchronous: bool): void {
        if (callbacks) {
            while (callbacks.head) {
                var next = callbacks.head;
                callbacks.deleteNode(next);
                var callback = next.value.callback, token = next.value.token;
                if (!(token && token.canceled)) {
                    // execute either synchronously or as a microtask at the end of the turn
                    tasks.Dispatcher.current.post(((callback) => () => { callback(result); })(callback), { synchronous: synchronous }, token);
                }
            }
        }
    }
}

// polyfill for Futures
if (typeof window !== "undefined" && typeof (<any>window).Future === "undefined") {
    (<any>window).Future = Future;
    (<any>window).FutureResolver = FutureResolver;
    (<any>window).CancellationToken = tasks.CancellationToken;
    (<any>window).CancellationSource = tasks.CancellationSource;
}