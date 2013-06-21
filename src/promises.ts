/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

/** 
 * A promised value
 * 
 * @link http://dom.spec.whatwg.org/#promise
 */
export class Promise<T> {

    private _promiseData: PromiseData<T>;

    /** 
     * A promised value
     * @param init A callback whose first argument is the resolver for the Promise
     *
     * @link http://dom.spec.whatwg.org/#promises
     */
    constructor(init: (resolver: PromiseResolver<T>) => void ) {
        var resolver: PromiseResolver<T> = Object.create(PromiseResolver.prototype);
        resolver.fulfill = resolver.fulfill.bind(resolver);
        resolver.resolve = resolver.resolve.bind(resolver);
        resolver.reject = resolver.reject.bind(resolver);

        $PromiseCreate(this, resolver);

        try {
            init.call(this, resolver);
        }
        catch (e) {
            $PromiseReject(this._promiseData, e);
        }
    }

    /** 
     * Creates a new Promise that is already in the fulfilled state with the provided value as the result.
     * @param value The value for the Promise
     * @returns A Promise for the value.
     * 
     * @link http://dom.spec.whatwg.org/#dom-promise-fulfill
     */
    public static fulfill<TResult>(value: TResult): Promise<TResult> {
        return new Promise<TResult>(resolver => {
            resolver.fulfill(value)
        });
    }

    /** 
     * Creates a new Promise that is resolved with the provided value. If the provided value is a Promise, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Promise
     * @returns A Promise for the value
     * 
     * @link http://dom.spec.whatwg.org/#dom-promise-resolve
     */
    public static resolve<TResult>(value: Promise<TResult>): Promise<TResult>;

    /** 
     * Creates a new Promise that is resolved with the provided value. If the provided value is a Promise, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Promise
     * @returns A Promise for the value
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-resolve
     */
    public static resolve<TResult>(value: TResult): Promise<TResult>;

    public static resolve(value: any): Promise {
        return new Promise(resolver => {
            resolver.resolve(value);
        });
    }

    /** 
     * Creates a new Promise that is already in the rejected state with the provided value as the result.
     * @param value The value for the Promise
     * @returns A Promise for the value.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-reject
     */
    public static reject<TResult>(value: any): Promise<TResult> {
        return new Promise(resolver => {
            resolver.reject(value);
        });
    }

    /** 
     * Creates a Promise that is resolved or rejected when the first of any of the values provided are resolved or rejected.
     * @param values The values to wait upon. 
     * @returns A new Promise that is either resolved with the value of the first Promise to resolve, or rejected with the error of the first Promise that is rejected.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-any (modified)
     */
    public static any<TResult>(...values: any[]): Promise<TResult> {
        return new Promise(resolver => {
            var data = $PromiseGetData(resolver);
            var resolveCallback = value => $PromiseFulfill(data, value, true);
            var rejectCallback = value => $PromiseReject(data, value, true);
            if (values.length <= 0) {
                resolver.fulfill(void 0);
            }
            else {
                values.forEach(value => {
                    Promise
                        .resolve(value)
                        .done(resolveCallback, rejectCallback);
                });
            }
        });
    }

