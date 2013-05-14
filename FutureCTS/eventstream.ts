/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import symbols = module("symbols");
import lists = module("lists");
import tasks = module("tasks");
import futures = module("futures");

var __EventSourceData__ = new symbols.Symbol("EventSourceData@d6611c28-e94d-41db-96d9-b565959aded1");
var __EventStreamData__ = new symbols.Symbol("EventStreamData@acb50420-7927-4576-8e5d-b51c9a4c72ad");

/** Links two cancellation tokens
  * @param x The first cancellation token
  * @param y The second cancellation token
  * @returns A token that is canceled when either x or y ara cancelled, or null if neither argument was a token
  */
function linkTokens(x: tasks.CancellationToken, y: tasks.CancellationToken): tasks.CancellationToken {
    if (x) {
        if (y) {
            return new tasks.CancellationSource(x, y).token;
        }
        return x;
    }
    return y;
}

interface ContinuationLinkedListNode extends lists.LinkedListNode {
    /** The token used for cancellation
      */
    token?: tasks.CancellationToken;
}

enum EventState {
    pending,
    sending,
    closed,
    canceled
}

class EventData {
    public source: EventSource;
    public stream: EventStream;
    public closed: bool = false;
    public receiveCallbacks: lists.LinkedList;
    public rejectCallbacks: lists.LinkedList;
    public closeCallbacks: lists.LinkedList;
    public state: EventState = EventState.pending;
    public token: tasks.CancellationToken;
    public cancellationHandle: number;

    /** Private data for a EventStream and its EventSource
      * @constructor
      * @param stream The EventStream associated with this data
      * @param source The EventSource associated with this data
      * @param token The cancellation token used to manage cancellation
      */
    constructor(stream: EventStream, source: EventSource, token: tasks.CancellationToken) {
        this.stream = stream;
        this.source = source;
        this.token = token;

        // register for cancellation
        if (this.token) {
            this.cancellationHandle = this.token.register(() => { this.cancel(); });
        }
    }

    /** accept algorithm, accepts a value and sends it to subscribers
      * @param value The value to send to subscribers
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      */
    public accept(value: any, synchronous?: bool): void {
        if (this.closed) {
            return;
        }

        this.state = EventState.sending;
        this.process(this.receiveCallbacks, value, false, synchronous);
    }

    /** The send algorithm awaits a value if it is a future, merges events from the value if it is an 
      * EventStream, or accepts the value and sends it to subscribers
      * @param value The value to send to subscribers
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      */
    public send(value: any, synchronous?: bool): void {
        if (this.closed) {
            return;
        }

        if (value === this.stream) {
            throw new TypeError("EventStream cannot stream itself");
        }

        if (futures.Future.isFuture(value)) {
            var future = <futures.Future>value;
            var resolve = value => { this.accept(value, true); };
            var reject = value => { this.reject(value, true); };
            try {
                value.done(resolve, reject);
            }
            catch (e) {
                this.reject(e, synchronous);
            }

            return;
        }

        if (EventStream.isEventStream(value)) {
            var stream = <EventStream>value;
            var receive = value => { this.accept(value, true); };
            var reject = value => { this.reject(value, true); };
            try {
                stream.subscribe(receive, reject);
            }
            catch (e) {
                this.reject(e, synchronous);
            }

            return;
        }

        this.accept(value, synchronous);
    }

    /** reject algorithm
      * @param value The error value to send to subscribers
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      */
    public reject(value: any, synchronous?: bool): void {
        if (this.closed) {
            return;
        }

        this.state = EventState.sending;
        this.process(this.rejectCallbacks, value, false, synchronous);
    }

    /** close algorithm
      * @param synchronous A flag that specifies whether to execute callbacks synchronously or asynchronously
      */
    public close(synchronous?: bool): void {
        if (this.closed) {
            return;
        }

        this.state = EventState.closed;
        this.closed = true;

        if (this.token && this.cancellationHandle) {
            this.token.unregister(this.cancellationHandle);
            this.token = null;
            this.cancellationHandle = null;
        }

        this.process(this.closeCallbacks, void 0, true, synchronous);
    }

    /** performs cancellation of the stream
      */
    public cancel(): void {
        if (this.closed) {
            return;
        }

        this.state = EventState.canceled;
        this.closed = true;

        if (this.token && this.cancellationHandle) {
            this.token.unregister(this.cancellationHandle);
            this.token = null;
            this.cancellationHandle = null;
        }
    }

