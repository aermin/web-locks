import { WebLocks } from "./polyfill";

const locks = (function() {
    if (!navigator.locks) {
      const webLocks = new WebLocks();
      navigator.locks = {
        // request: (lockName, async({name, mode}) => {})
        request: webLocks.request,
        // TODO：other methods
        // query: () => ({held, pending})
        ...navigator.locks
      };
    }
    return navigator.locks;
  })();

  export default locks;