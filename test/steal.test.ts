import {
  beforeEachHandle,
  createWebLocksInstance,
  generateRandomId,
  neverSettledPromise,
} from "./helpers";

describe("Web Locks API: steal option", () => {
  beforeEachHandle();

  test("Lock available", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;
    await webLocks.request(sourceName, { steal: true }, (lock) => {
      callback_called = true;
      // Lock should be granted
      expect(lock !== null).toBeTruthy();
    });
    // Callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Lock not available", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    let callback_called = false;

    // Grab and hold the lock.
    webLocks
      .request(sourceName, (lock) => neverSettledPromise)
      .catch((_) => {});

    // Steal it.
    await webLocks.request(sourceName, { steal: true }, (lock) => {
      callback_called = true;
      // Lock should be granted
      expect(lock !== null).toBeTruthy();
    });

    // Callback should be called
    expect(callback_called).toBeTruthy();
  });

  test("Broken lock's release promise rejects", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    // Grab and hold the lock.
    const promise = webLocks.request(sourceName, (lock) => neverSettledPromise);

    // Initial request's promise should reject
    promise.catch((error) => {
      expect(error.message).toEqual(
        "Lock broken by another request with the 'steal' option."
      );
      expect(error instanceof DOMException).toBeTruthy();
    });

    // Steal it.
    await webLocks.request(sourceName, { steal: true }, (lock) => {});
  });

  test("Requested lock's release promise is deferred", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    // Grab and hold the lock.
    webLocks
      .request(sourceName, (lock) => neverSettledPromise)
      .catch((_) => {});

    // Make a request for it.
    let request_granted = false;
    const promise = webLocks.request(sourceName, (lock) => {
      request_granted = true;
    });

    // Steal it.
    await webLocks.request(sourceName, { steal: true }, (lock) => {
      // Steal should override request
      expect(request_granted).toBeFalsy();
    });

    await promise;
    // Request should eventually be granted
    expect(request_granted).toBeTruthy();
  });

  test("Last caller wins", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();
    // Grab and hold the lock.
    webLocks
      .request(sourceName, (lock) => neverSettledPromise)
      .catch((error) => {});

    // Steal it.
    let saw_abort = false;
    const first_steal = webLocks
      .request(sourceName, { steal: true }, (lock) => neverSettledPromise)
      .catch((error) => {
        saw_abort = true;
      });

    // Steal it again.
    await webLocks.request(sourceName, { steal: true }, (lock) => {});

    await first_steal;
    // First steal should have aborted
    expect(saw_abort).toBeTruthy();
  });
});
