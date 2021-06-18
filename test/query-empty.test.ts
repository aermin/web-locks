import { beforeEachHandle, createWebLocksInstance } from "./helpers";

describe("Web Locks API: navigator.locks.query method - no locks held", () => {
  beforeEachHandle();

  test("query() returns dictionary with empty arrays when no locks are held", async () => {
    const webLocks = createWebLocksInstance();

    const state = await webLocks.query();

    // State has `pending` property
    expect(state).toHaveProperty("pending");
    // State `pending` property is an array
    expect(Array.isArray(state.pending)).toBeTruthy();
    // Pending array is empty
    expect(state.pending).toEqual([]);

    // State has `held` property
    expect(state).toHaveProperty("held");
    // State `held` property is an array
    expect(Array.isArray(state.held)).toBeTruthy();
    // Held array is empty
    expect(state.held).toEqual([]);
  });
});
