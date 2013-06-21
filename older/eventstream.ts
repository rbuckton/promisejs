/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import promises = module("promises");

module linkedlist {
    export function Append(list: { head?; }, node: any): any {
        if (node && !node.next) {
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
        }

        return node;
    }

    export function Delete(list: { head?; }, node: any): any {
        if (node && node.next) {
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
            
            node.prev = node.next = null;
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

/** Source for sending events
  */
export class EventSource<T> {

    private _eventData: EventData<T>;
    
    /** Source for sending events
      */
    constructor() {
        throw new TypeError("Object doesn't support this action");        
    }

    /** Accepts a value and sends it to a subscriber
      * @param value The value to send
      */
    public fulfill(value: T): void {
        this._eventData.fulfill(value);
    }

    /** Sends a value to a subscriber.
      * @param value The value to send
      */
    public resolve(value: T): void;

    /** Sends a future value to a subscriber.
      * @param value The value to send
      */
    public resolve(value: promises.Promise<T>, token?: promises.CancellationToken): void;
    public resolve(value: any, token?: promises.CancellationToken): void {
        this._eventData.resolve(value, token);
    }

    /** Sends the contents of an event stream to this stream's subscribers
      * @param value The values to stream
      */
    public merge(value: EventStream<T>, token?: promises.CancellationToken): void {
        this._eventData.merge(value, token);
    }

    /** Sends a rejection to the subscriber
      * @param value The value to send
      */
    public reject(value: any): void {        
        this._eventData.reject(value);
    }

    /** Closes the EventSource
      */
    public close(): void {        
        this._eventData.close();
    }

    /** Cancels the EventSource
      */
    public cancel(): void {        
        this._eventData.cancel();
    }
}

// TODO: should this buffer??
/** 
 * A stream of events
 */
export class EventStream<T> {    
    private _eventData: EventData<T>;

    /** 
     * A stream of events
     * @param init A callback whose first argument is the source for the stream
     */
    constructor(init: (source: EventSource<T>) => void);

    /**
     * A stream of events
     * @param init A callback whose first argument is the source for the stream
     * @param token A token to use to stop listening to events
     */
    constructor(init: (source: EventSource<T>) => void, token: promises.CancellationToken);

    /** 
     * A stream of events
     * @param init A callback whose first argument is the source for the stream
     */
    constructor(init: (source: EventSource<T>) => void, token?: promises.CancellationToken) {
        var source: EventSource<T> = Object.create(EventSource.prototype);
        var data = new EventData<T>(this, source, token);
        source.fulfill = source.fulfill.bind(source);
        source.resolve = source.resolve.bind(source);
        source.reject = source.reject.bind(source);
        source.close = source.close.bind(source);

        try {
            init.call(this, source);
        }
        catch (e) {
            data.reject(e);
        }
    }

    public static isEventStream(value: any): boolean {
        return value instanceof EventStream;
    }

    public static once<TResult>(value: promises.Promise<TResult>, token?: promises.CancellationToken): EventStream<TResult>;
    public static once<TResult>(value: TResult): EventStream<TResult>;
    public static once(value: any, token?: promises.CancellationToken): EventStream {
        var cts = new promises.CancellationSource(token);
        return new EventStream(source => {
            if (promises.Promise.isPromise(value)) {
                value.done(value => {
                    source.fulfill(value);
                    source.close();
                },
                source.reject,
                cts.cancel,
                cts.token);
            }
            else {
                source.fulfill(value);
                source.close();
            }
        }, cts.token);
    }

    public static empty<TResult>(): EventStream<TResult> {
        return new EventStream<TResult>(source => { source.close(); });
    }

    public static repeat<TResult>(count: number, value: promises.Promise<TResult>, token?: promises.CancellationToken): EventStream<TResult>;
    public static repeat<TResult>(count: number, value: TResult): EventStream<TResult>; 
    public static repeat(count: number, value: any, token?: promises.CancellationToken): EventStream {
        var cts = new promises.CancellationSource(token);
        return new EventStream(source => {
            if (promises.Promise.isPromise(value)) {
                value.done(value => {
                    while (count--) {
                        source.fulfill(value);
                    }

                    source.close();
                }, 
                source.reject,
                cts.cancel,
                cts.token);
            }
            else {
                while (count-- > 0) {
                    source.fulfill(value);
                }

                source.close();
            }
        }, cts.token);
    }

    /** Listens to new events sent to the EventStream
      * @param receive The callback to execute when a value is received.
      * @param reject The callback to execute when a rejection is received.
      * @param close The callback to execute when the stream is closed.
      * @param cancel The callback to execute when the stream is canceled.
      * @param token The cancellation token to use to stop listening.
      * @returns A new EventStream for the stream.
      */
    public listen(receive: (value: T) => void, reject?: (value: any) => void, close?: ()=> void, cancel?: () => void, token?: promises.CancellationToken): void {
        this._eventData.append(
            receive,
            reject || e => { throw e; }, 
            close, 
            cancel, 
            token);
    }

    public map<TResult>(projection: (value: T, index: number, stream: EventStream<T>) => promises.Promise<TResult>, thisArg?: any, token?: promises.CancellationToken): EventStream<TResult>;
    public map<TResult>(projection: (value: T, index: number, stream: EventStream<T>) => TResult, thisArg?: any, token?: promises.CancellationToken): EventStream<TResult>;
    public map(projection: (value, any, index, stream) => any, thisArg?, token?: promises.CancellationToken): EventStream {
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new EventStream(source => {
            this.listen(
                value => { 
                    try {
                        source.resolve(projection.call(thisArg, value, index++, this), cts.token); 
                    } 
                    catch (e) {
                        source.reject(e);
                        cts.cancel();
                    }
                },
                source.reject,
                source.close,
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public filter(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): EventStream<T> {
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new EventStream(source => {
            this.listen(
                value => {
                    try {
                        if (predicate.call(thisArg, value, index++, this)) {
                            source.fulfill(value);
                        }
                    }
                    catch (e) {
                        source.reject(e);
                        cts.cancel();
                    }
                },
                source.reject,
                source.close,
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public reduce(aggregate: (previousValue: T, value: T, index: number, stream: EventStream<T>) => T, token?: promises.CancellationToken): promises.Promise<T>;
    public reduce<TAccumulate>(aggregate: (previousValue: TAccumulate, value: T, index: number, stream: EventStream<T>) => TAccumulate, initialValue: TAccumulate, token?: promises.CancellationToken): promises.Promise<TAccumulate>;
    public reduce(aggregate: (previousValue, value, index, stream) => any, ...args: any[]): promises.Promise {
        var hasValue = false;
        var initialValue: any;
        var token: promises.CancellationToken;

        if (args.length >= 2) {
            hasValue = true;
            initialValue = args[0];
            token = args[1];
        }
        else if (args.length == 1) {
            if (args[0] instanceof promises.CancellationToken) {
                token = args[0];
            }
            else {
                hasValue = true;
                initialValue = args[0];
            }
        }

        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new promises.Promise(resolver => {
            var accumulator;
            if (hasValue) {
                accumulator = initialValue;
            }

            this.listen(
                value => {
                    try {
                        if (!hasValue) {
                            accumulator = value;
                            hasValue = true;
                        }
                        else {
                            accumulator = aggregate(accumulator, value, index++, this);
                        }
                    } 
                    catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                },
                resolver.reject,
                () => { 
                    resolver.resolve(accumulator); 
                }, 
                cts.cancel,
                cts.token);
        }, cts.token);        
    }

    public reduceRight(aggregate: (previousValue: T, value: T, index: number, stream: EventStream<T>) => T, token?: promises.CancellationToken): promises.Promise<T>;
    public reduceRight<TAccumulate>(aggregate: (previousValue: TAccumulate, value: T, index: number, stream: EventStream<T>) => TAccumulate, initialValue?: TAccumulate, token?: promises.CancellationToken): promises.Promise<TAccumulate>;
    public reduceRight(aggregate: (previousValue, value, index, stream) => any, ...args: any[]): promises.Promise {
        var hasValue = false;
        var initialValue: any;
        var token: promises.CancellationToken;

        if (args.length >= 2) {
            hasValue = true;
            initialValue = args[0];
            token = args[1];
        }
        else if (args.length == 1) {
            if (args[0] instanceof promises.CancellationToken) {
                token = args[0];
            }
            else {
                hasValue = true;
                initialValue = args[0];
            }
        }

        var index = 0;
        var cts = new promises.CancellationSource(token);
        var values = [];
        return new promises.Promise(resolver => {
            var accumulator;
            if (hasValue) {
                accumulator = initialValue;
            }

            this.listen(
                value => {
                    values.push(value);
                },
                resolver.reject,
                () => { 
                    try {
                        if (values) {
                            var i = values.length - 1;
                            if (!hasValue) {
                                accumulator = values[i--];
                            }
                            
                            for (; i >= 0; i--) {
                                accumulator = aggregate.call(null, accumulator, values[i], i, this);
                            }
                        }
                        
                        resolver.resolve(accumulator);
                    }
                    catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, 
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public first(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): promises.Promise<T> {
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new promises.Promise<T>(resolver => {
            this.listen(
                value => {
                    try {
                        if (!predicate || predicate.call(thisArg, value, index++, this)) {
                            resolver.resolve(value);
                            cts.cancel();
                        }
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                },
                resolver.reject,
                () => {
                    resolver.reject(new Error("Stream received no data"));
                },
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public last(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): promises.Promise<T> {
        var result: T;
        var hasValue = false;
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new promises.Promise(resolver => {
            this.listen(
                value => {
                    try {
                        if (!predicate || predicate.call(thisArg, value, index++, this)) {
                            result = value;
                            hasValue = true;
                        }
                    }
                    catch (e) {
                        resolver.reject(e);
                        cts.cancel();   
                    }
                },
                resolver.reject,
                () => {
                    if (hasValue) {
                        resolver.resolve(result);
                    }
                    else {
                        resolver.reject(new Error("Stream received no data"));
                    }
                },
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public some(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): promises.Promise<boolean> {
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new promises.Promise<boolean>(resolver => {
            this.listen(
                value => {
                    try {
                        if (!predicate || predicate.call(thisArg, value, index++, this)) {
                            resolver.resolve(true);
                            cts.cancel();
                        }
                    }
                    catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                },
                resolver.reject,
                () => {
                    resolver.resolve(false);
                }, 
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public every(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): promises.Promise<boolean> {
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new promises.Promise<boolean>(resolver => {
            this.listen(
                value => {
                    try {
                        if (!predicate.call(thisArg, value, index++, this)) {
                            resolver.resolve(false);
                            cts.cancel();
                        }
                    }
                    catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                },
                resolver.reject,
                () => { resolver.resolve(true); }, 
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public count(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): promises.Promise<number> {
        var index = 0;
        var count = 0;
        var cts = new promises.CancellationSource(token);
        return new promises.Promise<number>(resolver => {
            this.listen(
                value => {
                    try {
                        if (!predicate || predicate.call(thisArg, value, index++, this)) {
                            count++;
                        }
                    }
                    catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                },
                resolver.reject,
                () => {
                    resolver.resolve(count);
                }, 
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public skip(count: number, token?: promises.CancellationToken): EventStream<T> {
        var cts = new promises.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    if (count > 0) {
                        count--;
                    }
                    else {
                        source.fulfill(value);
                    }
                },
                source.reject,
                source.close,
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public take(count: number, token?: promises.CancellationToken): EventStream<T> {
        var cts = new promises.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    if (count > 0) {
                        count--;
                        source.fulfill(value);
                    }
                    else {
                        source.close();
                        cts.cancel();
                    }
                },
                source.reject,
                source.close,
                cts.cancel,
                cts.token);
        }, cts.token)
    }

    public skipWhile(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): EventStream<T> {
        var done = false;
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    try {
                        done = done || !predicate.call(thisArg, value, index++, this);
                        if (done) {
                            source.fulfill(value);
                        }
                    }
                    catch (e) {
                        source.reject(e);
                        cts.cancel();
                        return;
                    }
                },
                source.reject,
                source.close,
                cts.cancel,
                cts.token);
        }, cts.token)
    }

    public takeWhile(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: promises.CancellationToken): EventStream<T> {
        var index = 0;
        var cts = new promises.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    try {
                        if (predicate.call(thisArg, value, index++, this)) {
                            source.fulfill(value);
                        }
                        else {
                            source.close();
                            cts.cancel();
                        }
                    }
                    catch (e) {
                        source.reject(e);
                        cts.cancel();
                    }
                },
                source.reject,
                source.close,
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public skipUntil(future: promises.Promise<any>, token?: promises.CancellationToken): EventStream<T> {
        var done = false;
        var cts = new promises.CancellationSource(token);
        return new EventStream<T>(source => {            
            future.done(
                () => { 
                    done = true; 
                },
                e => {
                    source.reject(e);
                    cts.cancel();
                },
                cts.cancel,
                cts.token);

            this.listen(
                value => {
                    if (done) {
                        source.fulfill(value);
                    }
                },
                e => {
                    source.reject(e);
                    cts.cancel();
                },
                () => {
                    source.close();
                    cts.cancel();
                },
                cts.cancel,
                cts.token);
        }, cts.token)
    }

    public takeUntil(future: promises.Promise<any>, token?: promises.CancellationToken): EventStream<T> {
        var cts = new promises.CancellationSource(token);
        return new EventStream<T>(source => {
            future.done(
                () => {
                    source.close();
                },
                e => {
                    source.reject(e);
                    cts.cancel();
                },
                cts.cancel,
                cts.token);

            this.listen(
                source.fulfill,
                e => {
                    source.reject(e);
                    cts.cancel();
                },
                () => {
                    source.close();
                    cts.cancel();
                },
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public zip<TOther, TResult>(other: EventStream<TOther>, projection: (left: T, right: TOther, index: number, leftStream: EventStream<T>, rightStream: EventStream<TOther>) => TResult, thisArg?: any, token?: promises.CancellationToken): EventStream<TResult> {
        var cts = new promises.CancellationSource(token);
        var index = 0;
        var left = [];
        var right = [];
        return new EventStream<TResult>(source => {

            cts.token.register(() => {
                left = null;
                right = null;
            });

            this.listen(
                value => {
                    if (right.length <= 0) {
                        left.push(value);
                    }
                    else {
                        try {
                            var result = projection.call(thisArg, value, right.shift(), index++, this, other);
                            source.fulfill(result);
                        }
                        catch (e) {
                            source.reject(e);
                            cts.cancel();
                        }
                    }
                },
                e => {
                    source.reject(e);
                    cts.cancel();
                },
                () => {
                    source.close();
                    cts.cancel();
                },
                cts.cancel,
                cts.token);

            other.listen(
                value => {
                    if (left.length <= 0) {
                        right.push(value);
                    }
                    else {
                        try {
                            var result = projection.call(thisArg, left.shift(), value, index++, this, other);
                            source.fulfill(result);
                        }
                        catch (e) {
                            source.reject(e);
                            cts.cancel();
                        }
                    }
                },
                e => {
                    source.reject(e);
                    cts.cancel();
                },
                () => {
                    source.close();
                    cts.cancel();    
                },
                cts.cancel,
                cts.token);

        }, cts.token);
    }

    public throttle(delay: number, token?: promises.CancellationToken): EventStream<T> {
        var cts = new promises.CancellationSource(token);
        return new EventStream<T>(source => {
            var pending = false;
            var state: EventState;
            var hasLast = false;
            var last: any;
            var request = () => {
                if (!pending) {
                    pending = true;
                    promises.Scheduler.current.post(() => {
                        pending = false;
                        if (state === EventState.sending) {
                            source.fulfill(last);
                            hasLast = false;
                            last = null;
                        }
                        else if (state === EventState.rejected) {
                            source.reject(last);
                            hasLast = false;
                            last = null;
                            cts.cancel();
                        }
                        else if (state === EventState.closed) {
                            if (hasLast) {
                                source.fulfill(last);
                                hasLast = false;
                                last = null;
                            }
                            
                            source.close();
                            cts.cancel();
                        }
                    }, { delay: delay }, cts.token);
                }
            };
            
            this.listen(
                value => {
                    if (state <= EventState.sending) {
                        last = value;
                        hasLast = true;
                        state = EventState.sending;
                        request();
                    }
                },
                e => {
                    last = e;
                    state = EventState.rejected;
                    request();
                },
                () => {
                    state = EventState.closed;
                    request();
                },
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public toArray(token?: promises.CancellationToken): promises.Promise<T[]> {
        var values = [];
        var cts = new promises.CancellationSource(token);
        return new promises.Promise<T[]>(resolver => {
            this.listen(
                value => {
                    values.push(value);
                },
                e => {
                    resolver.reject(e);
                },
                () => {
                    resolver.resolve(values);
                },
                cts.cancel,
                cts.token);
        }, cts.token);
    }
}

class EventData<T> {
    public events: EventStream<T>;
    public source: EventSource<T>;
    public resolveCallbacks: { head?; };
    public rejectCallbacks: { head?; };
    public closeCallbacks: { head?; };
    public cancelCallbacks: { head?; };
    public pending: { head?; };
    public state: EventState = EventState.pending;
    public token: promises.CancellationToken;
    public cancellationHandle: number;

    constructor(events: EventStream<T>, source: EventSource<T>, token: promises.CancellationToken) {
        Object.defineProperty(events, "_eventData", { value: this });
        Object.defineProperty(source, "_eventData", { value: this });

        this.events = events;
        this.source = source;
        this.token = token;

        // register for cancellation
        if (this.token) {
            this.cancellationHandle = this.token.register(() => { 
                this.cancel(); 
            });
        }
    }

    public fulfill(value: any, synchronous?: boolean): void {
        if (this.state > EventState.sending) {
            return;
        }

        if (!this.pending) {
            this.pending = {};
        }
        
        this.state = EventState.sending;
        linkedlist.Append(this.pending, { kind: EventState.sending, value: value });
        
        this.processPending(synchronous);
    }

    public resolve(value: any, token: promises.CancellationToken, synchronous?: boolean): void {
        if (this.state > EventState.sending) {
            return;
        }

        if (promises.Promise.isPromise(value)) {
            var cts = new promises.CancellationSource(this.token, token);
            if (!this.pending) {
                this.pending = {};
            }
            
            this.state = EventState.sending;
            var node = linkedlist.Append(this.pending, { kind: EventState.pending });
            var future = <promises.Promise>value;
            var resolve = value => {
                if (this.state === EventState.canceled) return;
                node.value = value;
                node.kind = EventState.sending;
                this.processPending(/*synchronous:*/ true);
            };
            var reject = value => {
                if (this.state === EventState.canceled) return; 
                node.value = value;
                node.kind = EventState.rejected;
                this.state = EventState.rejected;                
                this.processPending(/*synchronous:*/ true);
            };

            try {
                value.done(resolve, reject, null, cts.token);
            }
            catch (e) {
                this.reject(e, synchronous);
            }

            return;
        }

        this.fulfill(value, synchronous);
    }

    public merge(stream: EventStream<T>, token: promises.CancellationToken): void {
        stream.listen(
            value => {
                this.fulfill(value, true);
            },
            e => {
                this.reject(e, true);
            },
            null,
            null,
            this.token);
    }

    public reject(value: any, synchronous?: boolean): void {
        if (this.state > EventState.sending) {
            return;
        }

        if (!this.pending) {
            this.pending = {};
        }

        this.state = EventState.rejected;
        linkedlist.Append(this.pending, { kind: EventState.rejected, value: value });
        this.processPending(synchronous);
    }

    public close(synchronous?: boolean): void {
        if (this.state > EventState.sending) {
            return;
        }

        if (!this.pending) {
            this.pending = {};
        }

        this.state = EventState.closed;
        linkedlist.Append(this.pending, { kind: EventState.closed });
        this.processPending(synchronous);
    }

    public cancel(): void {
        if (this.state > EventState.sending) {
            return;
        }

        if (!this.pending) {
            this.pending = {};
        }

        this.state = EventState.canceled;
        this.pending.head = null;
        linkedlist.Append(this.pending, { kind: EventState.canceled });
        this.processPending(/*synchronous:*/ true);
    }

    public append(receiveCallback: (value: any) => void, rejectCallback: (value: any) => void, closeCallback: () => void, cancelCallback: () => void, token: promises.CancellationToken): void {
        
        if (!(token && token.canceled)) {
            if (typeof receiveCallback === "function") {
                if (this.resolveCallbacks == null) {
                    this.resolveCallbacks = {};
                }

                var receiveNode = linkedlist.Append(this.resolveCallbacks, {
                    token: token,
                    callback: receiveCallback
                });
                
                if (token) {
                    token.register(() => {
                        linkedlist.Delete(this.resolveCallbacks, receiveNode);
                    });
                }
            }

            if (typeof rejectCallback === "function") {
                if (this.rejectCallbacks == null) {
                    this.rejectCallbacks = {};
                }

                var rejectNode = linkedlist.Append(this.rejectCallbacks, {
                    token: token,
                    callback: rejectCallback
                });

                if (token) {
                    token.register(() => linkedlist.Delete(this.rejectCallbacks, rejectNode));
                }
            }

            if (typeof closeCallback === "function") {
                if (this.closeCallbacks == null) {
                    this.closeCallbacks = {};
                }

                var closeNode = linkedlist.Append(this.closeCallbacks, {
                    token: token,
                    callback: closeCallback
                });

                if (token) {
                    token.register(() => linkedlist.Delete(this.closeCallbacks, closeNode));
                }
            }

            if (typeof cancelCallback === "function") {
                if (this.cancelCallbacks == null) {
                    this.cancelCallbacks = {};
                }

                linkedlist.Append(this.cancelCallbacks, {
                    callback: cancelCallback
                })
            }
        }

        this.processPending(/*synchronous:*/ false);
    }

    public processPending(synchronous: boolean): void {
        if (this.pending && (this.resolveCallbacks || this.rejectCallbacks || this.closeCallbacks || this.cancelCallbacks)) {
            
            var node;
            while (node = this.pending.head) {
                if (node.kind === EventState.pending) {
                    return;
                }

                // check for a transition to a closed state
                if (this.state <= EventState.sending && 
                    node.kind > EventState.sending) {

                    // remove any cancellation logic
                    if (this.token && this.cancellationHandle) {
                        this.token.unregister(this.cancellationHandle);
                        this.token = null;
                        this.cancellationHandle = null;
                    }

                    // clear any nodes that follow this node, leaving it as the sole entry
                    node.next = node;
                    node.prev = node;
                }

                // ensure we're in the right state
                this.state = node.kind;

                switch (node.kind) {
                    case EventState.sending:
                        linkedlist.Delete(this.pending, node);
                        this.process(this.resolveCallbacks, node.value, /*remove:*/ false, synchronous);
                        synchronous = false;
                        break;

                    case EventState.rejected:
                        this.process(this.rejectCallbacks, node.value, /*remove:*/ false, synchronous);                        
                        return;

                    case EventState.closed:
                        this.process(this.closeCallbacks, void 0, /*remove:*/ true, synchronous);
                        return;

                    case EventState.canceled:
                        this.process(this.cancelCallbacks, void 0, /*remove:*/ true, /*synchronous:*/ true);
                        return;
                }
            }
        }
    }

    public process(callbacks: { head?; }, result: any, remove: boolean, synchronous: boolean): void {
        if (callbacks) {
            var node = callbacks.head;
            if (node) {
                while (callbacks.head) {
                    var next = node.next;
                    if (remove) {
                        linkedlist.Delete(callbacks, node);
                    }
                    
                    var callback = node.value.callback, token = node.value.token;
                    if (!(token && token.canceled)) { 
                        // execute either synchronously or as a microtask at the end of the turn
                        promises.Scheduler.current.post(
                            callback.bind(null, result), 
                            { synchronous: synchronous }, 
                            token);
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

/** 
 * The state of the stream
 */
enum EventState {
    pending,
    queuing,
    sending,
    rejected,
    closed,
    canceled
}

