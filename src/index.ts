import { WebLocks } from "./polyfill";

const locks = (function () {
  if (!window?.navigator?.locks) {
    const webLocks = new WebLocks();
    Object.defineProperty(window, 'navigator', {
      value: {
        locks: webLocks
      },
      writable: true
    })
  }
  return window.navigator.locks;
})();

export default locks;