    /** 
     * Creates a Promise that is resolved when all of the provided values have resolved, or rejected when any of the values provided are rejected.
     * @param values The values to wait upon. 
     * @returns A new Promise that is either resolved with an array of the resolved values of all Promises, or rejected with the error of the first Promise that is rejected.
     *
     * When the new Promise is resolved, the order of the values in the result will be the same as the order of the Promises provided to Promise.every.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-every (modified)
     */
    public static every<TResult>(...values: any[]): Promise<TResult[]> {
        return new Promise<TResult[]>(resolver => {
            var data = $PromiseGetData(resolver);
            var countdown = values.length;
            var results: TResult[] = new Array<TResult>(countdown);
            var rejectCallback = value => $PromiseReject(data, value, true);
            values.forEach((value, index) => {
                var resolveCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        $PromiseFulfill(data, results, true);
                    }
                };
                Promise
                    .resolve(value)
                    .done(resolveCallback, rejectCallback);
            });
        });
    }

    /** 
     * Creates a Promise that is resolved or rejected when the first of any of the values provided are resolved or all are rejected.
     * @param values The values to wait upon. 
     * @returns A new Promise that is either resolved with the value of the first Promise to resolve, or rejected with an array of errors of all of the Promises that were rejected.
     *
     * If the new Promise is rejected, the order of the errors in the result will be the same as the order of the Promises provided to Promise.some.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-some (modified)
     */
    public static some<TResult>(...values: any[]): Promise<TResult> {
        return new Promise<TResult>(resolver => {
            var data = $PromiseGetData(resolver);
            var countdown = values.length;
            var results = new Array<TResult>(countdown);
            var resolveCallback = value => $PromiseFulfill(data, value, true);
            values.forEach((value, index) => {
                var rejectCallback = value => {
                    results[index] = value;
                    if (--countdown === 0) {
                        $PromiseReject(data, results, true);
                    }
                };
                Promise
                    .resolve(value)
                    .done(resolveCallback, rejectCallback);
            });
        });
    }

    /** 
     * Coerces a value into a Promise. 
     * @param value The value to coerce
     * @returns A Promise for the value.
     *
     * If the value is an instance of Promise, it is returned. 
     * If a value is a "promise-like" Object that has a callable "then" method, it is assimilated into a Promise.
     * In all other cases, a new Promise is returned that is resolved with the provided value.
     * 
     * (not currently specified)
     */
    public static from<TResult>(value: any): Promise<TResult> {
        if (Promise.isPromise(value)) {
            return value;
        }

        return new Promise<TResult>(function (resolver) {
            var resolve = value => {
                try {
                    if (Promise.isPromise(value)) {
                        value.done(resolver.fulfill, resolver.reject);
                    }
                    else if (Object(value) === value && typeof value.then === "function") {
                        value.then(resolve, resolver.reject);
                    }
                    else {
                        resolver.fulfill(value);
                    }
                }
                catch (e) {
                    resolver.reject(e);
                }
            };

            resolve(value);
        });
    }

    /** 
     * Determines if a value is a Promise
     * @param value The value to test
     * @returns True if the value is a Promise instance; otherwise, false.
     *
     * (not currently specified)
     */
    public static isPromise(value: any): boolean {
        return value instanceof Promise;
    }

    /** 
     * Creates a new chained Promise that is resolved by executing the continuations provided when this Promise completes.
     * @param resolve The callback to execute when the parent Promise is resolved. 
     * @param reject The callback to execute when the parent Promise is rejected. 
     * @returns A new chained Promise whose resolution and rejection are the result of the execution of continuations to this function.
     * 
     * The resolve callback is invoked when this Promise is resolved. The argument to the resolve callback is the value for this Promise. 
     * The return value of the resolve callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the resolve callback, the chained Promise is rejected using the error that was thrown.
     * If the resolve argument is null or undefined, the chained Promise will be resolved with the value for this Promise.
     * 
     * The reject callback is invoked when this Promise is rejected. The argument to the reject callback is the error for this Promise.
     * The return value of the reject callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the reject callback, the chained Promise is rejected using the error that was thrown.
     * If the reject argument is null or undefined, the chained Promise will be rejected with the error for this Promise.
     *
     * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
     * To handle these exceptions you must either create a new chained Promise that handles the reject callback, or call Promise#done.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-then
     */
    public then<TResult>(resolve?: (value: T) => Promise<TResult>, reject?: (value: any) => Promise<TResult>): Promise<TResult>;

    /** 
     * Creates a new chained Promise that is resolved by executing the continuations provided when this Promise completes.
     * @param resolve The callback to execute when the parent Promise is resolved. 
     * @param reject The callback to execute when the parent Promise is rejected. 
     * @returns A new chained Promise whose resolution and rejection are the result of the execution of continuations to this function.
     * 
     * The resolve callback is invoked when this Promise is resolved. The argument to the resolve callback is the value for this Promise. 
     * The return value of the resolve callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the resolve callback, the chained Promise is rejected using the error that was thrown.
     * If the resolve argument is null or undefined, the chained Promise will be resolved with the value for this Promise.
     * 
     * The reject callback is invoked when this Promise is rejected. The argument to the reject callback is the error for this Promise.
     * The return value of the reject callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the reject callback, the chained Promise is rejected using the error that was thrown.
     * If the reject argument is null or undefined, the chained Promise will be rejected with the error for this Promise.
     *
     * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
     * To handle these exceptions you must either create a new chained Promise that handles the reject callback, or call Promise#done.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-then
     */
    public then<TResult>(resolve?: (value: T) => Promise<TResult>, reject?: (value: any) => TResult): Promise<TResult>;

    /** 
     * Creates a new chained Promise that is resolved by executing the continuations provided when this Promise completes.
     * @param resolve The callback to execute when the parent Promise is resolved. 
     * @param reject The callback to execute when the parent Promise is rejected. 
     * @returns A new chained Promise whose resolution and rejection are the result of the execution of continuations to this function.
     * 
     * The resolve callback is invoked when this Promise is resolved. The argument to the resolve callback is the value for this Promise. 
     * The return value of the resolve callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the resolve callback, the chained Promise is rejected using the error that was thrown.
     * If the resolve argument is null or undefined, the chained Promise will be resolved with the value for this Promise.
     * 
     * The reject callback is invoked when this Promise is rejected. The argument to the reject callback is the error for this Promise.
     * The return value of the reject callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the reject callback, the chained Promise is rejected using the error that was thrown.
     * If the reject argument is null or undefined, the chained Promise will be rejected with the error for this Promise.
     *
     * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
     * To handle these exceptions you must either create a new chained Promise that handles the reject callback, or call Promise#done.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-then
     */
    public then<TResult>(resolve?: (value: T) => TResult, reject?: (value: any) => Promise<TResult>): Promise<TResult>;

    /** 
     * Creates a new chained Promise that is resolved by executing the continuations provided when this Promise completes.
     * @param resolve The callback to execute when the parent Promise is resolved. 
     * @param reject The callback to execute when the parent Promise is rejected. 
     * @returns A new chained Promise whose resolution and rejection are the result of the execution of continuations to this function.
     * 
     * The resolve callback is invoked when this Promise is resolved. The argument to the resolve callback is the value for this Promise. 
     * The return value of the resolve callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the resolve callback, the chained Promise is rejected using the error that was thrown.
     * If the resolve argument is null or undefined, the chained Promise will be resolved with the value for this Promise.
     * 
     * The reject callback is invoked when this Promise is rejected. The argument to the reject callback is the error for this Promise.
     * The return value of the reject callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the reject callback, the chained Promise is rejected using the error that was thrown.
     * If the reject argument is null or undefined, the chained Promise will be rejected with the error for this Promise.
     *
     * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
     * To handle these exceptions you must either create a new chained Promise that handles the reject callback, or call Promise#done.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-then 
     */
    public then<TResult>(resolve?: (value: T) => TResult, reject?: (value: any) => TResult): Promise<TResult>;

    public then(resolve?: (value: T) => any, reject?: (value: any) => any): Promise<any> {
        return new Promise(resolver => {
            var resolverData = $PromiseGetData(resolver);
            $PromiseAppend(this._promiseData,
                resolve ? $WrapResolveCallback(resolverData, resolve) : value => { $PromiseFulfill(resolverData, value, true); },
                reject ? $WrapResolveCallback(resolverData, reject) : value => { $PromiseReject(resolverData, value, true); });
        });
    }

    /** 
     * A short form for Promise#then that only handles the rejection of the Promise.
     * @param reject The callback to execute when the parent Promise is rejected. 
     * @returns A new chained Promise.
     *
     * The reject callback is invoked when this Promise is rejected. The argument to the reject callback is the error for the Promise.
     * The return value of the reject callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the reject callback, the chained Promise is rejected using the error that was thrown.
     * If the reject argument is null or undefined, the chained Promise will be rejected with the error for this Promise.
     *
     * If this Promise is resolved, the chained Promise will be resolved with the value.
     *
     * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
     * To handle these exceptions you must either create a new chained Promise that handles the reject callback, or call Promise#done.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-catch
     */
    public catch<TResult>(reject: (value: any) => Promise<TResult>): Promise<TResult>;

    /** 
     * A short form for Promise#then that only handles the rejection of the Promise.
     * @param reject The callback to execute when the parent Promise is rejected. 
     * @returns A new chained Promise.
     *
     * The reject callback is invoked when this Promise is rejected. The argument to the reject callback is the error for the Promise.
     * The return value of the reject callback becomes the resolved value for the chained Promise. 
     * If an error is thrown during the reject callback, the chained Promise is rejected using the error that was thrown.
     * If the reject argument is null or undefined, the chained Promise will be rejected with the error for this Promise.
     *
     * If this Promise is resolved, the chained Promise will be resolved with the value.
     *
     * Unhandled exceptions that are not handled by a reject callback will not propagate to the host. 
     * To handle these exceptions you must either create a new chained Promise that handles the reject callback, or call Promise#done.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-catch
     */
    public catch<TResult>(reject: (value: any) => TResult): Promise<TResult>;

    public catch(reject: (value: any) => any): Promise {
        return this.then(null, reject);
    }

    /** 
     * Handles the resolution or rejection of the Promise at the end of a chain.
     * @param resolve {Function} The callback to execute when the Promise is resolved. 
     * @param reject {Function} The callback to execute when the Promise is rejected.
     * 
     * The resolve callback is invoked when this Promise is resolved. The argument to the resolve callback is the value for the Promise. 
     * If an error is thrown during the resolve callback, the error will be raised to the host.
     * 
     * The reject callback is invoked when this Promise is rejected. The argument to the reject callback is the error for the Promise.
     * If an error is thrown during the reject callback, the error will be raised to the host.
     * If the reject argument is null or undefined, the error from this Promise will be raised to the host.
     * 
     * Unhandled exceptions that are not handled by a reject callback will propagate to the host. 
     *
     * (not specified)
     */
    public done(resolve?: (value: T) => void , reject?: (value: any) => void ): void {
        $PromiseAppend(this._promiseData,
            resolve,
            reject || e => { throw e; });
    }
}

