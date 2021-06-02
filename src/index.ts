import { WebLocks } from "./polyfill";

const locks = (function () {
  const navigator = window?.navigator as Navigator & { locks: WebLocks };
  // if (!window?.navigator?.locks || true) {
  if (!navigator?.locks) {
    const webLocks = new WebLocks();
    // TODO: follow navigator properties setting of native browser
    Object.defineProperty(window, "navigator", {
      value: {
        locks: webLocks,
      },
      writable: true,
    });
  }
  return navigator?.locks;
})();

export { WebLocks, locks as default };
