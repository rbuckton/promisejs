/*!
*
* Copyright 2013 Ron A. Buckton under the terms of the MIT license found at:
* https://github.com/rbuckton/promisejs/raw/master/LICENSE
*
*/
var futures = require("./futures");
var httpclient = require("./httpclient");

exports.CancellationSource = futures.CancellationSource;
exports.CancellationToken = futures.CancellationToken;
exports.Future = futures.Future;
exports.Uri = httpclient.Uri;
exports.HttpClient = httpclient.HttpClient;
exports.HttpRequest = httpclient.HttpRequest;
exports.HttpResponse = httpclient.HttpResponse;

