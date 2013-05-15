/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import symbols = module("symbols");


/** 
 * Describes a linked-list node
 */
export class LinkedListNode<T> {
    /** 
     * The value for the node
     */
    public value: T;

    /** 
     * Describes a linked-list node
     * @param value {T} The value for the node
     */
    constructor(value?: T) {
        this.value = value;
        NextSym.set(this, null);
        PrevSym.set(this, null);
        ListSym.set(this, null);
    }

    /** 
     * The next node in the list
     */
    public get next(): LinkedListNode<T> {
        return NextSym.get(this);
    }

    /** 
     * The previous node in the list
     */
    public get prev(): LinkedListNode<T> {
        return PrevSym.get(this);
    }

    /**
     * The list to which this node belongs
     */
    public get list(): LinkedList<T> {
        return ListSym.get(this);
    }
}
symbols.brand("LinkedListNode")(LinkedListNode);

/** 
 * A linked-list
 */
export class LinkedList<T> {

    /** 
     * A linked-list
     */
    constructor() {
        SizeSym.set(this, 0);
        HeadSym.set(this, null);
    }

    public get size(): number {
        return SizeSym.get(this);
    }
    
    /** 
     * Gets or sets the head of the list
     */
    public get head(): LinkedListNode<T> {
        return HeadSym.get(this);
    }

    /** 
     * Gets the tail of the list
     */
    public get tail(): LinkedListNode<T> {
        if (this.head) {
            return this.head.prev;
        }

        return null;
    }

    /**
     * Adds a value to the beginning of the list
     * @param value {T} The value to add
     * @returns {LinkedListNode<T>} The node for the added value
     */
    public unshift(value: T): LinkedListNode<T> {
        var node = new LinkedListNode<T>(value);
        this.unshiftNode(node);
        return node;
    }

    /**
     * Adds a value to the beginning of the list
     * @param node {LinkedListNode<T>} The value to add
     */
    public unshiftNode(node: LinkedListNode<T>): void {
        if (!symbols.hasBrand(node, LinkedListNode)) throw new Error("Invalid argument: node");
        if (ListSym.get(node) != null) throw new Error("Invalid argument: node");
        if (this.head) {
            this.insertNodeBefore(this.head, node);
        }
        else {
            ListSym.set(node, this);
            NextSym.set(node, node);
            PrevSym.set(node, node);
            HeadSym.set(this, node);
            SizeSym.set(this, 1);
        }        
    }

    /**
     * Removes a value from the beginning of the list
     * @returns {T} The value from the beginning of the list, or undefined if the list is empty
     */
    public shift(): T {
        var node = this.head;
        if (node) {
            this.deleteNode(node);
            return node.value;
        }
    }

    /**
     * Adds a value to the end of the list
     * @param value {T} The value to add
     * @returns {LinkedListNode<T>} The node for the added value
     */
    public push(value: T): LinkedListNode<T> {
        var node = new LinkedListNode<T>(value);
        this.pushNode(node);
        return node;
    }

    /**
     * Adds a value to the end of the list
     * @param node {LinkedListNode<T>} The value to add
     */
    public pushNode(node: LinkedListNode<T>): void {
        if (!symbols.hasBrand(node, LinkedListNode)) throw new Error("Invalid argument: node");
        if (ListSym.get(node) != null) throw new Error("Invalid argument: node");
        if (this.head) {
            this.insertNodeAfter(this.tail, node);
        }
        else {
            ListSym.set(node, this);
            NextSym.set(node, node);
            PrevSym.set(node, node);
            HeadSym.set(this, node);
            SizeSym.set(this, 1);
        }
    }

    /**
     * Removes a value from the end of the list
     * @returns {T} The value from the end of the list, or undefined if the list is empty
     */
    public pop(): T {
        var node = this.tail;
        if (node) {
            this.deleteNode(node);
            return node.value;
        }
    }

    /**
     * Removes the value from the list
     * @param value {T} The value to remove from the list
     * @returns {Boolean} True if the value was in the list; otherwise, false.
     */
    public delete(value: T): boolean {
        var node = this.match(v => is(v, value));
        if (node) {
            this.deleteNode(node);
            return true;
        }

        return false;
    }

    /**
     * Gets a value indicating whether the provided value is in the list
     * @param value {T} The value to find
     * @returns {Boolean} True if the value was in the list; otherwise, false.
     */
    public has(value: T): boolean {
        return !!this.match(v => is(v, value));
    }

    /**
     * Finds the node for a value in the list
     * @param value {T} The value to find
     * @returns {LinkedListNode<T>} The node for the value if found; otherwise, null.
     */
    public find(value: T): LinkedListNode<T> {
        return this.match(v => is(v, value));
    }

