/// <reference path="../lib/timers.d.ts" />
/// <reference path="../lib/node.d.ts" />
/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import symbols = module("symbols");
import lists = module("lists");

var CancellationDataSym = new symbols.Symbol<CancellationData>("tasks.CancellationData");
var SchedulerSym = new symbols.Symbol<Scheduler>("tasks.Scheduler");
var isNode = typeof process === "object" && Object.prototype.toString.call(process) === "[object process]" && typeof process.nextTick === "function";

/** An error that contains multiple errors
  */
export class AggregateError implements Error {
    /** The name of the error
      */
    public name: string = "AggregateError";
    
    /** The message for the error
      */
    public message: string = "One or more errors occurred";

    /** The errors found
      */
    public errors: any[] = [];
    
    /** An error that contains multiple errors
      */
    constructor();

    /** An error that contains multiple errors
      * @param errors An array of errors for the error
      */
    constructor(errors: any[]);

    /** An error that contains multiple errors
      * @param message The message for the error
      */
    constructor(message: string);

    /** An error that contains multiple errors
      * @param message The message for the error
      * @param errors An array of errors for the error
      */
    constructor(message: string, errors: any[]);

    /** An error that contains multiple errors
      * @param message The message for the error
      * @param errors An array of errors for the error
      */
    constructor(...args: any[]) {        
        var argi = 0;
        var message: string = null;
        var errors: any[] = null;
        
        if (typeof args[argi] === "string") {
        	message = args[argi++];
        }
        if (Array.isArray(args[argi])) {
        	errors = args[argi];
        }

        if (message != null) {
            this.message = message;
        }

        if (errors != null) {
            this.errors = errors;
        }
    }
}

<any>AggregateError.prototype = Object.create(Error.prototype);

symbols.brand("AggregateError")(AggregateError);

/** Token used for cancellation
  */
export class CancellationToken {

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
        var data = CancellationDataSym.get(this);
        if (!data || !symbols.hasBrand(this, CancellationToken)) throw new TypeError("'this' is not a CancellationToken object");
        
        return data.canceled;
    }
    
    /** 
     * Registers a cleanup callback
     * @param cleanup The callback to execute when cancellation is requested
     * @returns A handle to the cleanup callback that can be used to unregister the callback
     */
    public register(cleanup: () => void): number {
        var data = CancellationDataSym.get(this);
        if (!data || !symbols.hasBrand(this, CancellationToken)) throw new TypeError("'this' is not a CancellationToken object");
        
        return RegisterCancellationCleanup(data, cleanup);
    }
    
    /** 
     * Unregisters a cleanup callback
     * @param handle The handle to unregister
     */
    public unregister(handle: number): void {
        var data = CancellationDataSym.get(this);
        if (!data || !symbols.hasBrand(this, CancellationToken)) throw new TypeError("'this' is not a CancellationToken object");

        UnregisterCancellationCleanup(data, handle);
    }
}

symbols.brand("CancellationToken")(CancellationToken);

/** Source for cancellation
  */
export class CancellationSource {

    /**
     * Source for cancellation
     */
	constructor();

    /**
     * Source for cancellation
     * @param tokens One or more tokens to link to a new source 
     */
	constructor(...tokens: CancellationToken[]);

