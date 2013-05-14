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
            if (name) {
                name = String(name);
                var id = 0;
                for (var i = 0, l = name.length; i < l; i++) {
                    id = (((id << 5) + id) + name.charCodeAt(i));
                }
                name = "<" + (id & 0x7fffffff).toString(36) + ">" + name;
            } else {
                name = Math.random().toString(16).slice(2);
            }
    
            Object.defineProperty(this, "name", { value: "@Symbol@" + name });
            Object.freeze(this);
        }
        Symbol.prototype.get = function (obj) {
            if (Object(obj) != obj) {
                throw new TypeError("Invalid argument: obj");
            }
    
            if (this.name in obj) {
                return obj[this.name];
            }
        };
    
        Symbol.prototype.set = function (obj, value) {
            if (Object(obj) !== obj) {
                throw new TypeError("Invalid argument: obj");
            }
    
            var desc = Object.getOwnPropertyDescriptor(obj, this.name);
            if (desc == null) {
                desc = { writable: true, value: value };
                Object.defineProperty(obj, this.name, desc);
            } else {
                obj[this.name] = value;
            }
        };
    
        Symbol.prototype.has = function (obj) {
            if (Object(obj) !== obj) {
                throw new TypeError("Invalid argument: obj");
            }
    
            return this.name in obj;
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
    
    var BrandSym = new Symbol("Brand");
    
    function brand(name) {
        return function (target) {
            BrandSym.set(target.prototype, name);
            return target;
        };
    }
    exports.brand = brand;
    
    function hasBrand(obj, name) {
        if (typeof name === "function") {
            var func = name;
            name = BrandSym.get(func.prototype);
        }
    
        if (typeof name !== "string") {
            throw new TypeError("invalid argument: name");
        }
    
        if (typeof obj === "undefined")
            return false;
        if (typeof obj === "string" && name === "String")
            return true;
        if (typeof obj === "number" && name === "Number")
            return true;
        if (typeof obj === "boolean" && name === "Boolean")
            return true;
    
        while ((Object(obj) === obj) && BrandSym.has(obj)) {
            if (BrandSym.get(obj) === name) {
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
            if (BrandSym.has(this)) {
                var name = BrandSym.get(this);
                switch (name) {
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
    
    exports.brand("Object")(Object);
    exports.brand("Function")(Function);
    exports.brand("Number")(Number);
    exports.brand("Boolean")(Boolean);
    exports.brand("String")(String);
    exports.brand("Array")(Array);
    exports.brand("RegExp")(RegExp);
    exports.brand("Date")(Date);
    exports.brand("Error")(Error);
}, this);