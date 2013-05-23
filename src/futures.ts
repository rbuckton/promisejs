/// <reference path="../lib/timers.d.ts" />
/// <reference path="../lib/node.d.ts" />
/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
function is(x, y): boolean {
    return (x === y) 
        ? (x !== 0 || 1 / x === 1 / y) 
        : (x !== x && y !== y);
}

module linkedlist {
    export function Append(list: { head?; }, node: any): any {
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

    export function Delete(list: { head?; }, node: any): any {
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
                    list.head = node.next;
                }
            }
            
            node.list = node.prev = node.next = null;
        }

        return node;
    }

    export function Iterate(list: { head?; }, callback: (node: any) => void): void {
        Find(list, node => { 
            callback(node); 
            return false; 
        })
    }

    export function Find(list: { head?; }, predicate: (node: any) => boolean): any {
        var node = list.head;
        if (node) {
            do {
                if (predicate(node)) {
                    return node;
                }
                
                node = node.next;
            }
            while (node && node !== list.head);
        }

        return null;
    }
}

module tasks {
    var isNode = typeof process === "object" 
        && Object.prototype.toString.call(process) === "[object process]" 
        && typeof process.nextTick === "function";

    export class CancellationData {
        public static MAX_HANDLE: number = 2147483647;
        public static nextHandle: number = 1;
        public token: CancellationToken;
        public source: CancellationSource;
        public closed: boolean = false;
        public canceled: boolean = false;
        public cleanupCallbacks: { head?; };
        public links: { head?; };
        public cancelHandle: number;
        constructor(source: CancellationSource, token: CancellationToken) {
            Object.defineProperty(source, "_cancelData", { value: this });
            Object.defineProperty(token, "_cancelData", { value: this });
            this.source = source;
            this.token = token;
        }
    }

    export function RegisterCancellationCleanup(data: CancellationData, cleanup: () => void): number {
        if (data.canceled) {
            cleanup();
            return 0;
        }

        if (CancellationData.nextHandle >= CancellationData.MAX_HANDLE) {
            CancellationData.nextHandle = 1;
        }

        var handle = CancellationData.nextHandle++;

        if (data.cleanupCallbacks == null) {
            data.cleanupCallbacks = {};
        }

        linkedlist.Append(data.cleanupCallbacks, { handle: handle, callback: cleanup });
        return handle;
    }

    export function UnregisterCancellationCleanup(data: CancellationData, handle: number): void {
        if (data.cleanupCallbacks) {
            var found = linkedlist.Find(data.cleanupCallbacks, node => is(node.handle, handle));
            if (found) {
                linkedlist.Delete(data.cleanupCallbacks, found);
            }
        }
    }

    export function LinkToCancellationToken(data: CancellationData, token: CancellationToken): void {
        
        // lazy-init the links
        if (data.links == null) {
            data.links = {};
        }

        // register linked cancellation
        var handle = token.register(() => {
            Cancel(data);
        });

        linkedlist.Append(data.links, { handle: handle, callback: () => { UnregisterCancellationCleanup(data, handle); } });
    }

    export function Cancel(data: CancellationData): void {
        if (data.canceled) {
            return;
        }
        
        data.canceled = true;
        
        var errors: any[];
        var callback = (value: any) => {
            try {
                value.callback.call(null);
            }
            catch (e) {
                if (errors == null) {
                    errors = [];
                }

                errors.push(e);
            }
        }

        // execute each cleanup callback and catch any errors
        linkedlist.Iterate(data.cleanupCallbacks, callback);        
        data.cleanupCallbacks = null;
        
        // if there were any errors, throw them
        if (errors) {
            throw new AggregateError(null, errors);
        }
    }

    export function CancelAfter(data: CancellationData, delay: number): void {
        if (data.canceled) {
            return;
        }
        
        if (data.cancelHandle) {
            clearTimeout(data.cancelHandle);
            data.cancelHandle = null;
        }
        
        data.cancelHandle = setTimeout(() => { Cancel(data); }, delay);
    }

    export interface IScheduler {
        post(task: () => void, options: { synchronous?: boolean; delay?: number; }, token: CancellationToken): void;
    }

