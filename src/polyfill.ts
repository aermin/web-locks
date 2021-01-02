import { BroadcastChannel } from "broadcast-channel";

interface Options {
  mode?: "exclusive" | "shared";
  ifAvailable?: Boolean;
  steal?: Boolean;
  signal?: AbortSignal;
}

interface Message {
  key: string;
}

type LockFnParams = Pick<Options, "mode"> & {
  name: string;
};

type LockFn = ({ name, mode }: LockFnParams) => any;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

export class WebLocks {
  private _reqChannel: BroadcastChannel<Message>;
  private _resChannel: BroadcastChannel<Message>;
  private _options: Options;
  public defaultOptions: Options;
  public grantedSet: Set<string>;
  constructor() {
    const controller = new AbortController();
    this.defaultOptions = {
      mode: "exclusive",
      ifAvailable: false,
      steal: false,
      signal: controller.signal
    };
    this.init();
  }

  init() {
    this._reqChannel = new BroadcastChannel("request");
    this._resChannel = new BroadcastChannel("Response");
    this.grantedSet = new Set();
  }

  async request(lockName: string, options?: Options, fn?: LockFn) {

    let func;
    if (typeof options === "function" && !fn) {
      func = options;
    } else if (!options && fn) {
      func = fn;
    } else {
      throw Error("please input right options");
    }
    this._options = { ...this.defaultOptions, ...options };


    const key = this._registerLockRequest(lockName);
    // polling ask if lock was granted
    await this.pollingAskGrante(key, async () => await func({ name: lockName, mode: this._options.mode }))
  }

  disGrante(key) {
    this.grantedSet.delete(key);
  }

  async pollingAskGrante(key, cb) {
    if (!this.grantedSet.has(key)) {
      return;
    } else if (await this.checkIsGranted(key, 3000)) {
      //if the lock is granted in one tab, continue polling ask, else grante this tab
      await sleep(3000);
      this.pollingAskGrante(key, cb);
    } else {
      this.grante();
      await cb();
      this.disGrante(key);
    }
  }

  private _registerLockRequest(lockName) {
    const key = `${lockName}${new Date().getTime()}`;
    this.grantedSet.add(key);
    return key;
  }

  grante() {
    this._reqChannel.onmessage = ({ key }) => {
      if (this.grantedSet.has(key)) {
        this._resChannel.postMessage({ key });
      }
    };
  }

  checkIsGranted(checkKey, delay) {
    return new Promise((resolve, reject) => {
      try {
        this._resChannel.onmessage = ({ key }) => {
          if (key === checkKey) {
            resolve(true);
          }
        };
        this._reqChannel.postMessage({ key: checkKey });
        setTimeout(() => resolve(false), delay);
      } catch (error) {
        reject(error);
      }
    });
  }
}
