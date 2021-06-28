import {
  LockManager,
  LockInfo,
  LocksInfo,
  Lock,
  LockManagerSnapshot,
} from "./polyfill";

const locks = (function () {
  const navigator = window?.navigator as Navigator & { locks: LockManager };
  if (!navigator?.locks) {
    const lockManager = new LockManager();
    Object.defineProperty(navigator, "locks", {
      value: lockManager,
    });
  }
  return navigator?.locks;
})();

export {
  LockManager,
  locks as default,
  LockInfo,
  LocksInfo,
  Lock,
  LockManagerSnapshot,
};
