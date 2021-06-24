import { beforeEachHandle, createWebLocksInstance } from "./helpers";

describe("Web Locks API: mode-shared", () => {
  beforeEachHandle();

  test("Lock requests are granted in order", async () => {
    const granted: Number[] = [];
    function log_grant(n: number) {
      return () => {
        granted.push(n);
      };
    }
    const webLocks = createWebLocksInstance();
    window.localStorage.removeItem("heldLockSet");

    await Promise.all([
      webLocks.request("a", { mode: "shared" }, log_grant(1)),
      webLocks.request("b", { mode: "shared" }, log_grant(2)),
      webLocks.request("c", { mode: "shared" }, log_grant(3)),
      webLocks.request("a", { mode: "shared" }, log_grant(4)),
      webLocks.request("b", { mode: "shared" }, log_grant(5)),
      webLocks.request("c", { mode: "shared" }, log_grant(6)),
    ]);

    expect(granted).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("Shared locks are not exclusive", async () => {
    const webLocks = createWebLocksInstance();

    let a_acquired = false,
      a_acquired_again = false;

    await webLocks.request("a", { mode: "shared" }, async (lock) => {
      a_acquired = true;

      // Since lock is held, this request would be blocked if the
      // lock was not 'shared', causing this test to time out.

      await webLocks.request("a", { mode: "shared" }, (lock) => {
        a_acquired_again = true;
      });
    });

    // first lock acquired
    expect(a_acquired).toEqual(true);
    // second lock acquired
    expect(a_acquired_again).toEqual(true);
  });
});