/** 
 * A resolver for a Promise
 * 
 * @link http://dom.spec.whatwg.org/#promiseresolver
 */
export class PromiseResolver<T> {

    private _promiseData: PromiseData<T>;

    /** 
     * A resolver for a Promise.
     * 
     * @link http://dom.spec.whatwg.org/#promiseresolver
     */
    constructor() {
        throw new TypeError("Object doesn't support this action");
    }

    /** 
     * Accepts a value as the completion value of the Promise. If the Promise has already been resolved, no changes will be made.
     * @param value The value to accept
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-accept
     */
    public fulfill(value: T): void {
        $PromiseFulfill(this._promiseData, value);
    }

    /** 
     * Accepts a value as the completion value of the Promise.  If the value is itself a Promise, the Promise will not be resolved until the value resolves. If the Promise has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-resolve
     */
    public resolve(value: Promise<T>): void;

    /** 
     * Accepts a value as the completion value of the Promise.  If the value is itself a Promise, the Promise will not be resolved until the value resolves. If the Promise has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-resolve
     */
    public resolve(value: T): void;

    /** 
     * Accepts a value as the completion value of the Promise.  If the value is itself a Promise, the Promise will not be resolved until the value resolves. If the Promise has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-resolve
     */
    public resolve(value: any): void {
        $PromiseResolve(this._promiseData, value);
    }

