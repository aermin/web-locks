import { WebLocks } from "./polyfill";

const locks = (function () {
  // if (!window?.navigator?.locks || true) {
  if (!window?.navigator?.locks) {
    const webLocks = new WebLocks();
    // TODO: follow navigator properties setting of native browser
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
