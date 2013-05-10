/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */
import symbols = module("symbols");
import tasks = module("tasks");
import futures = module("futures");

/**
 * Additional options for the request
 */
export interface HttpRequestOptions {
	/**
	 * The username for the request
	 * @type {String}
	 */
	username?: string;

	/**
	 * The password for the request
	 * @type {String}
	 */
	password?: string;

	/**
	 * Headers for the request
	 * @type {String|Object}
	 */
	headers?: any;

	/**
	 * A filter for the status code, used to determine success
	 * @type {Function}
	 */
	statusFilter?: (statusCode: number) => bool;

	/**
	 * A value indicating whether the request should be sent with credentials
	 */
	withCredentials?: bool;
}

var __HttpResponseData__ = new symbols.Symbol("HttpResponseData");
var __HttpRequestData__ = new symbols.Symbol("HttpRequestData");

enum HttpRequestState {
	opened,
	sending,
	completed,
	canceled
}

class HttpRequestData {
	public state: HttpRequestState = HttpRequestState.opened;
	public request: HttpRequest;
	public response: HttpResponse;
	public xhr: XMLHttpRequest;
	public resolver: futures.FutureResolver;
	public token: tasks.CancellationToken;
	public cancellationHandle: number;
	public statusFilter: (status: number, statusText?: string) => bool = code => code === 200;

	constructor(request: HttpRequest, response: HttpResponse) {
		this.xhr = new XMLHttpRequest();
		this.onload = this.onload.bind(this);
		this.onerror = this.onerror.bind(this);
		this.request = request;
		this.response = response;
	}	

	public send(body: any, resolver: futures.FutureResolver, token: tasks.CancellationToken): void {
		if (this.state !== HttpRequestState.opened) {
			return;
		}

		this.state = HttpRequestState.sending;
		this.resolver = resolver;
		this.token = token;

		this.xhr.addEventListener("load", this.onload, false);
		this.xhr.addEventListener("error", this.onerror, false);

		if (this.token) {
			this.cancellationHandle = this.token.register(() => { this.cancel(); });
		}

		this.xhr.send(body);
	}

	public cancel(): void {		
		this.cleanup();
		this.state = HttpRequestState.canceled;
		this.xhr.abort();
	}

	private onload(e: Event): void {
		this.cleanup();

		if (this.state !== HttpRequestState.sending) {
			return;
		}

		this.state = HttpRequestState.completed;
		if (!(this.statusFilter && this.statusFilter(this.xhr.status, this.xhr.statusText))) {
			this.resolver.reject(this.response);
		}
		else {
			this.resolver.accept(this.response);
		}
	}

	private onerror(e: Event): void {
		this.cleanup();

		if (this.state !== HttpRequestState.sending) {
			return;
		}

		this.state = HttpRequestState.completed;
		this.resolver.reject(this.response);
	}

	private cleanup(): void {
		this.xhr.removeEventListener("load", this.onload, false);
		this.xhr.removeEventListener("error", this.onerror, false);

		if (this.token && this.cancellationHandle) {
			this.token.unregister(this.cancellationHandle);
			this.token = null;
			this.cancellationHandle = null;
		}
	}
}

export class HttpResponse {
	constructor() {
        throw new TypeError("Object doesn't support this action");
	}

	public get status(): number {
		var data: HttpRequestData = __HttpResponseData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");
		
		return data.xhr.status;
	}
	
	public get statusText(): string {
		var data: HttpRequestData = __HttpResponseData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

		return data.xhr.statusText;
	}

	public get responseText(): string {
		var data: HttpRequestData = __HttpResponseData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

		return data.xhr.responseText;
	}
	
	public getAllResponseHeaders(): string {
		var data: HttpRequestData = __HttpResponseData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

		return data.xhr.getAllResponseHeaders();
	}
	
	public getResponseHeader(header: string): string {		
		var data: HttpRequestData = __HttpResponseData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpResponse)) throw new TypeError("'this' is not an HttpResponse object");

		return data.xhr.getResponseHeader(header);
	}
}

symbols.brand.set(HttpResponse.prototype, "HttpResponse");

export class HttpRequest {

	constructor(method: string, url: string);
	constructor(method: string, url: string, token: tasks.CancellationToken);
	constructor(method: string, url: string, options: HttpRequestOptions);
	constructor(method: string, url: string, options: HttpRequestOptions, token: tasks.CancellationToken);
	constructor(method: string, url: string, ...args: any[]) {
		var argi: number = 0;
		var options: HttpRequestOptions = null;
		var token: tasks.CancellationToken = null;

		if (!symbols.hasBrand(args[argi], tasks.CancellationToken)) {
			options = args[argi++];
		}
		if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
			token = args[argi];
		}

		var response = Object.create(HttpResponse.prototype);
		var data = new HttpRequestData(this, response);
		__HttpResponseData__.set(response, data);
		__HttpRequestData__.set(this, data);

