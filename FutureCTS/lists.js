/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
(function (definition, global) {
    if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./symbols"], definition);
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
            }, global["lists"] = { });
    }
})
(function (require, exports) {
    var symbols = require("./symbols");
    
    var LinkedListNode = (function () {
        function LinkedListNode(value) {
            this.value = value;
            NextSym.set(this, null);
            PrevSym.set(this, null);
            ListSym.set(this, null);
        }
        Object.defineProperty(LinkedListNode.prototype, "next", {
            get: function () {
                return NextSym.get(this);
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(LinkedListNode.prototype, "prev", {
            get: function () {
                return PrevSym.get(this);
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(LinkedListNode.prototype, "list", {
            get: function () {
                return ListSym.get(this);
            },
            enumerable: true,
            configurable: true
        });
        return LinkedListNode;
    })();
    exports.LinkedListNode = LinkedListNode;
    symbols.brand("LinkedListNode")(LinkedListNode);
    
    var LinkedList = (function () {
        function LinkedList() {
            SizeSym.set(this, 0);
            HeadSym.set(this, null);
        }
        Object.defineProperty(LinkedList.prototype, "size", {
            get: function () {
                return SizeSym.get(this);
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(LinkedList.prototype, "head", {
            get: function () {
                return HeadSym.get(this);
            },
            enumerable: true,
            configurable: true
        });
    
        Object.defineProperty(LinkedList.prototype, "tail", {
            get: function () {
                if (this.head) {
                    return this.head.prev;
                }
    
                return null;
            },
            enumerable: true,
            configurable: true
        });
    
        LinkedList.prototype.unshift = function (value) {
            var node = new LinkedListNode(value);
            this.unshiftNode(node);
            return node;
        };
    
        LinkedList.prototype.unshiftNode = function (node) {
            if (!symbols.hasBrand(node, LinkedListNode))
                throw new Error("Invalid argument: node");
            if (ListSym.get(node) != null)
                throw new Error("Invalid argument: node");
            if (this.head) {
                this.insertNodeBefore(this.head, node);
            } else {
                ListSym.set(node, this);
                NextSym.set(node, node);
                PrevSym.set(node, node);
                HeadSym.set(this, node);
                SizeSym.set(this, 1);
            }
        };
    
        LinkedList.prototype.shift = function () {
            var node = this.head;
            if (node) {
                this.deleteNode(node);
                return node.value;
            }
        };
    
        LinkedList.prototype.push = function (value) {
            var node = new LinkedListNode(value);
            this.pushNode(node);
            return node;
        };
    
        LinkedList.prototype.pushNode = function (node) {
            if (!symbols.hasBrand(node, LinkedListNode))
                throw new Error("Invalid argument: node");
            if (ListSym.get(node) != null)
                throw new Error("Invalid argument: node");
            if (this.head) {
                this.insertNodeAfter(this.tail, node);
            } else {
                ListSym.set(node, this);
                NextSym.set(node, node);
                PrevSym.set(node, node);
                HeadSym.set(this, node);
                SizeSym.set(this, 1);
            }
        };
    
        LinkedList.prototype.pop = function () {
            var node = this.tail;
            if (node) {
                this.deleteNode(node);
                return node.value;
            }
        };
    
        LinkedList.prototype.delete = function (value) {
            var node = this.match(function (v) {
                return exports.is(v, value);
            });
            if (node) {
                this.deleteNode(node);
                return true;
            }
    
            return false;
        };
    
        LinkedList.prototype.has = function (value) {
            return !!this.match(function (v) {
                return exports.is(v, value);
            });
        };
    
        LinkedList.prototype.find = function (value) {
            return this.match(function (v) {
                return exports.is(v, value);
            });
        };
    
        LinkedList.prototype.findLast = function (value) {
            return this.matchLast(function (v) {
                return exports.is(v, value);
            });
        };
    
        LinkedList.prototype.insertBefore = function (position, value) {
            if (!symbols.hasBrand(position, LinkedListNode))
                throw new Error("Invalid argument: position");
    
            var node = new LinkedListNode(value);
            this.insertNodeBefore(position, node);
            return node;
        };
    
        LinkedList.prototype.insertAfter = function (position, value) {
            if (!symbols.hasBrand(position, LinkedListNode))
                throw new Error("Invalid argument: position");
    
            var node = new LinkedListNode(value);
            this.insertNodeAfter(position, node);
            return node;
        };
    
        LinkedList.prototype.insertNodeBefore = function (position, newNode) {
            if (!symbols.hasBrand(position, LinkedListNode))
                throw new Error("Invalid argument: position");
            if (!symbols.hasBrand(newNode, LinkedListNode))
                throw new Error("Invalid argument: newNode");
            if (ListSym.get(position) !== this)
                throw new Error("Invalid argument: position");
            if (ListSym.get(newNode) != null)
                throw new Error("Invalid argument: newNode");
    
            ListSym.set(newNode, this);
            NextSym.set(newNode, position);
            PrevSym.set(newNode, position.prev);
            NextSym.set(position.prev, newNode);
            PrevSym.set(position, newNode);
            SizeSym.set(this, this.size + 1);
    
            if (position === this.head) {
                HeadSym.set(this, newNode);
            }
        };
    
        LinkedList.prototype.insertNodeAfter = function (position, newNode) {
            if (!symbols.hasBrand(position, LinkedListNode))
                throw new Error("Invalid argument: position");
            if (!symbols.hasBrand(newNode, LinkedListNode))
                throw new Error("Invalid argument: newNode");
            if (ListSym.get(position) !== this)
                throw new Error("Invalid argument: position");
            if (ListSym.get(newNode) != null)
                throw new Error("Invalid argument: newNode");
    
            ListSym.set(newNode, this);
            PrevSym.set(newNode, position);
            NextSym.set(newNode, position.next);
            PrevSym.set(position.next, newNode);
            NextSym.set(position, newNode);
            SizeSym.set(this, this.size + 1);
        };
    
        LinkedList.prototype.deleteNode = function (position) {
            if (!symbols.hasBrand(position, LinkedListNode))
                throw new Error("Invalid argument: position");
            if (ListSym.get(position) !== this)
                throw new Error("Invalid argument: position");
    
            if (position.next === position) {
                HeadSym.set(this, null);
            } else {
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
        };
    
        LinkedList.prototype.match = function (filter) {
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
        };
    
        LinkedList.prototype.matchLast = function (filter) {
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
        };
    
        LinkedList.prototype.forEach = function (callback, thisArg) {
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
        };
        return LinkedList;
    })();
    exports.LinkedList = LinkedList;
    
    symbols.brand("LinkedList")(LinkedList);
    
    var Map = (function () {
        function Map() {
            var mapData = new MapData();
            MapDataSym.set(this, mapData);
        }
        Object.defineProperty(Map.prototype, "size", {
            get: function () {
                var mapData = MapDataSym.get(this);
                if (!mapData || !symbols.hasBrand(this, Map))
                    throw new TypeError("'this' is not a Map object");
    
                return mapData.size;
            },
            enumerable: true,
            configurable: true
        });
    
        Map.prototype.get = function (key) {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Map))
                throw new TypeError("'this' is not a Map object");
    
            var node = MapGet(mapData, key);
            if (node) {
                return node.value.value;
            }
        };
    
        Map.prototype.set = function (key, value) {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Map))
                throw new TypeError("'this' is not a Map object");
    
            var node = MapGet(mapData, key);
            if (node) {
                node.value.value = value;
            } else {
                node = new LinkedListNode({ key: key, value: value });
                MapInsert(mapData, node);
            }
        };
    
        Map.prototype.has = function (key) {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Map))
                throw new TypeError("'this' is not a Map object");
    
            var node = MapGet(mapData, key);
            if (node) {
                return true;
            }
    
            return false;
        };
    
        Map.prototype.delete = function (key) {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Map))
                throw new TypeError("'this' is not a Map object");
    
            var node = MapGet(mapData, key);
            if (node) {
                MapRemove(mapData, node);
                return true;
            }
    
            return false;
        };
    
        Map.prototype.clear = function () {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Map))
                throw new TypeError("'this' is not a Map object");
    
            mapData.stringTable = null;
            mapData.entries = null;
            mapData.size = 0;
        };
    
        Map.prototype.forEach = function (callback, thisArg) {
            var _this = this;
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Map))
                throw new TypeError("'this' is not a Map object");
    
            if (mapData.entries) {
                mapData.entries.forEach(function (value) {
                    callback.call(thisArg, value.value, value.key, _this);
                });
            }
        };
        return Map;
    })();
    exports.Map = Map;
    
    symbols.brand("Map")(Map);
    
    var Set = (function () {
        function Set() {
            var mapData = new MapData();
            MapDataSym.set(this, mapData);
        }
        Object.defineProperty(Set.prototype, "size", {
            get: function () {
                var mapData = MapDataSym.get(this);
                if (!mapData || !symbols.hasBrand(this, Set))
                    throw new TypeError("'this' is not a Set object");
    
                return mapData.size;
            },
            enumerable: true,
            configurable: true
        });
    
        Set.prototype.add = function (key) {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Set))
                throw new TypeError("'this' is not a Set object");
    
            var node = MapGet(mapData, key);
            if (node) {
                return false;
            } else {
                node = new LinkedListNode({ key: key, value: void 0 });
                MapInsert(mapData, node);
                return true;
            }
        };
    
        Set.prototype.has = function (key) {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Set))
                throw new TypeError("'this' is not a Set object");
    
            var node = MapGet(mapData, key);
            if (node) {
                return true;
            }
    
            return false;
        };
    
        Set.prototype.delete = function (key) {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Set))
                throw new TypeError("'this' is not a Set object");
    
            var node = MapGet(mapData, key);
            if (node) {
                MapRemove(mapData, node);
                return true;
            }
    
            return false;
        };
    
        Set.prototype.clear = function () {
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Set))
                throw new TypeError("'this' is not a Set object");
    
            mapData.stringTable = null;
            mapData.entries = null;
            mapData.size = 0;
        };
    
        Set.prototype.forEach = function (callback, thisArg) {
            var _this = this;
            var mapData = MapDataSym.get(this);
            if (!mapData || !symbols.hasBrand(this, Set))
                throw new TypeError("'this' is not a Set object");
    
            if (mapData.entries) {
                mapData.entries.forEach(function (value) {
                    callback.call(thisArg, value.key, _this);
                });
            }
        };
        return Set;
    })();
    exports.Set = Set;
    
    symbols.brand("Set")(Set);
    
    var MapData = (function () {
        function MapData() {
            this.size = 0;
        }
        return MapData;
    })();
    
    var HeadSym = new symbols.Symbol("lists.Head");
    var SizeSym = new symbols.Symbol("lists.Size");
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
    
    function MapGet(mapData, key) {
        var normalkey = ToKey(key);
        if (typeof normalkey === "string") {
            if (mapData.stringTable && mapData.stringTable.hasOwnProperty(normalkey)) {
                var list = mapData.stringTable[normalkey];
                if (list) {
                    var stringNode = list.match(function (node) {
                        return exports.is(node.value.key, key);
                    });
                    if (stringNode) {
                        return stringNode.value;
                    }
                }
            }
        } else {
            if (mapData.entries) {
                var node = mapData.entries.match(function (entry) {
                    return exports.is(entry.key, key);
                });
                if (node) {
                    return node;
                }
            }
        }
    }
    
    function MapInsert(mapData, node) {
        if (!mapData.entries) {
            mapData.entries = new LinkedList();
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
                var list = new LinkedList();
                mapData.stringTable[normalkey] = list;
            }
    
            list.push(node);
        }
    }
    
    function MapRemove(mapData, node) {
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
    
    function ToKey(key) {
        if (key === null)
            return NullKey;
        if (key === true)
            return TrueKey;
        if (key === false)
            return FalseKey;
        if (key == null)
            return UndefinedKey;
        if (key === "__proto__")
            return ProtoKey;
        if (typeof key === "number")
            return NumberKey + key.toString();
        return key;
    }
    
    function is(x, y) {
        return (x === y) ? (x !== 0 || 1 / x === 1 / y) : (x !== x && y !== y);
    }
    exports.is = is;
}, this);