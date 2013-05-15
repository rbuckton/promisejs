/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

/** A pseudo-private Symbol object.
  * The name of the symbol can still be reflected via Object.getOwnPropertyNames.
  */
export class Symbol<TValue> {
    
    /**
     * The internal name of the symbol     
     */
    public name: string;
    
    /** Creates a new pseudo-private-symbol object.
      * @constructor
      * @param [name] An optional predefined symbol string. This can be used to create symbols that are portable between realms (e.g. IFrames).
      */
    constructor(name?: string) {
        if (name) {
            name = String(name);
            var id: number = 0;
            for (var i = 0, l = name.length; i < l; i++) {
                id = (((id << 5) + id) + name.charCodeAt(i));
            }            
            name = "<" + (id & 0x7fffffff).toString(36) + ">" + name;
        }
        else {
            name = Math.random().toString(16).slice(2);
        }
        
        Object.defineProperty(this, "name", { value: "@Symbol@" + name });
        Object.freeze(this);
    }
    
    /** Gets the value of the symbol on the object.
      * @param obj The object from which to read the symbol value.
      * @returns The value of the symbol on the object.
      */
    public get(obj: any): TValue {
        if (Object(obj) != obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        if (this.name in obj) {
            return obj[this.name];
        }
    }

    /** Sets the value of the symbol on the object.
      * @param obj The object to which to write the symbol value.
      * @param value The value for the symbol.
      */
    public set(obj: any, value: TValue): void {
        if (Object(obj) !== obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        var desc = Object.getOwnPropertyDescriptor(obj, this.name);
        if (desc == null) {
            desc = { writable: true, value: value };
            Object.defineProperty(obj, this.name, desc);
        }
        else {
            obj[this.name] = value;
        }
    }
    
    /** Gets a value indicating whether the symbol has been defined for the object.
      * @param obj The object to test for presence of the symbol.
      * @returns True if the symbol is defined; otherwise, false.
      */
    public has(obj: any): boolean {
        if (Object(obj) !== obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        return this.name in obj;
    }

    /** toString is not supported by Symbol
      */
    private toString(): string {
        throw new TypeError("Not supported");
    }

    /** valueOf is not supported by Symbol
      */
    private valueOf(): string {
        throw new TypeError("Not supported");
    }
}

/** A unique pseudo-symbol used to brand an object
  */
var BrandSym = new Symbol("Brand");

/**
 * Decorator for a class that sets the class brand and pseudo @@toStringTag
 * @param  {String} name The name for the brand
 * @returns {Function} The decorator to apply to the class
 */
export function brand(name: string): (target: Function) => Function {
    return target => {
        BrandSym.set(target.prototype, name);
        return target;
    }
}

/** 
 * Determines whether an object has the specified branding
 * @param obj The object to test
 * @param name The brand to test
 * @returns True if the object or one if its prototypes has the specified brand; otherwise, false
 */
export function hasBrand(obj: any, name: string) : boolean;

/** 
 * Determines whether an object has the specified branding
 * @param obj The object to test
 * @param name The brand to test
 * @returns True if the object or one if its prototypes has the specified brand; otherwise, false
 */
export function hasBrand(obj: any, name: any) : boolean;

/** 
 * Determines whether an object has the specified branding
 * @param obj The object to test
 * @param name The brand to test
 * @returns True if the object or one if its prototypes has the specified brand; otherwise, false
 */
export function hasBrand(obj: any, name: any) : boolean {
    
    if (typeof name === "function") {
        var func = <Function>name;
        name = BrandSym.get(func.prototype);
    }

    if (typeof name !== "string") {
        throw new TypeError("invalid argument: name");
    }

    if (typeof obj === "undefined") return false;
    if (typeof obj === "string" && name === "String") return true;
    if (typeof obj === "number" && name === "Number") return true;
    if (typeof obj === "boolean" && name === "Boolean") return true;
    
    while ((Object(obj) === obj) && BrandSym.has(obj)) {
        if (BrandSym.get(obj) === name) {
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

// set up default brands
brand("Object")(Object);
brand("Function")(Function);
brand("Number")(Number);
brand("Boolean")(Boolean);
brand("String")(String);
brand("Array")(Array);
brand("RegExp")(RegExp);
brand("Date")(Date);
brand("Error")(Error);