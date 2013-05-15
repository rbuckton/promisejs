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
var DispatcherDataSym = new symbols.Symbol<DispatcherData>("tasks.DispatcherData");

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
	 * A value indicating whether the dispatcher should prefer fairness and schedule 
	 * the task in a later turn rather than the end of the turn.
	 */
	fair?: boolean;

	/**
	 * A value indicating whether the dispatcher to execute the task synchronously. Exceptions will be raised to the engine's unhandled exception handler.
	 */
	synchronous?: boolean;

	/**
	 * A number of milliseconds to delay before the task should execute.
	 */
	delay?: number;
}

/**
 * Dispatches microtasks to the event loop
 */
export class Dispatcher {
	/** 
	 * A dispatcher for microtasks in the event loop
	 */
	constructor() {
		var data = new DispatcherData(this);
		DispatcherDataSym.set(this, data);
	}

	/**
	 * Gets the default dispatcher
	 * @type {Dispatcher}
	 */
	public static get default(): Dispatcher {
		if (!DispatcherData.default) {
			DispatcherData.default = new Dispatcher();
			Object.freeze(DispatcherData.default);
		}

		return DispatcherData.default;
	}

	/**
	 * Gets the current dispatcher
	 * @type {Dispatcher}
	 */
	public static get current(): Dispatcher {
		if (!DispatcherData.current) {
			DispatcherData.current = Dispatcher.default;
		}

		return DispatcherData.current;
	}

    /**
     * Gets a value indicating whether the next tick will yield to the event loop
     * @type {boolean}
     */
    public get nextTickWillYield(): boolean {
        var data = DispatcherDataSym.get(this);
        if (!data || !symbols.hasBrand(this, Dispatcher)) throw new TypeError("'this' is not a Dispatcher object");

        return !data.inTick || Date.now() >= data.tickEnds;
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
    	var data = DispatcherDataSym.get(this);
    	if (!data || !symbols.hasBrand(this, Dispatcher)) throw new TypeError("'this' is not a Dispatcher object");
        
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

        PostTask(data, task, options, token);
    }
}

symbols.brand("Dispatcher")(Dispatcher);

/**
 * Internal data and algorithms for a Dispatcher
 */
class DispatcherData {

    /**
     * The default dispatcher
     * @type {Dispatcher}
     */
    public static default: Dispatcher = null;

    /**
     * The current dispatcher
     * @type {Dispatcher}
     */
    public static current: Dispatcher = null;

    /**
     * The maximum amount of time to spend executing local ticks before yielding to the event loop
     * @type {number}
     */
    public static MAX_TICK_DURATION: number = 100;

    /**
     * The related dispatcher for the internal data
     * @type {Dispatcher}
     */
    public dispatcher: Dispatcher;

    /**
     * A linked list of tasks to execute.
     * @type {lists.LinkedList}
     */
    public tasks: lists.LinkedList<() => void>;

    /**
     * A handle for the next tick
     * @type {any}
     */
    public tickHandle: any;

    /**
     * A value indicating whether the dispatcher is currently in a tick
     * @type {Boolean}
     */
    public inTick: boolean = false;

    /**
     * The time the tick started
     * @type {number}
     */
    public tickStarted: number;

    /**
     * The time the tick must end
     * @type {number}
     */
    public tickEnds: number;

    /**
     * Internal data and algorithms for a dispatcher
     * @param dispatcher The related dispatcher
     */
    constructor(dispatcher: Dispatcher) {
        this.dispatcher = dispatcher;
    }
}

/** Posts a microtask to the dispatcher
  * @param task The task to schedule
  * @param token The token to use for cancellation
  */
