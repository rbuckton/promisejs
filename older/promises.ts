/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
declare var process: {
    nextTick(fn: Function): void;
    domain: {
        bind<TFunction extends Function>(fn: TFunction): TFunction;
    }
};

declare function setImmediate(fn: Function, ...args: any[]): number;
declare function clearImmediate(handle: number): void;

var isNode = typeof process === "object"
    && Object.prototype.toString.call(process) === "[object process]"
    && typeof process.nextTick === "function";
var defaultScheduler: Scheduler = null;
var currentScheduler: Scheduler = null;
var MAX_HANDLE: number = 2147483647;
var nextCancellationHandle: number = 1;

function is(x, y): boolean {
    return (x === y)
        ? (x !== 0 || 1 / x === 1 / y)
        : (x !== x && y !== y);
}

interface Node {
    prev?: Node;
    next?: Node;
    list?: { head?: Node };
    token?: CancellationToken;
    handle?: number;
    callback: Function;
}

function $ListAppend(list: { head?: Node; }, node: Node): Node {
    if (node && !node.next && !node.list) {
        if (list.head) {
            var pos = list.head.prev;
            node.prev = pos;
            node.next = pos.next;
            pos.next.prev = node;
            pos.next = node;
        }
        else {
            node.next = node;
            node.prev = node;
            list.head = node;
        }

        node.list = list;
    }

    return node;
}

function $ListDelete(list: { head?: Node; }, node: Node): Node {
    if (node && node.next && node.list === list) {
        if (node.next !== node) {
            node.next.prev = node.prev;
            node.prev.next = node.next;
        }

        if (list.head === node) {
            if (node.next === node) {
                list.head = null;
            }
            else {
                list.head = <Node>node.next;
            }
        }

        node.list = node.prev = node.next = null;
    }

    return node;
}

function $ListIterate(list: { head?: Node; }, callback: (node: Node) => void ): void {
    $ListFind(list, node => {
        callback(node);
        return false;
    })
}

function $ListFind(list: { head?: Node; }, predicate: (node: Node) => boolean): Node {
    var node = list.head;
    if (node) {
        do {
            if (predicate(node)) {
                return node;
            }

            node = <Node>node.next;
        }
        while (node && node !== list.head);
    }

    return null;
}

/** 
 * Source for cancellation
 */
export class CancellationSource {
    private _cancelData: CancellationData;

    /** 
     * Source for cancellation
     * @param tokens One or more tokens to link to a new source 
     */
    constructor(...tokens: CancellationToken[]) {
        var token = Object.create(CancellationToken.prototype);
        this.cancel = this.cancel.bind(this);
        this.cancelAfter = this.cancelAfter.bind(this);

        $CancellationCreate(this, token);

        // link any optional tokens
        tokens.forEach(token => {
            if (token) {
                $CancellationLink(this._cancelData, token)
            }
        });

        // freeze the token to prevent modification
        Object.freeze(token);
    }

    /** 
     * Gets the token for this source
     */
    public get token(): CancellationToken {
        return this._cancelData.token;
    }

    /** 
     * Cancels the source
     */
    public cancel(): void {
        if (this._cancelData.closed) throw new Error("Object doesn't support this action");
        $CancellationCancel(this._cancelData);
    }

    /** 
     * Cancels the source after a number of milliseconds has elapsed
     * @param delay The number of milliseconds to wait
     */
    public cancelAfter(delay: number): void {
        if (this._cancelData.closed) throw new Error("Object doesn't support this action");
        $CancellationCancelAfter(this._cancelData, delay);
    }

    /** 
     * Cleans up the cancellation source
     */
    public close(): void {
        if (this._cancelData.closed) return;

        this._cancelData.closed = true;

        var links = this._cancelData.links;
        this._cancelData.links = null;

        $ListIterate(links, node => { node.callback.call(null); });
    }
}

/** 
 * Token used for cancellation
 */
export class CancellationToken {
    private _cancelData: CancellationData;

    /**
     * Token used for cancellation
     */
    constructor() {
        throw new TypeError("Object doesn't support this action");
    }

    /**
     * Gets a value indicating whether the token has been canceled
     * @type {Boolean}
     */
    public get canceled(): boolean {
        return this._cancelData.canceled;
    }