		var username: string = (options && options.username) || null;
		var password: string = (options && options.password) || null;
		var headers: any = (options && options.headers) || null;
		var withCredentials: bool = (options && options.withCredentials) || false;
		var statusFilter: (statusCode: number) => bool = (options && options.statusFilter) || null;

		var xhr = data.xhr;
		if (withCredentials) {
			xhr.withCredentials = withCredentials;
		}

		if (Object(headers) === headers) {
			Object.getOwnPropertyNames(headers).forEach(key => {
				this.setRequestHeader(key, headers[key]);
			});
		}
		else if (typeof headers === "string") {
			// TODO: need to parse
		}

		if (typeof statusFilter === "function") {
			this.statusFilter = statusFilter;
		}

		xhr.open(method, url, true, username, password);
	}

	public get statusFilter(): (status: number, statusText?: string) => bool {
		var data = __HttpRequestData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpRequest)) throw new TypeError("'this' is not an HttpRequest object");

		return data.statusFilter;
	}

	public set statusFilter(value: (status: number, statusText?: string) => bool) {
		var data = __HttpRequestData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpRequest)) throw new TypeError("'this' is not an HttpRequest object");

		data.statusFilter = value;
	}

	public setRequestHeader(header: string, value: string): void {
		var data = __HttpRequestData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpRequest)) throw new TypeError("'this' is not an HttpRequest object");

		data.setRequestHeader(header, value);
	}

	public send(body?: any, token?: tasks.CancellationToken): futures.Future {
		var data = __HttpRequestData__.get(this);
		if (!data || !symbols.hasBrand(this, HttpRequest)) throw new TypeError("'this' is not an HttpRequest object");

		return new futures.Future(resolver => {
			data.send(body, resolver, token);
		}, token)
	}

	public static send(method: string, url: string): futures.Future;
	public static send(method: string, url: string, token: tasks.CancellationToken): futures.Future;
	public static send(method: string, url: string, body: any): futures.Future;
	public static send(method: string, url: string, body: any, token: tasks.CancellationToken): futures.Future;
	public static send(method: string, url: string, body: any, options: HttpRequestOptions): futures.Future;
	public static send(method: string, url: string, body: any, options: HttpRequestOptions, token: tasks.CancellationToken): futures.Future;
	public static send(method: string, url: string, ...args: any[]): futures.Future {
		var argi: number = 0;
		var body: any = null;
		var options: HttpRequestOptions = null;
		var token: tasks.CancellationToken = null;

		if (!symbols.hasBrand(args[argi], tasks.CancellationToken)) {
			body = args[argi++];
			if (!symbols.hasBrand(args[argi], tasks.CancellationToken)) {
				options = args[argi++];
			}
		}

		if (symbols.hasBrand(args[argi], tasks.CancellationToken)) {
			token = args[argi];
		}

		var req = new HttpRequest(method, url, options, token);
		return req.send(body, token);
	}

	public static get(url: string): futures.Future;
	public static get(url: string, token: tasks.CancellationToken): futures.Future;
	public static get(url: string, options: HttpRequestOptions): futures.Future;
	public static get(url: string, options: HttpRequestOptions, token: tasks.CancellationToken): futures.Future;
	public static get(url: string, ...args: any[]): futures.Future {
		return HttpRequest.send("GET", url, null, args[0], args[1]);
	}

	public static post(url: string, body: any): futures.Future;
	public static post(url: string, body: any, token: tasks.CancellationToken): futures.Future;
	public static post(url: string, body: any, options: HttpRequestOptions): futures.Future;
	public static post(url: string, body: any, options: HttpRequestOptions, token: tasks.CancellationToken): futures.Future;
	public static post(url: string, body: any, ...args:any[]): futures.Future {
		return HttpRequest.send("POST", url, body, args[0], args[1]);
	}

	public static put(url: string, body: any): futures.Future;
	public static put(url: string, body: any, token: tasks.CancellationToken): futures.Future;
	public static put(url: string, body: any, options: HttpRequestOptions): futures.Future;
	public static put(url: string, body: any, options: HttpRequestOptions, token: tasks.CancellationToken): futures.Future;
	public static put(url: string, body: any = null, ...args: any[]): futures.Future {		
		return HttpRequest.send("PUT", url, body, args[0], args[1]);
	}

	public static delete(url: string): futures.Future;
	public static delete(url: string, token: tasks.CancellationToken): futures.Future;
	public static delete(url: string, options: HttpRequestOptions): futures.Future;
	public static delete(url: string, options: HttpRequestOptions, token: tasks.CancellationToken): futures.Future;
	public static delete(url: string, ...args: any[]): futures.Future {
		return HttpRequest.send("PUT", url, null, args[0], args[1]);
	}
}

symbols.brand.set(HttpRequest.prototype, "HttpRequest");