    /**
     * Finds the node for a value in the list, starting from the tail and working backwards
     * @param value {T} The value to find
     * @returns {LinkedListNode<T>} The node for the value if found; otherwise, null.
     */
    public findLast(value: T): LinkedListNode<T> {
        return this.matchLast(v => is(v, value));
    }

    /** 
     * Adds a value before the provided position
     * @param position The position in the list
     * @param value The value to add
     */
    public insertBefore(position: LinkedListNode<T>, value: T): LinkedListNode<T> {
        if (!symbols.hasBrand(position, LinkedListNode)) throw new Error("Invalid argument: position");

        var node = new LinkedListNode<T>(value);
        this.insertNodeBefore(position, node);
        return node;
    }

    /** 
     * Adds a value after the provided position
     * @param position The position in the list
     * @param value The value to add
     */
    public insertAfter(position: LinkedListNode<T>, value: T): LinkedListNode<T> {
        if (!symbols.hasBrand(position, LinkedListNode)) throw new Error("Invalid argument: position");

        var node = new LinkedListNode<T>(value);
        this.insertNodeAfter(position, node);
        return node;
    }

    /** 
     * Adds a node before the provided position
     * @param position The position in the list
     * @param newNode The new node to add
     */
    public insertNodeBefore(position: LinkedListNode<T>, newNode: LinkedListNode<T>): void {
        if (!symbols.hasBrand(position, LinkedListNode)) throw new Error("Invalid argument: position");
        if (!symbols.hasBrand(newNode, LinkedListNode)) throw new Error("Invalid argument: newNode");
        if (ListSym.get(position) !== this) throw new Error("Invalid argument: position");
        if (ListSym.get(newNode) != null) throw new Error("Invalid argument: newNode");

        ListSym.set(newNode, this);
        NextSym.set(newNode, position);
        PrevSym.set(newNode, position.prev);
        NextSym.set(position.prev, newNode);
        PrevSym.set(position, newNode);        
        SizeSym.set(this, this.size + 1);

        if (position === this.head) {
            HeadSym.set(this, newNode);
        }
    }

    /** 
     * Adds a node after the provided position
     * @param position The position in the list
     * @param newNode The new node to add
     */
    public insertNodeAfter(position: LinkedListNode<T>, newNode: LinkedListNode<T>): void {
        if (!symbols.hasBrand(position, LinkedListNode)) throw new Error("Invalid argument: position");
        if (!symbols.hasBrand(newNode, LinkedListNode)) throw new Error("Invalid argument: newNode");
        if (ListSym.get(position) !== this) throw new Error("Invalid argument: position");
        if (ListSym.get(newNode) != null) throw new Error("Invalid argument: newNode");

        ListSym.set(newNode, this);
        PrevSym.set(newNode, position);
        NextSym.set(newNode, position.next);
        PrevSym.set(position.next, newNode);
        NextSym.set(position, newNode);
        SizeSym.set(this, this.size + 1);
    }

    /** 
     * Removes a node from the list
     * @param position The node to remove
     */
    public deleteNode(position: LinkedListNode<T>): void {
        if (!symbols.hasBrand(position, LinkedListNode)) throw new Error("Invalid argument: position");
        if (ListSym.get(position) !== this) throw new Error("Invalid argument: position");
        
        if (position.next === position) {
            HeadSym.set(this, null);
        }
        else {
            PrevSym.set(position.next, position.prev);
            NextSym.set(position.prev, position.next);
            if (this.head === position) {
                HeadSym.set(this, position.next);
            }
        }
        
        ListSym.set(position, null);
        NextSym.set(position, null);
        PrevSym.set(position, null);
        SizeSym.set(this, this.size - 1);
    }

    /** Finds a node in the list
      * @param filter The filter to apply
      * @returns The node if found; otherwise, null
      */
    public match(filter: (value: T) => boolean): LinkedListNode<T>;

    /** Finds a node in the list
      * @param filter The filter to apply
      * @returns The node if found; otherwise, null
      */
    public match(filter: (value: T, list: LinkedList<T>) => boolean): LinkedListNode<T>;

    /** Finds a node in the list
      * @param filter The filter to apply
      * @returns The node if found; otherwise, null
      */
    public match(filter: (...args: any[]) => boolean): LinkedListNode<T> {
        var node = this.head;
        if (node) {
            while (!filter(node.value, this)) {
                node = node.next;
                if (node === this.head || node == null) {
                    return null;
                }
            }

            return node;
        }

        return null;
    }

