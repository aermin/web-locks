import { createWebLocksInstance, defer, generateRandomId } from "./helpers";
import { HeartBeat } from "../src/heartBeat";
import { LockManager } from "../src/polyfill";

describe("Web Locks API: Mixed Modes", () => {
  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("An exclusive request waits for the last shared holder to release", async () => {
    const webLocks = createWebLocksInstance();
    const name = generateRandomId();
    const first = defer();
    const second = defer();
    const secondGranted = defer();
    const log: string[] = [];

    const a = webLocks.request(name, { mode: "shared" }, async () => {
      log.push("+A");
      await first.promise;
      log.push("-A");
    });
    const b = webLocks.request(name, { mode: "shared" }, async () => {
      log.push("+B");
      secondGranted.resolve();
      await second.promise;
      log.push("-B");
    });
    await secondGranted.promise;
    const c = webLocks.request(name, () => {
      log.push("+C");
    });

    first.resolve();
    try {
      await a;
      const { held, pending } = await webLocks.query();
      expect(
        held.filter((lock) => lock.name === name).map((lock) => lock.mode)
      ).toEqual(["shared"]);
      expect(pending).toContainEqual(
        expect.objectContaining({ name, mode: "exclusive" })
      );
    } finally {
      second.resolve();
      await Promise.all([a, b, c]);
    }

    expect(log).toEqual(["+A", "+B", "-A", "-B", "+C"]);
  });

  test("Releasing a queued shared lock preserves holders of other resources", async () => {
    jest.useFakeTimers();
    const webLocks = createWebLocksInstance();
    const name = generateRandomId();
    const otherName = generateRandomId();
    const blocker = defer();
    const first = defer();
    const second = defer();
    const other = defer();

    const initial = webLocks.request(name, () => blocker.promise);
    const a = webLocks.request(name, { mode: "shared" }, () => first.promise);
    const b = webLocks.request(name, { mode: "shared" }, () => second.promise);
    const exclusive = jest.fn();
    const c = webLocks.request(name, exclusive);
    const d = webLocks.request(otherName, () => other.promise);
    const stateAfterA = a.then(() => webLocks.query());
    const requests = Promise.allSettled([initial, a, b, c, d]);

    blocker.resolve();
    first.resolve();
    try {
      await jest.advanceTimersByTimeAsync(1000);
      const { held } = await stateAfterA;
      expect(
        held.filter((lock) => lock.name === name).map((lock) => lock.mode)
      ).toEqual(["shared"]);
      expect(held).toContainEqual(expect.objectContaining({ name: otherName }));
      expect(exclusive).not.toHaveBeenCalled();
    } finally {
      second.resolve();
      other.resolve();
      await jest.advanceTimersByTimeAsync(1000);
      await requests;
    }
    expect(exclusive).toHaveBeenCalledTimes(1);
  });

  test("Cleaning a stale client preserves the exclusive request while another client holds a shared lock", async () => {
    jest.useFakeTimers();
    jest.spyOn(HeartBeat.prototype, "start").mockImplementationOnce(() => {});
    const staleClient = createWebLocksInstance();
    const activeClient = new LockManager();
    const name = generateRandomId();
    const stale = defer();
    const active = defer();
    const exclusive = jest.fn();

    const staleRequest = staleClient.request(
      name,
      { mode: "shared" },
      () => stale.promise
    );
    const activeRequest = activeClient.request(
      name,
      { mode: "shared" },
      () => active.promise
    );
    const exclusiveRequest = activeClient.request(name, exclusive);
    const requests = Promise.allSettled([
      staleRequest,
      activeRequest,
      exclusiveRequest,
    ]);

    try {
      await jest.advanceTimersByTimeAsync(2000);
      const { held, pending } = await activeClient.query();
      expect(
        held.filter((lock) => lock.name === name).map((lock) => lock.mode)
      ).toEqual(["shared"]);
      expect(pending).toContainEqual(
        expect.objectContaining({ name, mode: "exclusive" })
      );
      expect(exclusive).not.toHaveBeenCalled();
    } finally {
      stale.resolve();
      active.resolve();
      await requests;
    }
    expect(exclusive).toHaveBeenCalledTimes(1);
  });

  test("Lock requests are granted in order", async () => {
    const webLocks = createWebLocksInstance();

    let unblock: any;
    const blocked = new Promise((r) => {
      unblock = r;
    });

    const granted: string[] = [];

    // These should be granted immediately, and held until unblocked.
    webLocks.request("a", { mode: "shared" }, async (lock) => {
      granted.push("a-shared-1");
      await blocked;
    });
    webLocks.request("a", { mode: "shared" }, async (lock) => {
      granted.push("a-shared-2");
      await blocked;
    });
    webLocks.request("a", { mode: "shared" }, async (lock) => {
      granted.push("a-shared-3");
      await blocked;
    });

    // This should be blocked.
    let exclusive_lock: any;
    const exclusive_request = webLocks.request("a", async (lock) => {
      granted.push("a-exclusive");
      exclusive_lock = lock;
    });

    // This should be granted immediately (different name).
    await webLocks.request("b", { mode: "exclusive" }, (lock) => {
      granted.push("b-exclusive");
    });

    expect(granted).toEqual([
      "a-shared-1",
      "a-shared-2",
      "a-shared-3",
      "b-exclusive",
    ]);

    // Release the shared locks granted above.
    unblock();

    // Now the blocked request can be granted.
    await exclusive_request;
    expect(exclusive_lock.mode).toEqual("exclusive");

    expect(granted).toEqual([
      "a-shared-1",
      "a-shared-2",
      "a-shared-3",
      "b-exclusive",
      "a-exclusive",
    ]);

    await webLocks.request("resource", (lock) => {
      expect(lock?.name).toEqual("resource");
      expect(lock?.mode).toEqual("exclusive");
    });
  });
});
