/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports"], definition);
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
            }, global["futures"] = { });
    }
})
(function (require, exports) {
    var __extends = this.__extends || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        __.prototype = b.prototype;
        d.prototype = new __();
    };
    function is(x, y) {
        return (x === y) ? (x !== 0 || 1 / x === 1 / y) : (x !== x && y !== y);
    }
    
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
    
    var tasks;
    (function (tasks) {
        var isNode = typeof process === "object" && Object.prototype.toString.call(process) === "[object process]" && typeof process.nextTick === "function";
    
        var CancellationData = (function () {
            function CancellationData(source, token) {
                this.closed = false;
                this.canceled = false;
                Object.defineProperty(source, "_cancelData", { value: this });
                Object.defineProperty(token, "_cancelData", { value: this });
                this.source = source;
                this.token = token;
            }
            CancellationData.MAX_HANDLE = 2147483647;
            CancellationData.nextHandle = 1;
            return CancellationData;
        })();
        tasks.CancellationData = CancellationData;
    
        function RegisterCancellationCleanup(data, cleanup) {
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
        tasks.RegisterCancellationCleanup = RegisterCancellationCleanup;
    
        function UnregisterCancellationCleanup(data, handle) {
            if (data.cleanupCallbacks) {
                var found = linkedlist.Find(data.cleanupCallbacks, function (node) {
                    return is(node.handle, handle);
                });
                if (found) {
                    linkedlist.Delete(data.cleanupCallbacks, found);
                }
            }
        }
        tasks.UnregisterCancellationCleanup = UnregisterCancellationCleanup;
    
        function LinkToCancellationToken(data, token) {
            if (data.links == null) {
                data.links = {};
            }
    
            var handle = token.register(function () {
                Cancel(data);
            });
    
            linkedlist.Append(data.links, { handle: handle, callback: function () {
                    UnregisterCancellationCleanup(data, handle);
                } });
        }
        tasks.LinkToCancellationToken = LinkToCancellationToken;
    
        function Cancel(data) {
            if (data.canceled) {
                return;
            }
    
            data.canceled = true;
    
            var errors;
            var callback = function (value) {
                try  {
                    value.callback.call(null);
                } catch (e) {
                    if (errors == null) {
                        errors = [];
                    }
    
                    errors.push(e);
                }
            };
    
            linkedlist.Iterate(data.cleanupCallbacks, callback);
            data.cleanupCallbacks = null;
    
            if (errors) {
                throw new AggregateError(null, errors);
            }
        }
        tasks.Cancel = Cancel;
    
        function CancelAfter(data, delay) {
            if (data.canceled) {
                return;
            }
    
            if (data.cancelHandle) {
                clearTimeout(data.cancelHandle);
                data.cancelHandle = null;
            }
    
            data.cancelHandle = setTimeout(function () {
                Cancel(data);
            }, delay);
        }
        tasks.CancelAfter = CancelAfter;
    
        function createScheduler() {
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
        tasks.createScheduler = createScheduler;
    
        var SchedulerBase = (function () {
            function SchedulerBase() {
                this.tickRequested = false;
            }
            SchedulerBase.prototype.post = function (task, options, token) {
                if (options) {
                    if (options.synchronous) {
                        this.postSynchronous(task, token);
                        return;
                    } else if ("delay" in options) {
                        this.postAfter(task, options.delay, token);
                        return;
                    }
                }
    
                if (!this.nextQueue) {
                    this.nextQueue = {};
                }
    
                var node = linkedlist.Append(this.nextQueue, {
                    callback: function () {
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
    
                var tokenHandle;
                if (token) {
                    tokenHandle = token.register(function () {
                        if (node.list) {
                            linkedlist.Delete(node.list, node);
                        }
                    });
                }
    
                this.requestTick();
            };
    
            SchedulerBase.prototype.postSynchronous = function (task, token) {
                if (!(token && token.canceled)) {
                    try  {
                        task();
                    } catch (e) {
                        this.post(function () {
                            throw e;
                        }, null, null);
                    }
                }
            };
    
            SchedulerBase.prototype.postAfter = function (task, delay, token) {
                var taskHandle = setTimeout(function () {
                    if (token && tokenHandle) {
                        token.unregister(tokenHandle);
                    }
    
                    task();
                }, delay);
    
                var tokenHandle;
                if (token) {
                    tokenHandle = token.register(function () {
                        clearTimeout(taskHandle);
                    });
                }
            };
    
            SchedulerBase.prototype.requestTick = function () {
                if (!this.tickRequested) {
                    this.requestTickCore();
                    this.tickRequested = true;
                }
            };
    
            SchedulerBase.prototype.requestTickCore = function () {
            };
    
            SchedulerBase.prototype.tick = function () {
                this.tickRequested = false;
    
                if (this.activeQueue) {
                    this.drainQueue();
                }
    
                this.activeQueue = this.nextQueue;
                this.nextQueue = null;
    
                if (this.activeQueue) {
                    this.requestTick();
                }
            };
    
            SchedulerBase.prototype.drainQueue = function () {
                try  {
                    var node;
                    while (node = linkedlist.Delete(this.activeQueue, this.activeQueue.head)) {
                        var task = node.callback;
                        task();
                    }
                } finally {
                    if (this.activeQueue.head) {
                        this.requestTick();
                    }
                }
    
                this.activeQueue = null;
            };
            return SchedulerBase;
        })();
    
        var SetTimeoutScheduler = (function (_super) {
            __extends(SetTimeoutScheduler, _super);
            function SetTimeoutScheduler() {
                _super.apply(this, arguments);
            }
            SetTimeoutScheduler.prototype.requestTickCore = function () {
                var _this = this;
                setTimeout(function () {
                    _this.tick();
                }, 0);
            };
            return SetTimeoutScheduler;
        })(SchedulerBase);
    
        var SetImmediateScheduler = (function (_super) {
            __extends(SetImmediateScheduler, _super);
            function SetImmediateScheduler() {
                _super.apply(this, arguments);
            }
            SetImmediateScheduler.prototype.requestTickCore = function () {
                var _this = this;
                setImmediate(function () {
                    _this.tick();
                });
            };
            return SetImmediateScheduler;
        })(SchedulerBase);
    
        var MessageChannelScheduler = (function (_super) {
            __extends(MessageChannelScheduler, _super);
            function MessageChannelScheduler() {
                var _this = this;
                _super.call(this);
                this.channel = new MessageChannel();
                this.channel.port1.onmessage = function () {
                    _this.tick();
                };
            }
            MessageChannelScheduler.prototype.requestTickCore = function () {
                this.channel.port2.postMessage(null);
            };
            return MessageChannelScheduler;
        })(SchedulerBase);
    
        var NodeScheduler = (function (_super) {
            __extends(NodeScheduler, _super);
            function NodeScheduler() {
                _super.apply(this, arguments);
            }
            NodeScheduler.prototype.requestTickCore = function () {
                var _this = this;
                process.nextTick(function () {
                    _this.tick();
                });
            };
            return NodeScheduler;
        })(SchedulerBase);
    
        function BindTask(Scheduler, task) {
            var wrapped = function () {
                var previousScheduler = tasks.currentScheduler;
                tasks.currentScheduler = Scheduler;
                try  {
                    task();
                } finally {
                    tasks.currentScheduler = previousScheduler;
                }
            };
    
            var domain = GetDomain();
            if (domain) {
                wrapped = domain.bind(wrapped);
            }
    
            return wrapped;
        }
        tasks.BindTask = BindTask;
    
        var GetDomain = function () {
            return null;
        };
        if (isNode) {
            GetDomain = function () {
                return (process).domain;
            };
        }
    
        tasks.GetDomain = GetDomain;
    
        tasks.defaultScheduler = null;
        tasks.currentScheduler = null;
    })(tasks || (tasks = {}));
    
    var futures;
    (function (futures) {
        var FutureState;
        (function (FutureState) {
            FutureState[FutureState["pending"] = 0] = "pending";
            FutureState[FutureState["accepted"] = 1] = "accepted";
            FutureState[FutureState["rejected"] = 2] = "rejected";
            FutureState[FutureState["canceled"] = 3] = "canceled";
        })(FutureState || (FutureState = {}));
    
        var FutureData = (function () {
            function FutureData(future, resolver, token) {
                var _this = this;
                this.state = FutureState.pending;
                Object.defineProperty(future, "_futureData", { value: this });
                Object.defineProperty(resolver, "_futureData", { value: this });
                this.future = future;
                this.resolver = resolver;
                this.token = token;
                if (this.token) {
                    this.cancellationHandle = this.token.register(function () {
                        _this.cancel();
                    });
                }
            }
            FutureData.prototype.accept = function (value, synchronous) {
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
            };
    
            FutureData.prototype.resolve = function (value, synchronous) {
                var _this = this;
                if (this.state !== FutureState.pending) {
                    return;
                }
    
                if (value === this.future) {
                    throw new TypeError("Future cannot be resolved with itself");
                }
    
                if (Future.isFuture(value)) {
                    var resolve = function (value) {
                        return _this.accept(value, true);
                    };
                    var reject = function (value) {
                        return _this.reject(value, true);
                    };
    
                    try  {
                        value.done(resolve, reject, this.token);
                    } catch (e) {
                        this.reject(e, synchronous);
                    }
    
                    return;
                }
    
                this.accept(value, synchronous);
            };
    
            FutureData.prototype.reject = function (value, synchronous) {
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
            };
    
            FutureData.prototype.cancel = function () {
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
            };
    
            FutureData.prototype.append = function (resolveCallback, rejectCallback, cancelCallback, token) {
                var _this = this;
                var cts;
                if (this.state === FutureState.pending) {
                    cts = new CancellationSource(this.token, token);
                }
    
                if (this.state === FutureState.pending || this.state === FutureState.accepted) {
                    if (typeof resolveCallback === "function") {
                        if (this.resolveCallbacks == null) {
                            this.resolveCallbacks = {};
                        }
    
                        var resolveNode = linkedlist.Append(this.resolveCallbacks, { token: token, callback: resolveCallback });
                        cts && cts.token.register(function () {
                            linkedlist.Delete(_this.resolveCallbacks, resolveNode);
                        });
                    }
                }
    
                if (this.state === FutureState.pending || this.state === FutureState.rejected) {
                    if (typeof rejectCallback === "function") {
                        if (this.rejectCallbacks == null) {
                            this.rejectCallbacks = {};
                        }
    
                        var rejectNode = linkedlist.Append(this.rejectCallbacks, { token: token, callback: rejectCallback });
                        cts && cts.token.register(function () {
                            linkedlist.Delete(_this.rejectCallbacks, rejectNode);
                        });
                    }
                }
    
                if (this.state === FutureState.pending || this.state === FutureState.canceled) {
                    if (typeof cancelCallback === "function") {
                        if (this.cancelCallbacks == null) {
                            this.cancelCallbacks = {};
                        }
    
                        linkedlist.Append(this.cancelCallbacks, { callback: cancelCallback });
                    }
                }
    
                if (this.state === FutureState.accepted) {
                    this.process(this.resolveCallbacks, this.result, false);
                } else if (this.state === FutureState.rejected) {
                    this.process(this.rejectCallbacks, this.result, false);
                } else if (this.state === FutureState.canceled) {
                    this.process(this.cancelCallbacks, void 0, true);
                }
            };
    
            FutureData.prototype.wrapResolveCallback = function (callback) {
                var _this = this;
                var wrapper = function (value) {
                    try  {
                        value = callback.call(_this.future, value);
                    } catch (e) {
                        _this.reject(e, true);
                        return;
                    }
    
                    _this.resolve(value, true);
                };
    
                return wrapper;
            };
    
            FutureData.prototype.wrapCancelCallback = function (callback) {
                var _this = this;
                var wrapper = function () {
                    try  {
                        callback.call(_this.future);
                    } finally {
                        _this.cancel();
                    }
                };
    
                return wrapper;
            };
    
            FutureData.prototype.process = function (callbacks, result, synchronous) {
                if (callbacks) {
                    var node;
                    while (node = linkedlist.Delete(callbacks, callbacks.head)) {
                        var callback = node.callback, token = node.token;
                        if (!(token && token.canceled)) {
                            Scheduler.current.post(callback.bind(null, result), { synchronous: synchronous }, token);
                        }
                    }
                }
            };
            return FutureData;
        })();
        futures.FutureData = FutureData;
    })(futures || (futures = {}));
    
    var CancellationSource = (function () {
        function CancellationSource() {
            var tokens = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                tokens[_i] = arguments[_i + 0];
            }
            var token = Object.create(CancellationToken.prototype);
            var data = new tasks.CancellationData(this, token);
            this.cancel = this.cancel.bind(this);
            this.cancelAfter = this.cancelAfter.bind(this);
    
            tokens.forEach(function (token) {
                if (token) {
                    tasks.LinkToCancellationToken(data, token);
                }
            });
    
            Object.freeze(token);
        }
        Object.defineProperty(CancellationSource.prototype, "token", {
            get: function () {
                return this._cancelData.token;
            },
            enumerable: true,
            configurable: true
        });
    
        CancellationSource.prototype.cancel = function () {
            if (this._cancelData.closed)
                throw new Error("Object doesn't support this action");
            tasks.Cancel(this._cancelData);
        };
    
        CancellationSource.prototype.cancelAfter = function (delay) {
            if (this._cancelData.closed)
                throw new Error("Object doesn't support this action");
            tasks.CancelAfter(this._cancelData, delay);
        };
    
        CancellationSource.prototype.close = function () {
            if (this._cancelData.closed)
                return;
    
            this._cancelData.closed = true;
    
            var links = this._cancelData.links;
            this._cancelData.links = null;
    
            linkedlist.Iterate(links, function (node) {
                node.callback.call(null);
            });
        };
        return CancellationSource;
    })();
    exports.CancellationSource = CancellationSource;
    
    var CancellationToken = (function () {
        function CancellationToken() {
            throw new TypeError("Object doesn't support this action");
        }
        Object.defineProperty(CancellationToken.prototype, "canceled", {
            get: function () {
                return this._cancelData.canceled;
            },
            enumerable: true,
            configurable: true
        });
    
        CancellationToken.prototype.register = function (cleanup) {
            return tasks.RegisterCancellationCleanup(this._cancelData, cleanup);
        };
    
        CancellationToken.prototype.unregister = function (handle) {
            tasks.UnregisterCancellationCleanup(this._cancelData, handle);
        };
        return CancellationToken;
    })();
    exports.CancellationToken = CancellationToken;
    
    var Scheduler = (function () {
        function Scheduler() {
            this._scheduler = tasks.createScheduler();
        }
        Object.defineProperty(Scheduler, "default", {
            get: function () {
                if (!tasks.defaultScheduler) {
                    tasks.defaultScheduler = new Scheduler();
                    Object.freeze(tasks.defaultScheduler);
                }
    
                return tasks.defaultScheduler;
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(Scheduler, "current", {
            get: function () {
                if (!tasks.currentScheduler) {
                    tasks.currentScheduler = Scheduler.default;
                }
    
                return tasks.currentScheduler;
            },
            enumerable: true,
            configurable: true
        });
    
        Scheduler.prototype.post = function (task, options, token) {
            task = tasks.BindTask(this, task);
    
            this._scheduler.post(task, options, token);
        };
        return Scheduler;
    })();
    exports.Scheduler = Scheduler;
    
    var Future = (function () {
        function Future(init, token) {
            var resolver = Object.create(FutureResolver.prototype);
            var data = new futures.FutureData(this, resolver, token);
            resolver.accept = resolver.accept.bind(resolver);
            resolver.resolve = resolver.resolve.bind(resolver);
            resolver.reject = resolver.reject.bind(resolver);
            resolver.cancel = resolver.cancel.bind(resolver);
    
            try  {
                init.call(this, resolver);
            } catch (e) {
                data.reject(e);
            }
        }
        Future.accept = function (value) {
            return new Future(function (resolver) {
                resolver.accept(value);
            });
        };
    
        Future.resolve = function (value, token) {
            return new Future(function (resolver) {
                resolver.resolve(value);
            }, token);
        };
    
        Future.reject = function (value) {
            return new Future(function (resolver) {
                resolver.reject(value);
            });
        };
    
        Future.any = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = (resolver)._futureData;
                var resolveCallback = function (value) {
                    return data.accept(value, true);
                };
                var rejectCallback = function (value) {
                    return data.reject(value, true);
                };
                if (values.length <= 0) {
                    resolver.accept(void 0);
                } else {
                    values.forEach(function (value) {
                        Future.resolve(value).done(resolveCallback, rejectCallback);
                    });
                }
            });
        };
    
        Future.every = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = (resolver)._futureData;
                var countdown = values.length;
                var results = new Array(countdown);
                var rejectCallback = function (value) {
                    return data.reject(value, true);
                };
                values.forEach(function (value, index) {
                    var resolveCallback = function (value) {
                        results[index] = value;
                        if (--countdown === 0) {
                            data.accept(results, true);
                        }
                    };
                    Future.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
    
        Future.some = function () {
            var values = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                values[_i] = arguments[_i + 0];
            }
            return new Future(function (resolver) {
                var data = (resolver)._futureData;
                var countdown = values.length;
                var results = new Array(countdown);
                var resolveCallback = function (value) {
                    return data.accept(value, true);
                };
                values.forEach(function (value, index) {
                    var rejectCallback = function (value) {
                        results[index] = value;
                        if (--countdown === 0) {
                            data.reject(results, true);
                        }
                    };
                    Future.resolve(value).done(resolveCallback, rejectCallback);
                });
            });
        };
    
        Future.from = function (value, token) {
            if (Future.isFuture(value)) {
                return value;
            }
    
            var cts = new CancellationSource(token);
            return new Future(function (resolver) {
                var resolve = function (value) {
                    if (!cts.token.canceled) {
                        try  {
                            if (Future.isFuture(value)) {
                                value.done(resolver.accept, resolver.reject, cts.cancel, cts.token);
                            } else if (Object(value) === value && typeof value.then === "function") {
                                value.then(resolve, resolver.reject);
                            } else {
                                resolver.accept(value);
                            }
                        } catch (e) {
                            resolver.reject(e);
                        }
                    }
                };
    
                resolve(value);
            }, cts.token);
        };
    
        Future.isFuture = function (value) {
            return value instanceof Future;
        };
    
        Future.yield = function (token) {
            return new Future(function (resolver) {
                Scheduler.current.post(function () {
                    resolver.resolve(void 0);
                }, token);
            }, token);
        };
    
        Future.sleep = function (delay, value, token) {
            return new Future(function (resolver) {
                Scheduler.current.post(function () {
                    resolver.resolve(value);
                }, { delay: delay }, token);
            }, token);
        };
    
        Future.run = function (func, delay, token) {
            var options;
            if (typeof delay === "number") {
                options = { delay: delay };
            }
    
            return new Future(function (resolver) {
                var resolverData = (resolver)._futureData;
                Scheduler.current.post(function () {
                    try  {
                        resolverData.resolve(func(), true);
                    } catch (e) {
                        resolverData.reject(e, true);
                    }
                }, options, token);
            }, token);
        };
    
        Future.prototype.then = function (resolve, reject, cancel, token) {
            var _this = this;
            return new Future(function (resolver) {
                var resolverData = (resolver)._futureData;
                _this._futureData.append(resolve ? resolverData.wrapResolveCallback(resolve) : function (value) {
                    resolverData.accept(value, true);
                }, reject ? resolverData.wrapResolveCallback(reject) : function (value) {
                    resolverData.reject(value, true);
                }, cancel ? resolverData.wrapCancelCallback(cancel) : function () {
                    resolverData.cancel();
                }, token);
            });
        };
    
        Future.prototype.catch = function (reject, token) {
            return this.then(null, reject, null, token);
        };
    
        Future.prototype.done = function (resolve, reject, cancel, token) {
            this._futureData.append(resolve, reject || function (e) {
                throw e;
            }, cancel, token);
        };
        return Future;
    })();
    exports.Future = Future;
    
    var FutureResolver = (function () {
        function FutureResolver() {
            throw new TypeError("Object doesn't support this action");
        }
        FutureResolver.prototype.accept = function (value) {
            this._futureData.accept(value);
        };
    
        FutureResolver.prototype.resolve = function (value) {
            this._futureData.resolve(value);
        };
    
        FutureResolver.prototype.reject = function (value) {
            this._futureData.reject(value);
        };
    
        FutureResolver.prototype.cancel = function () {
            this._futureData.cancel();
        };
        return FutureResolver;
    })();
    exports.FutureResolver = FutureResolver;
    
    var AggregateError = (function () {
        function AggregateError(message, errors) {
            this.name = "AggregateError";
            this.message = "One or more errors occurred";
            this.errors = [];
            if (message != null) {
                this.message = message;
            }
    
            if (errors != null) {
                this.errors = errors;
            }
        }
        return AggregateError;
    })();
    exports.AggregateError = AggregateError;
    
    AggregateError.prototype = Object.create(Error.prototype);
    
    if (typeof window !== "undefined" && typeof (window).Future === "undefined") {
        (window).Future = Future;
        (window).FutureResolver = FutureResolver;
        (window).CancellationToken = CancellationToken;
        (window).CancellationSource = CancellationSource;
    }
}, this);