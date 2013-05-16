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