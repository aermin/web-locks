import {
  createWebLocksInstance,
  defer,
  generateRandomId,
  LockInfo,
  neverSettledPromise,
} from "./helpers";

// 远端写入先更新共享存储，storage 事件由测试稍后派发，复现跨窗口通知延迟。
function writeRemoteHeldLocks(held: LockInfo[]) {
  const key = "$navigator.locks-heldLockSet";
  const oldValue = localStorage.getItem(key) ?? null;
  const newValue = JSON.stringify(held);
  localStorage.setItem(key, newValue);
  return new StorageEvent("storage", {
    key,
    oldValue,
    newValue,
    storageArea: localStorage,
  });
}

describe("Web Locks API: steal notification races", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("A grant followed by a steal rejects before either storage notification is processed", async () => {
    const webLocks = createWebLocksInstance();
    const name = generateRandomId();
    const otherHeld = (await webLocks.query()).held;
    const remoteLock: LockInfo = {
      name,
      mode: "exclusive",
      clientId: "remote-client",
      uuid: generateRandomId(),
    };
    writeRemoteHeldLocks([...otherHeld, remoteLock]);

    let error: unknown;
    const callback = jest.fn(() => neverSettledPromise);
    webLocks.request(name, callback).catch((reason) => {
      error = reason;
    });
    const queued = (await webLocks.query()).pending.find(
      (lock) => lock.name === name
    )!;
    const queueKey = "$navigator.locks-requestQueueMap";
    const queues = JSON.parse(localStorage.getItem(queueKey)!);
    queues[name] = [];
    localStorage.setItem(queueKey, JSON.stringify(queues));
    const grant = writeRemoteHeldLocks([...otherHeld, queued]);
    const steal = writeRemoteHeldLocks([...otherHeld, remoteLock]);

    window.dispatchEvent(grant);
    window.dispatchEvent(steal);
    await jest.advanceTimersByTimeAsync(0);

    expect(error).toBeInstanceOf(DOMException);
    expect(error).toHaveProperty("name", "AbortError");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test.each(["fulfills", "rejects"])(
    "A stolen request rejects with AbortError when its callback %s before notification",
    async (outcome) => {
      const webLocks = createWebLocksInstance();
      const name = generateRandomId();
      const release = defer();
      const request = webLocks.request(name, () =>
        release.promise.then(() => {
          if (outcome === "rejects") throw new Error("callback failed");
          return "ok";
        })
      );
      const result = request.catch((error) => error);
      await jest.advanceTimersByTimeAsync(0);
      const held = (await webLocks.query()).held;
      const original = held.find((lock) => lock.name === name)!;
      const notification = writeRemoteHeldLocks([
        ...held.filter((lock) => lock.uuid !== original.uuid),
        { ...original, clientId: "remote-client", uuid: generateRandomId() },
      ]);

      release.resolve();
      await jest.advanceTimersByTimeAsync(0);

      expect(await result).toBeInstanceOf(DOMException);
      expect(await result).toHaveProperty("name", "AbortError");
      window.dispatchEvent(notification);
    }
  );

  test("A steal in a later task preserves a completed queued shared callback's result", async () => {
    const webLocks = createWebLocksInstance();
    const name = generateRandomId();
    const release = defer();
    const blocker = webLocks.request(name, () => release.promise);
    await jest.advanceTimersByTimeAsync(0);
    const callback = jest.fn(() => "ok");
    const request = webLocks.request(name, { mode: "shared" }, callback);
    const result = request.catch((error) => error);
    jest.spyOn(Math, "random").mockReturnValue(0.8);

    release.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(20);

    const thief = webLocks.request(name, { steal: true }, () => {});
    await jest.advanceTimersByTimeAsync(1000);
    await Promise.all([blocker, thief]);
    expect(await result).toBe("ok");
  });
});
