import { createWebLocksInstance, generateRandomId, LockInfo } from "./helpers";

// Returns an array of the modes for the locks with matching name.
function modes(list: LockInfo[], name: string) {
  return list.filter((item) => item.name === name).map((item) => item.mode);
}
// Returns an array of the clientIds for the locks with matching name.
function clients(list: LockInfo[], name: string) {
  return list.filter((item) => item.name === name).map((item) => item.clientId);
}

describe("Web Locks API: navigator.locks.query method", () => {
  test("query() returns dictionaries with expected properties", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    await webLocks.request(sourceName, async (lock1) => {
      // Attempt to request this again - should be blocked.
      let lock2_acquired = false;
      webLocks.request(sourceName, (lock2) => {
        lock2_acquired = true;
      });

      // Verify that it was blocked.
      await webLocks.request(
        sourceName,
        { ifAvailable: true },
        async (lock3) => {
          // second request should be blocked
          expect(lock2_acquired).toBeFalsy();
          // third request should have failed
          expect(lock3).toEqual(null);

          const state = await webLocks.query();

          // State has `pending` property
          expect(state).toHaveProperty("pending");
          // State `pending` property is an array
          expect(Array.isArray(state.pending)).toBeTruthy();
          const pending_info = state.pending[0];
          // Pending info dictionary has `name` property
          expect(pending_info).toHaveProperty("name");
          // Pending info dictionary has `mode` property
          expect(pending_info).toHaveProperty("mode");
          // Pending info dictionary has `clientId` property
          expect(pending_info).toHaveProperty("clientId");
          // State has `held` property
          expect(state).toHaveProperty("held");
          // State `held` property is an array
          expect(Array.isArray(state.held)).toBeTruthy();
          const held_info = state.held[0];
          // Held info dictionary has `name` property
          expect(held_info).toHaveProperty("name");
          // Held info dictionary has `mode` property
          expect(held_info).toHaveProperty("mode");
          // Held info dictionary has `clientId` property
          expect(held_info).toHaveProperty("clientId");
        }
      );
    });
  });

  test("query() reports individual held locks", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    await webLocks.request(sourceName, async (lock1) => {
      const state = await webLocks.query();
      // Held lock should appear once
      expect(modes(state.held, sourceName)).toEqual(["exclusive"]);
    });

    await webLocks.request(sourceName, { mode: "shared" }, async (lock1) => {
      const state = await webLocks.query();
      // Held lock should appear once
      expect(modes(state.held, sourceName)).toEqual(["shared"]);
    });
  });

  test("query() reports multiple held locks", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName1 = generateRandomId();
    const sourceName2 = generateRandomId();

    await webLocks.request(sourceName1, async (lock1) => {
      await webLocks.request(sourceName2, { mode: "shared" }, async (lock2) => {
        const state = await webLocks.query();
        // SHeld lock should appear once
        expect(modes(state.held, sourceName1)).toEqual(["exclusive"]);
        // Held lock should appear once
        expect(modes(state.held, sourceName2)).toEqual(["shared"]);
      });
    });
  });

  test("query() reports pending and held locks", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    await webLocks.request(sourceName, async (lock1) => {
      // Attempt to request this again - should be blocked.
      let lock2_acquired = false;
      webLocks.request(sourceName, (lock2) => {
        lock2_acquired = true;
      });

      // Verify that it was blocked.
      await webLocks.request(
        sourceName,
        { ifAvailable: true },
        async (lock3) => {
          // second request should be blocked
          expect(lock2_acquired).toBeFalsy();
          // third request should have failed
          expect(lock3).toEqual(null);

          const state = await webLocks.query();
          // Pending lock should appear once
          expect(modes(state.pending, sourceName)).toEqual(["exclusive"]);
          // Held lock should appear once
          expect(modes(state.held, sourceName)).toEqual(["exclusive"]);
        }
      );
    });
  });

  test("query() reports held shared locks with appropriate count", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    await webLocks.request(sourceName, { mode: "shared" }, async (lock1) => {
      await webLocks.request(sourceName, { mode: "shared" }, async (lock2) => {
        const state = await webLocks.query();
        // Held lock should appear twice
        expect(modes(state.held, sourceName)).toEqual(["shared", "shared"]);
      });
    });
  });

  test("query() reports pending shared locks with appropriate count", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName = generateRandomId();

    await webLocks.request(sourceName, async (lock1) => {
      let lock2_acquired = false,
        lock3_acquired = false;
      webLocks.request(sourceName, { mode: "shared" }, (lock2) => {
        lock2_acquired = true;
      });
      webLocks.request(sourceName, { mode: "shared" }, (lock3) => {
        lock3_acquired = true;
      });

      await webLocks.request(
        sourceName,
        { ifAvailable: true },
        async (lock4) => {
          // lock should not be available
          expect(lock4).toEqual(null);
          // second attempt should be blocked
          expect(lock2_acquired).toBeFalsy();
          // third attempt should be blocked
          expect(lock3_acquired).toBeFalsy();

          const state = await webLocks.query();
          // Held lock should appear once
          expect(modes(state.held, sourceName)).toEqual(["exclusive"]);
          // Pending lock should appear twice
          expect(modes(state.pending, sourceName)).toEqual([
            "shared",
            "shared",
          ]);
        }
      );
    });
  });

  test("query() reports the same clientId for held locks from the same context", async () => {
    const webLocks = createWebLocksInstance();
    const sourceName1 = generateRandomId();
    const sourceName2 = generateRandomId();

    await webLocks.request(sourceName1, async (lock1) => {
      await webLocks.request(sourceName2, async (lock2) => {
        const state = await webLocks.query();
        const res1_clients = clients(state.held, sourceName1);
        const res2_clients = clients(state.held, sourceName2);
        // Each lock should have one holder
        expect(res1_clients.length).toEqual(1);
        // Each lock should have one holder
        expect(res2_clients.length).toEqual(1);
        // Both locks should have same clientId
        expect(res1_clients).toEqual(res2_clients);
      });
    });
  });

  // TODO: other method to replace
  test("query() reports different ids for held locks from different contexts", async () => {});
});
