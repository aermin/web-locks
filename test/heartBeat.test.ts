/**
 * @jest-environment node
 */

import { HeartBeat } from "../src/heartBeat";

type BrowserLikeGlobal = {
  window?: Pick<Window, "addEventListener">;
  Storage: typeof Storage;
};

const browserGlobal = globalThis as unknown as BrowserLikeGlobal;

browserGlobal.Storage = class Storage {} as unknown as typeof Storage;

function setUpWindow() {
  browserGlobal.window = {
    addEventListener: jest.fn(),
  };
}

describe("HeartBeat teardown", () => {
  beforeEach(() => {
    setUpWindow();
    jest.useFakeTimers();
  });

  afterEach(() => {
    delete browserGlobal.window;
    jest.useRealTimers();
  });

  test("clears both intervals when the heartbeat callback loses window", () => {
    const heartBeat = new HeartBeat({
      key: "$navigator.locks-test-client",
      heartBeatDetectIntervalTime: 3000,
    });
    heartBeat.start();
    heartBeat.detect(jest.fn());

    delete browserGlobal.window;
    jest.advanceTimersByTime(1000);

    expect(jest.getTimerCount()).toBe(0);
  });

  test("does not run stale-client detection after window is unavailable", () => {
    const heartBeat = new HeartBeat({
      key: "$navigator.locks-test-client",
      heartBeatIntervalTime: 3000,
    });
    const detect = jest.fn();
    heartBeat.start();
    heartBeat.detect(detect);

    delete browserGlobal.window;
    jest.advanceTimersByTime(2000);

    expect(detect).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
