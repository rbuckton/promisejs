declare module "events" {
    export class EventEmitter {
        addListener(event: string, listener: (value: any) => void): void;
        on(event: string, listener: (value: any) => void): void;
        once(event: string, listener: (value: any) => void): void;
        removeListener(event: string, listener: (value: any) => void): void;
        removeAllListeners(event?: string): void;
        setMaxListeners(n: number): void;
        listeners(event: string): { (value: any): void; }[];
        emit(event: string, ...args: any[]): void;
    }
}

declare class Process {
    nextTick(callback: () => void): void;
    addListener(event: string, listener: (value: any) => void): void;
    on(event: string, listener: (value: any) => void): void;
    once(event: string, listener: (value: any) => void): void;
    removeListener(event: string, listener: (value: any) => void): void;
    removeAllListeners(event?: string): void;
    setMaxListeners(n: number): void;
    listeners(event: string): { (value: any): void; }[];
    emit(event: string, ...args: any[]): void;
}

declare var process: Process;

declare function require(id: string): any;

declare module "assert" {
    function ok(value?: any, message?: string): void;
    function fail(actual: any, expected: any, message: any, operator: any): void;    
    function equal(actual: any, expected: any, message?: string): void;
    function notEqual(actual: any, expected: any, message?: string): void;
    function deepEqual(actual: any, expected: any, message?: string): void;
    function notDeepEqual(actual: any, expected: any, message?: string): void;
    function strictEqual(actual: any, expected: any, message?: string): void;
    function notStrictEqual(actual: any, expected: any, message?: string): void;
    function ifError(value: any): void;
}

declare module "domain" {
    import events = module("events");

    function create(): Domain;
    
    class Domain extends events.EventEmitter {
        run(fn: Function): void;
        members: any[];
        add(emitter: events.EventEmitter): void;
        remove(emitter: events.EventEmitter): void;
        bind(callback: Function): Function;
        intercept(callback: Function): Function;
        dispose(): void;
    }
}