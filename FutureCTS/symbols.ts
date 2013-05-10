/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
/** A pseudo-private Symbol object.
  * The name of the symbol can still be reflected via Object.getOwnPropertyNames.
  */
export class Symbol {
    
    /**
     * The internal name of the symbol     
     */
    private _name: string;
    
    /** Creates a new pseudo-private-symbol object.
      * @constructor
      * @param [name] An optional predefined symbol string. This can be used to create symbols that are portable between realms (e.g. IFrames).
      */
    constructor(name?: string) {
        var _name: string;
        if (name) {
            _name = "@Symbol@" + name;
        }
        else {
            _name = "@Symbol@" + Math.random().toString(16).slice(2);
        }
        
        Object.defineProperty(this, "_name", { value: _name });
        Object.freeze(this);
    }
    
    /** Gets the value of the symbol on the object.
      * @param obj The object from which to read the symbol value.
      * @returns The value of the symbol on the object.
      */
    get(obj: any): any {
        if (Object(obj) != obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        if (this._name in obj) {
            return obj[this._name];
        }
    }

    /** Sets the value of the symbol on the object.
      * @param obj The object to which to write the symbol value.
      * @param value The value for the symbol.
      */
    set(obj: any, value: any): void {
        if (Object(obj) !== obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        var desc = Object.getOwnPropertyDescriptor(obj, this._name);
        if (desc == null) {
            desc = { writable: true, value: value };
            Object.defineProperty(obj, this._name, desc);
        }
        else {
            obj[this._name] = value;
        }
    }
    
    /** Gets a value indicating whether the symbol has been defined for the object.
      * @param obj The object to test for presence of the symbol.
      * @returns True if the symbol is defined; otherwise, false.
      */
    has(obj: any): bool {
        if (Object(obj) !== obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        return this._name in obj;
    }

    /** toString is not supported by Symbol
      */
    toString(): string {
        throw new TypeError("Not supported");
    }

    /** valueOf is not supported by Symbol
      */
    valueOf(): string {
        throw new TypeError("Not supported");
    }
}

/** A unique pseudo-symbol used to brand an object
  */
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

// export the symbol (fixes issue in TypeScript 0.9.0-alpha)
export var brand = brand;

/** Determines whether an object has the specified branding
  * @param obj The object to test
  * @param name The brand to test
  * @returns True if the object or one if its prototypes has the specified brand; otherwise, false
  */
export function hasBrand(obj: any, name: string) : bool;

/** Determines whether an object has the specified branding
  * @param obj The object to test
  * @param name The brand to test
  * @returns True if the object or one if its prototypes has the specified brand; otherwise, false
  */
export function hasBrand(obj: any, name: any) : bool;

/** Determines whether an object has the specified branding
  * @param obj The object to test
  * @param name The brand to test
  * @returns True if the object or one if its prototypes has the specified brand; otherwise, false
  */
export function hasBrand(obj: any, name: any) : bool {
    
    if (typeof name === "function") {
        var func = <Function>name;
        name = brand.get(func.prototype);
    }

    if (typeof name !== "string") {
        throw new TypeError("invalid argument: name");
    }

    if (typeof obj === "undefined") return false;
    if (typeof obj === "string" && name === "String") return true;
    if (typeof obj === "number" && name === "Number") return true;
    if (typeof obj === "boolean" && name === "Boolean") return true;
    
    while ((Object(obj) === obj) && brand.has(obj)) {
        if (brand.get(obj) === name) {
            return true;
        }

        obj = Object.getPrototypeOf(obj);
    }

    return false;
}

// use default branding for Object#toString;
var _toString = Object.prototype.toString;

Object.defineProperty(Object.prototype, "toString", { 
    writable: true,
    configurable: true, 
    value: function () {
        if (brand.has(this)) {
            var name = brand.get(this);
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