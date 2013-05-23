/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import futures = module("futures");

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

    private _eventData: EventData;
    
    /** Source for sending events
      */
    constructor() {
        throw new TypeError("Object doesn't support this action");        
    }

    /** Accepts a value and sends it to a subscriber
      * @param value The value to send
      */
    public accept(value: T): void {
        this._eventData.accept(value);
    }

    /** Sends a value to a subscriber.
      * @param value The value to send
      */
    public resolve(value: T): void;

    /** Sends a future value to a subscriber.
      * @param value The value to send
      */
    public resolve(value: futures.Future<T>, token?: futures.CancellationToken): void;
    public resolve(value: any, token?: futures.CancellationToken): void {
        this._eventData.resolve(value, token);
    }

    /** Sends the contents of an event stream to this stream's subscribers
      * @param value The values to stream
      */
    public merge(value: EventStream<T>, token?: futures.CancellationToken): void {
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
    private _eventData: EventData;

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
    constructor(init: (source: EventSource<T>) => void, token: futures.CancellationToken);

    /** 
     * A stream of events
     * @param init A callback whose first argument is the source for the stream
     */
    constructor(init: (source: EventSource<T>) => void, token?: futures.CancellationToken) {
        var source: EventSource<T> = Object.create(EventSource.prototype);
        var data = new EventData<T>(this, source, token);
        source.accept = source.accept.bind(source);
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

    public static once<TResultA>(value: futures.Future<TResultA>, token?: futures.CancellationToken): EventStream<TResultA>;
    public static once<TResultB>(value: TResultB): EventStream<TResultB>;
    public static once(value: any, token?: futures.CancellationToken): EventStream {
        var cts = new futures.CancellationSource(token);
        return new EventStream(source => {
            if (futures.Future.isFuture(value)) {
                value.done(value => {
                    source.accept(value);
                    source.close();
                },
                source.reject,
                cts.cancel,
                cts.token);
            }
            else {
                source.accept(value);
                source.close();
            }
        }, cts.token);
    }

    public static empty<TResultC>(): EventStream<TResultC> {
        return new EventStream<TResultC>(source => { source.close(); });
    }

    public static repeat<TResultD>(count: number, value: futures.Future<TResultD>, token?: futures.CancellationToken): EventStream<TResultD>;
    public static repeat<TResultE>(count: number, value: TResultE): EventStream<TResultE>; 
    public static repeat(count: number, value: any, token?: futures.CancellationToken): EventStream {
        var cts = new futures.CancellationSource(token);
        return new EventStream(source => {
            if (futures.Future.isFuture(value)) {
                value.done(value => {
                    while (count--) {
                        source.accept(value);
                    }

                    source.close();
                }, 
                source.reject,
                cts.cancel,
                cts.token);
            }
            else {
                while (count-- > 0) {
                    source.accept(value);
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
    public listen(receive: (value: T) => void, reject?: (value: any) => void, close?: ()=> void, cancel?: () => void, token?: futures.CancellationToken): void {
        this._eventData.append(
            receive,
            reject || e => { throw e; }, 
            close, 
            cancel, 
            token);
    }

    public map<TResult>(projection: (value: T, index: number, stream: EventStream<T>) => futures.Future<TResult>, thisArg?: any, token?: futures.CancellationToken): EventStream<TResult>;
    public map<TResult>(projection: (value: T, index: number, stream: EventStream<T>) => TResult, thisArg?: any, token?: futures.CancellationToken): EventStream<TResult>;
    public map(projection: (value, any, index, stream) => any, thisArg?, token?: futures.CancellationToken): EventStream {
        var index = 0;
        var cts = new futures.CancellationSource(token);
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

    public filter(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): EventStream<T> {
        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new EventStream(source => {
            this.listen(
                value => {
                    try {
                        if (predicate.call(thisArg, value, index++, this)) {
                            source.accept(value);
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

    public reduce(aggregate: (previousValue: T, value: T, index: number, stream: EventStream<T>) => T, token?: futures.CancellationToken): futures.Future<T>;
    public reduce<TAccumulate>(aggregate: (previousValue: TAccumulate, value: T, index: number, stream: EventStream<T>) => TAccumulate, initialValue: TAccumulate, token?: futures.CancellationToken): futures.Future<TAccumulate>;
    public reduce(aggregate: (previousValue, value, index, stream) => any, ...args: any[]): futures.Future {
        var hasValue = false;
        var initialValue: any;
        var token: futures.CancellationToken;

        if (args.length >= 2) {
            hasValue = true;
            initialValue = args[0];
            token = args[1];
        }
        else if (args.length == 1) {
            if (args[0] instanceof futures.CancellationToken) {
                token = args[0];
            }
            else {
                hasValue = true;
                initialValue = args[0];
            }
        }

        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new futures.Future(resolver => {
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

    public reduceRight(aggregate: (previousValue: T, value: T, index: number, stream: EventStream<T>) => T, token?: futures.CancellationToken): futures.Future<T>;
    public reduceRight<TAccumulate>(aggregate: (previousValue: TAccumulate, value: T, index: number, stream: EventStream<T>) => TAccumulate, initialValue?: TAccumulate, token?: futures.CancellationToken): futures.Future<TAccumulate>;
    public reduceRight(aggregate: (previousValue, value, index, stream) => any, ...args: any[]): futures.Future {
        var hasValue = false;
        var initialValue: any;
        var token: futures.CancellationToken;

        if (args.length >= 2) {
            hasValue = true;
            initialValue = args[0];
            token = args[1];
        }
        else if (args.length == 1) {
            if (args[0] instanceof futures.CancellationToken) {
                token = args[0];
            }
            else {
                hasValue = true;
                initialValue = args[0];
            }
        }

        var index = 0;
        var cts = new futures.CancellationSource(token);
        var values = [];
        return new futures.Future(resolver => {
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

    public first(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): futures.Future<T> {
        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new futures.Future<T>(resolver => {
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

    public last(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): futures.Future<T> {
        var result: T;
        var hasValue = false;
        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new futures.Future(resolver => {
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

    public some(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): futures.Future<boolean> {
        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new futures.Future<boolean>(resolver => {
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

    public every(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): futures.Future<boolean> {
        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new futures.Future<boolean>(resolver => {
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

    public count(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): futures.Future<number> {
        var index = 0;
        var count = 0;
        var cts = new futures.CancellationSource(token);
        return new futures.Future<boolean>(resolver => {
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

    public skip(count: number, token?: futures.CancellationToken): EventStream<T> {
        var cts = new futures.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    if (count > 0) {
                        count--;
                    }
                    else {
                        source.accept(value);
                    }
                },
                source.reject,
                source.close,
                cts.cancel,
                cts.token);
        }, cts.token);
    }

    public take(count: number, token?: futures.CancellationToken): EventStream<T> {
        var cts = new futures.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    if (count > 0) {
                        count--;
                        source.accept(value);
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

    public skipWhile(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): EventStream<T> {
        var done = false;
        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    try {
                        done = done || !predicate.call(thisArg, value, index++, this);
                        if (done) {
                            source.accept(value);
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

    public takeWhile(predicate: (value: T, index: number, stream: EventStream<T>) => boolean, thisArg?: any, token?: futures.CancellationToken): EventStream<T> {
        var index = 0;
        var cts = new futures.CancellationSource(token);
        return new EventStream<T>(source => {
            this.listen(
                value => {
                    try {
                        if (predicate.call(thisArg, value, index++, this)) {
                            source.accept(value);
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

    public skipUntil(future: futures.Future<any>, token?: futures.CancellationToken): EventStream<T> {
        var done = false;
        var cts = new futures.CancellationSource(token);
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
                        source.accept(value);
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

    public takeUntil(future: futures.Future<any>, token?: futures.CancellationToken): EventStream<T> {
        var cts = new futures.CancellationSource(token);
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
                source.accept,
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

    public zip<TOther, TResult>(other: EventStream<TOther>, projection: (left: T, right: TOther, index: number, leftStream: EventStream<T>, rightStream: EventStream<TOther>) => TResult, thisArg?: any, token?: futures.CancellationToken): EventStream<TResult> {
        var cts = new futures.CancellationSource(token);
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
                            source.accept(result);
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
                            source.accept(result);
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

    public throttle(delay: number, token?: futures.CancellationToken): EventStream<T> {
        var cts = new futures.CancellationSource(token);
        return new EventStream<T>(source => {
            var pending = false;
            var state: EventState;
            var hasLast = false;
            var last: any;
            var request = () => {
                if (!pending) {
                    pending = true;
                    futures.Scheduler.current.post(() => {
                        pending = false;
                        if (state === EventState.sending) {
                            source.accept(last);
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
                                source.accept(last);
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

    public toArray(token?: futures.CancellationToken): futures.Future<T[]> {
        var values = [];
        var cts = new futures.CancellationSource(token);
        return new futures.Future<T[]>(resolver => {
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

class EventData {
    public events: EventStream;
    public source: EventSource;
    public resolveCallbacks: { head?; };
    public rejectCallbacks: { head?; };
    public closeCallbacks: { head?; };
    public cancelCallbacks: { head?; };
    public pending: { head?; };
    public state: EventState = EventState.pending;
    public token: futures.CancellationToken;
    public cancellationHandle: number;

    constructor(events: EventStream, source: EventSource, token: futures.CancellationToken) {
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

    public accept(value: any, synchronous?: boolean): void {
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

    public resolve(value: any, token: futures.CancellationToken, synchronous?: boolean): void {
        if (this.state > EventState.sending) {
            return;
        }

        if (futures.Future.isFuture(value)) {
            var cts = new futures.CancellationSource(this.token, token);
            if (!this.pending) {
                this.pending = {};
            }
            
            this.state = EventState.sending;
            var node = linkedlist.Append(this.pending, { kind: EventState.pending });
            var future = <futures.Future>value;
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

        this.accept(value, synchronous);
    }

    public merge(stream: EventStream, token: futures.CancellationToken): void {
        stream.listen(
            value => {
                this.accept(value, true);
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

    public append(receiveCallback: (value: any) => void, rejectCallback: (value: any) => void, closeCallback: () => void, cancelCallback: () => void, token: futures.CancellationToken): void {
        
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
                        futures.Scheduler.current.post(
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

