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
  selfRequestQueueMap = {};
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

  get requestQueueMap() {
    const requestQueueMap = window.localStorage.getItem(STORAGE_ITEM_KEY);
    return requestQueueMap && JSON.parse(requestQueueMap) || {};
  }

  private _addRequestKey(lockName: string) {
    const requestQueue = this.requestQueueMap[lockName];
    const selfRequestQueue = this.selfRequestQueueMap[lockName];
    let key = `${lockName}${new Date().getTime()}`;

    this.requestQueueMap[lockName] = requestQueue?.length ? [...requestQueue, key] : [];
    this.selfRequestQueueMap[lockName] = selfRequestQueue?.length ? [...selfRequestQueue, key] : [];

    if (this.requestQueueMap[lockName].length !== requestQueue?.length) {
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(this.requestQueueMap));
    }

    return key;
  }

  private _deleteFirstRequestKey(key: string, lockName: string) {
    const firstKey = this.requestQueueMap[lockName][0];
    if (firstKey) {
      if (firstKey === key) {
        this._deleteRequestKey(key, lockName);
      } else {
        throw ('the first key in queue is not equal to the key should be delete!')
      }
    }
  }

  private _deleteSelfRequestKey(key: string, lockName: string) {
    const selfQueueIndex = this.selfRequestQueueMap[lockName].indexOf(key);
    if (selfQueueIndex !== -1) {
      this.selfRequestQueueMap[lockName].splice(selfQueueIndex, 1);
    } else {
      throw ('could find this key in self Request queue!')
    }
  }

  private _deleteGlobalRequestKey(key: string, lockName: string) {
    const requestQueue = this.requestQueueMap[lockName];
    const globalQueueIndex = requestQueue.indexOf(key);
    if (globalQueueIndex !== -1) {
      requestQueue.splice(globalQueueIndex, 1);
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(this.requestQueueMap));
    } else {
      throw ('could find this key in global request queue!')
    }
  }

  private _deleteRequestKey(key: string, lockName: string) {
    this._deleteSelfRequestKey(key, lockName);
    this._deleteGlobalRequestKey(key, lockName);
  }

  private _init() {
    onLocalStorageInit();
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

      const requestQueue = this.requestQueueMap[lockName];

      if (!requestQueue || requestQueue.length === 0) {
        const requestKeyInQueue = this._addRequestKey(lockName);
        const result = await func({ name: lockName, mode: this._options.mode });
        this._deleteFirstRequestKey(requestKeyInQueue, lockName);
        resolve(result);
      } else {
        const requestKeyInQueue = this._addRequestKey(lockName);
        const listener = async () => {
          if (requestKeyInQueue === this.currentRequestKey(lockName)) {
            const result = await func({ name: lockName, mode: this._options.mode });
            this._deleteFirstRequestKey(requestKeyInQueue, lockName);
            resolve(result);
            return true;
          }
          return false;
        }
        onStorageChange(STORAGE_ITEM_KEY, listener);
      }
    })
  }

  currentRequestKey(lockName) {
    return this.requestQueueMap[lockName][0];
  }

  private _onUnload() {
    window.addEventListener('unload', (e) => {
      const selfRequestQueueMap = this.selfRequestQueueMap;
      for (const lockName in selfRequestQueueMap) {
        if (Object.prototype.hasOwnProperty.call(selfRequestQueueMap, lockName)) {
          const selfRequestQueue = selfRequestQueueMap[lockName];
          selfRequestQueue.forEach(selfRequestKey => {
            this._deleteGlobalRequestKey(selfRequestKey, lockName);
          });
        }
      }
    });
  }
}
