var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var symbols = require("./symbols");
var lists = require("./lists");

var CancellationDataSym = new symbols.Symbol("tasks.CancellationData");
var SchedulerSym = new symbols.Symbol("tasks.Scheduler");
var isNode = typeof process === "object" && Object.prototype.toString.call(process) === "[object process]" && typeof process.nextTick === "function";

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

var Scheduler = (function () {
    function Scheduler() {
        this.tickRequested = false;
    }
    Scheduler.create = function () {
        if (typeof setImmediate !== "function") {
            return new SetImmediateScheduler();
        }

        if (typeof MessageChannel === "function") {
            return new MessageChannelScheduler();
        }

        if (isNode) {
            return new NodeScheduler();
        }

        return new Scheduler();
    };

    Scheduler.prototype.post = function (task, options, token) {
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
            this.nextQueue = new lists.LinkedList();
        }

        var node = this.nextQueue.push(function () {
            if (token) {
                if (token.canceled) {
                    return;
                }

                if (tokenHandle) {
                    token.unregister(tokenHandle);
                }
            }

            task();
        });

        var tokenHandle;
        if (token) {
            tokenHandle = token.register(function () {
                if (node.list) {
                    (node.list).deleteNode(node);
                }
            });
        }

        this.requestTick();
    };

    Scheduler.prototype.postSynchronous = function (task, token) {
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

    Scheduler.prototype.postAfter = function (task, delay, token) {
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

    Scheduler.prototype.requestTick = function () {
        if (!this.tickRequested) {
            this.requestTickCore();
            this.tickRequested = true;
        }
    };

    Scheduler.prototype.requestTickCore = function () {
        var _this = this;
        this.postAfter(function () {
            return _this.tick();
        }, 0, null);
    };

    Scheduler.prototype.tick = function () {
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

    Scheduler.prototype.drainQueue = function () {
        try  {
            while (this.activeQueue.head) {
                var task = this.activeQueue.shift();
                task();
            }
        } finally {
            if (this.activeQueue.head) {
                this.requestTick();
            }
        }

        this.activeQueue = null;
    };
    return Scheduler;
})();

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
})(Scheduler);

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
})(Scheduler);

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
})(Scheduler);

var defaultDispatcher = null;
var currentDispatcher = null;

var Dispatcher = (function () {
    function Dispatcher() {
        var scheduler = Scheduler.create();
        SchedulerSym.set(this, scheduler);
    }
    Object.defineProperty(Dispatcher, "default", {
        get: function () {
            if (!defaultDispatcher) {
                defaultDispatcher = new Dispatcher();
                Object.freeze(defaultDispatcher);
            }

            return defaultDispatcher;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(Dispatcher, "current", {
        get: function () {
            if (!currentDispatcher) {
                currentDispatcher = Dispatcher.default;
            }

            return currentDispatcher;
        },
        enumerable: true,
        configurable: true
    });

    Dispatcher.prototype.post = function (task) {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 1); _i++) {
            args[_i] = arguments[_i + 1];
        }
        if (!symbols.hasBrand(this, Dispatcher))
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

        task = BindTask(this, task);

        SchedulerSym.get(this).post(task, options, token);
    };
    return Dispatcher;
})();
exports.Dispatcher = Dispatcher;

symbols.brand("Dispatcher")(Dispatcher);

function BindTask(dispatcher, task) {
    var wrapped = function () {
        var previousDispatcher = currentDispatcher;
        currentDispatcher = dispatcher;
        try  {
            task();
        } finally {
            currentDispatcher = previousDispatcher;
        }
    };

    var domain = GetDomain();
    if (domain) {
        wrapped = domain.bind(wrapped);
    }

    return wrapped;
}

var GetDomain = function () {
    return null;
};
if (isNode) {
    GetDomain = function () {
        return (process).domain;
    };
}

