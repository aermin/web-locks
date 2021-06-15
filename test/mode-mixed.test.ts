import { beforeEachHandle, createWebLocksInstance } from "./helpers";

describe("Web Locks API: Mixed Modes", () => {
  beforeEachHandle();

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
