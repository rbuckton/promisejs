/** A pseudo-private Symbol object.
  */
export class Symbol {
    private _key: string;
    
    /** Creates a new pseudo-private-symbol object.
      * @constructor
      * @param {String} [predefined] An optional predefined symbol string. This can be used to create symbols that are portable between realms (e.g. IFrames).
      */
    constructor(name?: string) {
        if (name) {
            this._key = "@Symbol@" + name;
        }
        else {
            this._key = "@Symbol@" + Math.random().toString(16).slice(2);
        }
        
        Object.defineProperty(this, "_key", { enumerable: false });
        Object.freeze(this);
    }
    
    /** Gets the value of the symbol on the object.
      * @param {Object} obj The object from which to read the symbol value.
      * @returns The value of the symbol on the object.
      */
    get(obj: any): any {
        if (Object(obj) != obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        if (this._key in obj) {
            return obj[this._key];
        }
    }

    /** Sets the value of the symbol on the object.
      * @param {Object} obj The object to which to write the symbol value.
      * @param value The value to set.
      */
    set(obj: any, value: any): void {
        if (Object(obj) !== obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        var desc = Object.getOwnPropertyDescriptor(obj, this._key);
        if (desc == null) {
            desc = { writable: true, value: value };
            Object.defineProperty(obj, this._key, desc);
        }
        else {
            obj[this._key] = value;
        }
    }
    
    /** Gets a value indicating whether the symbol has been defined for the object.
      * @param {Object} obj The object to test for presence of the symbol.
      * @returns {Boolean} True if the symbol is defined; otherwise, false.
      */
    has(obj: any): bool {
        if (Object(obj) !== obj) {
            throw new TypeError("Invalid argument: obj");
        }
        
        return this._key in obj;
    }
}