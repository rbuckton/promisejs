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
            }, global["cancellation"] = { });
    }
})
(function (require, exports) {
    var CancellationSource = (function () {
        function CancellationSource() {
            var tokens = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                tokens[_i] = arguments[_i + 0];
            }
            var _this = this;
            var token = Object.create(CancellationToken.prototype);
            this.cancel = this.cancel.bind(this);
            this.cancelAfter = this.cancelAfter.bind(this);
    
            $CancellationCreate(this, token);
    
            tokens.forEach(function (token) {
                if (token) {
                    $CancellationLink(_this._cancelData, token);
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
            $CancellationCancel(this._cancelData);
        };
    
        CancellationSource.prototype.cancelAfter = function (delay) {
            if (this._cancelData.closed)
                throw new Error("Object doesn't support this action");
            $CancellationCancelAfter(this._cancelData, delay);
        };
    
        CancellationSource.prototype.close = function () {
            if (this._cancelData.closed)
                return;
            $CancellationClose(this._cancelData);
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
    
        CancellationToken.prototype.throwIfCanceled = function () {
            if (this.canceled) {
                throw new CanceledError();
            }
        };
    
        CancellationToken.prototype.register = function (cleanup) {
            return $CancellationRegister(this._cancelData, cleanup);
        };
    
        CancellationToken.prototype.unregister = function (handle) {
            $CancellationUnregister(this._cancelData, handle);
        };
        return CancellationToken;
    })();
    exports.CancellationToken = CancellationToken;
    
    function $CancellationCreate(source, token) {
        var data = {
            source: source,
            token: token,
            closed: false,
            canceled: false
        };
    
        Object.defineProperty(source, "_cancelData", { value: data });
        Object.defineProperty(token, "_cancelData", { value: data });
    }
    
    function $CancellationRegister(data, cleanup) {
        if (data.canceled) {
            cleanup();
            return 0;
        }
    
        if (nextCancellationHandle >= MAX_HANDLE) {
            nextCancellationHandle = 1;
        }
    
        var handle = nextCancellationHandle++;
    
        if (data.cleanupCallbacks == null) {
            data.cleanupCallbacks = [];
        }
    
        data.cleanupCallbacks.push({ handle: handle, callback: cleanup });
        return handle;
    }
    
    function $CancellationUnregister(data, handle) {
        if (data.cleanupCallbacks) {
            var index = 0;
            for (var i = 0, n = data.cleanupCallbacks.length; i < n; i++) {
                var node = data.cleanupCallbacks[i];
                if (is(node.handle, handle)) {
                    data.cleanupCallbacks.splice(i, 1);
                    return;
                }
            }
        }
    }
    
    function $CancellationLink(data, token) {
        if (data.links == null) {
            data.links = [];
        }
    
        var handle = token.register(function () {
            $CancellationCancel(data);
        });
    
        data.links.push({ handle: handle, callback: function () {
                $CancellationUnregister(data, handle);
            } });
    }
    
    function $CancellationCancel(data) {
        if (data.canceled) {
            return;
        }
    
        data.canceled = true;
    
        var errors;
        data.cleanupCallbacks.forEach(function (value) {
            try  {
                value.callback.call(null);
            } catch (e) {
                if (errors == null) {
                    errors = [];
                }
    
                errors.push(e);
            }
        });
    
        data.cleanupCallbacks = null;
    
        if (errors) {
            throw new AggregateError(null, errors);
        }
    }
    
    function $CancellationCancelAfter(data, delay) {
        if (data.canceled) {
            return;
        }
    
        if (data.cancelHandle) {
            clearTimeout(data.cancelHandle);
            data.cancelHandle = null;
        }
    
        data.cancelHandle = setTimeout(function () {
            $CancellationCancel(data);
        }, delay);
    }
    
    function $CancellationClose(data) {
        data.closed = true;
    
        var links = data.links;
        data.links = null;
    
        links.forEach(function (node) {
            node.callback.call(null);
        });
    }
    
    var AggregateError = (function () {
        function AggregateError(message, errors) {
            if (typeof message === "undefined") { message = "One or more errors occurred"; }
            if (typeof errors === "undefined") { errors = []; }
            this.message = message;
            this.errors = errors;
            this.name = "AggregateError";
        }
        return AggregateError;
    })();
    exports.AggregateError = AggregateError;
    
    AggregateError.prototype = Object.create(Error.prototype);
    
    var CanceledError = (function () {
        function CanceledError(message) {
            if (typeof message === "undefined") { message = "The operation was canceled"; }
            this.message = message;
            this.name = "CanceledError";
        }
        return CanceledError;
    })();
    exports.CanceledError = CanceledError;
    
    CanceledError.prototype = Object.create(Error.prototype);
    
    var MAX_HANDLE = 2147483647;
    var nextCancellationHandle = 1;
    
    function is(x, y) {
        return (x === y) ? (x !== 0 || 1 / x === 1 / y) : (x !== x && y !== y);
    }
}, this);