    /** Appends a receive, reject, or close callback to the EventStream's internal lists.
      * @param receiveCallback The callback executed when a value is received
      * @param rejectCallback The callback executed when a value is rejected
      * @param closeCallback The callback executed when the stream is closed
      */
    public append(receiveCallback: (value: any) => void, rejectCallback: (value: any) => void, closeCallback: () => void, token: tasks.CancellationToken): void {
        if (!(token && token.canceled)) {
            if (typeof receiveCallback === "function") {
                var receiveNode: ContinuationLinkedListNode = {
                    token: token,
                    value: receiveCallback
                };
                
                if (this.receiveCallbacks == null) {
                    this.receiveCallbacks = new lists.LinkedList();
                }

                this.receiveCallbacks.insertAfter(this.receiveCallbacks.tail, receiveNode);

                if (token) {
                    token.register(() => this.receiveCallbacks.remove(receiveNode));
                }
            }

            if (typeof rejectCallback === "function") {
                var rejectNode: ContinuationLinkedListNode = {
                    token: token,
                    value: rejectCallback
                };

                if (this.rejectCallbacks == null) {
                    this.rejectCallbacks = new lists.LinkedList();
                }

                this.rejectCallbacks.insertAfter(this.rejectCallbacks.tail, rejectNode);

                if (token) {
                    token.register(() => this.rejectCallbacks.remove(rejectNode));
                }
            }

            if (typeof closeCallback === "function") {
                var closeNode: ContinuationLinkedListNode = {
                    token: token,
                    value: closeCallback
                };

                if (this.closeCallbacks == null) {
                    this.closeCallbacks = new lists.LinkedList();
                }

                this.closeCallbacks.insertAfter(this.closeCallbacks.tail, closeNode);

                if (token) {
                    token.register(() => this.closeCallbacks.remove(closeNode));
                }
            }
        }

        // TODO: send events? Only if we're queuing them, not sure if that's the right design yet.
    }

    /** EventStream send wrapper callback algorithm
      * @param callback The callback to wrap
      * @returns The wrapped callback
      */
    public wrapSendCallback(callback: (value: any) => any): (value: any) => void {
        var wrapper = (argument: any) => {
            var value;
            try {
                value = callback.call(this.stream, argument);
            }
            catch (e) {
                this.reject(e, true);
                return;
            }

            this.send(value, true);
        }
        return wrapper;
    }

    /** EventStream close wrapper callback algorithm
      * @param callback The callback to wrap
      * @returns The wrapped callback
      */
    public wrapCloseCallback(callback: () => void): () => void {
        var wrapper = () => {
            try {
                callback.call(this.stream);
            }
            catch (e) {
                this.reject(e, true);
            }
            this.close(true);
        }
        return wrapper;
    }

    /** processes callbacks
      * @param callbacks The callbacks to process
      * @param result The result to pass to the callbacks
      * @param remove A value indicating whether to remove each processed callback
      * @param synchronous A value indicating whether to process the callbacks synchronously
      *
      * @link http://dom.spec.whatwg.org/#concept-future-process
      */
    public process(callbacks: lists.LinkedList, result: any, remove: bool, synchronous: bool): void {
        if (!synchronous) {
            futures.Future.run(() => this.process(callbacks, result, remove, true), this.token);
        }
        else {
            if (callbacks) {
                var node: ContinuationLinkedListNode = callbacks.head;
                if (node) {
                    while (callbacks.head) {
                        var next = node.next;
                        if (remove) {
                            callbacks.remove(node);
                        }
                        
                        if (!(node.token && node.token.canceled)) { 
                            try {
                                node.value.call(null, result);
                            }
                            catch (e) {
                                this.throwLater(e);
                            }
                        }
                        
                        node = next;
                        if (node === callbacks.head) {
                            return;
                        }
                    }
                }
            }
        }
    }

    /** throws an exception in a different task
      * @param e The error to throw
      */
    private throwLater(e: any): void {
        futures.Future
            .reject(e)
            .done(null, null);
    }
}

/** Source for sending events
  */
export class EventSource {
    
    /** Source for sending events
      */
    constructor() {
        throw new TypeError("Object doesn't support this action");        
    }

    /** Accepts a value and sends it to a subscriber
      * @param value The value to send
      */
    public accept(value: any): void {
        var eventData = __EventSourceData__.get(this);
        if (!eventData || !symbols.hasBrand(this, EventSource)) throw new TypeError("'this' is not an EventSource object");
        eventData.accept(value);
    }