    /** 
     * Registers a cleanup callback
     * @param cleanup The callback to execute when cancellation is requested
     * @returns A handle to the cleanup callback that can be used to unregister the callback
     */
    public register(cleanup: () => void ): number {
        return $CancellationRegister(this._cancelData, cleanup);
    }

    /** 
     * Unregisters a cleanup callback
     * @param handle The handle to unregister
     */
    public unregister(handle: number): void {
        $CancellationUnregister(this._cancelData, handle);
    }
}

interface CancellationData {
    token: CancellationToken;
    source: CancellationSource;
    closed: boolean;
    canceled: boolean;
    cleanupCallbacks?: { head?: Node; };
    links?: { head?: Node; };
    cancelHandle?: number;
}

function $CancellationCreate(source: CancellationSource, token: CancellationToken) {
    var data: CancellationData = { 
        source: source, 
        token: token,
        closed: false,
        canceled: false
    };
    
    Object.defineProperty(source, "_cancelData", { value: data });
    Object.defineProperty(token, "_cancelData", { value: data });
}

function $CancellationRegister(data: CancellationData, cleanup: () => void ): number {
    if (data.canceled) {
        cleanup();
        return 0;
    }

    if (nextCancellationHandle >= MAX_HANDLE) {
        nextCancellationHandle = 1;
    }

    var handle = nextCancellationHandle++;

    if (data.cleanupCallbacks == null) {
        data.cleanupCallbacks = {};
    }

    $ListAppend(data.cleanupCallbacks, { handle: handle, callback: cleanup });
    return handle;
}

function $CancellationUnregister(data: CancellationData, handle: number): void {
    if (data.cleanupCallbacks) {
        var found = $ListFind(data.cleanupCallbacks, node => is(node.handle, handle));
        if (found) {
            $ListDelete(data.cleanupCallbacks, found);
        }
    }
}

function $CancellationLink(data: CancellationData, token: CancellationToken): void {

    // lazy-init the links
    if (data.links == null) {
        data.links = {};
    }

    // register linked cancellation
    var handle = token.register(() => {
        $CancellationCancel(data);
    });

    $ListAppend(data.links, { handle: handle, callback: () => { $CancellationUnregister(data, handle); } });
}

function $CancellationCancel(data: CancellationData): void {
    if (data.canceled) {
        return;
    }

    data.canceled = true;


    // execute each cleanup callback and catch any errors
    var errors: any[];
    $ListIterate(data.cleanupCallbacks, value => {
        try {
            value.callback.call(null);
        }
        catch (e) {
            if (errors == null) {
                errors = [];
            }

            errors.push(e);
        }
    });

    data.cleanupCallbacks = null;

    // if there were any errors, throw them
    if (errors) {
        throw new AggregateError(null, errors);
    }
}

function $CancellationCancelAfter(data: CancellationData, delay: number): void {
    if (data.canceled) {
        return;
    }

    if (data.cancelHandle) {
        clearTimeout(data.cancelHandle);
        data.cancelHandle = null;
    }

    data.cancelHandle = setTimeout(() => { $CancellationCancel(data); }, delay);
}

function $CancellationTryCreateLinked(token1: CancellationToken, token2: CancellationToken): CancellationSource {
    if (token1 || token2) {
        return new CancellationSource(token1, token2);
    }

    return null;
}

/**
 * Schedules microtasks
 */
export class Scheduler {
    private _scheduler: SchedulerBase;

    /** 
     * A Scheduler for microtasks in the event loop
     */
    constructor() {
        this._scheduler = $CreateScheduler();
    }

    /**
     * Gets the default Scheduler
     * @type {Scheduler}
     */
    public static get default(): Scheduler {
        if (!defaultScheduler) {
            defaultScheduler = new Scheduler();
            Object.freeze(defaultScheduler);
        }

        return defaultScheduler;
    }

    /**
     * Gets the current Scheduler
     * @type {Scheduler}
     */
    public static get current(): Scheduler {
        if (!currentScheduler) {
            currentScheduler = Scheduler.default;
        }

        return currentScheduler;
    }

