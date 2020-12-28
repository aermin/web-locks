import { WebLocks } from "./polyfill";

const locks = (function () {
  if (!window?.navigator?.locks) {
    const webLocks = new WebLocks();
    Object.defineProperty(window?.navigator, 'locks', {
      value: {
        request: webLocks.request
      },
      writable: false
    })
    console.log("navigator.locks~~", window.navigator.locks);
  }
  return window.navigator.locks;
})();

export default locks;