    /** Sends a value to a subscriber. If the value is a Future, its future result or error is sent. If the value is an EventStream, its receive and reject events are sent.
      * @param value The value to send
      */
    public send(value: any): void {
        var eventData = __EventSourceData__.get(this);
        if (!eventData || !symbols.hasBrand(this, EventSource)) throw new TypeError("'this' is not an EventSource object");
        eventData.send(value);
    }

    /** Sends a rejection to the subscriber
      * @param value The value to send
      */
    public reject(value: any): void {        
        var eventData = __EventSourceData__.get(this);
        if (!eventData || !symbols.hasBrand(this, EventSource)) throw new TypeError("'this' is not an EventSource object");
        eventData.reject(value);
    }

    /** Closes the EventSource
      */
    public close(): void {        
        var eventData = __EventSourceData__.get(this);
        if (!eventData || !symbols.hasBrand(this, EventSource)) throw new TypeError("'this' is not an EventSource object");
        eventData.close();
    }

    /** Cancels the EventSource
      */
    public cancel(): void {        
        var eventData = __EventSourceData__.get(this);
        if (!eventData || !symbols.hasBrand(this, EventSource)) throw new TypeError("'this' is not an EventSource object");
        eventData.cancel();
    }
}

// brand the EventSource class
symbols.brand("EventSource")(EventSource);

/** A stream of events
  */
export class EventStream {    
    /** A stream of events
      * @param init A callback whose first argument is the source for the stream
      */
    constructor(init: (source: EventSource) => void);

    /** A stream of events
      * @param init A callback whose first argument is the source for the stream
      * @param token A token to use to stop listening to events
      */
    constructor(init: (source: EventSource) => void, token: tasks.CancellationToken);

    /** A stream of events
      * @param init A callback whose first argument is the source for the stream
      */
    constructor(init: (source: EventSource) => void, token?: tasks.CancellationToken) {
        if (typeof init !== "function") throw new TypeError("Invalid argument: init");
        if (token != null && !symbols.hasBrand(token, tasks.CancellationToken)) throw new TypeError("Invalid argument: token");

        // create source object from its prototype
        var source = Object.create(EventSource.prototype);
        var data = new EventData(this, source, token);
        __EventSourceData__.set(source, data);
        __EventStreamData__.set(this, data);

        // convenience, bind the methods to the instance
        source.accept = source.accept.bind(source);
        source.send = source.send.bind(source);
        source.reject = source.reject.bind(source);
        source.close = source.close.bind(source);

        try {
            init.call(this, source);
        }
        catch (e) {
            data.reject(e);
            data.close();
        }
    }

    public static isEventStream(value: any): bool {
        return symbols.hasBrand(value, EventStream);
    }

    /** Subscribes to new events sent to the EventStream
      * @returns A new EventStream for the stream.
      */
    public subscribe(): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param token The token used to stop listening to the stream.
      * @returns A new EventStream for the stream.
      */
    public subscribe(token: tasks.CancellationToken): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @returns A new EventStream for the stream.
      */
    public subscribe(receive: (value: any) => any): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param token The token used to stop listening to the stream.
      * @returns A new EventStream for the stream.
      */
    public subscribe(receive: (value: any) => any, token: tasks.CancellationToken): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @returns A new EventStream for the stream.
      */
    public subscribe(receive: (value: any) => any, reject: (value: any) => any): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param token The token used to stop listening to the stream.
      * @returns A new EventStream for the stream.
      */
    public subscribe(receive: (value: any) => any, reject: (value: any) => any, token: tasks.CancellationToken): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param close The callback to execute when the stream is closed.
      * @returns A new EventStream for the stream.
      */
    public subscribe(receive: (value: any) => any, reject: (value: any) => any, close: () => void): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param close The callback to execute when the stream is closed.
      * @param token The token used to stop listening to the stream.
      * @returns A new EventStream for the stream.
      */
    public subscribe(receive: (value: any) => any, reject: (value: any) => any, close: () => void, token: tasks.CancellationToken): EventStream;

    /** Subscribes to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param close The callback to execute when the stream is closed.
      * @returns A new EventStream for the stream.
      */
    public subscribe(...args: any[]): EventStream {
        var eventData = __EventStreamData__.get(this);
        if (!eventData || !symbols.hasBrand(this, EventStream)) throw new TypeError("'this' is not an EventStream object");

        var argi = 0;
        var receive: (value: any) => void = null;
        var reject: (value: any) => void = null;
        var close: () => void = null;
        var token: tasks.CancellationToken = null;

        // read arguments from possible overloads
        if (typeof args[argi] === "function") {
            receive = args[argi++];
            if (typeof args[argi] === "function") {
                reject = args[argi++];
                if (typeof args[argi] === "function") {
                    close = args[argi++];
                }
            }
        }
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
            token = args[argi];
        }

