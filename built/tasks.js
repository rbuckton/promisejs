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
            }, global["tasks"] = { });
    }
})
(function (require, exports) {
    var symbols = require("./symbols");
    var lists = require("./lists");
    
    var CancellationDataSym = new symbols.Symbol("tasks.CancellationData");
    var DispatcherDataSym = new symbols.Symbol("tasks.DispatcherData");
    
    var AggregateError = (function () {
        function AggregateError() {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                args[_i] = arguments[_i + 0];
            }
            this.name = "AggregateError";
            this.message = "One or more errors occurred";
            this.errors = [];
            var argi = 0;
            var message = null;
            var errors = null;
    
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
        return AggregateError;
    })();
    exports.AggregateError = AggregateError;
    
    AggregateError.prototype = Object.create(Error.prototype);
    
    symbols.brand("AggregateError")(AggregateError);
    
    var CancellationToken = (function () {
        function CancellationToken() {
            throw new TypeError("Object doesn't support this action");
        }
        Object.defineProperty(CancellationToken.prototype, "canceled", {
            get: function () {
                var data = CancellationDataSym.get(this);
                if (!data || !symbols.hasBrand(this, CancellationToken))
                    throw new TypeError("'this' is not a CancellationToken object");
    
                return data.canceled;
            },
            enumerable: true,
            configurable: true
        });
    
        CancellationToken.prototype.register = function (cleanup) {
            var data = CancellationDataSym.get(this);
            if (!data || !symbols.hasBrand(this, CancellationToken))
                throw new TypeError("'this' is not a CancellationToken object");
    
            return RegisterCancellationCleanup(data, cleanup);
        };
    
        CancellationToken.prototype.unregister = function (handle) {
            var data = CancellationDataSym.get(this);
            if (!data || !symbols.hasBrand(this, CancellationToken))
                throw new TypeError("'this' is not a CancellationToken object");
    
            UnregisterCancellationCleanup(data, handle);
        };
        return CancellationToken;
    })();
    exports.CancellationToken = CancellationToken;
    
    symbols.brand("CancellationToken")(CancellationToken);
    
    var CancellationSource = (function () {
        function CancellationSource() {
            var tokens = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                tokens[_i] = arguments[_i + 0];
            }
            var token = Object.create(CancellationToken.prototype);
            var data = new CancellationData(this, token);
            CancellationDataSym.set(token, data);
            CancellationDataSym.set(this, data);
    
            tokens.forEach(function (token) {
                if (symbols.hasBrand(token, CancellationToken)) {
                    LinkToCancellationToken(data, token);
                }
            });
    
            Object.freeze(token);
        }
        Object.defineProperty(CancellationSource.prototype, "token", {
            get: function () {
                var data = CancellationDataSym.get(this);
                if (!data || !symbols.hasBrand(this, CancellationSource))
                    throw new TypeError("'this' is not a CancellationSource object");
    
                return data.token;
            },
            enumerable: true,
            configurable: true
        });
    
        CancellationSource.prototype.cancel = function () {
            var data = CancellationDataSym.get(this);
            if (!data || !symbols.hasBrand(this, CancellationSource))
                throw new TypeError("'this' is not a CancellationSource object");
            if (data.closed)
                throw new Error("Object doesn't support this action");
    
            Cancel(data);
        };
    
        CancellationSource.prototype.cancelAfter = function (ms) {
            var data = CancellationDataSym.get(this);
            if (!data || !symbols.hasBrand(this, CancellationSource))
                throw new TypeError("'this' is not a CancellationSource object");
            if (data.closed)
                throw new Error("Object doesn't support this action");
    
            CancelAfter(data, ms);
        };
    
        CancellationSource.prototype.close = function () {
            var data = CancellationDataSym.get(this);
            if (!data || !symbols.hasBrand(this, CancellationSource))
                throw new TypeError("'this' is not a CancellationSource object");
            if (data.closed)
                return;
    
            data.closed = true;
    
            if (data.links != null) {
                data.links.forEach(function (value) {
                    value.callback.call(null);
                });
            }
    
            data.links = null;
        };
        return CancellationSource;
    })();
    exports.CancellationSource = CancellationSource;
    
    symbols.brand("CancellationSource")(CancellationSource);
    
    var CancellationData = (function () {
        function CancellationData(source, token) {
            this.closed = false;
            this.canceled = false;
            this.source = source;
            this.token = token;
        }
        CancellationData.MAX_HANDLE = 2147483647;
    
        CancellationData.nextHandle = 1;
        return CancellationData;
    })();
    
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
            data.cleanupCallbacks = new lists.LinkedList();
        }
    
        data.cleanupCallbacks.push({ handle: handle, callback: cleanup });
        return handle;
    }
    
    function UnregisterCancellationCleanup(data, handle) {
        if (data.cleanupCallbacks) {
            var found = data.cleanupCallbacks.match(function (entry) {
                return lists.is(entry.handle, handle);
            });
            if (found) {
                data.cleanupCallbacks.deleteNode(found);
            }
        }
    }
    
    function LinkToCancellationToken(data, token) {
        if (data.links == null) {
            data.links = new lists.LinkedList();
        }
    
        var handle = token.register(function () {
            Cancel(data);
        });
    
        data.links.push({ handle: handle, callback: function () {
                UnregisterCancellationCleanup(data, handle);
            } });
    }
    
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
    
        data.cleanupCallbacks.forEach(callback);
        data.cleanupCallbacks = null;
    
        if (errors) {
            throw new AggregateError(null, errors);
        }
    }
    
    function CancelAfter(data, ms) {
        if (data.canceled) {
            return;
        }
    
        if (data.cancelHandle) {
            clearTimeout(data.cancelHandle);
            data.cancelHandle = null;
        }
    
        data.cancelHandle = setTimeout(function () {
            Cancel(data);
        }, ms);
    }
    
    var Dispatcher = (function () {
        function Dispatcher() {
            var data = new DispatcherData(this);
            DispatcherDataSym.set(this, data);
        }
        Object.defineProperty(Dispatcher, "default", {
            get: function () {
                if (!DispatcherData.default) {
                    DispatcherData.default = new Dispatcher();
                    Object.freeze(DispatcherData.default);
                }
    
                return DispatcherData.default;
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(Dispatcher, "current", {
            get: function () {
                if (!DispatcherData.current) {
                    DispatcherData.current = Dispatcher.default;
                }
    
                return DispatcherData.current;
            },
            enumerable: true,
            configurable: true
        });
    
        Dispatcher.prototype.post = function (task) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            var data = DispatcherDataSym.get(this);
            if (!data || !symbols.hasBrand(this, Dispatcher))
                throw new TypeError("'this' is not a Dispatcher object");
    
            var argi = 0;
            var options = null;
            var token = null;
    
            if (!symbols.hasBrand(args[argi], CancellationToken)) {
                options = args[argi++];
            }
    
            if (symbols.hasBrand(args[argi], CancellationToken)) {
                options = args[argi];
            }
    
            PostTask(data, task, options, token);
        };
        return Dispatcher;
    })();
    exports.Dispatcher = Dispatcher;
    
    symbols.brand("Dispatcher")(Dispatcher);
    
    var DispatcherData = (function () {
        function DispatcherData(dispatcher) {
            this.inTick = false;
            this.dispatcher = dispatcher;
        }
        DispatcherData.default = null;
    
        DispatcherData.current = null;
        return DispatcherData;
    })();
    
    function PostTask(data, task, options, token) {
        var tokenHandle;
        var taskHandle;
    
        task = BindTask(data, task);
    
        if (options) {
            if (options.synchronous) {
                if (!(token && token.canceled)) {
                    try  {
                        task();
                    } catch (e) {
                        PostTask(data, function () {
                            throw e;
                        }, null, null);
                    }
                }
    
                return;
            } else if ("delay" in options) {
                taskHandle = setTimeout(function () {
                    if (token) {
                        if (tokenHandle) {
                            token.unregister(tokenHandle);
                        }
                    }
    
                    task();
                }, options.delay);
    
                if (token) {
                    tokenHandle = token.register(function () {
                        clearTimeout(taskHandle);
                    });
                }
    
                return;
            } else if (options.fair) {
                taskHandle = SetImmediate(function () {
                    if (token) {
                        if (tokenHandle) {
                            token.unregister(tokenHandle);
                        }
                    }
    
                    task();
                });
    
                if (token) {
                    tokenHandle = token.register(function () {
                        ClearImmediate(taskHandle);
                    });
                }
                return;
            }
        }
    
        if (data.tasks == null) {
            data.tasks = new lists.LinkedList();
        }
    
        var node = data.tasks.push(function () {
            if (token) {
                token.unregister(tokenHandle);
                if (token.canceled) {
                    return;
                }
            }
    
            task();
        });
    
        RequestTick(data);
    
        if (token) {
            tokenHandle = token.register(function () {
                data.tasks.deleteNode(node);
    
                if (!data.tasks.head) {
                    CancelTick(data);
                }
            });
        }
    }
    
    function BindTask(data, task) {
        var wrapped = function () {
            var previousDispatcher = DispatcherData.current;
            DispatcherData.current = data.dispatcher;
            try  {
                task();
            } finally {
                DispatcherData.current = previousDispatcher;
            }
        };
    
        var domain = GetDomain();
        if (domain) {
            wrapped = domain.bind(wrapped);
        }
    
        return wrapped;
    }
    
    function RequestTick(data) {
        if (!data.inTick) {
            if (!data.tickHandle && data.tasks.head) {
                data.tickHandle = SetImmediate(function () {
                    Tick(data);
                });
            }
        }
    }
    
    function CancelTick(data) {
        if (data.tickHandle) {
            ClearImmediate(data.tickHandle);
            data.tickHandle = null;
        }
    }
    
    function Tick(data) {
        CancelTick(data);
    
        RequestTick(data);
    
        data.inTick = true;
        try  {
            while (data.tasks.head) {
                var next = data.tasks.head;
                data.tasks.deleteNode(next);
    
                var callback = next.value;
                callback();
            }
    
            CancelTick(data);
        } finally {
            data.inTick = false;
        }
    }
    
    var GetDomain = function () {
        return null;
    };
    var SetImmediate;
    var ClearImmediate;
    
    if (typeof setImmediate === "function") {
        SetImmediate = function (task) {
            return setImmediate(task);
        };
        ClearImmediate = function (handle) {
            return clearImmediate(handle);
        };
    } else if (typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function") {
        GetDomain = function () {
            return (process).domain;
        };
        SetImmediate = function (task) {
            var handle = { canceled: false };
            process.nextTick(function () {
                if (!handle.canceled) {
                    task();
                }
            });
            return handle;
        };
        ClearImmediate = function (handle) {
            if (handle)
                handle.canceled = true;
        };
    } else {
        SetImmediate = function (task) {
            return setTimeout(task, 0);
        };
        ClearImmediate = function (handle) {
            return clearTimeout(handle);
        };
    }
}, this);