    /** Posts a microtask to the Scheduler
      * @param task The task to schedule
      * @param options Option that affect task scheduling
      * @param token The token to use for cancellation
      */
    public post(task: () => void , options?: { synchronous?: boolean; delay?: number; }, token?: CancellationToken): void {
        // bind the task to the Scheduler
        task = $BindTask(this, task);

        // schedule the task
        this._scheduler.post(task, options, token);
    }
}

class SchedulerBase {
    private activeQueue: { head?; };
    private nextQueue: { head?; };
    private tickRequested: boolean = false;

    public post(task: () => void , options: { synchronous?: boolean; delay?: number; }, token: CancellationToken): void {
        if (options) {
            if (options.synchronous) {
                this.postSynchronous(task, token);
                return;
            }
            else if ("delay" in options) {
                this.postAfter(task, options.delay, token);
                return;
            }
        }

        if (!this.nextQueue) {
            this.nextQueue = {};
        }

        var node = $ListAppend(this.nextQueue, {
            callback: () => {
                if (token) {
                    if (token.canceled) {
                        return;
                    }

                    if (tokenHandle) {
                        token.unregister(tokenHandle);
                    }
                }

                task();
            }
        });

        var tokenHandle: number;
        if (token) {
            tokenHandle = token.register(() => {
                if (node.list) {
                    $ListDelete(node.list, node);
                }
            });
        }

        this.requestTick();
    }

    private postSynchronous(task: () => void , token: CancellationToken): void {
        if (!(token && token.canceled)) {
            try {
                task();
            }
            catch (e) {
                this.post(() => { throw e; }, null, null);
            }
        }
    }

    private postAfter(task: () => void , delay: number, token: CancellationToken): void {
        var taskHandle = setTimeout(() => {
            if (token && tokenHandle) {
                token.unregister(tokenHandle);
            }

            task();
        }, delay);

        var tokenHandle: number;
        if (token) {
            tokenHandle = token.register(() => {
                clearTimeout(taskHandle);
            });
        }
    }

    private requestTick(): void {
        if (!this.tickRequested) {
            this.requestTickCore();
            this.tickRequested = true;
        }
    }

    public requestTickCore(): void {
    }

    public tick(): void {
        // clear the tick request
        this.tickRequested = false;

        // drain the active queue for any pending work
        if (this.activeQueue) {
            this.drainQueue();
            if (this.activeQueue) {
                this.requestTick();
                return;
            }
        }

        // swap queues
        this.activeQueue = this.nextQueue;
        this.nextQueue = null;

        // if we have new work to do, request a new tick
        if (this.activeQueue) {
            this.requestTick();
        }
    }

    private drainQueue(): void {
        try {
            var node;
            while (node = $ListDelete(this.activeQueue, this.activeQueue.head)) {
                var task = node.callback;
                task();
            }
        }
        finally {
            // if we're not done, request a new tick to continue processing
            if (this.activeQueue.head) {
                return;
            }
        }

        this.activeQueue = null;
    }
}

class SetTimeoutScheduler extends SchedulerBase {
    public requestTickCore(): void {
        setTimeout(() => {
            this.tick();
        }, 0);
    }
}

class SetImmediateScheduler extends SchedulerBase {
    public requestTickCore(): void {
        setImmediate(() => {
            this.tick();
        });
    }
}

class MessageChannelScheduler extends SchedulerBase {
    private channel: MessageChannel;

    constructor() {
        super();
        this.channel = new MessageChannel();
        this.channel.port1.onmessage = () => { this.tick(); };
    }

    public requestTickCore(): void {
        this.channel.port2.postMessage(null);
    }
}

class NodeScheduler extends SchedulerBase {
    public requestTickCore(): void {
        process.nextTick(() => { this.tick(); });
    }
}

function $CreateScheduler(): SchedulerBase {
    if (typeof setImmediate === "function") {
        return new SetImmediateScheduler();
    }

    if (typeof MessageChannel === "function") {
        return new MessageChannelScheduler();
    }

    if (isNode) {
        return new NodeScheduler();
    }

    return new SetTimeoutScheduler();
}