        // create a linked token
        token = linkTokens(eventData.token, token);

        // create the event source
        return new EventStream(source => {
            var sourceData = __EventSourceData__.get(source);
            if (!sourceData || !symbols.hasBrand(this, EventSource)) throw new TypeError("'this' is not an EventSource object");

            // wrap the receive callback
            var receiveCallback: (value: any) => void;
            if (receive != null) {
                receiveCallback = sourceData.wrapCallback(receive, false);
            }
            else {
                receiveCallback = value => sourceData.send(value, true);
            }

            // wrap the reject callback
            var rejectCallback: (value: any) => void;
            if (reject != null) {
                rejectCallback = sourceData.wrapCallback(reject, false);
            }
            else {
                rejectCallback = value => sourceData.reject(value, true);
            }

            // wrap the close callback
            var closeCallback: () => void;
            if (close != null) {
                closeCallback = sourceData.wrapCallback(close, true);
            }
            else {
                closeCallback = () => sourceData.close(true);
            }

            // append the callbacks to the antecedent
            eventData.append(receiveCallback, rejectCallback, closeCallback, token);
        }, token);
    }

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: any) => void): void;

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param token The cancellation token to use to stop listening.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: any) => void, token: tasks.CancellationToken): void;

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: any) => void, reject: (value: any) => void): void;

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param token The cancellation token to use to stop listening.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: any) => void, reject: (value: any) => void, token: tasks.CancellationToken): void;

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param close The callback to execute when the stream is closed.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: any) => void, reject: (value: any) => void, close: () => void): void;

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param close The callback to execute when the stream is closed.
      * @param token The cancellation token to use to stop listening.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: any) => void, reject: (value: any) => void, close: () => void, token: tasks.CancellationToken): void;

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param rejectOrToken The callback to execute when a rejection is received; Alternatively, the cancellation token used to stop listening.
      * @param closeOrToken The callback to execute when the stream is closed; Alternatively, the cancellation token used to stop listening.
      * @param token The cancellation token to use to stop listening.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: any) => void, ...args: any[]): void {
        var eventData = __EventStreamData__.get(this);
        if (!eventData || !symbols.hasBrand(this, EventStream)) throw new TypeError("'this' is not an EventStream object");

        var argi = 0;
        var reject: (value: any) => void = null;
        var close: () => void = null;
        var token: tasks.CancellationToken = null;

        // read arguments from possible overloads
        if (typeof args[argi] === "function") {
            reject = args[argi++];
            if (typeof args[argi] === "function") {
                close = args[argi++];
            }
        }
        if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
            token = args[argi];
        }

        // create a linked token
        token = linkTokens(eventData.token, token);

        // append the callbacks
        eventData.append(receive, reject, close, token);
    }
}

symbols.brand("EventStream")(EventStream);