    /** 
     * Rejects the Promise using the provided argument as the reason. If the Promise has already been resolved, no changes will be made.
     * @param err The reason for the rejection.
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-reject
     */
    public reject(value: any): void {
        $PromiseReject(this._promiseData, value);
    }
}

enum PromiseState { pending, fulfilled, rejected }

interface PromiseData<T> {
    promise?: Promise<T>;
    resolver?: PromiseResolver<T>;
    state?: PromiseState;
    result?: any;
    resolveCallbacks?: Function[];
    rejectCallbacks?: Function[];
}

function $PromiseGetData<T>(promise: Promise<T>): PromiseData<T>;
function $PromiseGetData<T>(resolver: PromiseResolver<T>): PromiseData<T>;
function $PromiseGetData<T>(promise: any): PromiseData<T> {
    return promise._promiseData;
}

function $PromiseCreate<T>(promise: Promise<T>, resolver: PromiseResolver<T>): void {
    var data: PromiseData<T> = {
        promise: promise,
        resolver: resolver,
        state: PromiseState.pending
    };
    Object.defineProperty(promise, "_promiseData", { value: data });
    Object.defineProperty(resolver, "_promiseData", { value: data });
}

function $PromiseFulfill<T>(data: PromiseData<T>, value: T, synchronous: boolean = false): void {
    if (data.state !== PromiseState.pending) {
        return;
    }

    data.state = PromiseState.fulfilled;
    data.result = value;

    $PromiseProcess(data.resolveCallbacks, value, synchronous);
}

function $PromiseResolve<T>(data: PromiseData<T>, value: T, synchronous: boolean = false): void;
function $PromiseResolve<T>(data: PromiseData<T>, value: Promise<T>, synchronous: boolean = false): void;
function $PromiseResolve<T>(data: PromiseData<T>, value: any, synchronous: boolean = false): void {
    if (data.state !== PromiseState.pending) {
        return;
    }

    if (value === data.promise) {
        throw new TypeError("Promise cannot be resolved with itself")
    }

    if (Promise.isPromise(value)) {
        var resolve = value => $PromiseFulfill(data, value, true);
        var reject = value => $PromiseReject(data, value, true);

        try {
            value.done(resolve, reject);
        }
        catch (e) {
            $PromiseReject(data, e, synchronous);
        }

        return;
    }

    $PromiseFulfill(data, value, synchronous);
}

function $PromiseReject<T>(data: PromiseData<T>, value: any, synchronous: boolean = false): void {
    if (data.state !== PromiseState.pending) {
        return;
    }

    data.state = PromiseState.rejected;
    data.result = value;

    $PromiseProcess(data.rejectCallbacks, value, synchronous);
}

