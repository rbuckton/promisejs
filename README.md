promisejs
=========

Promise/Future-based asynchrony in javascript

DOMFuture
---------
This contains an approximate polyfill for DOM Futures with several minor extensions:
* **Future#then**, **Future#done**, and **Future#catch** expose an additional, optional, options argument that can be used to provide additional options for the resulting Future.
* Several additional non-standard methods include:
  * **Future.of** - Converts a Promise/A-like "thennable" into a DOM Future
  * **Future.isFuture** - Tests whether the provided value is a DOM Future (works cross-realm only in ES5+)
  * **Future.yield** - Creates a Future that resolves in the next turn of the dispatcher
  * **Future.sleep** - Creates a Future that resolves after a period of time has elapsed
  * **Future.sleepUntil** - Creates a Future that resolves after a condition has been met. The condition is evaluated at most once per turn of the dispatcher, but can be tested less frequently by supplying an optional argument.
  * **Future.run** - Creates a Future for the result or exception thrown from executing a callback either in the next turn of the dispatcher, or after a period of time has elapsed.
* A nonstandard **Deferred** class also exists, to invert Future/FutureResolver in order to simplify some tasks such as "cancellation-by-future" (see below).

Some consideration is begin given to the following areas:
* Progress notifications
  * Should progress be built into Future?
  * Should we have a ProgressFuture subclass?
* Cancellation
  * Should all futures be cancellable by way of a Future#cancel method?
    * Should cancellation only effect the target Future and its chained descendants?
    * Should cancellation support subscription to perform cancellation cleanup (e.g. XMLHttpRequest#abort, Worker#close, etc.)
  * Should cancellation be performed by providing an external Future to use for cancellation? e.g.:
    function fetchAsync(url, token) {
      return new Future(function (resolver) {
        var xhr = new XMLHttpRequest();
        // trap cancellation
        token.done(function() { 
          xhr.abort(); 
          resolver.reject("canceled"); 
        }, { synchronous: true });
        // attach events to xhr and send
      });
    }

    // create a Deferred to use as a cancellation source
    var cts = new Deferred();
    
    // begin an asynchronous fetch of data
    var data = fetchAsync(url, cts.future);
    
    // wait 500ms then cancel
    Future.sleep(500).done(cts.resolve);
