promisejs
=========

Promise/Future-based asynchrony in javascript

Future
---------
This contains an approximate polyfill for DOM Futures with several additions:
* **Future#then** and **Future#done** take an additional optional argument that can be used to listen for a cancellation signal on a future
* **Future#then**, **Future#done**, and **Future#catch** take an additional optional argument that acts as a cancellation signal for a future
* Several additional non-standard methods include:
  * **Future.isFuture** - Tests whether the provided value is a DOM Future
  * **Future.from** - Converts a Promise/A-like "thennable" into a DOM Future
  * **Future.yield** - Creates a Future that resolves in the next turn of the dispatcher
  * **Future.sleep** - Creates a Future that resolves after a period of time has elapsed
  * **Future.run** - Creates a Future for the result or exception thrown from executing a callback either in the next turn of the dispatcher, or after a period of time has elapsed.
* Several additional non-standard classes include:
  * **CancellationSource** - A source for a cancellation token that can be passed to the Future constructor or to various methods that allows an external actor to cancel the future.
  * **CancellationToken** - A token associated with a **CancellationSource** that is used to listen for a cancellation signal

More information can be found in the [wiki](https://github.com/rbuckton/promisejs/wiki).