/*
    var _es5 = typeof Function.prototype.bind === "function" &&
               typeof Object.create === "function" &&
               typeof Object.defineProperty === "function",
        _toArray = _es5 ? Function.prototype.call.bind(Array.prototype.slice) : function (arraylike, start, end) { 
            return Array.prototype.slice.call(arraylike, start, end); 
        },
        _uncurry = _es5 ? Function.prototype.bind.bind(Function.prototype.call) : function (target) { 
            return function (thisArg) { return target.apply(thisArg, _toArray(arguments, 1)); } 
        },
        _bind = _es5 ? _uncurry(Function.prototype.bind) : function (target, thisArg) {
            var boundArgs = _toArray(arguments, 2);
            return function () { return target.apply(thisArg, boundArgs.concat(_toArray(arguments))); }
        },
        _create = _es5 ? Object.create : function (_) { 
            return function (proto) {
                try {
                    _.prototype = proto;
                    return new _();
                }
                finally {
                    _.prototype = null;
                }
            }
        }(function () {}),
        
        VERB_SEND = "send",
        VERB_REJECT = "reject",
        VERB_CLOSE = "close";

    / ** Implements a simple dispatcher for the engine's event-loop.
      * /
    var Dispatcher = function () {
        if (typeof setImmediate === "function") {
            return { 
                post: _bind(setImmediate, null),
                cancel: _bind(clearImmediate, null)
            };
        }
        else {
            return {
                post: function (work) { return setTimeout.apply(null, [work, 0].concat(_toArray(arguments, 1)));},
                cancel: _bind(clearTimeout, null)
            }
        }
    }();

    var Countdown = function () {
        / ** A countdown event
          * @param count {Number} The number of times the event must signal before it completes
          * /
        function Countdown(count) {
            / ** Signals a countdown event
              * @returns {Boolean} True if the countdown has completed; otherwise, false
              * /
            this.set = function () { 
                if (count > 0) {
                    return --count <= 0; 
                }
                
                return true;
            }
        }
        
        return Countdown;
    }();
        
    var __EventSourceData__ = Symbol();
    var __EventStreamData__ = Symbol();
    var __EventStreamBrand__ = Symbol("[[EventStream]]");
        
    var EventData = function () {
        function EventData(stream, source) {
            this.antecedent = null;
            this.completed = false;
            this.stream = stream;
            this.source = source;
        }
        
        / ** Root of a chain of subscriptions for the EventSource. This is called when a new subscriber is added to an EventStream.
          * @param {EventSource} source The source for the new subscriber.
          * @param {Function} receive The receive callback for the new subscriber.
          * @param {Function} reject The reject callback for the new subscriber.
          * @param {Function} close The close callback for the new subscriber.
          * @param {Object} [options] An optional object providing additional options that affect the new subscriber.          
          * /
        EventData.prototype.chain = function (source, receive, reject, close) {
            
            // set the antecedent for the subscriber to use to remove the subscription on close
            if (source) {
                var sourceEventData = __EventSourceData__.get(source);
                if (sourceEventData) {
                    sourceEventData.antecedent = this;
                }
            }
            
            var link = function (verb, value) {
                link.next.call(this, verb, value);
                Dispatcher.post(forward, source, verb, value, receive, reject, close);
            }
            
            link.source = sourceEventData;
            link.next = this.when;
            this.when = link;
        }
        
        / ** Root for sending notifications to subscribers.
          * @param {String} verb The notification type for the event
          * @param value The value for the notification
          * /
        EventData.prototype.when = function (verb, value) {
            if (verb === VERB_CLOSE) {
                this.chain = function (source, receive, reject, close) {
                    Dispatcher.post(forward, source, verb, value, receive, reject, close);
                }
            }
        }
        
        / ** Publishes an event to subscribers.
          * @param {String} verb The notification type for the event
          * @param value The value for the notification
          * /
        EventData.prototype.publish = function (verb, value) {
            // TODO: should we await Futures? How would this affect event ordering?
            if (verb === VERB_SEND && EventStream.isEventStream(value)) {
                try {
                    var antecedent = this;
                    value.subscribe(
                        _bind(this.publish, this, VERB_SEND),
                        _bind(this.publish, this, VERB_REJECT)
                    );
                }
                catch (e) {
                    this.when(VERB_REJECT, e);
                }
            }
            else {
                this.when(verb, value);
            }
        }
        
        / ** Attempts to publish an event to subscribers.
          * @param {String} verb The notification type for the event
          * @param value The value for the notification
          * /
        EventData.prototype.tryPublish = function (verb, value) {
            if (this.completed) {
                return false;
            }

            if (verb === VERB_CLOSE) {            
                this.completed = true;
                
                // check for an antecedent and remove us from the chain
                if (this.antecedent) {
                    for (var node = this.antecedent.chain, prev = null; node; prev = node, node = node.next) {
                        if (node.source === this) {
                            if (prev) {
                                prev.next = node.next;
                            }
                            else {
                                this.antecedent.chain = node.next;
                            }
                            break;
                        }
                    }
                }
            }

            this.publish(verb, value);
            return true;
        }
        
        / ** Forwards a notification to a subscriber
          * @param {EventSource} source An EventSource for the subscriber.
          * @param {String} verb The notification type for the event.
          * @param value The value for the notification
          * @param {Function} A callback to execute when the verb is "send"
          * @param {Function} A callback to execute when the verb is "reject"
          * @param {Function} A callback to execute when the verb is "close"
          * /
        function forward(source, verb, value, receive, reject, close) {
            var stream = null;
            if (source) {
                var eventData = __EventSourceData__.get(source);
                if (eventData) {
                    stream = eventData.stream;
                }
            }
            
            try {
                if (verb === VERB_SEND) {
                    if (receive) {
                        value = receive.call(stream, value);
                    }
                }
                else if (verb === VERB_REJECT) {
                    if (reject) {
                        value = reject.call(stream, value);
                        verb = VERB_SEND;
                    }
                }
            }
            catch (e) {
                value = e;
                verb = VERB_REJECT;
            }
            
            if (verb === VERB_CLOSE) {
                try {
                    if (close) {
                        close.call(stream);
                    }
                }
                catch (e) {
                    Dispatcher.post(function () { throw e; });
                }
            }
            
            if (source) {
                source[verb](value);
            }
            else if (verb === VERB_REJECT) {
                Dispatcher.post(function () { throw value; });
            }
        }
        
        return EventData;
    }();

    var EventSource = function () {    
        / ** A source for an EventStream
          * @constructor
          * /
        function EventSource() {
            throw new TypeError("Type is not creatable");
            
            // NOTE: Should EventSource be creatable?
            / *
            if (!(this instanceof EventSource) || this === EventSource.prototype) throw new TypeError("'this' is not an EventSource object");
            
            // private storage object
            var data = new EventData();
            __EventSourceData__.set(this, data);
            
            // initialize the stream
            var stream = _create(EventStream.prototype);
            this.stream = stream;
            __EventStreamData__.set(stream, data);
            
            // brand the event stream
            __EventStreamBrand__.set(stream);
            
            // convenience, bind the source functions
            this.send = _bind(this.send, this);
            this.reject = _bind(this.reject, this);
            this.close = _bind(this.close, this);        
            * /    
        }
        
        // NOTE: Should EventSource be creatable?
        // EventSource.prototype.stream = null;
        
        EventSource.prototype.send = function (value) {
            var eventData = __EventSoureData__.get(this);
            if (!eventData) throw new TypeError("'this' is not an EventSource object");
            
            return eventData.tryPublish(VERB_SEND, value);
        }
        
        EventSource.prototype.reject = function (err) {
            var eventData = __EventSoureData__.get(this);
            if (!eventData) throw new TypeError("'this' is not an EventSource object");
            
            return eventData.tryPublish(VERB_REJECT, err);
        }
        
        EventSource.prototype.close = function () {
            var eventData = __EventSoureData__.get(this);
            if (!eventData) throw new TypeError("'this' is not an EventSource object");
                        
            return eventData.tryPublish(VERB_CLOSE);
        }
        
        return EventSource;
    }();
    
    var EventStream = function () {
        / ** A stream of events 
          * @constructor
          * @param {Function} init A callback used to initialize the stream. The sole argument is the EventSource for the stream
          * /
        function EventStream(init) {
            if (typeof init !== "function") throw new TypeError("Invalid argument: init");
            if (!(this instanceof EventStream) || this === EventStream.prototype) throw new TypeError("'this' is not an EventStream object");
            
            // brand the event stream
            __EventStreamBrand__.set(this);
            
            // initialize the source
            var source = _create(EventSource.prototype);            
            // NOTE: If EventSource is creatable, we should attach the "stream" property
            // source.stream = this;            

            // private storage object
            var data = new EventData(this, source);
            __EventStreamData__.set(this, data);
            __EventSourceData__.set(source, data);
            
            // convenience, bind the source functions
            source.send = _bind(source.send, source);
            source.reject = _bind(source.reject, source);
            source.close = _bind(source.close, source);
            
            try {
                init.call(this, source);
            }
            catch (e) {
                data.tryPublish(VERB_REJECT, e);
                data.tryPublish(VERB_CLOSE);
            }
        }
        
        / ** Closes the EventStream and stops listening to future events
          * /
        EventStream.prototype.close = function () { 
            var eventData = __EventStreamData__.get(this);
            if (!eventData) throw new TypeError("'this' is not an EventStream object");
            
            eventData.tryPublish(VERB_CLOSE);
        }
        
        / ** Subscribes to events on the EventStream, creating a new chained EventStream.
          * @param {Function} [receive] Callback that receives a value from this EventStream. The result of the callback is used as the value for the chained EventStream.
          * @param {Function} [reject] Callback that receives any error that terminates the EventStream.
          * @param {Function} [close] Callback that is executed when the EventStream is closed.
          * /
        EventStream.prototype.subscribe = function (receive, reject, close) {
            var eventData = __EventStreamData__.get(this);
            if (!eventData) throw new TypeError("'this' is not an EventStream object");
            
            return new EventStream(function (source) {
                eventData.chain(source, receive, reject, close);
            });
        }
        
        EventStream.prototype["finally"] = function (close) {
            var eventData = __EventStreamData__.get(this);
            if (!eventData) throw new TypeError("'this' is not an EventStream object");
            
            return new EventStream(function (source) {
                eventData.chain(source, null, null, close);
            });
        }
        
        EventStream.prototype.map = function (projection, thisArg) {
            return this.subscribe(function (value) {
                return projection.call(thisArg, value, antecedent);
            });
        }
        
        EventStream.prototype.filter = function (predicate, thisArg) {
            var antecedent = this;
            return new EventStream(function (source) {
                antecedent.subscribe(
                    function (value) {
                        if (predicate.call(thisArg, value, antecedent)) {
                            source.send(value);
                        }
                    },
                    source.reject,
                    function () {
                        source.close();
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.skip = function (count) {
            var antecedent = this;
            return new EventStream(function (source) {
                var countdown = new Countdown(count);
                antecedent.subscribe(
                    function (value) {
                        if (countdown.Set()) {
                            source.send(value);
                        }
                    },
                    source.reject,
                    function () {
                        source.close();
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.take = function (count) {
            var antecedent = this;
            return new EventStream(function (source) {
                var countdown = new Countdown(count);
                antecedent.subscribe(
                    function (value) {
                        if (!countdown.Set()) {
                            source.send(value);
                        }
                        else {
                            source.close();
                            this.close();
                        }
                    },
                    source.reject,
                    function () {
                        source.close();
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.skipWhile = function (predicate, thisArg) {
            if (typeof predicate !== "function") throw new TypeError("Invalid argument: predicate");
            
            var antecedent = this;
            return new EventStream(function (source) {
                var done = false;
                antecedent.subscribe(
                    function (value) {
                        if (!done) {
                            try {
                                done = !predicate.call(thisArg, value, antecedent);
                                if (!done) return;
                            }
                            catch (e) {
                                source.reject(e);
                                source.close();
                                this.close();
                                return;
                            }
                        }

                        source.send(value);
                    },
                    source.reject,
                    function () {
                        source.close();
                        this.close();
                    }
                );
            });
        }

        EventStream.prototype.takeWhile = function (predicate, thisArg) {
            if (typeof predicate !== "function") throw new TypeError("Invalid argument: predicate");
            
            var antecedent = this;
            return new EventStream(function (source) {
                antecedent.subscribe(
                    function (value) {
                        try {
                            if (predicate.call(thisArg, value, antecedent)) {
                                source.send(value);
                            }
                            else {
                                source.close();
                                this.close();
                            }
                        }
                        catch (e) {
                            source.reject(e);
                            source.close();
                            this.close();
                        }
                    },
                    source.reject,
                    function () {
                        source.close();
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.skipUntil = function (future) {
            if (!Future.isFuture(future)) throw new TypeError("Invalid argument: future");
            
            var antecedent = this;
            return new EventStream(function (source) {
                var done = false;
                var subscription = antecedent.subscribe(
                    function (value) {
                        if (done) {
                            source.send(value);
                        }
                    },
                    source.reject,
                    function () {
                        // really want to be able to cancel the future...
                        source.close();
                        this.close();
                    }
                );

                future.done(
                    function() { 
                        done = true; 
                    },
                    function (err) {
                        source.reject(err);
                        source.close();
                        subscription.close();
                    }
                );                
            });
        }

        EventStream.prototype.takeUntil = function (future) {
            if (!Future.isFuture(future)) throw new TypeError("Invalid argument: future");
            
            var antecedent = this;
            return new EventStream(function (source) {
                
                var subscription = antecedent.subscribe(
                    source.send,
                    source.reject,
                    function () {
                        source.close();
                        this.close();
                    }
                );

                future.done(
                    function() { 
                        source.close();
                        subscription.close();
                    },
                    function (err) {
                        source.reject(err);
                        source.close();
                        subscription.close();
                    }
                );
            });
        }
        
        EventStream.prototype.throttle = function (interval) {
            // TODO
            throw new Error("not implemented");
        }
        
        EventStream.prototype.zip = function (right, projection, thisArg) {
            // TODO:
            throw new Error("not implemented");
        }
                        
        EventStream.ptototype.reduce = function (aggregate, initialValue) {
            var antecedent = this;
            return new Future(function (resolver) {

                var accumulator;
                var hasValue = arguments.length >= 2;
                if (hasValue) {
                    accumuator = initialValue;
                }
                
                antecedent.subscribe(
                    function (value) {
                        try {
                            if (!hasValue) {
                                accumulator = value;
                                hasValue = true;
                            }
                            else {
                                accumulator = aggregate.call(null, accumulator, value, antecedent);
                            }
                        } 
                        catch (e) {
                            resolver.reject(e);
                            this.close();
                        }
                    },
                    function (err) {
                        resolver.reject(err);
                        this.close();
                    },
                    function () {
                        resolver.resolve(accumulator);
                        this.close();
                    });
            });
        }
        
        EventStream.prototype.reduceRight = function (aggregate, initialValue) {
            var antecedent = this;
            return new Future(function (resolver) {
                var accumulator;
                var values;
                var hasValue = arguments.length >= 2;
                if (hasValue) {
                    accumulator = initialValue;
                }
                
                antecedent.subscribe(
                    function (value) {
                        if (!values) {
                            values = [];
                        }
                        values.push(value);
                    },
                    function (err) {
                        resolver.reject(err);
                        this.close();
                    },
                    function () {
                        try {
                            if (values) {
                                var i = values.length - 1;
                                if (!hasValue) {
                                    accumulator = values[i--];
                                }
                                
                                for (; i >= 0; i--) {
                                    accumulator = aggregate.call(null, accumulator, values[i], antecedent);
                                }
                            }
                            
                            resolver.resolve(accumulator);
                        }
                        catch (e) {
                            resolver.reject(e);
                        }
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.first = function (predicate, thisArg) {
            var antecedent = this;
            return new Future(function (resolver) {
                antecedent.subscribe(
                    function (value) {
                        try {
                            if (typeof predicate !== "function" || predicate.call(thisArg, value, antecedent)) {
                                resolver.resolve(value);
                                this.close();
                            }
                        } 
                        catch (e) {
                            resolver.reject(e);
                            this.close();
                        }
                    },
                    function (err) {
                        resolver.reject(err);
                        this.close();
                    },
                    function () {
                        resolver.reject(new Error("No data"));
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.last = function (predicate, thisArg) {
            var antecedent = this;
            return new Future(function (resolver) {
                var result;
                var hasValue = false;
                antecedent.subscribe(
                    function (value) {
                        try {
                            if (typeof predicate !== "function" || predicate.call(thisArg, value, antecedent)) {
                                result = value;
                                hasValue = true;
                            }
                        }
                        catch (e) {
                            resolver.reject(e);
                            this.close();
                        }
                    },
                    function (err) {
                        resolver.reject(err);
                        this.close();
                    },
                    function () {
                        if (hasValue) {
                            resolver.resolve(result);
                        }
                        else {
                            resolver.reject(new Error("No data"));
                        }
                        this.close();
                    });
                );
            });
        }
        
        EventStream.prototype.some = function (predicate, thisArg) {
            var antecedent = this;
            return new Future(function (resolver) {
                antecedent.subscribe(
                    function (value) {
                        try {
                            if (typeof predicate !== "function" || predicate.call(thisArg, value, antecedent)) {
                                resolver.resolve(true);
                                this.close();
                            }
                        }
                        catch (e) {
                            resolver.reject(e);
                            this.close();
                        }
                    },
                    function (err) {
                        resolver.reject(err);
                        this.close();
                    },
                    function () {
                        resolver.resolve(false);
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.every = function (predicate, thisArg) {
            var antecedent = this;
            var hasValue = false;
            return new Future(function (resolver) {
                antecedent.subscribe(
                    function (value) {
                        try {
                            if (typeof predicate !== "function" || predicate.call(thisArg, value, antecedent)) {
                                resolver.resolve(false);
                                this.close();
                            }
                            
                            hasValue = true;
                        }
                        catch (e) {
                            resolver.reject(e);
                            this.close();
                        }
                    },
                    function (err) {
                        resolver.reject(err);
                        this.close();
                    },
                    function () {
                        resolver.resolve(hasValue);
                        this.close();
                    }
                );
            });
        }
        
        EventStream.prototype.count = function (predicate, thisArg) {
            var antecedent = this;
            return new Future(function (resolver) {
                var count = 0;
                antecedent.subscribe(
                    function (value) {
                        try {
                            if (typeof predicate !== "function" || predicate.call(thisArg, value, antecedent)) {
                                count++;
                            }
                        }
                        catch (e) {
                            resolver.reject(e);
                            this.close();
                        }
                    },
                    function (err) {
                        resolver.reject(err);
                        this.close();
                    },
                    function () {
                        resolver.resolve(count);
                        this.close();
                    }
                );
            });
        }
        
        EventStream.isEventStream = function (value) {
            if (value instanceof EventStream) {
                return true;
            }
            
            if (Object(value) === value && __EventStreamBrand__.has(value)) {
                return true;
            }
            
            return false;
        }
                
        return EventStream;
    }();
*/