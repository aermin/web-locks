import { HeartBeat } from "../src/heartBeat";
import {
  createWebLocksInstance,
  generateRandomId,
  neverSettledPromise,
} from "./helpers";

function dispatchPageHide(persisted: boolean) {
  const event = new Event("pagehide") as PageTransitionEvent;
  Object.defineProperty(event, "persisted", { value: persisted });
  window.dispatchEvent(event);
}

async function acquireHeldLock() {
  const webLocks = createWebLocksInstance();
  const sourceName = generateRandomId();
  let granted: () => void = () => {};
  const lockGrantedPromise = new Promise<void>((resolve) => {
    granted = resolve;
  });

  webLocks
    .request(sourceName, () => {
      granted();
      return neverSettledPromise;
    })
    .catch(() => undefined);
  await lockGrantedPromise;

  return webLocks;
}

describe("Web Locks API: BFCache lifecycle", () => {
  afterEach(() => {
    dispatchPageHide(false);
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("uses pagehide instead of unload for lifecycle cleanup", () => {
    const addEventListener = jest.spyOn(window, "addEventListener");

    createWebLocksInstance();

    expect(addEventListener).toHaveBeenCalledWith(
      "pagehide",
      expect.any(Function)
    );
    expect(addEventListener).not.toHaveBeenCalledWith(
      "unload",
      expect.any(Function)
    );
  });

  test("releases this client's held locks on non-BFCache pagehide", async () => {
    const webLocks = await acquireHeldLock();

    expect((await webLocks.query()).held).toHaveLength(1);

    dispatchPageHide(false);

    expect((await webLocks.query()).held).toHaveLength(0);
  });

  test("does not release this client's held locks when pagehide enters bfcache", async () => {
    const webLocks = await acquireHeldLock();

    dispatchPageHide(true);

    expect((await webLocks.query()).held).toHaveLength(1);
  });

  test("does not destroy heartbeat when pagehide enters bfcache", () => {
    jest.useFakeTimers();
    const heartBeat = new HeartBeat({
      key: "$navigator.locks-test-client",
    });
    heartBeat.start();

    dispatchPageHide(true);
    jest.advanceTimersByTime(1000);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "$navigator.locks-test-client",
      expect.any(String)
    );

    heartBeat.destroy();
  });

  test("destroys heartbeat on non-BFCache pagehide", () => {
    jest.useFakeTimers();
    const heartBeat = new HeartBeat({
      key: "$navigator.locks-test-client",
    });
    heartBeat.start();

    dispatchPageHide(false);
    jest.advanceTimersByTime(1000);

    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "$navigator.locks-test-client",
      expect.any(String)
    );
  });
});
