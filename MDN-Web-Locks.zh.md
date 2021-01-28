> 实验
> 这是一项实验性技术，请在生产中使用它之前仔细检查浏览器兼容性表。

Web Locks API允许运行在一个选项卡或工作程序中的脚本去异步获取锁，在执行工作时将其保留，然后释放它。在保持状态的同时，其他在同一源执行的脚本都无法获得相同的锁，这使得在多个选项卡或工作程序中运行的Web应用程序可以协调工作和资源的使用。

## Web Locks 的概念和用法


锁是代表一些潜在共享资源的抽象概念，它由Web应用程序选择的名称标识。例如，如果运行在多个选项卡中的Web应用程序要确保只有一个选项卡在网络和索引数据库之间同步数据，则每个选项卡都可以尝试获取"my_net_db_sync"锁，但只有一个选项卡会成功（[领导者选举模式](https://en.wikipedia.org/wiki/Leader_election)）

该API的用法如下：

1. 请求该锁。
2. 在持锁时的异步任务中将工作完成。
3. 当任务完成时，该锁将自动释放。

```js
navigator.locks.request('my_resource', async lock => {
  // The lock has been acquired.
  await do_something();
  await do_something_else();
  // Now the lock will be released.
});
```


持有锁时，将从此执行上下文或其他选项卡/工作器中请求相同锁的请求排队。仅当释放锁定时，才会批准第一个排队的请求。

该API提供了可根据需要使用的可选功能，包括：

- 从异步任务返回值
- 共享和独占锁定模式
- 有条件获取
- 诊断以查询源中的锁状态
- 可防止死锁的逃生舱口

锁的作用域是origins；选项卡从https://example.com获得的锁对标签来自https://example.org:8080的锁没有影响，因为它们是不同的origins。

主要入口点是navigator.locks.request()，它请求锁定。它需要一个锁名，一组可选的选项以及一个回调。授予锁定时将调用回调。当回调返回时，锁会自动释放，因此通常回调是​​一个异步函数，这导致仅在异步函数完全完成后才释放锁。

request() 方法本身返回一个promise，一旦释放锁，该promise就会解析。在异步函数中，脚本可以await调用从而使异步代码流能线性化。例如：

```js
await do_something_without_lock();

// Request the lock.
await navigator.locks.request('my_resource', async lock => {
  // The lock has been acquired.
  await do_something_with_lock();
  await do_something_else_with_lock();
  // Now the lock will be released.
});
// The lock has been released.

await do_something_else_without_lock();
```

## Options参数

请求锁定时可以传递几个选项：

- mode：默认mode为"exclusive"("独占")，但可以指定"shared"("共享")。锁只能有一个"exclusive"，但是可以同时授予多个"shared"请求。这可以用来实现[读者-作家模式](https://en.wikipedia.org/wiki/Readers%E2%80%93writer_lock)。

- signal: 可以传递AbortSignal，从而允许中止锁定请求。这可用于对请求实施超时。

- ifAvailable: 如果指定，且在锁不能马上被授予的情况下(没有等待)，lock request将失败。The callback is invoked with null.

## Monitoring监控方式

脚本可以使用navigator.locks.query()方法对源的锁管理器的状态进行内省。这在调试时很有用，例如，确定为什么无法获取锁。结果是锁管理器状态的快照，该快照标识保留快照和请求的锁，以及在获取快照时有关每个锁的一些其他数据（例如模式）。

## Advanced use高级使用

对于更复杂的情况，例如在任意时间保持锁，回调可以返回由脚本显式解决的promise：

```js
// Capture promise control functions:
let resolve, reject;
const p = new Promise((res, rej) => { resolve = res; reject = rej; });

// Request the lock:
navigator.locks.request('my_resource', lock => {
  // Lock is acquired.

  return p;
  // Now lock will be held until either resolve() or reject() is called.
});
```

