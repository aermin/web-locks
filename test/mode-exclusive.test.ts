import { beforeEachHandle, createWebLocksInstance } from "./helpers";

describe("test suite of Web Locks API: mode-exclusive", () => {
  beforeEachHandle();

  test("Lock requests are granted in order", async () => {
    const granted: Number[] = [];
    function log_grant(n: number) {
      return () => {
        granted.push(n);
      };
    }

    const webLocks = createWebLocksInstance();

    await Promise.all([
      webLocks.request("a", log_grant(1)),
      webLocks.request("a", log_grant(2)),
      webLocks.request("a", log_grant(3)),
    ]);
    expect(granted).toEqual([1, 2, 3]);
  });

  test("Requests for distinct resources can be granted", async () => {
    const granted: Number[] = [];
    function log_grant(n: number) {
      return () => {
        granted.push(n);
      };
    }

    const webLocks = createWebLocksInstance();

    let inner_promise;
    await webLocks.request("a", async (lock) => {
      inner_promise = Promise.all([
        // This will be blocked.
        webLocks.request("a", log_grant(1)),
        // But this should be grantable immediately.
        webLocks.request("b", log_grant(2)),
      ]);
      // Flush microtask queue
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await inner_promise;
    expect(granted).toEqual([2, 1]);
  });
});
