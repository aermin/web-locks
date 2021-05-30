import { WebLocks } from "../src/polyfill";
type EventType = Event & {
  value?: string;
  key?: string;
};

let mockFridge: { [P: string]: any } = {};

beforeAll(() => {
  global.Storage.prototype.setItem = jest.fn((key, value) => {
    console.log("666===", key, value);
    mockFridge[key] = value;
    var event: EventType = new Event(key);
    event.value = value;
    event.key = key;
    console.log("dispatchEvent===", event);
    document.dispatchEvent(event);
  });
  global.Storage.prototype.getItem = jest.fn((key) => mockFridge[key]);
});

/**
 * @jest-environment jsdom
 */
test("base", async () => {

  const granted: Number[] = [];
  function log_grant(n: number) {
    return () => {
      granted.push(n);
    };
  }
  const webLocks = new WebLocks();
  window.localStorage.removeItem("heldLockSet");

  await Promise.all([
    webLocks.request("a", log_grant(1)),
    webLocks.request("a", log_grant(2)),
    webLocks.request("a", log_grant(3)),
  ]);
  console.log("333===");
  expect(granted).toEqual([1, 2, 3]);
});
