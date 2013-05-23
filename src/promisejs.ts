/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

import futures = module('futures');
import httpclient = module('httpclient');

export var CancellationSource = futures.CancellationSource;
export var CancellationToken = futures.CancellationToken;
export var Future = futures.Future;
export var Uri = httpclient.Uri;
export var HttpClient = httpclient.HttpClient;
export var HttpRequest = httpclient.HttpRequest;
export var HttpResponse = httpclient.HttpResponse;