function PostTask(data: DispatcherData, task: () => void, options: DispatcherPostOptions, token: CancellationToken): void {
    var tokenHandle: number;
    var taskHandle: any;

    // bind the task to the dispatcher
    task = BindTask(data, task);

    if (options) {
        if (options.synchronous) {

            // execute the task synchronously, but throw the exception to the engine
            if (!(token && token.canceled)) {
                try {
                    task();
                }
                catch (e) {
                    PostTask(data, () => { throw e; }, null, null);
                }
            }

            return;
        }
        else if ("delay" in options) {

            // execute the task after a delay
            taskHandle = setTimeout(() => {
                if (token) {
                    if (tokenHandle) {
                        token.unregister(tokenHandle);
                    }
                }

                task();

            }, options.delay);
            
            if (token) {
                tokenHandle = token.register(() => { 
                    clearTimeout(taskHandle);
                });
            }

            return;
        }
        else if (options.fair) {

            // execute the task in the next turn
            taskHandle = SetImmediate(() => {
                if (token) {
                    if (tokenHandle) {
                        token.unregister(tokenHandle);
                    }
                }

                task();
            });
            
            if (token) {
                tokenHandle = token.register(() => { 
                    ClearImmediate(taskHandle) 
                });
            }
            return;
        }
    }

    // execute the task at the end of the turn
    if (data.tasks == null) {
        data.tasks = new lists.LinkedList<() => void>();
    }

    // enqueue the task
    var node = data.tasks.push(() => {
        if (token) {
            token.unregister(tokenHandle);
            if (token.canceled) {
                return;
            }
        }

        task();
    });

    // request a tick 
    RequestTick(data);

    if (token) {
        // if the token is canceled, we don't need to process this task
        tokenHandle = token.register(() => { 
            data.tasks.deleteNode(node);

            // if there are no tasks left, cancel the next tick request
            if (!data.tasks.head) {
                CancelTick(data);
            }
        });
    }
}

/** binds a task to a dispatcher 
  * @param task The task to bind
  */
function BindTask(data: DispatcherData, task: () => void): () => void {
    var wrapped = () => {
        var previousDispatcher = DispatcherData.current;
        DispatcherData.current = data.dispatcher;
        try {
            task();
        }
        finally {
            DispatcherData.current = previousDispatcher;
        }           
    }
    
    var domain = GetDomain();
    if (domain) {
        wrapped = domain.bind(wrapped);
    }

    return wrapped;
}

/** requests a tick to process microtasks
  */
function RequestTick(data: DispatcherData) {
    // do not request a tick if we are in a tick
    if (!data.inTick) {
        if (!data.tickHandle && data.tasks.head) {
            data.tickHandle = SetImmediate(() => { Tick(data); });
        }
    }
}

/** cancels the pending tick request
  */
function CancelTick(data: DispatcherData) {
    if (data.tickHandle) {
        ClearImmediate(data.tickHandle);
        data.tickHandle = null;
    }
}

/** handles processing of tasks
  */
function Tick(data: DispatcherData) {
    // cancel the previous tick
    CancelTick(data);

    // request a new tick in the event of an error being thrown
    RequestTick(data);

    // begin processing the queue
    data.inTick = true;
    data.tickStarted = Date.now();    
    data.tickEnds = data.tickStarted + DispatcherData.MAX_TICK_DURATION;    
    try {

        // Dequeue each pending task from the queue. If an exception is thrown, 
        // it will bubble to the engine's default unhandled exception event.
        // If we process all pending tasks and there are none that remain, we can
        // safely cancel the next tick. 
        // NOTE: We need a way to to ensure that we start a new Macro-task for some cases. 
        while (data.tasks.head) {
            var next = data.tasks.head;
            data.tasks.deleteNode(next);

            // NOTE: this may throw, that's ok. If it throws, we can continue processing in a later tick (assuming we ever get to it, depending on the engine).
            var callback = next.value;
            callback();

            // check to see if we should continue processing
            if (Date.now() >= data.tickEnds) {

                // maximum time in this tick has elapsed
                if (data.tasks.head) {

                    // more tasks to process, yield to the next tick
                    return;
                }
                else {
                    // no more tasks to process, exit the loop and cancel the next tick
                    break;
                }
            }
        }

        // No exceptions thrown, and no new tasks added. cancel the requested tick
        CancelTick(data);
    }
    finally {
        data.tickStarted = null;
        data.tickEnds = null;
        data.inTick = false;
    }
}

// feature detect our ability to schedule
var GetDomain = (): any => null;
var SetImmediate: (callback: () => void) => any;
var ClearImmediate: (handle: any) => void;

if (typeof setImmediate === "function") {
    SetImmediate = (task: () => void) => setImmediate(task);
    ClearImmediate = (handle: any) => clearImmediate(handle);
}
else if (typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function") {
    GetDomain = (): any => (<any>process).domain;
    SetImmediate = (task: () => void) => {
        var handle = { canceled: false };
        process.nextTick(() => {
            if (!handle.canceled) {
                task();
            }
        });
        return handle;
    }        
    ClearImmediate = (handle: any) => { if (handle) handle.canceled = true; }
}
else {
    SetImmediate = (task: () => void) => setTimeout(task, 0);
    ClearImmediate = (handle: any) => clearTimeout(handle);
}