function $PromiseAppend<T>(data: PromiseData<T>, resolveCallback: (value: T) => void , rejectCallback: (value: any) => void ): void {
    if (data.state === PromiseState.pending || data.state === PromiseState.fulfilled) {
        if (typeof resolveCallback === "function") {
            if (data.resolveCallbacks == null) {
                data.resolveCallbacks = [];
            }

            data.resolveCallbacks.push(resolveCallback);
        }
    }

    if (data.state === PromiseState.pending || data.state === PromiseState.rejected) {
        if (typeof rejectCallback === "function") {
            if (data.rejectCallbacks == null) {
                data.rejectCallbacks = [];
            }

            data.rejectCallbacks.push(rejectCallback);
        }
    }

    if (data.state === PromiseState.fulfilled) {
        // the Promise has already been accepted, process the resolve callbacks in a later turn
        $PromiseProcess(data.resolveCallbacks, data.result, false);
    }
    else if (data.state === PromiseState.rejected) {
        // the Promise has already been rejected, process the reject callbacks in a later turn
        $PromiseProcess(data.rejectCallbacks, data.result, false);
    }
}

function $PromiseProcess(callbacks: Function[], result: any, synchronous: boolean): void {
    if (callbacks) {
        var callback: Function;
        while (callback = callbacks.shift()) {
            $SchedulerPostTask(callback.bind(null, result), synchronous);
        }
    }
}

function $WrapResolveCallback<T>(data: PromiseData<T>, callback: (value: any) => any): (value: any) => void {
    var wrapper = (value: any) => {
        try {
            value = callback.call(data.promise, value);
        }
        catch (e) {
            $PromiseReject(data, e, true);
            return;
        }

        $PromiseResolve(data, value, true);
    }

    return wrapper;
}

function $SchedulerPostTask(task: () => void , synchronous: boolean = false): void {
    if (synchronous) {
        try {
            task();
        }
        catch (e) {
            $SchedulerPostTask(() => { throw e; });
        }

        return;
    }

    var domain = isNode && process.domain;
    if (domain) {
        task = domain.bind(task);
    }

    if (!schedulerNextQueue) {
        schedulerNextQueue = [];
    }

    schedulerNextQueue.push(task);

    $SchedulerRequestTick();
}

function $SchedulerRequestTick(): void {
    if (!schedulerTickRequested) {
        if (!schedulerRequestTickCore) {
            if (typeof setImmediate === "function") {
                schedulerRequestTickCore = () => { setImmediate($SchedulerTick); }
            }
            else if (typeof MessageChannel === "function") {
                schedulerChannel = new MessageChannel();
                schedulerChannel.port1.onmessage = $SchedulerTick;
                schedulerRequestTickCore = () => { schedulerChannel.port2.postMessage(null); }
            }
            else if (isNode) {
                schedulerRequestTickCore = () => { process.nextTick($SchedulerTick); };
            }
            else {
                schedulerRequestTickCore = () => { setTimeout($SchedulerTick); };
            }
        }

        schedulerRequestTickCore();
        schedulerTickRequested = true;
    }
}

function $SchedulerTick(): void {
    // clear the tick request
    schedulerTickRequested = false;

    // drain the active queue for any pending work
    if (schedulerActiveQueue) {
        try {
            var task: () => void;
            while (task = schedulerActiveQueue.shift()) {
                task();
            }
        }
        finally {
            // if we're not done, request a new tick to continue processing
            if (schedulerActiveQueue.length) {
                $SchedulerRequestTick();
                return;
            }
        }
    }

    // swap queues
    schedulerActiveQueue = schedulerNextQueue;
    schedulerNextQueue = null;

    // if we have new work to do, request a new tick
    if (schedulerActiveQueue) {
        $SchedulerRequestTick();
    }
}

declare var process: {
    nextTick(fn: Function): void;
    domain: {
        bind<TFunction extends Function>(fn: TFunction): TFunction;
    }
};

declare function setImmediate(fn: Function, ...args: any[]): number;

var isNode = typeof process === "object"
    && Object.prototype.toString.call(process) === "[object process]"
    && typeof process.nextTick === "function";

var schedulerActiveQueue: { (): void; }[];
var schedulerNextQueue: { (): void; }[];
var schedulerTickRequested: boolean = false;
var schedulerChannel: MessageChannel;
var schedulerRequestTickCore: () => void;

// polyfill for Promises
if (typeof window !== "undefined" && typeof (<any>window).Promise === "undefined") {
    (<any>window).Promise = Promise;
    (<any>window).PromiseResolver = PromiseResolver;
}