import { BroadcastChannel } from "broadcast-channel";

interface Options {
  mode?: "exclusive" | "shared";
  ifAvailable?: Boolean;
  steal?: Boolean;
  signal?: AbortSignal;
}

type LockFnParams = Pick<Options, "mode"> & {
  name: string;
};

type LockFn = ({ name, mode }: LockFnParams) => any;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

export class WebLocks {
  private _channel: BroadcastChannel;
  private _options: Options;
  public defaultOptions: Options;
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

  get grantedQueue() {
    const grantedQueue = window.localStorage.getItem('grantedQueue');
    return grantedQueue ? JSON.parse(window.localStorage.getItem('grantedQueue')) : null;
  }

  _addGrantedQueue(lockName?: string) {
    const grantedQueue = this.grantedQueue || [];
    let key;
    if (lockName) {
      key = `${lockName}${new Date().getTime()}`;
      grantedQueue.push(key);
    }
    window.localStorage.setItem('grantedQueue', JSON.stringify(grantedQueue));
    return key;
  }

  _deleteGrantedQueue(key: string) {
    const firstQueue = this.grantedQueue[0];
    if (firstQueue) {
      if (firstQueue === key) {
        const newQueue = this.grantedQueue.shift();
        window.localStorage.setItem('grantedQueue', JSON.stringify(newQueue));
      } else {
        throw ('the first key in queue is not equal to the key should be delete!')
      }
    }
  }

  init() {
    this._channel = new BroadcastChannel("web-locks");
    if (!this.grantedQueue) {
      this._addGrantedQueue();
    }
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

    if (this.grantedQueue && this.grantedQueue.length === 0) {
      const grantedKeyInQueue = this._addGrantedQueue(lockName);
      await func({ name: lockName, mode: this._options.mode });
      this._afterRequestEventFinished(grantedKeyInQueue);
    } else {
      const grantedKeyInQueue = this._addGrantedQueue(lockName);
      this._channel.onmessage(async ({ key }) => {
        if (key === grantedKeyInQueue) {
          await func({ name: lockName, mode: this._options.mode });
          this._afterRequestEventFinished(grantedKeyInQueue);
        }
      })
    }
  }

  private _afterRequestEventFinished(grantedKeyInQueue) {
    this._deleteGrantedQueue(grantedKeyInQueue);
    const newFirstKey = this.grantedQueue[0];
    if (newFirstKey) {
      this._channel.postMessage({ key: newFirstKey });
    }
  }
}
