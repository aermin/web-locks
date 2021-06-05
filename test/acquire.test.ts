import {
  beforeEachHandle,
  createWebLocksInstance,
  generateRandomId,
} from "./helpers";

describe("Returned Promise rejects if callback throws asynchronously", () => {
  beforeEachHandle();

  test("navigator.locks.request requires a name and a callback", async () => {
    const webLocks = createWebLocksInstance();
    try {
      // @ts-ignore
      await webLocks.request();
    } catch ({ name, message }) {
      expect(name).toEqual("TypeError");
      expect(message).toEqual(
        "Failed to execute 'request' on 'LockManager': 2 arguments required, but only 0 present."
      );
    }

    try {
      const sourceName = generateRandomId();
      // @ts-ignore
      await webLocks.request(sourceName);
    } catch ({ name, message }) {
      expect(name).toEqual("TypeError");
      expect(message).toEqual(
        "Failed to execute 'request' on 'LockManager': 2 arguments required, but only 1 present."
      );
    }
  });

  test('mode must be "shared" or "exclusive"', async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();
    try {
      // @ts-ignore
      await webLocks.request(sourceName, { mode: "foo" }, (lock) => {});
    } catch ({ name, message }) {
      expect(name).toEqual("TypeError");
      expect(message).toEqual(
        "Failed to execute 'request' on 'LockManager': The provided value 'foo' is not a valid enum value of type LockMode."
      );
    }

    try {
      // @ts-ignore
      await webLocks.request(sourceName, { mode: null }, (lock) => {});
    } catch ({ name, message }) {
      expect(name).toEqual("TypeError");
      expect(message).toEqual(
        "Failed to execute 'request' on 'LockManager': The provided value 'null' is not a valid enum value of type LockMode."
      );
    }

    // 'mode is exclusive'
    let mode;
    await webLocks.request(
      sourceName,
      { mode: "exclusive" },
      (lock) => (mode = lock?.mode)
    );
    expect(mode).toEqual("exclusive");

    // 'mode is shared'
    await webLocks.request(
      sourceName,
      { mode: "shared" },
      (lock) => (mode = lock?.mode)
    );
    expect(mode).toEqual("shared");
  });

  test("The 'steal' and 'ifAvailable' options are mutually exclusive", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    try {
      // @ts-ignore
      await webLocks.request(
        sourceName,
        { steal: true, ifAvailable: true },
        (lock) => {}
      );
    } catch (error) {
      expect(error.message).toEqual(
        "Failed to execute 'request' on 'LockManager': The 'steal' and 'ifAvailable' options cannot be used together."
      );
      expect(error instanceof DOMException).toBeTruthy();
    }
  });

  test("The 'steal' option must be used with exclusive locks", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    try {
      // @ts-ignore
      await webLocks.request(
        sourceName,
        { mode: "shared", steal: true },
        (lock) => {}
      );
    } catch (error) {
      expect(error.message).toEqual(
        "Failed to execute 'request' on 'LockManager': The 'steal' option may only be used with 'exclusive' locks."
      );
      expect(error instanceof DOMException).toBeTruthy();
    }
  });

  test("The 'signal' and 'steal' options are mutually exclusive", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();
    const controller = new AbortController();

    try {
      // @ts-ignore
      await webLocks.request(
        sourceName,
        { signal: controller.signal, steal: true },
        (lock) => {}
      );
    } catch (error) {
      expect(error.message).toEqual(
        "Failed to execute 'request' on 'LockManager': The 'signal' and 'steal' options cannot be used together."
      );
      expect(error instanceof DOMException).toBeTruthy();
    }
  });

  test("The 'signal' and 'ifAvailable' options are mutually exclusive", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();
    const controller = new AbortController();

    try {
      // @ts-ignore
      await webLocks.request(
        sourceName,
        { signal: controller.signal, ifAvailable: true },
        (lock) => {}
      );
    } catch (error) {
      expect(error.message).toEqual(
        "Failed to execute 'request' on 'LockManager': The 'signal' and 'ifAvailable' options cannot be used together."
      );
      expect(error instanceof DOMException).toBeTruthy();
    }
  });
});
