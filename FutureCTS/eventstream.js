/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./symbols"], definition);
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
    var symbols = require("./symbols");
    var lists = require("./lists");
    var tasks = require("./tasks");
    var futures = require("./futures");
    var __EventSourceData__ = new symbols.Symbol("EventSourceData@d6611c28-e94d-41db-96d9-b565959aded1");
    var __EventStreamData__ = new symbols.Symbol("EventStreamData@acb50420-7927-4576-8e5d-b51c9a4c72ad");
    function linkTokens(x, y) {
        if (x) {
            if (y) {
                return new tasks.CancellationSource(x, y).token;
            }
            return x;
        }
        return y;
    }
    var EventState;
    (function (EventState) {
        EventState._map = [];
        EventState._map[0] = "pending";
        EventState.pending = 0;
        EventState._map[1] = "sending";
        EventState.sending = 1;
        EventState._map[2] = "closed";
        EventState.closed = 2;
        EventState._map[3] = "canceled";
        EventState.canceled = 3;
    })(EventState || (EventState = {}));
    var EventData = (function () {
        function EventData(stream, source, token) {
            var _this = this;
            this.closed = false;
            this.state = EventState.pending;
            this.stream = stream;
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
            this.state = EventState.sending;
            this.process(this.receiveCallbacks, value, false, synchronous);
        };
        EventData.prototype.send = function (value, synchronous) {
            var _this = this;
            if (this.closed) {
                return;
            }
            if (value === this.stream) {
                throw new TypeError("EventStream cannot stream itself");
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
            if (EventStream.isEventStream(value)) {
                var stream = value;
                var receive = function (value) {
                    _this.accept(value, true);
                };
                var reject = function (value) {
                    _this.reject(value, true);
                };
                try  {
                    stream.subscribe(receive, reject);
                } catch (e) {
                    this.reject(e, synchronous);
                }
                return;
            }
            this.accept(value, synchronous);
        };
        EventData.prototype.reject = function (value, synchronous) {
            if (this.closed) {
                return;
            }
            this.state = EventState.sending;
            this.process(this.rejectCallbacks, value, false, synchronous);
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
        };
        EventData.prototype.append = function (receiveCallback, rejectCallback, closeCallback, token) {
            var _this = this;
            if (!(token && token.canceled)) {
                if (typeof receiveCallback === "function") {
                    var receiveNode = {
                        token: token,
                        value: receiveCallback
                    };
                    if (this.receiveCallbacks == null) {
                        this.receiveCallbacks = new lists.LinkedList();
                    }
                    this.receiveCallbacks.insertAfter(this.receiveCallbacks.tail, receiveNode);
                    if (token) {
                        token.register(function () {
                            return _this.receiveCallbacks.remove(receiveNode);
                        });
                    }
                }
                if (typeof rejectCallback === "function") {
                    var rejectNode = {
                        token: token,
                        value: rejectCallback
                    };
                    if (this.rejectCallbacks == null) {
                        this.rejectCallbacks = new lists.LinkedList();
                    }
                    this.rejectCallbacks.insertAfter(this.rejectCallbacks.tail, rejectNode);
                    if (token) {
                        token.register(function () {
                            return _this.rejectCallbacks.remove(rejectNode);
                        });
                    }
                }
                if (typeof closeCallback === "function") {
                    var closeNode = {
                        token: token,
                        value: closeCallback
                    };
                    if (this.closeCallbacks == null) {
                        this.closeCallbacks = new lists.LinkedList();
                    }
                    this.closeCallbacks.insertAfter(this.closeCallbacks.tail, closeNode);
                    if (token) {
                        token.register(function () {
                            return _this.closeCallbacks.remove(closeNode);
                        });
                    }
                }
            }
        };
        EventData.prototype.wrapSendCallback = function (callback) {
            var _this = this;
            var wrapper = function (argument) {
                var value;
                try  {
                    value = callback.call(_this.stream, argument);
                } catch (e) {
                    _this.reject(e, true);
                    return;
                }
                _this.send(value, true);
            };
            return wrapper;
        };
        EventData.prototype.wrapCloseCallback = function (callback) {
            var _this = this;
            var wrapper = function () {
                try  {
                    callback.call(_this.stream);
                } catch (e) {
                    _this.reject(e, true);
                }
                _this.close(true);
            };
            return wrapper;
        };
        EventData.prototype.process = function (callbacks, result, remove, synchronous) {
            var _this = this;
            if (!synchronous) {
                futures.Future.run(function () {
                    return _this.process(callbacks, result, remove, true);
                }, this.token);
            } else {
                if (callbacks) {
                    var node = callbacks.head;
                    if (node) {
                        while(callbacks.head) {
                            var next = node.next;
                            if (remove) {
                                callbacks.remove(node);
                            }
                            if (!(node.token && node.token.canceled)) {
                                try  {
                                    node.value.call(null, result);
                                } catch (e) {
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
        };
        EventData.prototype.throwLater = function (e) {
            futures.Future.reject(e).done(null, null);
        };
        return EventData;
    })();
    var EventSource = (function () {
        function EventSource() {
            throw new TypeError("Object doesn't support this action");
        }
        EventSource.prototype.accept = function (value) {
            var eventData = __EventSourceData__.get(this);
            if (!eventData || !symbols.hasBrand(this, EventSource)) {
                throw new TypeError("'this' is not an EventSource object");
            }
            eventData.accept(value);
        };
        EventSource.prototype.send = function (value) {
            var eventData = __EventSourceData__.get(this);
            if (!eventData || !symbols.hasBrand(this, EventSource)) {
                throw new TypeError("'this' is not an EventSource object");
            }
            eventData.send(value);
        };
        EventSource.prototype.reject = function (value) {
            var eventData = __EventSourceData__.get(this);
            if (!eventData || !symbols.hasBrand(this, EventSource)) {
                throw new TypeError("'this' is not an EventSource object");
            }
            eventData.reject(value);
        };
        EventSource.prototype.close = function () {
            var eventData = __EventSourceData__.get(this);
            if (!eventData || !symbols.hasBrand(this, EventSource)) {
                throw new TypeError("'this' is not an EventSource object");
            }
            eventData.close();
        };
        EventSource.prototype.cancel = function () {
            var eventData = __EventSourceData__.get(this);
            if (!eventData || !symbols.hasBrand(this, EventSource)) {
                throw new TypeError("'this' is not an EventSource object");
            }
            eventData.cancel();
        };
        return EventSource;
    })();
    exports.EventSource = EventSource;
    symbols.brand.set(EventSource.prototype, "EventSource");
    var EventStream = (function () {
        function EventStream(init, token) {
            if (typeof init !== "function") {
                throw new TypeError("Invalid argument: init");
            }
            if (token != null && !symbols.hasBrand(token, tasks.CancellationToken)) {
                throw new TypeError("Invalid argument: token");
            }
            var source = Object.create(EventSource.prototype);
            var data = new EventData(this, source, token);
            __EventSourceData__.set(source, data);
            __EventStreamData__.set(this, data);
            source.accept = source.accept.bind(source);
            source.send = source.send.bind(source);
            source.reject = source.reject.bind(source);
            source.close = source.close.bind(source);
            try  {
                init.call(this, source);
            } catch (e) {
                data.reject(e);
                data.close();
            }
        }
        EventStream.isEventStream = function isEventStream(value) {
            return symbols.hasBrand(value, EventStream);
        };
        EventStream.prototype.subscribe = function () {
            var _this = this;
            var args = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                args[_i] = arguments[_i + 0];
            }
            var eventData = __EventStreamData__.get(this);
            if (!eventData || !symbols.hasBrand(this, EventStream)) {
                throw new TypeError("'this' is not an EventStream object");
            }
            var argi = 0;
            var receive = null;
            var reject = null;
            var close = null;
            var token = null;
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
            token = linkTokens(eventData.token, token);
            return new EventStream(function (source) {
                var sourceData = __EventSourceData__.get(source);
                if (!sourceData || !symbols.hasBrand(_this, EventSource)) {
                    throw new TypeError("'this' is not an EventSource object");
                }
                var receiveCallback;
                if (receive != null) {
                    receiveCallback = sourceData.wrapCallback(receive, false);
                } else {
                    receiveCallback = function (value) {
                        return sourceData.send(value, true);
                    };
                }
                var rejectCallback;
                if (reject != null) {
                    rejectCallback = sourceData.wrapCallback(reject, false);
                } else {
                    rejectCallback = function (value) {
                        return sourceData.reject(value, true);
                    };
                }
                var closeCallback;
                if (close != null) {
                    closeCallback = sourceData.wrapCallback(close, true);
                } else {
                    closeCallback = function () {
                        return sourceData.close(true);
                    };
                }
                eventData.append(receiveCallback, rejectCallback, closeCallback, token);
            }, token);
        };
        EventStream.prototype.listen = function (receive) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            var eventData = __EventStreamData__.get(this);
            if (!eventData || !symbols.hasBrand(this, EventStream)) {
                throw new TypeError("'this' is not an EventStream object");
            }
            var argi = 0;
            var reject = null;
            var close = null;
            var token = null;
            if (typeof args[argi] === "function") {
                reject = args[argi++];
                if (typeof args[argi] === "function") {
                    close = args[argi++];
                }
            }
            if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
                token = args[argi];
            }
            token = linkTokens(eventData.token, token);
            eventData.append(receive, reject, close, token);
        };
        return EventStream;
    })();
    exports.EventStream = EventStream;
    symbols.brand.set(EventStream.prototype, "EventStream");
}, this);