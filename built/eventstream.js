/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./futures"], definition);
    }
    else if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
        definition(require, module["exports"] || exports);
    }
    else {
        definition(
            function (name) { 
                name = String(name)
                    .replace(/^\s+|\s+$/g, "")
                    .replace(/\\+|\/+/g, "/")
                    .replace(/^\.\/|\/\.(\/)/g, "$1");
                return global[name]; 
            }, global["eventstream"] = { });
    }
})
(function (require, exports) {
    var futures = require("./futures");
    
    var linkedlist;
    (function (linkedlist) {
        function Append(list, node) {
            if (node && !node.next && !node.list) {
                if (list.head) {
                    var pos = list.head.prev;
                    node.prev = pos;
                    node.next = pos.next;
                    pos.next.prev = node;
                    pos.next = node;
                } else {
                    node.next = node;
                    node.prev = node;
                    list.head = node;
                }
    
                node.list = list;
            }
    
            return node;
        }
        linkedlist.Append = Append;
    
        function Delete(list, node) {
            if (node && node.next && node.list === list) {
                if (node.next !== node) {
                    node.next.prev = node.prev;
                    node.prev.next = node.next;
                }
    
                if (list.head === node) {
                    if (node.next === node) {
                        list.head = null;
                    } else {
                        list.head = node.next;
                    }
                }
    
                node.list = node.prev = node.next = null;
            }
    
            return node;
        }
        linkedlist.Delete = Delete;
    
        function Iterate(list, callback) {
            Find(list, function (node) {
                callback(node);
                return false;
            });
        }
        linkedlist.Iterate = Iterate;
    
        function Find(list, predicate) {
            var node = list.head;
            if (node) {
                do {
                    if (predicate(node)) {
                        return node;
                    }
    
                    node = node.next;
                } while(node && node !== list.head);
            }
    
            return null;
        }
        linkedlist.Find = Find;
    })(linkedlist || (linkedlist = {}));
    
    var EventSource = (function () {
        function EventSource() {
            throw new TypeError("Object doesn't support this action");
        }
        EventSource.prototype.accept = function (value) {
            this._eventData.accept(value);
        };
    
        EventSource.prototype.send = function (value) {
            this._eventData.send(value);
        };
    
        EventSource.prototype.stream = function (value) {
            this._eventData.send(value);
        };
    
        EventSource.prototype.reject = function (value) {
            this._eventData.reject(value);
        };
    
        EventSource.prototype.close = function () {
            this._eventData.close();
        };
    
        EventSource.prototype.cancel = function () {
            this._eventData.cancel();
        };
        return EventSource;
    })();
    exports.EventSource = EventSource;
    
    var EventStream = (function () {
        function EventStream(init, token) {
            var source = Object.create(EventSource.prototype);
            var data = new EventData(this, source, token);
            source.accept = source.accept.bind(source);
            source.send = source.send.bind(source);
            source.reject = source.reject.bind(source);
            source.close = source.close.bind(source);
    
            try  {
                init.call(this, source);
            } catch (e) {
                data.reject(e);
            }
        }
        EventStream.isEventStream = function (value) {
            return value instanceof EventStream;
        };
    
        EventStream.once = function (value, token) {
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                if (futures.Future.isFuture(value)) {
                    value.done(function (value) {
                        source.accept(value);
                        source.close();
                    }, source.reject, cts.cancel, cts.token);
                } else {
                    source.accept(value);
                    source.close();
                }
            }, cts.token);
        };
    
        EventStream.empty = function () {
            return new EventStream(function (source) {
                source.close();
            });
        };
    
        EventStream.repeat = function (count, value, token) {
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                if (futures.Future.isFuture(value)) {
                    value.done(function (value) {
                        while (count--) {
                            source.accept(value);
                        }
    
                        source.close();
                    }, source.reject, cts.cancel, cts.token);
                } else {
                    while (count-- > 0) {
                        source.accept(value);
                    }
    
                    source.close();
                }
            }, cts.token);
        };
    
        EventStream.prototype.listen = function (receive, reject, close, cancel, token) {
            this._eventData.append(receive, reject || function (e) {
                throw e;
            }, close, cancel, token);
        };
    
        EventStream.prototype.map = function (projection, thisArg, token) {
            var _this = this;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                _this.listen(function (value) {
                    try  {
                        source.send(projection.call(thisArg, value, index++, _this));
                    } catch (e) {
                        source.reject(e);
                        cts.cancel();
                    }
                }, source.reject, source.close, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.filter = function (predicate, thisArg, token) {
            var _this = this;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                _this.listen(function (value) {
                    try  {
                        if (predicate.call(thisArg, value, index++, _this)) {
                            source.accept(value);
                        }
                    } catch (e) {
                        source.reject(e);
                        cts.cancel();
                    }
                }, source.reject, source.close, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.reduce = function (aggregate) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            var _this = this;
            var hasValue = false;
            var initialValue;
            var token;
    
            if (args.length >= 2) {
                hasValue = true;
                initialValue = args[0];
                token = args[1];
            } else if (args.length == 1) {
                if (args[0] instanceof futures.CancellationToken) {
                    token = args[0];
                } else {
                    hasValue = true;
                    initialValue = args[0];
                }
            }
    
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new futures.Future(function (resolver) {
                var accumulator;
                if (hasValue) {
                    accumulator = initialValue;
                }
    
                _this.listen(function (value) {
                    try  {
                        if (!hasValue) {
                            accumulator = value;
                            hasValue = true;
                        } else {
                            accumulator = aggregate(accumulator, value, index++, _this);
                        }
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, resolver.reject, function () {
                    resolver.resolve(accumulator);
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.reduceRight = function (aggregate) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            var _this = this;
            var hasValue = false;
            var initialValue;
            var token;
    
            if (args.length >= 2) {
                hasValue = true;
                initialValue = args[0];
                token = args[1];
            } else if (args.length == 1) {
                if (args[0] instanceof futures.CancellationToken) {
                    token = args[0];
                } else {
                    hasValue = true;
                    initialValue = args[0];
                }
            }
    
            var index = 0;
            var cts = new futures.CancellationSource(token);
            var values = [];
            return new futures.Future(function (resolver) {
                var accumulator;
                if (hasValue) {
                    accumulator = initialValue;
                }
    
                _this.listen(function (value) {
                    values.push(value);
                }, resolver.reject, function () {
                    try  {
                        if (values) {
                            var i = values.length - 1;
                            if (!hasValue) {
                                accumulator = values[i--];
                            }
    
                            for (; i >= 0; i--) {
                                accumulator = aggregate.call(null, accumulator, values[i], i, _this);
                            }
                        }
    
                        resolver.resolve(accumulator);
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.first = function (predicate, thisArg, token) {
            var _this = this;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new futures.Future(function (resolver) {
                _this.listen(function (value) {
                    try  {
                        if (!predicate || predicate.call(thisArg, value, index++, _this)) {
                            resolver.resolve(value);
                            cts.cancel();
                        }
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, resolver.reject, function () {
                    resolver.reject(new Error("Stream received no data"));
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.last = function (predicate, thisArg, token) {
            var _this = this;
            var result;
            var hasValue = false;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new futures.Future(function (resolver) {
                _this.listen(function (value) {
                    try  {
                        if (!predicate || predicate.call(thisArg, value, index++, _this)) {
                            result = value;
                            hasValue = true;
                        }
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, resolver.reject, function () {
                    if (hasValue) {
                        resolver.resolve(result);
                    } else {
                        resolver.reject(new Error("Stream received no data"));
                    }
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.some = function (predicate, thisArg, token) {
            var _this = this;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new futures.Future(function (resolver) {
                _this.listen(function (value) {
                    try  {
                        if (!predicate || predicate.call(thisArg, value, index++, _this)) {
                            resolver.resolve(true);
                            cts.cancel();
                        }
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, resolver.reject, function () {
                    resolver.resolve(false);
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.every = function (predicate, thisArg, token) {
            var _this = this;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new futures.Future(function (resolver) {
                _this.listen(function (value) {
                    try  {
                        if (!predicate.call(thisArg, value, index++, _this)) {
                            resolver.resolve(false);
                            cts.cancel();
                        }
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, resolver.reject, function () {
                    resolver.resolve(true);
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.count = function (predicate, thisArg, token) {
            var _this = this;
            var index = 0;
            var count = 0;
            var cts = new futures.CancellationSource(token);
            return new futures.Future(function (resolver) {
                _this.listen(function (value) {
                    try  {
                        if (!predicate || predicate.call(thisArg, value, index++, _this)) {
                            count++;
                        }
                    } catch (e) {
                        resolver.reject(e);
                        cts.cancel();
                    }
                }, resolver.reject, function () {
                    resolver.resolve(count);
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.skip = function (count, token) {
            var _this = this;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                _this.listen(function (value) {
                    if (count > 0) {
                        count--;
                    } else {
                        source.accept(value);
                    }
                }, source.reject, source.close, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.take = function (count, token) {
            var _this = this;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                _this.listen(function (value) {
                    if (count > 0) {
                        count--;
                        source.accept(value);
                    } else {
                        source.close();
                        cts.cancel();
                    }
                }, source.reject, source.close, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.skipWhile = function (predicate, thisArg, token) {
            var _this = this;
            var done = false;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                _this.listen(function (value) {
                    try  {
                        done = done || !predicate.call(thisArg, value, index++, _this);
                        if (done) {
                            source.send(value);
                        }
                    } catch (e) {
                        source.reject(e);
                        cts.cancel();
                        return;
                    }
                }, source.reject, source.close, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.takeWhile = function (predicate, thisArg, token) {
            var _this = this;
            var index = 0;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                _this.listen(function (value) {
                    try  {
                        if (predicate.call(thisArg, value, index++, _this)) {
                            source.send(value);
                        } else {
                            source.close();
                            cts.cancel();
                        }
                    } catch (e) {
                        source.reject(e);
                        cts.cancel();
                    }
                }, source.reject, source.close, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.skipUntil = function (future, token) {
            var _this = this;
            var done = false;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                future.done(function () {
                    done = true;
                }, function (e) {
                    source.reject(e);
                    cts.cancel();
                }, cts.cancel, cts.token);
    
                _this.listen(function (value) {
                    if (done) {
                        source.send(value);
                    }
                }, function (e) {
                    source.reject(e);
                    cts.cancel();
                }, function () {
                    source.close();
                    cts.cancel();
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.takeUntil = function (future, token) {
            var _this = this;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                future.done(function () {
                    source.close();
                }, function (e) {
                    source.reject(e);
                    cts.cancel();
                }, cts.cancel, cts.token);
    
                _this.listen(source.accept, function (e) {
                    source.reject(e);
                    cts.cancel();
                }, function () {
                    source.close();
                    cts.cancel();
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.zip = function (other, projection, thisArg, token) {
            var _this = this;
            var cts = new futures.CancellationSource(token);
            var index = 0;
            var left = [];
            var right = [];
            return new EventStream(function (source) {
                cts.token.register(function () {
                    left = null;
                    right = null;
                });
    
                _this.listen(function (value) {
                    if (right.length <= 0) {
                        left.push(value);
                    } else {
                        try  {
                            var result = projection.call(thisArg, value, right.shift(), index++, _this, other);
                            source.send(result);
                        } catch (e) {
                            source.reject(e);
                            cts.cancel();
                        }
                    }
                }, function (e) {
                    source.reject(e);
                    cts.cancel();
                }, function () {
                    source.close();
                    cts.cancel();
                }, cts.cancel, cts.token);
    
                other.listen(function (value) {
                    if (left.length <= 0) {
                        right.push(value);
                    } else {
                        try  {
                            var result = projection.call(thisArg, left.shift(), value, index++, _this, other);
                            source.send(result);
                        } catch (e) {
                            source.reject(e);
                            cts.cancel();
                        }
                    }
                }, function (e) {
                    source.reject(e);
                    cts.cancel();
                }, function () {
                    source.close();
                    cts.cancel();
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.throttle = function (delay, token) {
            var _this = this;
            var cts = new futures.CancellationSource(token);
            return new EventStream(function (source) {
                var pending = false;
                var state;
                var hasLast = false;
                var last;
                var request = function () {
                    if (!pending) {
                        pending = true;
                        futures.Scheduler.current.post(function () {
                            pending = false;
                            if (state === EventState.sending) {
                                source.accept(last);
                                hasLast = false;
                                last = null;
                            } else if (state === EventState.rejected) {
                                source.reject(last);
                                hasLast = false;
                                last = null;
                                cts.cancel();
                            } else if (state === EventState.closed) {
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
    
                _this.listen(function (value) {
                    if (state <= EventState.sending) {
                        last = value;
                        hasLast = true;
                        state = EventState.sending;
                        request();
                    }
                }, function (e) {
                    last = e;
                    state = EventState.rejected;
                    request();
                }, function () {
                    state = EventState.closed;
                    request();
                }, cts.cancel, cts.token);
            }, cts.token);
        };
    
        EventStream.prototype.toArray = function (token) {
            var _this = this;
            var values = [];
            var cts = new futures.CancellationSource(token);
            return new futures.Future(function (resolver) {
                _this.listen(function (value) {
                    values.push(value);
                }, function (e) {
                    resolver.reject(e);
                }, function () {
                    resolver.resolve(values);
                }, cts.cancel, cts.token);
            }, cts.token);
        };
        return EventStream;
    })();
    exports.EventStream = EventStream;
    
    var EventData = (function () {
        function EventData(events, source, token) {
            var _this = this;
            this.closed = false;
            this.state = EventState.pending;
            Object.defineProperty(events, "_eventData", { value: this });
            Object.defineProperty(source, "_eventData", { value: this });
            this.events = events;
            this.source = source;
            this.token = token;
    
            if (this.token) {
                this.cancellationHandle = this.token.register(function () {
                    _this.cancel();
                });
            }
        }
        EventData.prototype.accept = function (value, synchronous) {
            if (this.closed) {
                return;
            }
    
            if (this.state === EventState.pending) {
                if (!this.pending) {
                    this.pending = [];
                }
    
                this.pending.push(value);
            } else {
                this.process(this.receiveCallbacks, value, false, synchronous);
            }
        };
    
        EventData.prototype.send = function (value, synchronous) {
            var _this = this;
            if (this.closed) {
                return;
            }
    
            if (futures.Future.isFuture(value)) {
                var future = value;
                var resolve = function (value) {
                    _this.accept(value, true);
                };
                var reject = function (value) {
                    _this.reject(value, true);
                };
    
                try  {
                    value.done(resolve, reject);
                } catch (e) {
                    this.reject(e, synchronous);
                }
    
                return;
            }
    
            this.accept(value, synchronous);
        };
    
        EventData.prototype.stream = function (value, synchronous) {
            var _this = this;
            if (this.closed) {
                return;
            }
    
            if (EventStream.isEventStream(value)) {
                var events = value;
                if (events === this.events) {
                    throw new TypeError("EventStream cannot stream itself");
                }
    
                var receive = function (value) {
                    _this.accept(value, true);
                };
                var reject = function (value) {
                    _this.reject(value, true);
                };
                try  {
                    events.listen(receive, reject, null, null, this.token);
                } catch (e) {
                    this.reject(e, synchronous);
                }
    
                return;
            }
    
            this.send(value, synchronous);
        };
    
        EventData.prototype.reject = function (value, synchronous) {
            if (this.closed) {
                return;
            }
    
            this.state = EventState.rejected;
            this.fault = value;
            this.closed = true;
    
            if (this.token && this.cancellationHandle) {
                this.token.unregister(this.cancellationHandle);
                this.token = null;
                this.cancellationHandle = null;
            }
    
            this.process(this.rejectCallbacks, value, true, synchronous);
        };
    
        EventData.prototype.close = function (synchronous) {
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
        };
    
        EventData.prototype.cancel = function () {
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
    
            this.process(this.cancelCallbacks, void 0, true, true);
        };
    
        EventData.prototype.append = function (receiveCallback, rejectCallback, closeCallback, cancelCallback, token) {
            var _this = this;
            if (!(token && token.canceled)) {
                if (typeof receiveCallback === "function") {
                    if (this.receiveCallbacks == null) {
                        this.receiveCallbacks = {};
                    }
    
                    var receiveNode = linkedlist.Append(this.receiveCallbacks, {
                        token: token,
                        callback: receiveCallback
                    });
    
                    if (token) {
                        token.register(function () {
                            linkedlist.Delete(_this.receiveCallbacks, receiveNode);
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
                        token.register(function () {
                            return linkedlist.Delete(_this.rejectCallbacks, rejectNode);
                        });
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
                        token.register(function () {
                            return linkedlist.Delete(_this.closeCallbacks, closeNode);
                        });
                    }
                }
    
                if (typeof cancelCallback === "function") {
                    if (this.cancelCallbacks == null) {
                        this.cancelCallbacks = {};
                    }
    
                    linkedlist.Append(this.cancelCallbacks, {
                        callback: cancelCallback
                    });
                }
            }
    
            if (this.receiveCallbacks && this.pending) {
                var pending = this.pending;
                this.pending = null;
                this.state = EventState.sending;
                while (pending.length) {
                    this.process(this.receiveCallbacks, pending.shift(), false, false);
                }
            }
    
            if (this.state === EventState.sending) {
            } else if (this.state === EventState.rejected) {
                this.process(this.rejectCallbacks, this.fault, true, false);
            } else if (this.state === EventState.closed) {
                this.process(this.closeCallbacks, void 0, true, false);
            } else if (this.state === EventState.canceled) {
                this.process(this.cancelCallbacks, void 0, true, true);
            }
        };
    
        EventData.prototype.process = function (callbacks, result, remove, synchronous) {
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
                            futures.Scheduler.current.post((function (callback) {
                                return function () {
                                    callback(result);
                                };
                            })(callback), { synchronous: synchronous }, token);
                        }
    
                        node = next;
                        if (node === callbacks.head) {
                            return;
                        }
                    }
                }
            }
        };
        return EventData;
    })();
    
    var EventState;
    (function (EventState) {
        EventState[EventState["pending"] = 0] = "pending";
        EventState[EventState["sending"] = 1] = "sending";
        EventState[EventState["rejected"] = 2] = "rejected";
        EventState[EventState["closed"] = 3] = "closed";
    
        EventState[EventState["canceled"] = 4] = "canceled";
    })(EventState || (EventState = {}));
}, this);