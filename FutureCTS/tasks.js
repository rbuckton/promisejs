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
    
    var __CancellationTokenData__ = new symbols.Symbol("CancellationTokenData@edf533f9-bae1-4a85-a3c1-1e191754155d");
    var __CancellationSourceData__ = new symbols.Symbol("CancellationTokenSourceData@7d9c6295-bbfe-4d18-99b0-10583b920e9c");
    var __DispatcherData__ = new symbols.Symbol("DispatcherData@cc25bb49-9c40-40aa-8503-fef7f6080a2c");
    
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
    
    AggregateError.prototype = Object.create(Error.prototype);
    
    symbols.brand.set(AggregateError.prototype, "AggregateError");
    
    var CancellationData = (function () {
        function CancellationData(source, token) {
            this.closed = false;
            this.canceled = false;
            this.source = source;
            this.token = token;
        }
        CancellationData.prototype.register = function (cleanup) {
            if (this.canceled) {
                cleanup();
                return 0;
            }
    
            if (CancellationData.nextHandle >= CancellationData.MAX_HANDLE) {
                CancellationData.nextHandle = 1;
            }
            var handle = CancellationData.nextHandle++;
    
            if (this.cleanupCallbacks == null) {
                this.cleanupCallbacks = new lists.LinkedList();
            }
    
            var node = {
                handle: handle,
                value: cleanup
            };
            this.cleanupCallbacks.insertAfter(this.cleanupCallbacks.tail, node);
            return handle;
        };
    
        CancellationData.prototype.unregister = function (handle) {
            if (this.cleanupCallbacks) {
                var filter = function (node) {
                    return node.handle === handle;
                };
                var found = this.cleanupCallbacks.find(filter);
                if (found) {
                    this.cleanupCallbacks.remove(found);
                }
            }
        };
    
        CancellationData.prototype.linkTo = function (token) {
            var _this = this;
            if (this.links == null) {
                this.links = new lists.LinkedList();
            }
    
            var handle = token.register(function () {
                _this.cancel();
            });
    
            var node = {
                handle: handle,
                value: function () {
                    token.unregister(handle);
                }
            };
    
            this.links.insertAfter(this.links.tail, node);
        };
    
        CancellationData.prototype.cancel = function () {
            if (this.canceled) {
                return;
            }
    
            this.canceled = true;
    
            var errors;
            var callback = function (node) {
                try  {
                    node.value.call(null);
                } catch (e) {
                    if (errors == null) {
                        errors = [];
                    }
    
                    errors.push(e);
                }
            };
    
            this.cleanupCallbacks.forEach(callback);
            this.cleanupCallbacks = null;
    
            if (errors) {
                throw new AggregateError(null, errors);
            }
        };
    
        CancellationData.prototype.cancelAfter = function (ms) {
            var _this = this;
            if (this.canceled) {
                return;
            }
    
            if (this.cancelHandle) {
                clearTimeout(this.cancelHandle);
                this.cancelHandle = null;
            }
    
            this.cancelHandle = setTimeout(function () {
                _this.cancel();
            }, ms);
        };
        CancellationData.MAX_HANDLE = 2147483647;
    
        CancellationData.nextHandle = 1;
        return CancellationData;
    })();
    
    var CancellationToken = (function () {
        function CancellationToken() {
            throw new TypeError("Object doesn't support this action");
        }
        Object.defineProperty(CancellationToken.prototype, "canceled", {
            get: function () {
                var data = __CancellationTokenData__.get(this);
                if (!data || !symbols.hasBrand(this, CancellationToken))
                    throw new TypeError("'this' is not a CancellationToken object");
    
                return data.canceled;
            },
            enumerable: true,
            configurable: true
        });
    
        CancellationToken.prototype.register = function (cleanup) {
            var data = __CancellationTokenData__.get(this);
            if (!data || !symbols.hasBrand(this, CancellationToken))
                throw new TypeError("'this' is not a CancellationToken object");
    
            return data.register(cleanup);
        };
    
        CancellationToken.prototype.unregister = function (handle) {
            var data = __CancellationTokenData__.get(this);
            if (!data || !symbols.hasBrand(this, CancellationToken))
                throw new TypeError("'this' is not a CancellationToken object");
    
            data.unregister(handle);
        };
        return CancellationToken;
    })();
    exports.CancellationToken = CancellationToken;
    
    symbols.brand.set(CancellationToken.prototype, "CancellationToken");
    
    var CancellationSource = (function () {
        function CancellationSource() {
            var tokens = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                tokens[_i] = arguments[_i + 0];
            }
            var token = Object.create(CancellationToken.prototype);
            var data = new CancellationData(this, token);
            __CancellationTokenData__.set(token, data);
            __CancellationSourceData__.set(this, data);
    
            tokens.forEach(function (token) {
                if (symbols.hasBrand(token, CancellationToken)) {
                    data.linkTo(token);
                }
            });
    
            Object.freeze(token);
        }
        Object.defineProperty(CancellationSource.prototype, "token", {
            get: function () {
                var data = __CancellationSourceData__.get(this);
                if (!data || !symbols.hasBrand(this, CancellationSource))
                    throw new TypeError("'this' is not a CancellationSource object");
    
                return data.token;
            },
            enumerable: true,
            configurable: true
        });
    
        CancellationSource.prototype.cancel = function () {
            var data = __CancellationSourceData__.get(this);
            if (!data || !symbols.hasBrand(this, CancellationSource))
                throw new TypeError("'this' is not a CancellationSource object");
            if (data.closed)
                throw new Error("Object doesn't support this action");
    
            data.cancel();
        };
    
        CancellationSource.prototype.cancelAfter = function (ms) {
            var data = __CancellationSourceData__.get(this);
            if (!data || !symbols.hasBrand(this, CancellationSource))
                throw new TypeError("'this' is not a CancellationSource object");
            if (data.closed)
                throw new Error("Object doesn't support this action");
    
            data.cancelAfter(ms);
        };
    
        CancellationSource.prototype.close = function () {
            var data = __CancellationSourceData__.get(this);
            if (!data || !symbols.hasBrand(this, CancellationSource))
                throw new TypeError("'this' is not a CancellationSource object");
            if (data.closed)
                return;
    
            data.closed = true;
    
            if (data.links != null) {
                data.links.forEach(function (node) {
                    node.value.call(null);
                });
            }
    
            data.links = null;
        };
        return CancellationSource;
    })();
    exports.CancellationSource = CancellationSource;
    
    symbols.brand.set(CancellationSource.prototype, "CancellationSource");
    
    var _getDomain = function () {
        return null;
    };
    var _setImmediate;
    var _clearImmediate;
    if (typeof setImmediate === "function") {
        _setImmediate = function (task) {
            return setImmediate(task);
        };
        _clearImmediate = function (handle) {
            return clearImmediate(handle);
        };
    } else if (typeof process !== "undefined" && Object(process) === process && typeof process.nextTick === "function") {
        _getDomain = function () {
            return (process).domain;
        };
        _setImmediate = function (task) {
            var handle = { canceled: false };
            process.nextTick(function () {
                if (!handle.canceled) {
                    task();
                }
            });
            return handle;
        };
        _clearImmediate = function (handle) {
            if (handle)
                handle.canceled = true;
        };
    } else {
        _setImmediate = function (task) {
            return setTimeout(task, 0);
        };
        _clearImmediate = function (handle) {
            return clearTimeout(handle);
        };
    }
    
    var DispatcherData = (function () {
        function DispatcherData(dispatcher) {
            this.inTick = false;
            this.dispatcher = dispatcher;
        }
        DispatcherData.prototype.post = function (task, options, token) {
            var _this = this;
            var tokenHandle;
            var taskHandle;
    
            task = this.bind(task);
    
            if (options) {
                if (options.synchronous) {
                    if (!(token && token.canceled)) {
                        try  {
                            task();
                        } catch (e) {
                            this.post(function () {
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
                    taskHandle = _setImmediate(function () {
                        if (token) {
                            if (tokenHandle) {
                                token.unregister(tokenHandle);
                            }
                        }
    
                        task();
                    });
    
                    if (token) {
                        tokenHandle = token.register(function () {
                            _clearImmediate(taskHandle);
                        });
                    }
                    return;
                }
            }
    
            if (this.tasks == null) {
                this.tasks = new lists.LinkedList();
            }
    
            var node = {
                value: function () {
                    if (token) {
                        token.unregister(tokenHandle);
                        if (token.canceled) {
                            return;
                        }
                    }
    
                    task();
                }
            };
    
            this.tasks.insertAfter(this.tasks.tail, node);
    
            this.requestTick();
    
            if (token) {
                tokenHandle = token.register(function () {
                    _this.tasks.remove(node);
    
                    if (!_this.tasks.head) {
                        _this.cancelTick();
                    }
                });
            }
        };
    
        DispatcherData.prototype.requestTick = function () {
            var _this = this;
            if (!this.inTick) {
                if (!this.tickHandle && this.tasks.head) {
                    this.tickHandle = _setImmediate(function () {
                        _this.tick();
                    });
                }
            }
        };
    
        DispatcherData.prototype.cancelTick = function () {
            if (this.tickHandle) {
                _clearImmediate(this.tickHandle);
                this.tickHandle = null;
            }
        };
    
        DispatcherData.prototype.bind = function (task) {
            var _this = this;
            var wrapped = function () {
                var previousDispatcher = DispatcherData.current;
                DispatcherData.current = _this.dispatcher;
                try  {
                    task();
                } finally {
                    DispatcherData.current = previousDispatcher;
                }
            };
    
            var domain = _getDomain();
            if (domain) {
                wrapped = domain.bind(wrapped);
            }
    
            return wrapped;
        };
    
        DispatcherData.prototype.tick = function () {
            this.cancelTick();
    
            this.requestTick();
    
            this.inTick = true;
            try  {
                while (this.tasks.head) {
                    var next = this.tasks.head;
                    this.tasks.remove(next);
    
                    var callback = next.value;
                    callback();
                }
    
                this.cancelTick();
            } finally {
                this.inTick = false;
            }
        };
        DispatcherData.default = null;
    
        DispatcherData.current = null;
        return DispatcherData;
    })();
    
    var Dispatcher = (function () {
        function Dispatcher() {
            var data = new DispatcherData(this);
            __DispatcherData__.set(this, data);
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
            var data = __DispatcherData__.get(this);
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
    
            data.post(task, options, token);
        };
        return Dispatcher;
    })();
    exports.Dispatcher = Dispatcher;
    
    symbols.brand.set(Dispatcher.prototype, "Dispatcher");
}, this);