import {
  beforeEachHandle,
  createWebLocksInstance,
  generateRandomId,
} from "./helpers";

function makePromiseAndResolveFunc(): any[] {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return [promise, resolve];
}

describe("Web Locks API: AbortSignal integration", () => {
  beforeEachHandle();

  test("The signal option must be an AbortSignal", async () => {
    // These cases should not work:
    for (const signal of [
      "string",
      12.34,
      false,
      {},
      Symbol(),
      () => {},
      self,
    ]) {
      const webLocks = createWebLocksInstance();
      const sourceName = generateRandomId();
      const cb = jest.fn(() => {});
      try {
        await webLocks.request(
          sourceName,
          // @ts-ignore
          { signal },
          cb
        );
        // callback should not run
        expect(cb).not.toHaveBeenCalled();
      } catch (error) {
        // Bindings should throw if the signal option is a not an AbortSignal
        expect(error).toHaveProperty("name", "TypeError");
        expect(error).toHaveProperty(
          "message",
          "Failed to execute 'request' on 'LockManager': member signal is not of type AbortSignal."
        );
      }
    }
  });

  test("Passing an already aborted signal aborts", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    const controller = new AbortController();
    controller.abort();

    const cb = jest.fn(() => {});
    try {
      await webLocks.request(sourceName, { signal: controller.signal }, cb);
      // callback should not run
      expect(cb).not.toHaveBeenCalled();
    } catch (error) {
      // Request should reject with AbortError
      expect(error instanceof DOMException).toBeTruthy();
      expect(error).toHaveProperty(
        "message",
        "Failed to execute 'request' on 'LockManager': The request was aborted."
      );
    }
  });

  test("An aborted request results in AbortError", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    // Grab a lock and hold it until this subtest completes.
    let resolve;
    const never_settled = new Promise((res) => (resolve = res));
    webLocks.request(sourceName, (lock) => never_settled);

    const controller = new AbortController();

    const cb = jest.fn(() => {});
    const promise = webLocks.request(
      sourceName,
      { signal: controller.signal },
      cb
    );

    // Verify the request is enqueued:
    const state = await webLocks.query();
    // Number of held locks
    expect(
      state.held.filter((lock) => lock.name === sourceName).length
    ).toEqual(1);
    // Number of pending locks
    expect(
      state.pending.filter((lock) => lock.name === sourceName).length
    ).toEqual(1);

    controller.abort();

    promise.catch((error) => {
      expect(error.message).toEqual("The request was aborted.");
      expect(error instanceof DOMException).toBeTruthy();
    });
  });

  test("Abort after a timeout", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    // Grab a lock and hold it until this subtest completes.
    let resolve;
    const never_settled = new Promise((res) => (resolve = res));
    webLocks.request(sourceName, (lock) => never_settled);

    const controller = new AbortController();

    const promise = webLocks.request(
      sourceName,
      { signal: controller.signal },
      (lock) => {}
    );

    // Verify the request is enqueued:
    const state = await webLocks.query();
    // Number of held locks
    expect(
      state.held.filter((lock) => lock.name === sourceName).length
    ).toEqual(1);
    // Number of pending locks
    expect(
      state.pending.filter((lock) => lock.name === sourceName).length
    ).toEqual(1);

    let callback_called = false;
    setTimeout(() => {
      callback_called = true;
      controller.abort();
    }, 10);

    promise.catch((error) => {
      expect(error.message).toEqual("The request was aborted.");
      expect(error instanceof DOMException).toBeTruthy();
      // timeout should have caused the abort
      expect(callback_called).toBeTruthy();
    });
  });

  test("Signal that is not aborted", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    const controller = new AbortController();

    let got_lock = false;
    await webLocks.request(
      sourceName,
      { signal: controller.signal },
      async (lock) => {
        got_lock = true;
      }
    );

    // Lock should be acquired if abort is not signaled.
    expect(got_lock).toBeTruthy();
  });

  test("Synchronously signaled abort", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    const controller = new AbortController();

    let got_lock = false;
    const p = webLocks.request(
      sourceName,
      { signal: controller.signal },
      (lock) => {
        got_lock = true;
      }
    );
    // Even though lock is grantable, this abort should be processed synchronously.
    controller.abort();

    // Request should abort
    p.catch((error) => {
      expect(error.message).toEqual("The request was aborted.");
      expect(error instanceof DOMException).toBeTruthy();
    });

    // Request should be aborted if signal is synchronous
    expect(got_lock).toBeFalsy();

    await webLocks.request(sourceName, (lock) => {
      got_lock = true;
    });
    // Subsequent request should not be blocked
    expect(got_lock).toBeTruthy();
  });

  // Abort signaled after lock granted, granted Lock will released with not reject
  test("Abort signaled after lock granted", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    const controller = new AbortController();

    // Make a promise that resolves when the lock is acquired.
    const [acquired_promise, acquired_func] = makePromiseAndResolveFunc();

    // Request the lock.
    let release_func: any;
    const released_promise = webLocks.request(
      sourceName,
      { signal: controller.signal },
      (lock) => {
        acquired_func();

        // Hold lock until release_func is called.
        const [waiting_promise, waiting_func] = makePromiseAndResolveFunc();
        release_func = waiting_func;
        return waiting_promise;
      }
    );

    // Wait for the lock to be acquired.
    await acquired_promise;

    // Signal an abort.
    controller.abort();

    // Release the lock.
    release_func("resolved ok");

    // Lock released promise should not reject
    expect(await released_promise).toEqual("resolved ok");
  });

  test("Abort signaled after lock released", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    const controller = new AbortController();

    // Make a promise that resolves when the lock is acquired.
    const [acquired_promise, acquired_func] = makePromiseAndResolveFunc();

    // Request the lock.
    let release_func: any;
    const released_promise = webLocks.request(
      sourceName,
      { signal: controller.signal },
      (lock) => {
        acquired_func();

        // Hold lock until release_func is called.
        const [waiting_promise, waiting_func] = makePromiseAndResolveFunc();
        release_func = waiting_func;
        return waiting_promise;
      }
    );

    // Wait for the lock to be acquired.
    await acquired_promise;

    // Release the lock.
    release_func("resolved ok");

    // Signal an abort.
    controller.abort();

    // Lock released promise should not reject
    expect(await released_promise).toEqual("resolved ok");
  });
});
