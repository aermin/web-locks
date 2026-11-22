import { LockManager } from "../src/polyfill";
export * from "../src/sleep";
export * from "../src/polyfill";

export function createWebLocksInstance() {
  localStorage.clear();
  return new LockManager();
}

export function defer() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export const neverSettledPromise = new Promise((resolve) => {
  /* never */
});
