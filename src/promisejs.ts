/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

import promises = module('promises');
import cancellation = module('cancellation');
import httpclient = module('httpclient');

export var Promise = promises.Promise;
export var PromiseResolver = promises.PromiseResolver;
export var CancellationSource = cancellation.CancellationSource;
export var CancellationToken = cancellation.CancellationToken;
export var AggregateError = cancellation.AggregateError;
export var CancelledError = cancellation.CanceledError;
export var Uri = httpclient.Uri;
export var QueryString = httpclient.QueryString;
export var HttpClient = httpclient.HttpClient;
export var HttpRequest = httpclient.HttpRequest;
export var HttpResponse = httpclient.HttpResponse;