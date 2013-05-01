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
            }, global["Future2/symbols"] = { });
    }
})
(function (require, exports) {
    var Symbol = (function () {
        function Symbol(name) {
            if(name) {
                this._key = "@Symbol@" + name;
            } else {
                this._key = "@Symbol@" + Math.random().toString(16).slice(2);
            }
            Object.defineProperty(this, "_key", {
                enumerable: false
            });
            Object.freeze(this);
        }
        Symbol.prototype.get = function (obj) {
            if(Object(obj) != obj) {
                throw new TypeError("Invalid argument: obj");
            }
            if(this._key in obj) {
                return obj[this._key];
            }
        };
        Symbol.prototype.set = function (obj, value) {
            if(Object(obj) !== obj) {
                throw new TypeError("Invalid argument: obj");
            }
            var desc = Object.getOwnPropertyDescriptor(obj, this._key);
            if(desc == null) {
                desc = {
                    writable: true,
                    value: value
                };
                Object.defineProperty(obj, this._key, desc);
            } else {
                obj[this._key] = value;
            }
        };
        Symbol.prototype.has = function (obj) {
            if(Object(obj) !== obj) {
                throw new TypeError("Invalid argument: obj");
            }
            return this._key in obj;
        };
        return Symbol;
    })();
    exports.Symbol = Symbol;
}, this);