    /** Finds a node in the list
      * @param filter The filter to apply
      * @returns The node if found; otherwise, null
      */
    public matchLast(filter: (value: T, list?: LinkedList<T>) => boolean): LinkedListNode<T> {
        var node = this.tail;
        if (node) {
            while (!filter(node.value, this)) {
                node = node.prev;
                if (node === this.tail || node == null) {
                    return null;
                }
            }

            return node;
        }

        return null;
    }

    /** Iterates through each node in the list
      * @param callback The callback to execute
      */
    public forEach(callback: (value: T) => void, thisArg?: any): void;

    /** Iterates through each node in the list
      * @param callback The callback to execute
      */
    public forEach(callback: (value: T, list: LinkedList<T>) => void, thisArg?: any): void;

    /** Iterates through each node in the list
      * @param callback The callback to execute
      */
    public forEach(callback: (...args: any[]) => void, thisArg?: any): void {
        var node = this.head;
        if (node) {
            while (true) {
                var next = node.next;
                callback.call(thisArg, node.value, this);
                node = next;
                if (node === this.head) {
                    return;
                }
            }
        }
    }
}

symbols.brand("LinkedList")(LinkedList);

export class Map<TKey, TValue> {
    constructor() {
        var mapData = new MapData<TKey, TValue>();
        MapDataSym.set(this, mapData);
    }

    public get size(): number {
        var mapData: MapData<TKey, TValue> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Map)) throw new TypeError("'this' is not a Map object");

        return mapData.size;
    }

    public get(key: TKey): TValue {
        var mapData: MapData<TKey, TValue> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Map)) throw new TypeError("'this' is not a Map object");

        var node = MapGet(mapData, key);
        if (node) {
            return node.value.value;
        }
    }

    public set(key: TKey, value: TValue): void {
        var mapData: MapData<TKey, TValue> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Map)) throw new TypeError("'this' is not a Map object");

        var node = MapGet(mapData, key);
        if (node) {
            node.value.value = value;
        }
        else {
            node = new LinkedListNode<MapEntry<TKey, TValue>>({ key: key, value: value });
            MapInsert(mapData, node);
        }
    }

    public has(key: TKey): boolean {
        var mapData: MapData<TKey, TValue> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Map)) throw new TypeError("'this' is not a Map object");

        var node = MapGet(mapData, key);
        if (node) {
            return true;
        }

        return false;
    }

    public delete(key: TKey): boolean {
        var mapData: MapData<TKey, TValue> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Map)) throw new TypeError("'this' is not a Map object");

        var node = MapGet(mapData, key);
        if (node) {
            MapRemove(mapData, node);
            return true;
        }

        return false;
    }

    public clear(): void {
        var mapData: MapData<TKey, TValue> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Map)) throw new TypeError("'this' is not a Map object");

        mapData.stringTable = null;
        mapData.entries = null;
        mapData.size = 0;
    }

    public forEach(callback: (value: TValue) => void, thisArg?: any): void;
    public forEach(callback: (value: TValue, key: TKey) => void, thisArg?: any): void;
    public forEach(callback: (value: TValue, key: TKey, map: Map<TKey, TValue>) => void, thisArg?: any): void;
    public forEach(callback: (...args: any[]) => void, thisArg?: any): void {
        var mapData: MapData<TKey, TValue> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Map)) throw new TypeError("'this' is not a Map object");

        if (mapData.entries) {
            mapData.entries.forEach((value: MapEntry<TKey, TValue>) => {
                callback.call(thisArg, value.value, value.key, this);
            });
        }
    }
}

symbols.brand("Map")(Map);

export class Set<TValue> {
    constructor() {
        var mapData = new MapData<TValue, void>();
        MapDataSym.set(this, mapData);
    }

    public get size(): number {
        var mapData: MapData<TValue, void> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Set)) throw new TypeError("'this' is not a Set object");

        return mapData.size;
    }

    public add(key: TValue): boolean {
        var mapData: MapData<TValue, void> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Set)) throw new TypeError("'this' is not a Set object");

        var node = MapGet(mapData, key);
        if (node) {
            return false;
        }
        else {
            node = new LinkedListNode<MapEntry<TValue, void>>({ key: key, value: void 0 });
            MapInsert(mapData, node);
            return true;
        }
    }

    public has(key: TValue): boolean {
        var mapData: MapData<TValue, void> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Set)) throw new TypeError("'this' is not a Set object");

        var node = MapGet(mapData, key);
        if (node) {
            return true;
        }

        return false;
    }

    public delete(key: TValue): boolean {
        var mapData: MapData<TValue, void> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Set)) throw new TypeError("'this' is not a Set object");

        var node = MapGet(mapData, key);
        if (node) {
            MapRemove(mapData, node);
            return true;
        }

        return false;
    }

    public clear(): void {
        var mapData: MapData<TValue, void> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Set)) throw new TypeError("'this' is not a Set object");

        mapData.stringTable = null;
        mapData.entries = null;
        mapData.size = 0;
    }

    public forEach(callback: (value?: TValue, set?: Set<TValue>) => void, thisArg?: any): void {
        var mapData: MapData<TValue, void> = MapDataSym.get(this);
        if (!mapData || !symbols.hasBrand(this, Set)) throw new TypeError("'this' is not a Set object");

        if (mapData.entries) {
            mapData.entries.forEach((value: MapEntry<TValue, void>) => {
                callback.call(thisArg, value.key, this);
            });
        }
    }
}

