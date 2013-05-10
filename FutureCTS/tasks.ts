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

var __CancellationTokenData__ = new symbols.Symbol("CancellationTokenData@edf533f9-bae1-4a85-a3c1-1e191754155d");
var __CancellationSourceData__ = new symbols.Symbol("CancellationTokenSourceData@7d9c6295-bbfe-4d18-99b0-10583b920e9c");
var __DispatcherData__ = new symbols.Symbol("DispatcherData@cc25bb49-9c40-40aa-8503-fef7f6080a2c");

interface CallbackLinkedListNode extends lists.LinkedListNode<() => void> {
    /** The handle for the callback
      */
    handle?: number;
}

/** An error that contains multiple errors
  */
class AggregateError implements Error {
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

symbols.brand.set(AggregateError.prototype, "AggregateError");

/** 
 * Internal data used for cancellation
 */
class CancellationData {

    /**
     * The maximum handle value before it should wrap
     * @type {number}
     */
    private static MAX_HANDLE: number = 2147483647;

    /**
     * The id of the next cancellation handle to use
     * @type {Number}
     */
    private static nextHandle: number = 1;

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
    public closed: bool = false;

    /**
     * A value indicating whether the source has been canceled
     * @type {Boolean}
     */
    public canceled: bool = false;
    
    /**
     * A linked list of cleanup callbacks
     * @type {lists.LinkedList}
     */
    public cleanupCallbacks: lists.LinkedList<() => void>;

    /**
     * A linked list of linked tokens
     * @type {lists.LinkedList}
     */
    public links: lists.LinkedList<() => void>;

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
    
    /** 
     * Registers a cleanup callback
     * @param cleanup The callback to execute when cancellation is requested
     * @returns A handle to the cleanup callback that can be used to unregister the callback
     */
    public register(cleanup: () => void): number {
        if (this.canceled) {
            cleanup();
            return 0;
        }

        // fetch the next handle
        if (CancellationData.nextHandle >= CancellationData.MAX_HANDLE) {
        	CancellationData.nextHandle = 1;
        }        
        var handle = CancellationData.nextHandle++;

        // lazy-init the list
        if (this.cleanupCallbacks == null) {
            this.cleanupCallbacks = new lists.LinkedList<() => void>();
        }

        // add a node to the linked list
        var node: CallbackLinkedListNode = {
            handle: handle,
            value: cleanup
        };                
        this.cleanupCallbacks.insertAfter(this.cleanupCallbacks.tail, node);
        return handle;
    }
    
    /** 
     * Unregisters a cleanup callback
     * @param handle The handle to unregister
     */
    public unregister(handle: number): void {
        if (this.cleanupCallbacks) {
            var filter = (node: CallbackLinkedListNode) => node.handle === handle;
            var found = this.cleanupCallbacks.find(filter);
            if (found) {
                this.cleanupCallbacks.remove(found);
            }
        }
    }

    /** 
     * Links this cancellation to another token
     * @param token The token to link
     */
    public linkTo(token: CancellationToken): void {
        
        // lazy-init the links
        if (this.links == null) {
            this.links = new lists.LinkedList<() => void>();
        }

        // register linked cancellation
        var handle = token.register(() => {
            this.cancel();
        });

        var node: CallbackLinkedListNode = {
            handle: handle,
            value: () => { token.unregister(handle); }
        };

        this.links.insertAfter(this.links.tail, node);
    }
    
    /**
     * Cancels the source
     */
    public cancel(): void {
    	if (this.canceled) {
            return;
        }
        
        this.canceled = true;
        
        var errors: any[];
        var callback = (node: CallbackLinkedListNode) => {
            try {
                node.value.call(null);
            }
            catch (e) {
                if (errors == null) {
                	errors = [];
                }

                errors.push(e);
            }
        }

        // execute each cleanup callback and catch any errors
        this.cleanupCallbacks.forEach(callback);        
        this.cleanupCallbacks = null;
        
        // if there were any errors, throw them
        if (errors) {
            throw new AggregateError(null, errors);
        }
    }
    
