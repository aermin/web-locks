<h2 align="center">web-locks polyfill</h2>

<h3 align="center">

![push workflow](https://github.com/aermin/web-locks/actions/workflows/push.yml/badge.svg)
![release workflow](https://github.com/aermin/web-locks/actions/workflows/release.yml/badge.svg)
![npm](https://img.shields.io/npm/v/navigator.locks)
![license](https://img.shields.io/github/license/aermin/web-locks)

</h3>

a [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) polyfill, work for the browsers which haven't support web lock API: `navigator.lock`, e.g. `Firefox`, `Safari`, `IE`.

- implement features according to [Web Locks API Specification](https://wicg.github.io/web-locks/)

- implement the unit test according to [web-platform-test](https://github.com/web-platform-tests/wpt/tree/master/web-locks)

- implement all the features of [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

## Installation

```
// with npm
npm install navigator.locks

// with yarn
yarn add navigator.locks
```

## Usage

Just import It.

```js
import "navigator.locks";

navigator.locks.request("my_resource", async (lock) => {
  // The lock has been acquired.
  await do_something();
  await do_something_else();
  // Now the lock will be released.
});
```

```ts
// if you use Typescript, could import these types to use
import type {
  LockManager,
  Lock,
  LockInfo,
  LockManagerSnapshot,
  LocksInfo,
} from "navigator.locks";
```

> `navigator.locks` API usage follow [MDN API Doc](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

## Online demo

[demo link](https://codesandbox.io/s/web-locks-demo-ytqq5?file=/src/pollfill/polyfill.ts)

> you could open this URL in two tabs, operate the lock buttons and see the page and console

## Process

### All API ✅

- navigator.locks.request

- navigator.locks.request options:

  *mode*: `exclusive` | `shared`

  *ifAvailable*

  *steal*

  *signal*

- navigator.locks.query

### CI/CD ✅

### Unit test ✅