symbols.brand("Set")(Set);

interface MapEntry<TKey, TValue> {
    key: TKey;
    value: TValue;
}

class MapData<TKey, TValue> {
    public size: number = 0;
    public stringTable: { [key: string]: LinkedList<LinkedListNode<MapEntry<TKey, TValue>>>; };
    public entries: LinkedList<MapEntry<TKey, TValue>>;
}

var HeadSym = new symbols.Symbol("lists.Head");
var SizeSym = new symbols.Symbol<number>("lists.Size");
var ListSym = new symbols.Symbol("lists.List");
var NextSym = new symbols.Symbol("lists.Next");
var PrevSym = new symbols.Symbol("lists.Prev");
var MapDataSym = new symbols.Symbol("lists.MapData");
var TrueKey = new symbols.Symbol("lists.TrueKey").name;
var FalseKey = new symbols.Symbol("lists.FalseKey").name;
var NullKey = new symbols.Symbol("lists.NullKey").name;
var UndefinedKey = new symbols.Symbol("lists.UndefinedKey").name;
var ProtoKey = new symbols.Symbol("lists.ProtoKey").name;
var NumberKey = new symbols.Symbol("lists.NumberKey").name;

function MapGet<TKey, TValue>(mapData: MapData<TKey, TValue>, key: TKey): LinkedListNode<MapEntry<TKey, TValue>> {
    var normalkey = ToKey(key);
    if (typeof normalkey === "string") {
        if (mapData.stringTable && mapData.stringTable.hasOwnProperty(normalkey)) {
            var list = mapData.stringTable[normalkey];
            if (list) {
                var stringNode = list.match(node => is(node.value.key, key));
                if (stringNode) {
                    return stringNode.value;
                }
            }
        }
    }
    else {
        if (mapData.entries) {
            var node = mapData.entries.match((entry: MapEntry<TKey, TValue>) => is(entry.key, key));
            if (node) {
                return node;
            }
        }
    }
}

function MapInsert<TKey, TValue>(mapData: MapData<TKey, TValue>, node: LinkedListNode<MapEntry<TKey, TValue>>): void {
    if (!mapData.entries) {
        mapData.entries = new LinkedList<MapEntry<TKey, TValue>>();
    }

    mapData.entries.pushNode(node);
    mapData.size++;

    var normalkey = ToKey(node.value.key);

    if (typeof normalkey === "string") {
        if (!mapData.stringTable) {
            mapData.stringTable = {};
        }

        var list = mapData.stringTable.hasOwnProperty(normalkey) ? mapData.stringTable[normalkey] : null;
        if (!list) {
            var list = new LinkedList<LinkedListNode<MapEntry<TKey, TValue>>>();
            mapData.stringTable[normalkey] = list;
        }

        list.push(node);
    }
}

function MapRemove<TKey, TValue>(mapData: MapData<TKey, TValue>, node: LinkedListNode<MapEntry<TKey, TValue>>): void {
    mapData.entries.deleteNode(node);
    mapData.size--;
    
    var normalkey = ToKey(node.value.key);
    if (typeof normalkey === "string") {
        if (mapData.stringTable) {
            var list = mapData.stringTable.hasOwnProperty(normalkey) ? mapData.stringTable[normalkey] : null;
            if (list) {
                list.delete(node);
            }
            
            if (!list.size) {
                delete mapData.stringTable[normalkey];
            }
        }
    }
}

function ToKey(key: any): any {
    if (key === null) return NullKey;
    if (key === true) return TrueKey;
    if (key === false) return FalseKey;
    if (key == null) return UndefinedKey;
    if (key === "__proto__") return ProtoKey;
    if (typeof key === "number") return NumberKey + key.toString();
    return key;
}

/**
 * is operator (from ES6) which has stricter equality semantics than "==" or "==="
 * @param x A value to test
 * @param y A value to test
 */
export function is(x, y): boolean {
    return (x === y) ? (x !== 0 || 1 / x === 1 / y) : (x !== x && y !== y);
}
