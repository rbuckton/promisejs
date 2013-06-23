promisejs
=========

Promise-based asynchrony in javascript

Promise
---------
This contains an approximate polyfill for DOM Promises.

A normal function call in javascript is completed synchronously in one of two 
ways: normal completion that exits the function with a possible return value, or an abrupt 
completion which results in an exception.

An asynchronous function can return a Promise, which represents the eventual completion of the 
asynchronous operation in one of two ways: fulfillment of the Promise with a possible return value 
(an asynchronous 'normal completion'), or rejection of the Promise with a reason (an asynchronous 
'abrupt completion').

For example, if you wanted to fetch a remote resource from the browser, you might use the following 
code to perform a synchronous fetch:

```js
function fetch(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, /*async:*/ false);
  xhr.send(null);
  return xhr.responseText;
}

try {
  var res = fetch("...");
  /*do something with res*/
  var value = next(res);
  /*do something with value*/
}
catch(err) {
  /*handle err*/
}
```

The above example has the unfortunate side effect of blocking the browser's UI thread until the resource is loaded.
To be more efficient, we might rewrite this to be asynchronous using Continuation Passing Style:

```js
function fetchCPS(url, callback, errback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, /*async:*/ true);
  xhr.onload = event => callback(xhr.responseText);
  xhr.onerror = event => errback(xhr.statusText);
  xhr.send(null);
}

fetchCPS("...", 
  res => {
    /*do something with res*/
    nextCPS(res, 
      value => {
        /*do something with value*/
      }, 
      err => {
        /*handle err*/ 
      })},
  err => {/*handle err*/})
```

If you need to perform a large number of nested asynchronous calls, Continuation 
Passing Style can start to look complicated very quickly.

With Promises, you might write:

```js
function fetchAsync(url) {
  return new Promise(resolver => {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, /*async:*/ true);
    xhr.onload = event => resolver.fulfill(xhr.responseText);
    xhr.onerror = event => resolver.reject(xhr.statusText);
    xhr.send(null);
  });
}

var resP = fetchAsynx("...");
resP.then(res => {
      /*do something with res*/
      return nextAsync(res)
    })
    .then(value => {
      /*do something with value*/
    })
    .catch(err => {
      /*handle err*/
    })
```

More information can be found in the [wiki](https://github.com/rbuckton/promisejs/wiki).
