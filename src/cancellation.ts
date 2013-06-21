/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

/** 
 * Source for cancellation
 */
export class CancellationSource {
    private _cancelData: CancellationData;

    /** 
     * Source for cancellation
     * @param tokens One or more tokens to link to a new source 
     */
    constructor(...tokens: CancellationToken[]) {
        var token = Object.create(CancellationToken.prototype);
        this.cancel = this.cancel.bind(this);
        this.cancelAfter = this.cancelAfter.bind(this);

        $CancellationCreate(this, token);

        // link any optional tokens
        tokens.forEach(token => {
            if (token) {
                $CancellationLink(this._cancelData, token)
            }
        });

        // freeze the token to prevent modification
        Object.freeze(token);
    }

    /** 
     * Gets the token for this source
     */
    public get token(): CancellationToken {
        return this._cancelData.token;
    }

    /** 
     * Cancels the source
     */
    public cancel(): void {
        if (this._cancelData.closed) throw new Error("Object doesn't support this action");
        $CancellationCancel(this._cancelData);
    }

    /** 
     * Cancels the source after a number of milliseconds has elapsed
     * @param delay The number of milliseconds to wait
     */
    public cancelAfter(delay: number): void {
        if (this._cancelData.closed) throw new Error("Object doesn't support this action");
        $CancellationCancelAfter(this._cancelData, delay);
    }

    /** 
     * Cleans up the cancellation source
     */
    public close(): void {
        if (this._cancelData.closed) return;
        $CancellationClose(this._cancelData);
    }
}

/** 
 * Token used for cancellation
 */
export class CancellationToken {
    private _cancelData: CancellationData;

    /**
     * Token used for cancellation
     */
    constructor() {
        throw new TypeError("Object doesn't support this action");
    }

    /**
     * Gets a value indicating whether the token has been canceled
     */
    public get canceled(): boolean {
        return this._cancelData.canceled;
    }

    /**
     * Throws a CanceledError if the source has been canceled
     */
    public throwIfCanceled(): void {
        if (this.canceled) {
            throw new CanceledError();
        }
    }

    /** 
     * Registers a cleanup callback
     * @param cleanup The callback to execute when cancellation is requested
     * @returns A handle to the cleanup callback that can be used to unregister the callback
     */
    public register(cleanup: () => void ): number {
        return $CancellationRegister(this._cancelData, cleanup);
    }

    /** 
     * Unregisters a cleanup callback
     * @param handle The handle to unregister
     */
    public unregister(handle: number): void {
        $CancellationUnregister(this._cancelData, handle);
    }
}

interface CancellationData {
    token: CancellationToken;
    source: CancellationSource;
    closed: boolean;
    canceled: boolean;
    cleanupCallbacks?: { handle: number; callback: () => void; }[];
    links?: { handle: number; callback: () => void; }[];
    cancelHandle?: number;
}

function $CancellationCreate(source: CancellationSource, token: CancellationToken) {
    var data: CancellationData = {
        source: source,
        token: token,
        closed: false,
        canceled: false
    };

    Object.defineProperty(source, "_cancelData", { value: data });
    Object.defineProperty(token, "_cancelData", { value: data });
}

function $CancellationRegister(data: CancellationData, cleanup: () => void ): number {
    if (data.canceled) {
        cleanup();
        return 0;
    }

    if (nextCancellationHandle >= MAX_HANDLE) {
        nextCancellationHandle = 1;
    }

    var handle = nextCancellationHandle++;

    if (data.cleanupCallbacks == null) {
        data.cleanupCallbacks = [];
    }

    data.cleanupCallbacks.push({ handle: handle, callback: cleanup });
    return handle;
}

function $CancellationUnregister(data: CancellationData, handle: number): void {
    if (data.cleanupCallbacks) {
        var index = 0;
        for (var i = 0, n = data.cleanupCallbacks.length; i < n; i++) {
            var node = data.cleanupCallbacks[i];
            if (is(node.handle, handle)) {
                data.cleanupCallbacks.splice(i, 1);
                return;
            }
        }
    }
}

function $CancellationLink(data: CancellationData, token: CancellationToken): void {

    // lazy-init the links
    if (data.links == null) {
        data.links = [];
    }

    // register linked cancellation
    var handle = token.register(() => {
        $CancellationCancel(data);
    });

    data.links.push({ handle: handle, callback: () => { $CancellationUnregister(data, handle); } });
}

function $CancellationCancel(data: CancellationData): void {
    if (data.canceled) {
        return;
    }

    data.canceled = true;


    // execute each cleanup callback and catch any errors
    var errors: any[];
    data.cleanupCallbacks.forEach(value => {
        try {
            value.callback.call(null);
        }
        catch (e) {
            if (errors == null) {
                errors = [];
            }

            errors.push(e);
        }
    });

    data.cleanupCallbacks = null;

    // if there were any errors, throw them
    if (errors) {
        throw new AggregateError(null, errors);
    }
}

function $CancellationCancelAfter(data: CancellationData, delay: number): void {
    if (data.canceled) {
        return;
    }

    if (data.cancelHandle) {
        clearTimeout(data.cancelHandle);
        data.cancelHandle = null;
    }

    data.cancelHandle = setTimeout(() => { $CancellationCancel(data); }, delay);
}

function $CancellationClose(data: CancellationData): void {
    data.closed = true;

    var links = data.links;
    data.links = null;

    links.forEach(node => { node.callback.call(null); });
}

/** 
 * An error that contains multiple errors
 */
export class AggregateError implements Error {
    public name: string = "AggregateError";

    /** 
     * An error that contains multiple errors
     * @param message The message for the error
     * @param errors An array of errors for the error
     */
    constructor(
        public message: string = "One or more errors occurred", 
        public errors: any[] = []) {
    }
}

// wire up AggregateError base
<any>AggregateError.prototype = Object.create(Error.prototype);

export class CanceledError implements Error {
    public name: string = "CanceledError";
    constructor(
        public message: string = "The operation was canceled") {
    }
}

// wire up the CanceledError base
<any>CanceledError.prototype = Object.create(Error.prototype);

var MAX_HANDLE: number = 2147483647;
var nextCancellationHandle: number = 1;

function is(x, y): boolean {
    return (x === y)
        ? (x !== 0 || 1 / x === 1 / y)
        : (x !== x && y !== y);
}