function $BindTask(Scheduler: Scheduler, task: () => void ): () => void {
    var wrapped = () => {
        var previousScheduler = currentScheduler;
        currentScheduler = Scheduler;
        try {
            task();
        }
        finally {
            currentScheduler = previousScheduler;
        }
    }

    var domain = $GetDomain();
    if (domain) {
        wrapped = domain.bind(wrapped);
    }

    return wrapped;
}

function $GetDomain() {
    if (isNode) {
        return process.domain;
    }
}

/** 
 * A Future value
 * 
 * @link http://dom.spec.whatwg.org/#promise
 */
export class Promise<T> {

    private _promiseData: PromiseData<T>;

    /** 
     * A Future value
     * @param init A callback whose first argument is the resolver for the future
     * @param token  A cancellation token used to prevent cancel the future
     *
     * @link http://dom.spec.whatwg.org/#promises
     */
    constructor(init: (resolver: PromiseResolver<T>) => void , token?: CancellationToken) {
        var resolver: PromiseResolver<T> = Object.create(PromiseResolver.prototype);
        resolver.fulfill = resolver.fulfill.bind(resolver);
        resolver.resolve = resolver.resolve.bind(resolver);
        resolver.reject = resolver.reject.bind(resolver);
        resolver.cancel = resolver.cancel.bind(resolver);

        $PromiseCreate(this, resolver, token);

        try {
            init.call(this, resolver);
        }
        catch (e) {
            $PromiseReject(this._promiseData, e);
        }
    }

    /** 
     * Creates a new Future that is already in the fulfilled state with the provided value as the result.
     * @param value The value for the Future
     * @returns A Future for the value.
     * 
     * @link http://dom.spec.whatwg.org/#dom-promise-fulfill
     */
    public static fulfill<TResult>(value: TResult): Promise<TResult> {
        return new Promise<TResult>(resolver => {
            resolver.fulfill(value)
        });
    }

    /** 
     * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Future
     * @param token The token to use for cancellation
     * @returns A Future for the value
     */
    public static resolve<TResult>(value: Promise<TResult>, token?: CancellationToken): Promise<TResult>;

    /** 
     * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Future
     * @returns A Future for the value
     */
    public static resolve<TResult>(value: TResult): Promise<TResult>;

    /** 
     * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Future
     * @param token The token to use for cancellation
     * @returns A Future for the value
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-resolve
     */
    public static resolve(value: any, token?: CancellationToken): Promise {
        return new Promise(resolver => {
            resolver.resolve(value);
        }, token);
    }

    /** 
     * Creates a new Future that is already in the rejected state with the provided value as the result.
     * @param value The value for the Future
     * @returns A Future for the value.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-reject
     */
    public static reject<TResult>(value: any): Promise<TResult> {
        return new Promise(resolver => {
            resolver.reject(value);
        });
    }

