/*! 
* This source is subject to the Microsoft Public License.
* See http://www.microsoft.com/opensource/licenses.mspx#Ms-PL.
* All other rights reserved.
* ----------------------------------------------------------------------
* Version: 1.0.0.0
* Author: Ron Buckton (rbuckton@chronicles.org)
* ----------------------------------------------------------------------
*/
// @requires Symbol.js
// @requires DOMFuture.js
(function (definition) {
    if (typeof EventStream === "undefined") {
        definition(window, Symbol, Future);
    }
})
(function (window, Symbol, Future, undefined) {

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

    /** Implements a simple dispatcher for the engine's event-loop.
      */
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
        /** A countdown event
          * @param count {Number} The number of times the event must signal before it completes
          */
        function Countdown(count) {
            /** Signals a countdown event
              * @returns {Boolean} True if the countdown has completed; otherwise, false
              */
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
        
        /** Root of a chain of subscriptions for the EventSource. This is called when a new subscriber is added to an EventStream.
          * @param {EventSource} source The source for the new subscriber.
          * @param {Function} receive The receive callback for the new subscriber.
          * @param {Function} reject The reject callback for the new subscriber.
          * @param {Function} close The close callback for the new subscriber.
          * @param {Object} [options] An optional object providing additional options that affect the new subscriber.          
          */
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
        
        /** Root for sending notifications to subscribers.
          * @param {String} verb The notification type for the event
          * @param value The value for the notification
          */
        EventData.prototype.when = function (verb, value) {
            if (verb === VERB_CLOSE) {
                this.chain = function (source, receive, reject, close) {
                    Dispatcher.post(forward, source, verb, value, receive, reject, close);
                }
            }
        }
        
        /** Publishes an event to subscribers.
          * @param {String} verb The notification type for the event
          * @param value The value for the notification
          */
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
        
        /** Attempts to publish an event to subscribers.
          * @param {String} verb The notification type for the event
          * @param value The value for the notification
          */
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
        
        /** Forwards a notification to a subscriber
          * @param {EventSource} source An EventSource for the subscriber.
          * @param {String} verb The notification type for the event.
          * @param value The value for the notification
          * @param {Function} A callback to execute when the verb is "send"
          * @param {Function} A callback to execute when the verb is "reject"
          * @param {Function} A callback to execute when the verb is "close"
          */
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
        /** A source for an EventStream
          * @constructor
          */
        function EventSource() {
            throw new TypeError("Type is not creatable");
            
            // NOTE: Should EventSource be creatable?
            /*
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
            */    
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
        /** A stream of events 
          * @constructor
          * @param {Function} init A callback used to initialize the stream. The sole argument is the EventSource for the stream
          */
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
        
        /** Closes the EventStream and stops listening to future events
          */
        EventStream.prototype.close = function () { 
            var eventData = __EventStreamData__.get(this);
            if (!eventData) throw new TypeError("'this' is not an EventStream object");
            
            eventData.tryPublish(VERB_CLOSE);
        }
        
        /** Subscribes to events on the EventStream, creating a new chained EventStream.
          * @param {Function} [receive] Callback that receives a value from this EventStream. The result of the callback is used as the value for the chained EventStream.
          * @param {Function} [reject] Callback that receives any error that terminates the EventStream.
          * @param {Function} [close] Callback that is executed when the EventStream is closed.
          */
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
})

/*
function getDomEventStream(element, name, useCapture) {
    return new EventStream(function (source) { 
        var handler = function (evt) { source.send(handler); };
        
        this.finally(function () {
            event.removeEventListener(name, handler, useCapture);
        });
        
        element.addEventListener(name, handler, useCapture);
    });
}

var mousedown = getDomEventStream(el, "mousedown");
var mouseup = getDomEventStream(el, "mouseup");
var mousemove = getDomEventStream(el, "mousemove");
mousedown.map(function (mde) {
    return mousemove
        .takeUntil(mouseup.first())
        .forEach(function (mme) {
            
        });
});
*/