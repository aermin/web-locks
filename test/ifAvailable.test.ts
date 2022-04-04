import {
  beforeEachHandle,
  createWebLocksInstance,
  generateRandomId,
  sleep,
} from "./helpers";

describe("Web Locks API: ifAvailable option", () => {
  beforeEachHandle();

  test("Lock request with ifAvailable - lock available", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, { ifAvailable: true }, async (lock) => {
      callback_called = true;
      // lock should be granted
      expect(lock !== null).toBeTruthy();
    });
    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Lock request with ifAvailable - lock not available", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;

    await webLocks.request(sourceName, async (lock) => {
      // Request would time out if |ifAvailable| was not specified.
      const result = await webLocks.request(
        sourceName,
        { ifAvailable: true },
        async (lock) => {
          callback_called = true;
          // lock should not be granted
          expect(lock).toEqual(null);
          return 123;
        }
      );
      // result should be value returned by callback
      expect(result).toEqual(123);
    });
    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Lock request with ifAvailable - lock not available, callback throws", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    let reached = false;

    await webLocks.request(sourceName, async (lock) => {
      try {
        // Request would time out if |ifAvailable| was not specified.
        await webLocks.request(
          sourceName,
          { ifAvailable: true },
          async (lock) => {
            callback_called = true;
            // lock should not be granted
            expect(lock).toEqual(null);
            throw 123;
          }
        );
        reached = true;
      } catch (ex) {
        //ex should be value thrown by callback
        expect(ex).toEqual(123);
      }
      expect(reached).toBeFalsy();
    });
    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("ck request with ifAvailable - unrelated lock held", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, async (lock) => {
      // Request with a different name - should be grantable.
      await webLocks.request(
        "different",
        { ifAvailable: true },
        async (lock) => {
          callback_called = true;
          // lock should be granted
          expect(lock !== null).toBeTruthy();
        }
      );
    });
    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Shared lock request with ifAvailable - shared lock held", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, { mode: "shared" }, async (lock) => {
      await webLocks.request(
        sourceName,
        { mode: "shared", ifAvailable: true },
        async (lock) => {
          callback_called = true;
          // lock should be granted
          expect(lock !== null).toBeTruthy();
        }
      );
    });

    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Exclusive lock request with ifAvailable - shared lock held", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, { mode: "shared" }, async (lock) => {
      // Request would time out if |ifAvailable| was not specified.
      await webLocks.request(
        sourceName,
        { ifAvailable: true },
        async (lock) => {
          callback_called = true;
          // lock should not be granted
          expect(lock).toEqual(null);
        }
      );
    });
    // callback should be called
    expect(callback_called).toBeTruthy();

    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Shared lock request with ifAvailable - exclusive lock held", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, async (lock) => {
      // Request would time out if |ifAvailable| was not specified.
      await webLocks.request(
        sourceName,
        { mode: "shared", ifAvailable: true },
        async (lock) => {
          callback_called = true;
          // lock should not be granted
          expect(lock).toEqual(null);
        }
      );
    });
    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Returned Promise rejects if callback throws synchronously", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, async (lock) => {
      callback_called = true;
      const test_error = { name: "test" };
      const p = webLocks.request(sourceName, { ifAvailable: true }, (lock) => {
        // lock should not be available
        expect(lock).toEqual(null);
        throw test_error;
      });
      // request() result is a Promise
      expect(Promise.resolve(p)).toEqual(p);
      try {
        await p;
      } catch (error) {
        // result should reject
        expect(error).toEqual(test_error);
      }
    });
    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Returned Promise rejects if async callback yields rejected promise", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, async (lock) => {
      callback_called = true;
      const test_error = { name: "test" };
      const p = webLocks.request(
        sourceName,
        { ifAvailable: true },
        async (lock) => {
          // lock should not be available
          expect(lock).toEqual(null);
          throw test_error;
        }
      );
      // request() result is a Promise
      expect(Promise.resolve(p)).toEqual(p);
      try {
        await p;
      } catch (error) {
        // result should reject
        expect(error).toEqual(test_error);
      }
    });
    // callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Locks are available once previous release is processed", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName1 = generateRandomId();
    const sourceName2 = generateRandomId();

    let callback1_called = false;

    await webLocks.request(sourceName1, async (lock) => {
      callback1_called = true;
      let callback2_called = false;
      await webLocks.request(sourceName2, async (lock) => {
        callback2_called = true;
      });
      // callback2 should be called
      expect(callback2_called).toBeTruthy();

      let callback3_called = false;
      await webLocks.request(
        sourceName2,
        { ifAvailable: true },
        async (lock) => {
          callback3_called = true;
          // This request would fail if the "is this grantable?" test
          // failed, e.g. due to the release without a pending request
          // skipping steps.

          // Lock should be available
          expect(lock !== null).toBeTruthy();
        }
      );
      // callback2 should be called
      expect(callback3_called).toBeTruthy();
    });
    // callback1 should be called
    expect(callback1_called).toBeTruthy();
  });

  test("nested locks that throw exception", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName1 = generateRandomId();
    const sourceName2 = generateRandomId();

    let callback1_called = false;

    await webLocks.request(
      sourceName1,
      { ifAvailable: true },
      async (lock1) => {
        if (lock1 === null) {
          // this code path is not reached since this is the first request for sourceName1
          return;
        }

        callback1_called = true;

        let callback2_called = false;

        await expect(() =>
          webLocks.request(
            sourceName2,
            { ifAvailable: true },
            async (lock2) => {
              if (lock2 === null) {
                // this code path is not reached since this is the first request for sourceName2
                return;
              }

              callback2_called = true;

              let callback3_called = false;

              await webLocks.request(
                sourceName1,
                { ifAvailable: true },
                async (lock3) => {
                  if (lock3 === null) {
                    // this code path *is* reached since this sourceName1 is already held
                    return;
                  }

                  // this code path is not reached
                  callback3_called = true;
                }
              );

              expect(callback3_called).toBeFalsy();

              // this will raise exception that we catch later
              if (!callback3_called) {
                throw new Error("test error");
              }
            }
          )
        ).rejects.toHaveProperty("message", "test error");

        // at this point there should only be one lock held, namely sourceName1
        expect((await webLocks.query()).held).toHaveLength(1);

        expect(callback2_called).toBeTruthy();
      }
    );

    expect(callback1_called).toBeTruthy();
  });
});
