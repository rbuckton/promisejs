/*! 
* This source is subject to the Microsoft Public License.
* See http://www.microsoft.com/opensource/licenses.mspx#Ms-PL.
* All other rights reserved.
* ----------------------------------------------------------------------
* Version: 1.0.0.0
* Author: Ron Buckton (rbuckton@chronicles.org)
* ----------------------------------------------------------------------
*/
(function (definition) {
    if (typeof Symbol === "undefined") {
        definition(window);
    }
})
(function (window, undefined) {

    var _es5 = typeof Function.prototype.bind === "function" &&
               typeof Object.create === "function" &&
               typeof Object.defineProperty === "function",
        _create = _es5 ? Object.create : function(_) { 
            return function(proto) {
                try {
                    _.prototype = proto;
                    return new _();
                }
                finally {
                    _.prototype = null;
                }
            }
        }(function() {});

    var Symbol = function() {    
        
        /** Creates a new pseudo-private-symbol object.
          * @constructor
          * @param {String} [predefined] An optional predefined symbol string. This can be used to create symbols that are portable between realms (e.g. IFrames).
          */
        function Symbol(predefined) { 
            var sym = _create(Symbol.prototype);
            sym.key = "@@Symbol@" + (predefined == null ? Math.random().toString(36).slice(2) : predefined); 
            if (_es5) {
                Object.defineProperty(sym, "key", { enumerable: false, configurable: false, writable: false });
                Object.freeze(this);
            }
            return sym;
        }
        
        if (_es5) {
            /** Gets the value of the symbol on the object.
              * @param {Object} obj The object from which to read the symbol value.
              * @returns The value of the symbol on the object.
              */
            Symbol.prototype.get = function (obj) { 
                if (Object(obj) !== obj) throw new TypeError("Invalid argument: obj");

                var desc = Object.getOwnPropertyDescriptor(obj, this.key);
                if (desc != null) {
                    return desc.value;
                }
            }

            /** Sets the value of the symbol on the object.
              * @param {Object} obj The object to which to write the symbol value.
              * @param value The value to set.
              */
            Symbol.prototype.set = function (obj, value) { 
                if (Object(obj) !== obj) throw new TypeError("Invalid argument: obj");

                var desc = Object.getOwnPropertyDescriptor(obj, this.key);
                if (desc == null) {
                    desc = { writable: true, value: value };
                    Object.defineProperty(obj, this.key, desc);
                }
                else {
                    obj[this.key] = value;
                }
            }

            /** Gets a value indicating whether the symbol has been defined for the object.
              * @param {Object} obj The object to test for presence of the symbol.
              * @returns {Boolean} True if the symbol is defined; otherwise, false.
              */
            Symbol.prototype.has = function (obj) { 
                if (Object(obj) !== obj) throw new TypeError("Invalid argument: obj");

                return !!Object.getOwnPropertyDescriptor(obj, this.key);
            }
        } 
        else {
            /** Gets the value of the symbol on the object
              * @param obj {Object} The object from which to read the symbol value
              * @returns The value of the symbol on the object
              */
            Symbol.prototype.get = function (obj) {
                if (Object(obj) !== obj) throw new TypeError("Invalid argument: obj");
                
                var symbolValue = obj.valueOf(this.key);
                if (symbolValue) {
                    return symbolValue.value;
                }
            }

            /** Sets the value of the symbol on the object.
              * @param {Object} obj The object to which to write the symbol value.
              * @param value The value to set.
              */
            Symbol.prototype.set = function (obj, value) {
                if (Object(obj) !== obj) throw new TypeError("Invalid argument: obj");
            
                var symbolValue = obj.valueOf(this.key);
                if (!symbolValue) {
                    obj.valueOf = addSymbolReader(this.key, obj.valueOf);
                    symbolValue = obj.valueOf(this.key);
                }
                
                symbolValue.value = value;
            }

            /** Gets a value indicating whether the symbol has been defined for the object.
              * @param {Object} obj The object to test for presence of the symbol.
              * @returns {Boolean} True if the symbol is defined; otherwise, false.
              */
            Symbol.prototype.has = function (obj) {
                if (Object(obj) !== obj) throw new TypeError("Invalid argument: obj");
                
                var symbolValue = obj.valueOf(this.key);
                if (symbolValue) {
                    return true;
                }
                
                return false;
            }
        }
        Symbol.prototype.toString = function () { throw new TypeError(); }
        Symbol.prototype.valueOf = function () { throw new TypeError(); }
        
        // private storage reader for pre-ES5 engines
        // uses variables in the function scope to protect against unwanted readers.
        function addSymbolReader(sym, valueOf) {
            var value = { };
            return function(key) {
                if (key === sym) {
                    return value;
                }
                return valueOf.apply(this, arguments);
            }
        }

        return Symbol;
    }();

    window.Symbol = Symbol;
})