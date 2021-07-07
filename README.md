# web-locks

a [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) polyfill, support the mainstream browsers usage when `window.navigator` exist but `navigator.lock` not exist.

- implement features according to [Web Locks API Specification](https://wicg.github.io/web-locks/)

- implement the unit test according to [web-platform-test](https://github.com/web-platform-tests/wpt/tree/master/web-locks)

- implement all the features of [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

## usage:

install this lib

```
npm i navigator.locks
```

import this lib and use it follow [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

```js
import "navigator.locks";

navigator.locks.request("my_resource", async (lock) => {
  // The lock has been acquired.
  await do_something();
  await do_something_else();
  // Now the lock will be released.
});
```

## online demo

[demo link](https://codesandbox.io/s/web-locks-demo-ytqq5?file=/src/pollfill/polyfill.ts)

> you could open this url in two tabs, operate the lock buttons and see the page and console

## process:

- [x] lock.request

  - [x] lock.request option -> `mode`
  - [x] lock.request option -> `ifAvailable `
  - [x] lock.request option -> `steal`
  - [x] lock.request option -> `1signal`

- [x] lock.query

- [x] CI/CD

- [x] Unit test
