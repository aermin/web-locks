import {
  LockManager,
  LockInfo,
  LocksInfo,
  Lock,
  LockManagerSnapshot,
} from "./polyfill";

const locks = (function () {
  if (typeof window !== "undefined") {
    const navigator = window.navigator as Navigator & { locks: LockManager };
    if (navigator && !navigator.locks) {
      const lockManager = new LockManager();
      Object.defineProperty(navigator, "locks", {
        value: lockManager,
      });
    }
  }
})();

export {
  LockManager,
  locks as default,
  LockInfo,
  LocksInfo,
  Lock,
  LockManagerSnapshot,
};
