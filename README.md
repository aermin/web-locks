# web-locks

A polyfill of [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) with localstorage, support the mainstream browsers usage

## usage:

install this lib

```
npm i navigator.locks
```

import this lib and use it follow [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

```js
import locks from "navigator.locks";

locks.request("my_resource", async (lock) => {
  // The lock has been acquired.
  await do_something();
  await do_something_else();
  // Now the lock will be released.
});
```

## process:

- [x] lock.request

  - [x] lock.request option -> `mode`
  - [x] lock.request option -> `ifAvailable `
  - [x] lock.request option -> `steal`
  - [x] lock.request option -> `1signal`

- [x] lock.query

- [x] CI/CD

- [ ] UT/IT