    /** 
     * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
     * @param values The values to wait upon. 
     * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-any (modified)
     */
    public static any(...values: any[]): Promise<any> {
        return new Promise(resolver => {
            var data: PromiseData<any> = (<any>resolver)._promiseData;
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
     * Creates a Future that is resolved when all of the provided values have resolved, or rejected when any of the values provided are rejected.
     * @param values The values to wait upon. 
     * @returns A new Future that is either resolved with an array of the resolved values of all Futures, or rejected with the error of the first Future that is rejected.
     *
     * When the new Future is resolved, the order of the values in the result will be the same as the order of the Futures provided to Future.every.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-every (modified)
     */
    public static every(...values: any[]): Promise<any[]> {
        return new Promise(resolver => {
            var data: PromiseData<any[]> = (<any>resolver)._promiseData;
            var countdown = values.length;
            var results: any[] = new Array<any>(countdown);
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
     * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or all are rejected.
     * @param values The values to wait upon. 
     * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with an array of errors of all of the Futures that were rejected.
     *
     * If the new Future is rejected, the order of the errors in the result will be the same as the order of the Futures provided to Future.some.
     *
     * @link http://dom.spec.whatwg.org/#dom-promise-some (modified)
     */
    public static some(...values: any[]): Promise<any> {
        return new Promise(resolver => {
            var data: PromiseData<any> = (<any>resolver)._promiseData;
            var countdown = values.length;
            var results = new Array(countdown);
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
    public static from(value: any, token?: CancellationToken): Promise<any> {
        if (Promise.isPromise(value)) {
            return value;
        }

        var cts = new CancellationSource(token);
        return new Promise<any>(function (resolver) {
            var resolve = value => {
                if (!cts.token.canceled) {
                    try {
                        if (Promise.isPromise(value)) {
                            value.done(resolver.fulfill, resolver.reject, cts.cancel, cts.token);
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
                }
            };

            resolve(value);
        }, cts.token);
    }

    /** 
     * Determines if a value is a Future
     * @param value The value to test
     * @returns True if the value is a Future instance; otherwise, false.
     *
     * (not currently specified)
     */
    public static isPromise(value: any): boolean {
        return value instanceof Promise;
    }

    /** 
     * Creates a Future that resolves as undefined in the next turn of the event loop
     * @param token An optional cancellation token to use to cancel the result
     * @returns The new Future
     *
     * (not currently specified)
     */
    public static yield(token?: CancellationToken): Promise<any> {
        return new Promise<any>(resolver => {
            Scheduler.current.post(() => {
                resolver.resolve(void 0);
            }, token);
        }, token);
    }

    /** 
     * Sleeps for a period of time before resolving the future
     * @param delay The number of milliseconds to wait before resolving
     * @param value The value to use for resolution when the future resolves
     * @param token The token to use for 
     * @returns The new Future
     */
    public static sleep<TResult>(delay: number, value?: Promise<TResult>, token?: CancellationToken): Promise<TResult>;

    /** 
     * Sleeps for a period of time before resolving the future
     * @param delay The number of milliseconds to wait before resolving
     * @param value The value to use for resolution when the future resolves
     * @param token The token to use for 
     * @returns The new Future
     */
    public static sleep<TResult>(delay: number, value?: TResult, token?: CancellationToken): Promise<TResult>;

    public static sleep(delay: number, value?, token?: CancellationToken): Promise {
        return new Promise(resolver => {
            Scheduler.current.post(() => {
                resolver.resolve(value);
            }, { delay: delay }, token);
        }, token);
    }

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param delay The number of milliseconds to wait before executing the callback
     * @param token The token to use for cancellation
     * @returns A Future for the result or exception from the callback
     */
    public static run<TResult>(func: () => Promise<TResult>, delay?: number, token?: CancellationToken): Promise<TResult>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param delay The number of milliseconds to wait before executing the callback
     * @param token The token to use for cancellation
     * @returns A Future for the result or exception from the callback
     */
    public static run<TResult>(func: () => TResult, delay?: number, token?: CancellationToken): Promise<TResult>;

    public static run(func: () => any, delay?: number, token?: CancellationToken): Promise {
        var options;
        if (typeof delay === "number") {
            options = { delay: delay };
        }

        return new Promise<any>(resolver => {
            var resolverData: PromiseData<any> = (<any>resolver)._promiseData;
            Scheduler.current.post(() => {
                try {
                    $PromiseResolve(resolverData, func(), true);
                }
                catch (e) {
                    $PromiseReject(resolverData, e, true);
                }
            }, options, token);
        }, token);
    }

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
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
     * @link http://dom.spec.whatwg.org/#dom-promise-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => Promise<TResult>, reject?: (value: any) => Promise<TResult>, cancel?: () => void , token?: CancellationToken): Promise<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
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
     * @link http://dom.spec.whatwg.org/#dom-promise-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => Promise<TResult>, reject?: (value: any) => TResult, cancel?: () => void , token?: CancellationToken): Promise<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
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
     * @link http://dom.spec.whatwg.org/#dom-promise-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => TResult, reject?: (value: any) => Promise<TResult>, cancel?: () => void , token?: CancellationToken): Promise<TResult>;

    /** 
     * Creates a new chained Future that is resolved by executing the continuations provided when this Future completes.
     * @param resolve The callback to execute when the parent Future is resolved. 
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
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
     * @link http://dom.spec.whatwg.org/#dom-promise-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => TResult, reject?: (value: any) => TResult, cancel?: () => void , token?: CancellationToken): Promise<TResult>;

    public then(resolve?: (value: T) => any, reject?: (value: any) => any, cancel?: () => void , token?: CancellationToken): Promise<any> {
        return new Promise(resolver => {
            var resolverData = $PromiseGetData(resolver);
            $PromiseAppend(this._promiseData,
                resolve ? $WrapResolveCallback(resolverData, resolve) : value => { $PromiseFulfill(resolverData, value, true); },
                reject ? $WrapResolveCallback(resolverData, reject) : value => { $PromiseReject(resolverData, value, true); },
                cancel ? $WrapCancelCallback(resolverData, cancel) : () => { $PromiseCancel(resolverData); },
                token);
        });
    }

    /** 
     * A short form for Future#then that only handles the rejection of the Future.
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
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
     * @link http://dom.spec.whatwg.org/#dom-promise-catch
     */
    public catch<TResult>(reject: (value: any) => Promise<TResult>, token?: CancellationToken): Promise<TResult>;

    /** 
     * A short form for Future#then that only handles the rejection of the Future.
     * @param reject The callback to execute when the parent Future is rejected. 
     * @param token A cancellation token that can be used to cancel the request.
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
     * @link http://dom.spec.whatwg.org/#dom-promise-catch
     */
    public catch<TResult>(reject: (value: any) => TResult, token?: CancellationToken): Promise<TResult>;

    public catch(reject: (value: any) => any, token?: CancellationToken): Promise {
        return this.then(null, reject, null, token);
    }

    /** 
     * Handles the resolution or rejection of the Future at the end of a chain.
     * @param resolve {Function} The callback to execute when the Future is resolved. 
     * @param reject {Function} The callback to execute when the Future is rejected. 
     * @param cancel {Function} The callback to execute when the Future is canceled.
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
     * @link http://dom.spec.whatwg.org/#dom-promise-catch
     */
    public done(resolve?: (value: T) => void , reject?: (value: any) => void , cancel?: () => void , token?: CancellationToken): void {
        $PromiseAppend(this._promiseData,
            resolve,
            reject || e => { throw e; },
            cancel,
            token);
    }
}

/** 
 * A resolver for a Future
 * 
 * @link http://dom.spec.whatwg.org/#futureresolver
 */
export class PromiseResolver<T> {

    private _promiseData: PromiseData<T>;

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
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-accept
     */
    public fulfill(value: T): void {
        $PromiseFulfill(this._promiseData, value);
    }

    /** 
     * Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-resolve
     */
    public resolve(value: Promise<T>): void;

    /** 
     * Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-resolve
     */
    public resolve(value: T): void;

    /** 
     * Accepts a value as the completion value of the Future.  If the value is itself a Future, the Future will not be resolved until the value resolves. If the Future has already been resolved, no changes will be made.
     * @param value The value to resolve
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-resolve
     */
    public resolve(value: any): void {
        $PromiseResolve(this._promiseData, value);
    }

    /** 
     * Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
     * @param err The reason for the rejection.
     *
     * @link http://dom.spec.whatwg.org/#dom-promiseresolver-reject
     */
    public reject(value: any): void {
        $PromiseReject(this._promiseData, value);
    }

    /**
     * Cancels the future
     */
    public cancel(): void {
        $PromiseCancel(this._promiseData);
    }
}

/**
 * The valid states for a promise
 */
enum PromiseState {
    /**
     * The promise is in the pending state
     */
    pending,

    /**
     * The promise is in the fulfilled state
     */
    fulfilled,

    /**
     * The promise is in the rejected state
     */
    rejected,

    /**
     * The promise is in the canceled state
     */
    canceled
}

/**
 * Internal data for a promise
 */
interface PromiseData<T> {
    /**
     * The associated promise
     */
    promise?: Promise<T>;

    /**
     * The associated promise resolver
     */
    resolver?: PromiseResolver<T>;

    /**
     * The state of the promise
     */
    state?: PromiseState;

    /**
     * The result of the fulfilled promise, or the error for the rejected promise
     */
    result?: any;

    /**
     * The callbacks to execute upon resolution
     */
    resolveCallbacks?: { head?: Node };

    /**
     * The callbacks to execute upon rejection
     */
    rejectCallbacks?: { head?: Node };

    /**
     * The callbacks to execute upon cancellation
     */
    cancelCallbacks?: { head?: Node };

    /**
     * The token to use for cancellation
     */
    token?: CancellationToken;

    /**
     * The cancellation handle used to stop waiting for cancellation
     */
    cancellationHandle?: number;
}

/**
 * Gets the internal data for a Promise
 * @param promise The promise from which to read internal state
 * @returns The internal state
 */
function $PromiseGetData<T>(promise: Promise<T>): PromiseData<T>;

/**
 * Gets the internal data for a PromiseResolver
 * @param resolver The resolver from which to read internal state
 * @returns The internal state
 */
function $PromiseGetData<T>(resolver: PromiseResolver<T>): PromiseData<T>;

/**
 * Gets the internal data for a Promise or a PromiseResolver
 * @param promise The promise or resolver from which to read internal state
 * @returns The internal state
 */
function $PromiseGetData<T>(promise: any): PromiseData<T> {
    return promise._promiseData;
}

/**
 * Creates the internal data for a Promise
 * @param promise the associated promise
 * @param resolver the associated resolver
 * @param token a cancellation token
 */
function $PromiseCreate<T>(promise: Promise<T>, resolver: PromiseResolver<T>, token: CancellationToken): void {
    var data: PromiseData<T> = { state: PromiseState.pending };
    Object.defineProperty(promise, "_promiseData", { value: data });
    Object.defineProperty(resolver, "_promiseData", { value: data });
    data.promise = promise;
    data.resolver = resolver;
    data.token = token;
    if (token) {
        data.cancellationHandle = token.register(() => {
            $PromiseCancel(data);
        });
    }
}

/**
 * Fulfills a promise with a value
 * @param data The internal data for a promise
 * @param value The fulfillment value
 * @param synchronous A value indicating whether the perform the fulfullment synchronously
 */
function $PromiseFulfill<T>(data: PromiseData<T>, value: T, synchronous?: boolean): void {
    if (data.state !== PromiseState.pending) {
        return;
    }

    data.state = PromiseState.fulfilled;
    data.result = value;

    $PromiseUnregisterCancellation(data);
    $PromiseProcess(data.resolveCallbacks, value, synchronous);
}

/**
 * Resolve a promise with the value from another promise
 * @param data The internal data for a promise
 * @param value The promise or fulfillment value
 * @param synchronous A value indicating whether the perform the resolution synchronously
 */
function $PromiseResolve<T>(data: PromiseData<T>, value: any, synchronous?: boolean): void {
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
            value.done(resolve, reject, null, data.token);
        }
        catch (e) {
            $PromiseReject(data, e, synchronous);
        }

        return;
    }

    $PromiseFulfill(data, value, synchronous);
}

/**
 * Reject a promise with a reason
 * @param data The internal data for a promise
 * @param value The rejection reason
 * @param synchronous A value indicating whether the perform the rejection synchronously
 */
function $PromiseReject<T>(data: PromiseData<T>, value: any, synchronous?: boolean): void {
    if (data.state !== PromiseState.pending) {
        return;
    }

    data.state = PromiseState.rejected;
    data.result = value;

    $PromiseUnregisterCancellation(data);
    $PromiseProcess(data.rejectCallbacks, value, synchronous);
}

/**
 * Cancel a promise
 * @param data The internal data for a promise
 */
function $PromiseCancel<T>(data: PromiseData<T>): void {
    if (data.state !== PromiseState.pending) {
        return;
    }

    data.state = PromiseState.canceled;

    $PromiseUnregisterCancellation(data);
    $PromiseProcess(data.cancelCallbacks, void 0, true);
}

/**
 * Unregisters the cancellation sink from a promise's associated cancellation token
 * @param data The internal data for a promise
 */
function $PromiseUnregisterCancellation<T>(data: PromiseData<T>): void {
    if (data.token && data.cancellationHandle) {
        data.token.unregister(data.cancellationHandle);
        data.token = null;
        data.cancellationHandle = null;
    }
}

/**
 * Appends a set of continuation callbacks to a promise
 * @param data The internal data for a promise
 * @param resolveCallback The callback to execute when the promise is fulfilled
 * @param rejectCallback The callback to execute when the promise is rejected
 * @param cancelCallback The callback to execute when the promise is canceled
 * @param token A cancellation token
 */
function $PromiseAppend<T>(data: PromiseData<T>, resolveCallback: (value: T) => void , rejectCallback: (value: any) => void , cancelCallback: () => void , token: CancellationToken): void {

    var cts: CancellationSource;
    if (data.state === PromiseState.pending) {
        cts = $CancellationTryCreateLinked(data.token, token);
    }

    if (data.state === PromiseState.pending || data.state === PromiseState.fulfilled) {
        if (typeof resolveCallback === "function") {
            if (data.resolveCallbacks == null) {
                data.resolveCallbacks = {};
            }

            var resolveNode = $ListAppend(data.resolveCallbacks, { token: token, callback: resolveCallback });
            cts && cts.token.register(() => {
                $ListDelete(data.resolveCallbacks, resolveNode);
            });
        }
    }

    if (data.state === PromiseState.pending || data.state === PromiseState.rejected) {
        if (typeof rejectCallback === "function") {
            if (data.rejectCallbacks == null) {
                data.rejectCallbacks = {};
            }

            var rejecNode = $ListAppend(data.rejectCallbacks, { token: token, callback: rejectCallback });
            cts && cts.token.register(() => {
                $ListDelete(data.rejectCallbacks, rejecNode);
            });
        }
    }

    if (data.state === PromiseState.pending || data.state === PromiseState.canceled) {
        if (typeof cancelCallback === "function") {
            if (data.cancelCallbacks == null) {
                data.cancelCallbacks = {};
            }

            $ListAppend(data.cancelCallbacks, { callback: cancelCallback });
        }
    }

    if (data.state === PromiseState.fulfilled) {
        // the future has already been accepted, process the resolve callbacks in a later turn
        $PromiseProcess(data.resolveCallbacks, data.result, false);
    }
    else if (data.state === PromiseState.rejected) {
        // the future has already been rejected, process the reject callbacks in a later turn
        $PromiseProcess(data.rejectCallbacks, data.result, false);
    }
    else if (data.state === PromiseState.canceled) {
        // the future has already been canceled, process the cancel callbacks immediately
        $PromiseProcess(data.cancelCallbacks, void 0, true);
    }
}

/**
 * Process each of the registered callbacks
 * @param callbacks a Linked list of callback nodes
 * @param result The result to send
 * @param synchronous A value indicating whether the result should be processed synchronously
 */
function $PromiseProcess(callbacks: { head?: Node }, result: any, synchronous: boolean): void {
    if (callbacks) {
        var node: Node;
        while (node = $ListDelete(callbacks, callbacks.head)) {
            var callback = node.callback,
                token = node.token;
            if (!(token && token.canceled)) {
                Scheduler.current.post(callback.bind(null, result), { synchronous: synchronous }, token);
            }
        }
    }
}

/**
 * Wraps a callback that should result in the resolution of the callback's return value
 * @param data The internal data for the promise
 * @param callback The callback to wrap
 * @returns The wrapped callback
 */
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

/**
 * Wraps a callback that should result in the cancellation of the promise
 * @param data The internal data for the promise
 * @param callback The callback to wrap
 * @returns The wrapped callback
 */
function $WrapCancelCallback<T>(data: PromiseData<T>, callback: () => void ): () => void {
    var wrapper = () => {
        try {
            callback.call(data.promise);
        }
        finally {
            $PromiseCancel(data);
        }
    };
    return wrapper;
}

/** 
 * An error that contains multiple errors
 */
export class AggregateError implements Error {
    public name: string = "AggregateError";
    public message: string = "One or more errors occurred";
    public errors: any[] = [];

    /** 
     * An error that contains multiple errors
     * @param message The message for the error
     * @param errors An array of errors for the error
     */
    constructor(message?: string, errors?: any[]) {
        if (message != null) {
            this.message = message;
        }

        if (errors != null) {
            this.errors = errors;
        }
    }
}

// wire up aggregate error base
<any>AggregateError.prototype = Object.create(Error.prototype);

// polyfill for Futures
if (typeof window !== "undefined" && typeof (<any>window).Promise === "undefined") {
    (<any>window).Promise = Promise;
    (<any>window).PromiseResolver = PromiseResolver;
    (<any>window).CancellationToken = CancellationToken;
    (<any>window).CancellationSource = CancellationSource;
}