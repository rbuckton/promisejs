/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

/** Describes a linked-list node
  */
export interface LinkedListNode<T> {
    /** The value for the node
      */
    value: T;

    /** The next node in the list
      */
    next?: LinkedListNode;

    /** The previous node in the list
      */
    prev?: LinkedListNode;
}


/** A linked-list
  */
export class LinkedList<T> {
    /** Gets the head of the list
      */
    public head: LinkedListNode<T> = null;

    /** Gets the tail of the list
      */
    public get tail(): LinkedListNode<T> {
        if (this.head) {
            return this.head.prev;
        }

        return null;
    }

    /** Adds a node before the provided position
      * @param position The position in the list
      * @param newNode The new node to add
      */
    public insertBefore(position: LinkedListNode<T>, newNode: LinkedListNode<T>): void {
        if (position) {
            newNode.next = position;
            newNode.prev = position.prev;
            position.prev.next = newNode;
            position.prev = newNode;
            if (position === this.head) {
                this.head = position;
            }
        }
        else {
            newNode.next = newNode;
            newNode.prev = newNode;
            this.head = newNode;
        }
    }

    /** Adds a node after the provided position
      * @param position The position in the list
      * @param newNode The new node to add
      */
    public insertAfter(position: LinkedListNode<T>, newNode: LinkedListNode<T>): void {
        if (position) {
            newNode.prev = position;
            newNode.next = position.next;
            position.next.prev = newNode;
            position.next = newNode;
        }
        else {
            newNode.next = newNode;
            newNode.prev = newNode;
            this.head = newNode;
        }
    }

    /** Removes a node from the list
      * @param position The node to remove
      */
    public remove(position: LinkedListNode<T>): void {
        if (position) {
            if (position.next === position) {
                this.head = null;
            }
            else {
                position.next.prev = position.prev;
                position.prev.next = position.next;
                if (this.head === position) {
                    this.head = position.next;
                }
            }
            position.next = null;
            position.prev = null;
        }
    }

    /** Finds a node in the list
      * @param filter The filter to apply
      * @returns The node if found; otherwise, null
      */
    public find(filter: (node: LinkedListNode<T>, list?: LinkedList<T>) => bool): LinkedListNode<T> {
        var node = this.head;
        if (node) {
            while (!filter(node, this)) {
                node = node.next;
                if (node === this.head) {
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
    public forEach(callback: (node: LinkedListNode<T>, list?: LinkedList<T>) => void): void {
        var node = this.head;
        if (node) {
            while (true) {
                var next = node.next;
                callback(node, this);
                node = next;
                if (node === this.head) {
                    return;
                }
            }
        }
    }
}