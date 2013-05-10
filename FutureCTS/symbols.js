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
            }, global["symbols"] = { });
    }
})
(function (require, exports) {
    var Symbol = (function () {
        function Symbol(name) {
            var _name;
            if (name) {
                _name = "@Symbol@" + name;
            } else {
                _name = "@Symbol@" + Math.random().toString(16).slice(2);
            }
            Object.defineProperty(this, "_name", {
                value: _name
            });
            Object.freeze(this);
        }
        Symbol.prototype.get = function (obj) {
            if (Object(obj) != obj) {
                throw new TypeError("Invalid argument: obj");
            }
            if (this._name in obj) {
                return obj[this._name];
            }
        };
        Symbol.prototype.set = function (obj, value) {
            if (Object(obj) !== obj) {
                throw new TypeError("Invalid argument: obj");
            }
            var desc = Object.getOwnPropertyDescriptor(obj, this._name);
            if (desc == null) {
                desc = {
                    writable: true,
                    value: value
                };
                Object.defineProperty(obj, this._name, desc);
            } else {
                obj[this._name] = value;
            }
        };
        Symbol.prototype.has = function (obj) {
            if (Object(obj) !== obj) {
                throw new TypeError("Invalid argument: obj");
            }
            return this._name in obj;
        };
        Symbol.prototype.toString = function () {
            throw new TypeError("Not supported");
        };
        Symbol.prototype.valueOf = function () {
            throw new TypeError("Not supported");
        };
        return Symbol;
    })();
    exports.Symbol = Symbol;
    var brand = new Symbol("Brand");
    brand.set(Object.prototype, "Object");
    brand.set(Function.prototype, "Function");
    brand.set(Number.prototype, "Number");
    brand.set(Boolean.prototype, "Boolean");
    brand.set(String.prototype, "String");
    brand.set(Array.prototype, "Array");
    brand.set(RegExp.prototype, "RegExp");
    brand.set(Date.prototype, "Date");
    brand.set(Error.prototype, "Error");
    exports.brand = brand;
    function hasBrand(obj, name) {
        if (typeof name === "function") {
            var func = name;
            name = brand.get(func.prototype);
        }
        if (typeof name !== "string") {
            throw new TypeError("invalid argument: name");
        }
        if (typeof obj === "undefined") {
            return false;
        }
        if (typeof obj === "string" && name === "String") {
            return true;
        }
        if (typeof obj === "number" && name === "Number") {
            return true;
        }
        if (typeof obj === "boolean" && name === "Boolean") {
            return true;
        }
        while((Object(obj) === obj) && brand.has(obj)) {
            if (brand.get(obj) === name) {
                return true;
            }
            obj = Object.getPrototypeOf(obj);
        }
        return false;
    }
    exports.hasBrand = hasBrand;
    var _toString = Object.prototype.toString;
    Object.defineProperty(Object.prototype, "toString", {
        writable: true,
        configurable: true,
        value: function () {
            if (brand.has(this)) {
                var name = brand.get(this);
                switch(name) {
                    case "object":
                    case "function":
                    case "number":
                    case "boolean":
                    case "string":
                    case "Array":
                    case "RegExp":
                    case "Date":
                    case "Error":
                        return _toString.apply(this, arguments);
                }
                return "[object " + name + "]";
            }
            return _toString.apply(this, arguments);
        }
    });
}, this);