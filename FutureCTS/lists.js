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
            }, global["lists"] = { });
    }
})
(function (require, exports) {
    var LinkedList = (function () {
        function LinkedList() {
            this.head = null;
        }
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
        LinkedList.prototype.insertBefore = function (position, newNode) {
            if (position) {
                newNode.next = position;
                newNode.prev = position.prev;
                position.prev.next = newNode;
                position.prev = newNode;
                if (position === this.head) {
                    this.head = position;
                }
            } else {
                newNode.next = newNode;
                newNode.prev = newNode;
                this.head = newNode;
            }
        };
        LinkedList.prototype.insertAfter = function (position, newNode) {
            if (position) {
                newNode.prev = position;
                newNode.next = position.next;
                position.next.prev = newNode;
                position.next = newNode;
            } else {
                newNode.next = newNode;
                newNode.prev = newNode;
                this.head = newNode;
            }
        };
        LinkedList.prototype.remove = function (position) {
            if (position) {
                if (position.next === position) {
                    this.head = null;
                } else {
                    position.next.prev = position.prev;
                    position.prev.next = position.next;
                    if (this.head === position) {
                        this.head = position.next;
                    }
                }
                position.next = null;
                position.prev = null;
            }
        };
        LinkedList.prototype.find = function (filter) {
            var node = this.head;
            if (node) {
                while(!filter(node, this)) {
                    node = node.next;
                    if (node === this.head) {
                        return null;
                    }
                }
                return node;
            }
            return null;
        };
        LinkedList.prototype.forEach = function (callback) {
            var node = this.head;
            if (node) {
                while(true) {
                    var next = node.next;
                    callback(node, this);
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
}, this);