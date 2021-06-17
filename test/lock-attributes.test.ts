import { beforeEachHandle, createWebLocksInstance } from "./helpers";

describe("Web Locks API: Lock Attributes", () => {
  beforeEachHandle();

  test("Lock attributes reflect requested properties (exclusive)", async () => {
    const webLocks = createWebLocksInstance();

    await webLocks.request("resource", (lock) => {
      expect(lock?.name).toBe("resource");
      expect(lock?.mode).toBe("exclusive");
    });
  });

  test("Lock attributes reflect requested properties (shared)", async () => {
    const webLocks = createWebLocksInstance();

    await webLocks.request("resource", { mode: "shared" }, (lock) => {
      expect(lock?.name).toBe("resource");
      expect(lock?.mode).toBe("shared");
    });
  });
});