    export function createScheduler(): IScheduler {
        if (typeof setImmediate !== "function") {
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

    class SchedulerBase {
        private activeQueue: { head?; };
        private nextQueue: { head?; };
        private tickRequested: boolean = false;

        public post(task: () => void, options: { synchronous?: boolean; delay?: number; }, token: CancellationToken): void {
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

            var node = linkedlist.Append(this.nextQueue, {
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
                        linkedlist.Delete(node.list, node);
                    }
                });
            }

            this.requestTick();
        }

        private postSynchronous(task: () => void, token: CancellationToken): void {
            if (!(token && token.canceled)) {
                try {
                    task();
                }
                catch (e) {
                    this.post(() => { throw e; }, null, null);
                }
            }        
        }

        private postAfter(task: () => void, delay: number, token: CancellationToken): void {
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
                while (node = linkedlist.Delete(this.activeQueue, this.activeQueue.head)) {
                    var task = node.callback;
                    task();
                }
            }
            finally {
                // if we're not done, request a new tick to continue processing
                if (this.activeQueue.head) {
                    this.requestTick();
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

    export function BindTask(Scheduler: Scheduler, task: () => void): () => void {
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
        
        var domain = GetDomain();
        if (domain) {
            wrapped = domain.bind(wrapped);
        }

        return wrapped;
    }

    // feature detect our ability to schedule
    var GetDomain = (): any => null;
    if (isNode) {
        GetDomain = (): any => (<any>process).domain;
    }

    export var GetDomain = GetDomain;

    export var defaultScheduler: Scheduler = null;
    export var currentScheduler: Scheduler = null;
}

module futures {

    enum FutureState { pending, accepted, rejected, canceled }

    export class FutureData {
        public future: Future;
        public resolver: FutureResolver;
        public state: FutureState = FutureState.pending;
        public result: any;
        public resolveCallbacks: { head?: Node };
        public rejectCallbacks: { head?: Node };
        public cancelCallbacks: { head?: Node };
        public token: CancellationToken;
        public cancellationHandle: number;
        
        constructor(future: Future, resolver: FutureResolver, token: CancellationToken) {
            Object.defineProperty(future, "_futureData", { value: this });
            Object.defineProperty(resolver, "_futureData", { value: this });
            this.future = future;
            this.resolver = resolver;
            this.token = token;
            if (this.token) {
                this.cancellationHandle = this.token.register(() => { this.cancel() });
            }
        }
        
        public accept(value: any, synchronous?: boolean) : void {
            if (this.state !== FutureState.pending) {
                return;
            }
            
            this.state = FutureState.accepted;
            this.result = value;
            
            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }
            
            this.process(this.resolveCallbacks, value, synchronous);
        }
        
        public resolve(value: any, synchronous?: boolean): void {
            if (this.state !== FutureState.pending) {
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

        public reject(value: any, synchronous?: boolean) {
            if (this.state !== FutureState.pending) { 
                return;
            }
            
            this.state = FutureState.rejected;
            this.result = value;

            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }
            
            this.process(this.rejectCallbacks, value, synchronous);
        }
        
        public cancel() {
            if (this.state !== FutureState.pending) {
                return;
            }
            
            this.state = FutureState.canceled;
            
            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }

            this.process(this.cancelCallbacks, void 0, true);
        }

        public append(resolveCallback: (value: any) => void, rejectCallback: (value: any) => void, cancelCallback: () => void, token: CancellationToken): void {
            var cts: CancellationSource;
            if (this.state === FutureState.pending) {
                cts = new CancellationSource(this.token, token);
            }

            if (this.state === FutureState.pending || this.state === FutureState.accepted) {
                if (typeof resolveCallback === "function") {
                    if (this.resolveCallbacks == null) {
                        this.resolveCallbacks = { }; 
                    }

                    var resolveNode = linkedlist.Append(this.resolveCallbacks, { token: token, callback: resolveCallback });
                    cts && cts.token.register(() => {
                        linkedlist.Delete(this.resolveCallbacks, resolveNode);
                    });
                }
            }
            
            if (this.state === FutureState.pending || this.state === FutureState.rejected) {
                if (typeof rejectCallback === "function") {
                    if (this.rejectCallbacks == null) {
                        this.rejectCallbacks = { };
                    }

                    var rejectNode = linkedlist.Append(this.rejectCallbacks, { token: token, callback: rejectCallback });
                    cts && cts.token.register(() => {
                        linkedlist.Delete(this.rejectCallbacks, rejectNode);
                    });
                }
            }

            if (this.state === FutureState.pending || this.state === FutureState.canceled) {
                if (typeof cancelCallback === "function") {
                    if (this.cancelCallbacks == null) {
                        this.cancelCallbacks = { };
                    }

                    linkedlist.Append(this.cancelCallbacks, { callback: cancelCallback });
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
            else if (this.state === FutureState.canceled) {
                // the future has already been canceled, process the cancel callbacks immediately
                this.process(this.cancelCallbacks, void 0, true);
            }
        }    
         
        public wrapResolveCallback(callback: (value: any) => any): (value: any) => void {
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

        public wrapCancelCallback(callback: () => void): () => void {
            var wrapper = () => {
                try {
                    callback.call(this.future);
                }
                finally {
                    this.cancel();
                }
            }

            return wrapper;
        }

        public process(callbacks: { head?: Node }, result: any, synchronous: boolean): void {
            if (callbacks) {
                var node: any;
                while (node = linkedlist.Delete(callbacks, callbacks.head)) {
                    var callback = node.callback, 
                        token = node.token;
                    if (!(token && token.canceled)) {
                        Scheduler.current.post(callback.bind(null, result), { synchronous: synchronous }, token);
                    }
                }
            }
        }
    }
}

/** 
 * Source for cancellation
 */
export class CancellationSource {
    private _cancelData: tasks.CancellationData;

    /** 
     * Source for cancellation
     * @param tokens One or more tokens to link to a new source 
     */
    constructor(...tokens: CancellationToken[]) {
        var token = Object.create(CancellationToken.prototype);
        var data = new tasks.CancellationData(this, token);
        this.cancel = this.cancel.bind(this);
        this.cancelAfter = this.cancelAfter.bind(this);

        // link any optional tokens
        tokens.forEach(token => { 
            if (token) {
                tasks.LinkToCancellationToken(data, token)
            }
        });

        // freeze the token to prevent modification
        Object.freeze(token);
    }
    
    /** 
     * Gets the token for this source
     * @type {CancellationToken}
     */
    public get token(): CancellationToken {
        return this._cancelData.token;
    }
    
    /** 
     * Cancels the source
     */
    public cancel(): void {
        if (this._cancelData.closed) throw new Error("Object doesn't support this action");        
        tasks.Cancel(this._cancelData);
    }
    
    /** 
     * Cancels the source after a number of milliseconds has elapsed
     * @param delay The number of milliseconds to wait
     */
    public cancelAfter(delay: number): void {
        if (this._cancelData.closed) throw new Error("Object doesn't support this action");
        tasks.CancelAfter(this._cancelData, delay);
    }
    
    /** 
     * Cleans up the cancellation source
     */
    public close(): void {
        if (this._cancelData.closed) return;
        
        this._cancelData.closed = true;

        var links = this._cancelData.links;
        this._cancelData.links = null;

        linkedlist.Iterate(links, node => { node.callback.call(null); });
    }
}

/** 
 * Token used for cancellation
 */
export class CancellationToken {
    private _cancelData: tasks.CancellationData;

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
    public register(cleanup: () => void): number {
        return tasks.RegisterCancellationCleanup(this._cancelData, cleanup);
    }
    
    /** 
     * Unregisters a cleanup callback
     * @param handle The handle to unregister
     */
    public unregister(handle: number): void {
        tasks.UnregisterCancellationCleanup(this._cancelData, handle);
    }
}

/**
 * Schedules microtasks
 */
export class Scheduler {
    private _scheduler: tasks.IScheduler;

    /** 
     * A Scheduler for microtasks in the event loop
     */
    constructor() {
        this._scheduler = tasks.createScheduler();
    }

    /**
     * Gets the default Scheduler
     * @type {Scheduler}
     */
    public static get default(): Scheduler {
        if (!tasks.defaultScheduler) {
            tasks.defaultScheduler = new Scheduler();
            Object.freeze(tasks.defaultScheduler);
        }

        return tasks.defaultScheduler;
    }

    /**
     * Gets the current Scheduler
     * @type {Scheduler}
     */
    public static get current(): Scheduler {
        if (!tasks.currentScheduler) {
            tasks.currentScheduler = Scheduler.default;
        }

        return tasks.currentScheduler;
    }

    /** Posts a microtask to the Scheduler
      * @param task The task to schedule
      * @param options Option that affect task scheduling
      * @param token The token to use for cancellation
      */
    public post(task: () => void, options?: { synchronous?: boolean; delay?: number; }, token?: CancellationToken): void {
        // bind the task to the Scheduler
        task = tasks.BindTask(this, task);

        // schedule the task
        this._scheduler.post(task, options, token);
    }
}

/** 
 * A Future value
 * 
 * @link http://dom.spec.whatwg.org/#future
 */
export class Future<T> {

    private _futureData: futures.FutureData;

    /** 
     * A Future value
     * @param init A callback whose first argument is the resolver for the future
     * @param token  A cancellation token used to prevent cancel the future
     *
     * @link http://dom.spec.whatwg.org/#dom-future
     */
    constructor (init: (resolver: FutureResolver<T>) => void, token?: CancellationToken) {
        var resolver: FutureResolver<T> = Object.create(FutureResolver.prototype);
        var data = new futures.FutureData(this, resolver, token);
        resolver.accept = resolver.accept.bind(resolver);
        resolver.resolve = resolver.resolve.bind(resolver);
        resolver.reject = resolver.reject.bind(resolver);
        resolver.cancel = resolver.cancel.bind(resolver);
                
        try {
            init.call(this, resolver);
        }
        catch (e) {
            data.reject(e);
        }
    }
    
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
    
    /** 
     * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Future
     * @param token The token to use for cancellation
     * @returns A Future for the value
     */
    public static resolve<TResultB>(value: Future<TResultB>, token?: CancellationToken): Future<TResultB>;

    /** 
     * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Future
     * @param token The token to use for cancellation
     * @returns A Future for the value
     */
    public static resolve<TResultD>(value: TResultD, token?: CancellationToken): Future<TResultD>;

    /** 
     * Creates a new Future that is resolved with the provided value. If the provided value is a Future, its completion is implicitly unwrapped to its accepted result.
     * @param value The value for the Future
     * @param token The token to use for cancellation
     * @returns A Future for the value
     *
     * @link http://dom.spec.whatwg.org/#dom-future-resolve
     */
    public static resolve(value: any, token?: CancellationToken): Future {
        return new Future(resolver => { 
            resolver.resolve(value);
        }, token);
    }
    
    /** 
     * Creates a new Future that is already in the rejected state with the provided value as the result.
     * @param value The value for the Future
     * @returns A Future for the value.
     *
     * @link http://dom.spec.whatwg.org/#dom-future-reject
     */
    public static reject(value: any): Future<any> {
        return new Future(resolver => { 
            resolver.reject(value);
        });        
    }

    /** 
     * Creates a Future that is resolved or rejected when the first of any of the values provided are resolved or rejected.
     * @param values The values to wait upon. 
     * @returns A new Future that is either resolved with the value of the first Future to resolve, or rejected with the error of the first Future that is rejected.
     *
     * @link http://dom.spec.whatwg.org/#dom-future-any (modified)
     */
    public static any(...values: any[]): Future {
        return new Future(resolver => {            
            var data: futures.FutureData = (<any>resolver)._futureData;
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
            var data: futures.FutureData = (<any>resolver)._futureData;
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
            var data: futures.FutureData = (<any>resolver)._futureData;
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
    public static from(value: any, token?: CancellationToken): Future {
        if (Future.isFuture(value)) {
            return value;
        }
        
        var cts = new CancellationSource(token);
        return new Future(function (resolver) { 
            var resolve = value => {
                if (!cts.token.canceled) {
                    try {
                        if (Future.isFuture(value)) {
                            value.done(resolver.accept, resolver.reject, cts.cancel, cts.token);
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
        }, cts.token);
    }
    
    /** 
     * Determines if a value is a Future
     * @param value The value to test
     * @returns True if the value is a Future instance; otherwise, false.
     *
     * (not currently specified)
     */
    public static isFuture(value: any): boolean { 
        return value instanceof Future;
    }

    /** 
     * Creates a Future that resolves as undefined in the next turn of the event loop
     * @param token An optional cancellation token to use to cancel the result
     * @returns The new Future
     *
     * (not currently specified)
     */
    public static yield(token?: CancellationToken): Future {
        return new Future(resolver => { 
            Scheduler.current.post(() => { 
                resolver.resolve(void 0);
            }, token); 
        }, token);
    }

    /** 
     * Sleeps for a period of time before resolving the future
     * @param delay The number of milliseconds to wait before resolving
     * @param value The value to use for resolution when the future resolves
     * @param token The token to use for tasks.
     * @returns The new Future
     */
    public static sleep<TResultP>(delay: number, value?: Future<TResultP>, token?: CancellationToken): Future<TResultP>;

    /** 
     * Sleeps for a period of time before resolving the future
     * @param delay The number of milliseconds to wait before resolving
     * @param value The value to use for resolution when the future resolves
     * @param token The token to use for tasks.
     * @returns The new Future
     */
    public static sleep<TResultQ>(delay: number, value?: TResultQ, token?: CancellationToken): Future<TResultQ>;

    public static sleep(delay: number, value?, token?: CancellationToken): Future {
        return new Future(resolver => { 
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
    public static run<TResultX>(func: () => Future<TResultX>, delay?: number, token?: CancellationToken): Future<TResultX>;

    /** 
     * Runs the supplied callback at the end of the current turn
     * @param func The callback to execute
     * @param delay The number of milliseconds to wait before executing the callback
     * @param token The token to use for cancellation
     * @returns A Future for the result or exception from the callback
     */
    public static run<TResultY>(func: () => TResultY, delay?: number, token?: CancellationToken): Future<TResultY>;

    public static run(func: () => any, delay?: number, token?: CancellationToken): Future {
        var options;
        if (typeof delay === "number") {
            options = { delay: delay };
        }
        
        return new Future(resolver => {
            var resolverData: futures.FutureData = (<any>resolver)._futureData;
            Scheduler.current.post(() => {
                try {
                    resolverData.resolve(func(), true);
                }
                catch (e) {
                    resolverData.reject(e, true);
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
     * @link http://dom.spec.whatwg.org/#dom-future-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => Future<TResult>, reject?: (value: any) => Future<TResult>, cancel?: () => void, token?: CancellationToken): Future<TResult>;

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
     * @link http://dom.spec.whatwg.org/#dom-future-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => Future<TResult>, reject?: (value: any) => TResult, cancel?: () => void, token?: CancellationToken): Future<TResult>;

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
     * @link http://dom.spec.whatwg.org/#dom-future-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => TResult, reject?: (value: any) => Future<TResult>, cancel?: () => void, token?: CancellationToken): Future<TResult>;

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
     * @link http://dom.spec.whatwg.org/#dom-future-then (modified)
     */
    public then<TResult>(resolve?: (value: T) => TResult, reject?: (value: any) => TResult, cancel?: () => void, token?: CancellationToken): Future<TResult>;

    public then(resolve?: (value: T) => any, reject?: (value: any) => any, cancel?: () => void, token?: CancellationToken): Future<any> {
        // create a linked token
        return new Future(resolver => {
            var resolverData: futures.FutureData = (<any>resolver)._futureData;
            this._futureData.append(
                resolve ? resolverData.wrapResolveCallback(resolve) : value => { resolverData.accept(value, true); }, 
                reject ? resolverData.wrapResolveCallback(reject) : value => { resolverData.reject(value, true); }, 
                cancel ? resolverData.wrapCancelCallback(cancel) : () => { resolverData.cancel(); },
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
     * @link http://dom.spec.whatwg.org/#dom-future-catch
     */
    public catch<TResult>(reject: (value: any) => Future<TResult>, token?: CancellationToken): Future<TResult>;

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
     * @link http://dom.spec.whatwg.org/#dom-future-catch
     */
    public catch<TResult>(reject: (value: any) => TResult, token?: CancellationToken): Future<TResult>;

    public catch(reject: (value: any) => any, token?: CancellationToken): Future {
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
     * @link http://dom.spec.whatwg.org/#dom-future-catch
     */
    public done(resolve?: (value: T) => void, reject?: (value: any) => void, cancel?: () => void, token?: CancellationToken): void {
        this._futureData.append(
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
export class FutureResolver<T> {
    
    private _futureData: futures.FutureData;

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
        this._futureData.accept(value);
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
        this._futureData.resolve(value);
    }
    
    /** 
     * Rejects the Future using the provided argument as the reason. If the Future has already been resolved, no changes will be made.
     * @param err The reason for the rejection.
     *
     * @link http://dom.spec.whatwg.org/#dom-futureresolver-reject
     */
    public reject(value: any): void {
        this._futureData.reject(value);
    }

    /**
     * Cancels the future
     */
    public cancel(): void {
        this._futureData.cancel();
    }
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
if (typeof window !== "undefined" && typeof (<any>window).Future === "undefined") {
    (<any>window).Future = Future;
    (<any>window).FutureResolver = FutureResolver;
    (<any>window).CancellationToken = CancellationToken;
    (<any>window).CancellationSource = CancellationSource;
}