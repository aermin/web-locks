import { LockManager } from "./polyfill";

(function () {
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