    /** 
     * Cancels the token after a delay
     * @param ms The number of milliseconds to wait
     */
    public cancelAfter(ms: number): void {
        if (this.canceled) {
            return;
        }
        
        if (this.cancelHandle) {
            clearTimeout(this.cancelHandle);
            this.cancelHandle = null;
        }
        
        this.cancelHandle = setTimeout(() => { this.cancel(); }, ms);
    }
}

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
    public get canceled(): bool {
        var data = __CancellationTokenData__.get(this);
        if (!data || !symbols.hasBrand(this, CancellationToken)) throw new TypeError("'this' is not a CancellationToken object");
        
        return data.canceled;
    }
    
    /** 
     * Registers a cleanup callback
     * @param cleanup The callback to execute when cancellation is requested
     * @returns A handle to the cleanup callback that can be used to unregister the callback
     */
    public register(cleanup: () => void): number {
        var data = __CancellationTokenData__.get(this);
        if (!data || !symbols.hasBrand(this, CancellationToken)) throw new TypeError("'this' is not a CancellationToken object");
        
        return data.register(cleanup);
    }
    
    /** 
     * Unregisters a cleanup callback
     * @param handle The handle to unregister
     */
    public unregister(handle: number): void {
        var data = __CancellationTokenData__.get(this);
        if (!data || !symbols.hasBrand(this, CancellationToken)) throw new TypeError("'this' is not a CancellationToken object");

        data.unregister(handle);
    }
}

