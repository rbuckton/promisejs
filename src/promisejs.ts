/*!
 *
 * Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
 * https://github.com/rbuckton/promisejs/raw/master/LICENSE
 * 
 */

import tasks = module('tasks');
import futures = module('futures');
import httpclient = module('httpclient');

export var CancellationSource = tasks.CancellationSource;
export var CancellationToken = tasks.CancellationToken;
export var Future = futures.Future;
export var Uri = httpclient.Uri;
export var HttpClient = httpclient.HttpClient;
export var HttpRequest = httpclient.HttpRequest;
export var HttpResponse = httpclient.HttpResponse;