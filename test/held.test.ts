import {
  beforeEachHandle,
  createWebLocksInstance,
  generateRandomId,
  sleep,
} from "./helpers";

describe("Web Locks API: Lock held until callback result resolves", () => {
  beforeEachHandle();

  test("callback's result is promisified if not async", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    const p = webLocks.request(sourceName, (lock) => 123);
    //  request() result is a Promise
    expect(Promise.resolve(p)).toEqual(p);
    // promise resolves to the returned value
    expect(await p).toEqual(123);
  });

  test("lock is held until callback's returned promise resolves", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    // Resolved when the lock is granted.
    let granted: any;
    const lock_granted_promise = new Promise((r) => {
      granted = r;
    });

    // Lock is held until this is resolved.
    let resolve: any;
    const lock_release_promise = new Promise((r) => {
      resolve = r;
    });

    const order: string[] = [];

    webLocks.request(sourceName, (lock) => {
      granted(lock);
      return lock_release_promise;
    });
    await lock_granted_promise;

    await Promise.all([
      sleep(50).then(() => {
        order.push("1st lock released");
        resolve();
      }),
      webLocks.request(sourceName, () => {
        order.push("2nd lock granted");
      }),
    ]);

    expect(order).toEqual(["1st lock released", "2nd lock granted"]);
  });

  test("lock is held until callback's returned promise rejects", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    // Resolved when the lock is granted.
    let granted: any;
    const lock_granted_promise = new Promise((r) => {
      granted = r;
    });

    // Lock is held until this is rejected.
    let reject: any;
    const lock_release_promise = new Promise((r) => {
      reject = r;
    });

    const order: string[] = [];

    webLocks.request(sourceName, (lock) => {
      granted(lock);
      return lock_release_promise;
    });
    await lock_granted_promise;

    await Promise.all([
      sleep(50).then(() => {
        order.push("reject");
        reject(new Error("this uncaught rejection is expected"));
      }),
      webLocks.request(sourceName, () => {
        order.push("2nd lock granted");
      }),
    ]);

    expect(order).toEqual(["reject", "2nd lock granted"]);
  });

  test("held lock prevents the same client from acquiring it", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, async (lock) => {
      await webLocks.request(sourceName, { ifAvailable: true }, (lock) => {
        callback_called = true;
        // lock request should fail if held
        expect(lock).toEqual(null);
      });
    });

    // callback should have executed
    expect(callback_called).toBeTruthy();
  });
});