symbols.brand.set(CancellationToken.prototype, "CancellationToken");

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
        __CancellationTokenData__.set(token, data);
        __CancellationSourceData__.set(this, data);

        // link any optional tokens
        tokens.forEach(token => { 
        	if (symbols.hasBrand(token, CancellationToken)) {
	        	data.linkTo(token)
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
        var data = __CancellationSourceData__.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");
        
        return data.token;
    }
    
    /** 
     * Cancels the source
     */
    public cancel(): void {
        var data = __CancellationSourceData__.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");
        if (data.closed) throw new Error("Object doesn't support this action");
        
        data.cancel();
    }
    
    /** 
     * Cancels the source after a number of milliseconds has elapsed
     * @param ms The number of milliseconds to wait
     */
    public cancelAfter(ms: number): void {
        var data = __CancellationSourceData__.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");
        if (data.closed) throw new Error("Object doesn't support this action");
        
        data.cancelAfter(ms);
    }
    
    /** 
     * Cleans up the cancellation source
     */
    public close(): void {
        var data = __CancellationSourceData__.get(this);
        if (!data || !symbols.hasBrand(this, CancellationSource)) throw new TypeError("'this' is not a CancellationSource object");        
        if (data.closed) return;
        
        data.closed = true;
        
        if (data.links != null) {
            data.links.forEach(node => { node.value.call(null) });
        }
        
        data.links = null;
    }
}

symbols.brand.set(CancellationSource.prototype, "CancellationSource");

// feature detect our ability to schedule
var _getDomain = (): any => null;
var _setImmediate: (callback: () => void) => any;
var _clearImmediate: (handle: any) => void;    
if (typeof setImmediate === "function") {
    _setImmediate = (task: () => void) => setImmediate(task);
    _clearImmediate = (handle: any) => clearImmediate(handle);
}
else if (typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function") {
    _getDomain = (): any => (<any>process).domain;
    _setImmediate = (task: () => void) => {
        var handle = { canceled: false };
        process.nextTick(() => {
            if (!handle.canceled) {
                task();
            }
        });
        return handle;
    }        
    _clearImmediate = (handle: any) => { if (handle) handle.canceled = true; }
}
else {
    _setImmediate = (task: () => void) => setTimeout(task, 0);
    _clearImmediate = (handle: any) => clearTimeout(handle);
}

/**
 * Options for a task posted to a dispatcher
 */
export interface DispatcherPostOptions {
	/**
	 * A value indicating whether the dispatcher should prefer fairness and schedule 
	 * the task in a later turn rather than the end of the turn.
	 */
	fair?: bool;

	/**
	 * A value indicating whether the dispatcher to execute the task synchronously. Exceptions will be raised to the engine's unhandled exception handler.
	 */
	synchronous?: bool;

	/**
	 * A number of milliseconds to delay before the task should execute.
	 */
	delay?: number;
}

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
	public inTick: bool = false;

	/**
	 * Internal data and algorithms for a dispatcher
	 * @param dispatcher The related dispatcher
	 */
	constructor(dispatcher: Dispatcher) {
		this.dispatcher = dispatcher;
	}

    /** Posts a microtask to the dispatcher
      * @param task The task to schedule
      * @param token The token to use for cancellation
      */
    public post(task: () => void, options: DispatcherPostOptions, token: CancellationToken): void {
    	var tokenHandle: number;
    	var taskHandle: any;

    	// bind the task to the dispatcher
    	task = this.bind(task);

    	if (options) {
    		if (options.synchronous) {

    			// execute the task synchronously, but throw the exception to the engine
    			if (!(token && token.canceled)) {
	    			try {
	    				task();
	    			}
	    			catch (e) {
	    				this.post(() => { throw e; }, null, null);
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
		        taskHandle = _setImmediate(() => {
		            if (token) {
		                if (tokenHandle) {
		                    token.unregister(tokenHandle);
		                }
		            }

		            task();
		        });
		        
		        if (token) {
		            tokenHandle = token.register(() => { 
		                _clearImmediate(taskHandle) 
		            });
		        }
		        return;
	    	}
	    }

	    // execute the task at the end of the turn
    	if (this.tasks == null) {
            this.tasks = new lists.LinkedList<() => void>();
        }

        // create a node for the callback
        var node: lists.LinkedListNode<() => void> = { 
            value: () => {
                if (token) {
                    token.unregister(tokenHandle);
                    if (token.canceled) {
                        return;
                    }
                }

                task();
            }
        };

        // enqueue the task
        this.tasks.insertAfter(this.tasks.tail, node);

        // request a tick 
        this.requestTick();

        if (token) {
            // if the token is canceled, we don't need to process this task
            tokenHandle = token.register(() => { 
                this.tasks.remove(node);

                // if there are no tasks left, cancel the next tick request
                if (!this.tasks.head) {
                    this.cancelTick();
                }
            });
        }
    }

    /** requests a tick to process microtasks
      */
    private requestTick() {
        // do not request a tick if we are in a tick
        if (!this.inTick) {
            if (!this.tickHandle && this.tasks.head) {
                this.tickHandle = _setImmediate(() => { this.tick(); });
            }
        }
    }

    /** cancels the pending tick request
      */
    private cancelTick() {
        if (this.tickHandle) {
            _clearImmediate(this.tickHandle);
            this.tickHandle = null;
        }
    }

    /** binds a task to a dispatcher 
      * @param task The task to bind
      */
    private bind(task: () => void): () => void {
    	var wrapped = () => {
            var previousDispatcher = DispatcherData.current;
            DispatcherData.current = this.dispatcher;
            try {
            	task();
            }
            finally {
            	DispatcherData.current = previousDispatcher;
            }    		
    	}
    	
    	var domain = _getDomain();
    	if (domain) {
    		wrapped = domain.bind(wrapped);
    	}

    	return wrapped;
    }

    /** handles processing of tasks
      */
    private tick() {
        // cancel the previous tick
        this.cancelTick();

        // request a new tick in the event of an error being thrown
        this.requestTick();

        // begin processing the queue
        this.inTick = true;
        try {

            // Dequeue each pending task from the queue. If an exception is thrown, 
            // it will bubble to the engine's default unhandled exception event.
            // If we process all pending tasks and there are none that remain, we can
            // safely cancel the next tick. 
            // NOTE: We need a way to to ensure that we start a new Macro-task for some cases. 
            while (this.tasks.head) {
                var next = this.tasks.head;
                this.tasks.remove(next);

                // NOTE: this may throw, that's ok. If it throws, we can continue processing in a later tick (assuming we ever get to it, depending on the engine).
                var callback = next.value;
            	callback();
            }

            // No exceptions thrown, and no new tasks added. cancel the requested tick
            this.cancelTick();
        }
        finally {
            this.inTick = false;
        }
    }
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
		__DispatcherData__.set(this, data);
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
    	var data = __DispatcherData__.get(this);
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

        data.post(task, options, token);
    }
}

symbols.brand.set(Dispatcher.prototype, "Dispatcher");