    /** 
     * Source for cancellation
     * @param tokens One or more tokens to link to a new source 
     */
    constructor(...tokens: CancellationToken[]) {
    	
    	// create the token from its prototype
        var token = Object.create(CancellationToken.prototype);                
        var data = new CancellationData(this, token);
        CancellationDataSym.set(token, data);
        CancellationDataSym.set(this, data);

        // link any optional tokens
        tokens.forEach(token => { 
        	if (symbols.hasBrand(token, CancellationToken)) {
	        	LinkToCancellationToken(data, token)
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
        var data = CancellationDataSym.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");
        
        return data.token;
    }
    
    /** 
     * Cancels the source
     */
    public cancel(): void {
        var data = CancellationDataSym.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");
        if (data.closed) throw new Error("Object doesn't support this action");
        
        Cancel(data);
    }
    
    /** 
     * Cancels the source after a number of milliseconds has elapsed
     * @param ms The number of milliseconds to wait
     */
    public cancelAfter(ms: number): void {
        var data = CancellationDataSym.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");
        if (data.closed) throw new Error("Object doesn't support this action");
        
        CancelAfter(data, ms);
    }
    
    /** 
     * Cleans up the cancellation source
     */
    public close(): void {
        var data = CancellationDataSym.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");        
        if (data.closed) return;
        
        data.closed = true;
        
        if (data.links != null) {
            data.links.forEach(value => { value.callback.call(null) });
        }
        
        data.links = null;
    }
}

symbols.brand("CancellationSource")(CancellationSource);

interface CallbackEntry {
    /** 
     * The handle for the callback
     */
    handle: number;

    callback: () => void;
}

/** 
 * Internal data used for cancellation
 */
class CancellationData {

    /**
     * The maximum handle value before it should wrap
     * @type {number}
     */
    public static MAX_HANDLE: number = 2147483647;

    /**
     * The id of the next cancellation handle to use
     * @type {Number}
     */
    public static nextHandle: number = 1;

    /**
     * The token related to the cancellation data
     * @type {CancellationToken}
     */
    public token: CancellationToken;

    /**
     * The source related to the cancellation data
     * @type {CancellationSource}
     */
    public source: CancellationSource;

    /**
     * A value indicating whether the source has been closed
     * @type {Boolean}
     */
    public closed: boolean = false;

    /**
     * A value indicating whether the source has been canceled
     * @type {Boolean}
     */
    public canceled: boolean = false;
    
    /**
     * A linked list of cleanup callbacks
     * @type {lists.LinkedList}
     */
    public cleanupCallbacks: lists.LinkedList<CallbackEntry>;

    /**
     * A linked list of linked tokens
     * @type {lists.LinkedList}
     */
    public links: lists.LinkedList<CallbackEntry>;

    /**
     * A handle to a timeout used for delayed cleanup
     * @type {number}
     */
    public cancelHandle: number;
    
    /** 
     * Internal data used for cancellation
     * @param source The source for cancellation
     * @param token The token for cancellation
     */
    constructor(source: CancellationSource, token: CancellationToken) {
        this.source = source;
        this.token = token;
    }
}

/** 
 * Registers a cleanup callback
 * @param cleanup The callback to execute when cancellation is requested
 * @returns A handle to the cleanup callback that can be used to unregister the callback
 */
function RegisterCancellationCleanup(data: CancellationData, cleanup: () => void): number {
    if (data.canceled) {
        cleanup();
        return 0;
    }

    // fetch the next handle
    if (CancellationData.nextHandle >= CancellationData.MAX_HANDLE) {
        CancellationData.nextHandle = 1;
    }

    var handle = CancellationData.nextHandle++;

    // lazy-init the list
    if (data.cleanupCallbacks == null) {
        data.cleanupCallbacks = new lists.LinkedList<CallbackEntry>();
    }

    // add a node to the linked list
    data.cleanupCallbacks.push({ handle: handle, callback: cleanup });
    return handle;
}

/** 
 * Unregisters a cleanup callback
 * @param handle The handle to unregister
 */
function UnregisterCancellationCleanup(data: CancellationData, handle: number): void {
    if (data.cleanupCallbacks) {
        var found = data.cleanupCallbacks.match(entry => lists.is(entry.handle, handle));
        if (found) {
            data.cleanupCallbacks.deleteNode(found);
        }
    }
}

/** 
 * Links this cancellation to another token
 * @param token The token to link
 */
function LinkToCancellationToken(data: CancellationData, token: CancellationToken): void {
    
    // lazy-init the links
    if (data.links == null) {
        data.links = new lists.LinkedList<CallbackEntry>();
    }

    // register linked cancellation
    var handle = token.register(() => {
        Cancel(data);
    });

    data.links.push({ handle: handle, callback: () => { UnregisterCancellationCleanup(data, handle); } });
}

/**
 * Cancels the source
 */
function Cancel(data: CancellationData): void {
    if (data.canceled) {
        return;
    }
    
    data.canceled = true;
    
    var errors: any[];
    var callback = (value: CallbackEntry) => {
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
    data.cleanupCallbacks.forEach(callback);        
    data.cleanupCallbacks = null;
    
    // if there were any errors, throw them
    if (errors) {
        throw new AggregateError(null, errors);
    }
}

/** 
 * Cancels the token after a delay
 * @param ms The number of milliseconds to wait
 */
function CancelAfter(data: CancellationData, ms: number): void {
    if (data.canceled) {
        return;
    }
    
    if (data.cancelHandle) {
        clearTimeout(data.cancelHandle);
        data.cancelHandle = null;
    }
    
    data.cancelHandle = setTimeout(() => { Cancel(data); }, ms);
}

/**
 * Options for a task posted to a dispatcher
 */
export interface DispatcherPostOptions {
	/**
	 * A value indicating whether the dispatcher to execute the task synchronously. Exceptions will be raised to the engine's unhandled exception handler.
	 */
	synchronous?: boolean;

	/**
	 * A number of milliseconds to delay before the task should execute.
	 */
	delay?: number;
}

class Scheduler {
    private activeQueue: lists.LinkedList<() => void>;
    private nextQueue: lists.LinkedList<() => void>;
    private tickRequested: boolean = false;

    public static create(): Scheduler {
        if (typeof setImmediate !== "function") {
            return new SetImmediateScheduler();
        }

        if (typeof MessageChannel === "function") {
            return new MessageChannelScheduler();
        }

        if (isNode) {
            return new NodeScheduler();
        }
       
        return new Scheduler();
    }

    public post(task: () => void, options: DispatcherPostOptions, token: CancellationToken): void {
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
            this.nextQueue = new lists.LinkedList<() => void>();
        }

        var node = this.nextQueue.push(() => {
            if (token) {
                if (token.canceled) {
                    return;
                }

                if (tokenHandle) {
                    token.unregister(tokenHandle);
                }
            }

            task();
        });
        
        var tokenHandle: number;
        if (token) {
            tokenHandle = token.register(() => {
                if (node.list) {
                    (<any>node.list).deleteNode(node);
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
        // default to setTimeout
        this.postAfter(() => this.tick(), 0, null);
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
            while (this.activeQueue.head) {
                var task = this.activeQueue.shift();
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

class SetImmediateScheduler extends Scheduler {
    public requestTickCore(): void {
        setImmediate(() => { 
            this.tick(); 
        });
    }
}

class MessageChannelScheduler extends Scheduler {
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

class NodeScheduler extends Scheduler {
    public requestTickCore(): void {
        process.nextTick(() => { this.tick(); });
    }
}

var defaultDispatcher: Dispatcher = null;
var currentDispatcher: Dispatcher = null;

/**
 * Dispatches microtasks to the event loop
 */
export class Dispatcher {
	/** 
	 * A dispatcher for microtasks in the event loop
	 */
	constructor() {
        var scheduler = Scheduler.create();
		SchedulerSym.set(this, scheduler);
	}

	/**
	 * Gets the default dispatcher
	 * @type {Dispatcher}
	 */
	public static get default(): Dispatcher {
		if (!defaultDispatcher) {
			defaultDispatcher = new Dispatcher();
			Object.freeze(defaultDispatcher);
		}

		return defaultDispatcher;
	}

	/**
	 * Gets the current dispatcher
	 * @type {Dispatcher}
	 */
	public static get current(): Dispatcher {
		if (!currentDispatcher) {
			currentDispatcher = Dispatcher.default;
		}

		return currentDispatcher;
	}

    /** Posts a microtask to the dispatcher
      * @param task The task to schedule
      */
    public post(task: () => void): void;

    /** Posts a microtask to the dispatcher
      * @param task The task to schedule
      * @param token The token to use for cancellation
      */
    public post(task: () => void, token: CancellationToken): void;

    /** Posts a microtask to the dispatcher
      * @param task The task to schedule
      * @param options Option that affect task scheduling
      */
    public post(task: () => void, options: DispatcherPostOptions): void;

    /** Posts a microtask to the dispatcher
      * @param task The task to schedule
      * @param options Option that affect task scheduling
      * @param token The token to use for cancellation
      */
    public post(task: () => void, options: DispatcherPostOptions, token: CancellationToken): void;

    /** Posts a microtask to the dispatcher
      * @param task The task to schedule
      * @param options Option that affect task scheduling
      * @param token The token to use for cancellation
      */
    public post(task: () => void, ...args: any[]): void {
        if (!symbols.hasBrand(this, Dispatcher)) throw new TypeError("'this' is not a Dispatcher object");

        var argi = 0;
        var options: DispatcherPostOptions = null;
        var token: CancellationToken = null;

        // read the optional arguments
        if (!symbols.hasBrand(args[argi], CancellationToken)) {
        	options = args[argi++];
        }

        if (symbols.hasBrand(args[argi], CancellationToken)) {
        	options = args[argi];
        }

        // bind the task to the dispatcher
        task = BindTask(this, task);

        // schedule the task
        SchedulerSym.get(this).post(task, options, token);
    }
}

symbols.brand("Dispatcher")(Dispatcher);

/** binds a task to a dispatcher 
  * @param task The task to bind
  */
function BindTask(dispatcher: Dispatcher, task: () => void): () => void {
    var wrapped = () => {
        var previousDispatcher = currentDispatcher;
        currentDispatcher = dispatcher;
        try {
            task();
        }
        finally {
            currentDispatcher = previousDispatcher;
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