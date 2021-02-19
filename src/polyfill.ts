import { onLocalStorageInit, onStorageChange } from './localStorageSubscribe';

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


const STORAGE_ITEM_KEY = 'requestQueue';
export class WebLocks {
  private _options: Options;
  public defaultOptions: Options;
  protected selfRequestQueue: string[] = [];
  constructor() {
    const controller = new AbortController();
    this.defaultOptions = {
      mode: "exclusive",
      ifAvailable: false,
      steal: false,
      signal: controller.signal
    };
    this._init();
  }

  get globalRequestQueue() {
    const requestQueue = window.localStorage.getItem(STORAGE_ITEM_KEY);
    return requestQueue ? JSON.parse(window.localStorage.getItem(STORAGE_ITEM_KEY)) : [];
  }

  private _addRequestKey(lockName?: string) {
    const requestQueue = [...this.globalRequestQueue];
    let key;
    if (lockName) {
      key = `${lockName}${new Date().getTime()}`;
      requestQueue.push(key);
      this.selfRequestQueue.push(key);
    }
    if (this.globalRequestQueue.length !== requestQueue.length) {
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(requestQueue));
    }
    return key;
  }

  private _deleteFirstRequestKey(key: string) {
    const firstKey = this.globalRequestQueue[0];
    if (firstKey) {
      if (firstKey === key) {
        this._deleteRequestKey(key);
      } else {
        throw ('the first key in queue is not equal to the key should be delete!')
      }
    }
  }

  private _deleteSelfRequestKey(key: string) {
    const selfQueueIndex = this.selfRequestQueue.indexOf(key);
    if (selfQueueIndex !== -1) {
      this.selfRequestQueue.splice(selfQueueIndex, 1);
    } else {
      throw ('could find this key in self Request queue!')
    }
  }

  private _deleteGlobalRequestKey(key: string) {
    const tempQueue = [...this.globalRequestQueue];
    const globalQueueIndex = tempQueue.indexOf(key);
    if (globalQueueIndex !== -1) {
      tempQueue.splice(globalQueueIndex, 1);
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(tempQueue));
    } else {
      throw ('could find this key in global request queue!')
    }
  }

  private _deleteRequestKey(key: string) {
    this._deleteSelfRequestKey(key);
    this._deleteGlobalRequestKey(key);
  }

  private _init() {
    onLocalStorageInit();
    if (!this.globalRequestQueue) {
      this._addRequestKey();
    }
    this._onUnload();
  }

  protected async request(lockName: string, options?: Options, fn?: LockFn) {
    return new Promise(async (resolve, reject) => {
      let func;
      if (typeof options === "function" && !fn) {
        func = options;
      } else if (!options && fn) {
        func = fn;
      } else {
        throw Error("please input right options");
      }
      this._options = { ...this.defaultOptions, ...options };

      if (this.globalRequestQueue && this.globalRequestQueue.length === 0) {
        const requestKeyInQueue = this._addRequestKey(lockName);
        const result = await func({ name: lockName, mode: this._options.mode });
        this._deleteFirstRequestKey(requestKeyInQueue);
        resolve(result);
      } else {
        const requestKeyInQueue = this._addRequestKey(lockName);
        const listener = async () => {
          if (requestKeyInQueue === this.currentRequestKey) {
            const result = await func({ name: lockName, mode: this._options.mode });
            this._deleteFirstRequestKey(requestKeyInQueue);
            resolve(result);
            return true;
          }
          return false;
        }
        onStorageChange(STORAGE_ITEM_KEY, listener);
      }
    })
  }

  get currentRequestKey() {
    return this.globalRequestQueue[0];
  }

  private _onUnload() {
    window.addEventListener('unload', (e) => {
      this.selfRequestQueue.forEach(key => {
        this._deleteGlobalRequestKey(key);
      });
    });
  }
}
