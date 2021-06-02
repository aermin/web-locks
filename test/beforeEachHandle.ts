import { dispatchEvent } from "../src/localStorageSubscribe";

let mockFridge: { [P: string]: any } = {};

export default function beforeEachHandle() {
  beforeEach(() => {
    global.Storage.prototype.setItem = jest.fn((key, value) => {
      mockFridge[key] = value;
      dispatchEvent(key, value);
    });
    global.Storage.prototype.getItem = jest.fn((key) => mockFridge[key]);
  });
}
