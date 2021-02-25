import { onLocalStorageInit, onStorageChange } from './localStorageSubscribe';


type LockMode = "exclusive" | "shared";
interface LockOptions {
  mode?: LockMode;
  ifAvailable?: Boolean;
  steal?: Boolean;
  signal?: AbortSignal;
}

type Lock = {
  mode: LockMode;
  name: string;
};

type LockGrantedCallback = ({ name, mode }: Lock) => Promise<any>;

type LockInfo = Lock & {
  clientId: string;
}

interface RequestQueueMapType {
  [key: string]: LockInfo[];
}

const STORAGE_ITEM_KEY = 'requestQueue';
export class WebLocks {
  public defaultOptions: LockOptions;
  protected selfRequestQueueMap: RequestQueueMapType = {};
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

  get requestQueueMap(): RequestQueueMapType {
    const requestQueueMap = window.localStorage.getItem(STORAGE_ITEM_KEY);
    return requestQueueMap && JSON.parse(requestQueueMap) || {};
  }

  private _addRequest(name: string, mode: LockMode) {
    const requestQueue = this.requestQueueMap[name];
    const selfRequestQueue = this.selfRequestQueueMap[name];
    let key = `${name}-${new Date().getTime()}-${String(Math.random()).substring(2)}`;

    const request = {
      clientId: key,
      name,
      mode
    };

    this.requestQueueMap[name] = requestQueue?.length ? [...requestQueue, request] : [];
    this.selfRequestQueueMap[name] = selfRequestQueue?.length ? [...selfRequestQueue, request] : [];

    if (this.requestQueueMap[name].length !== requestQueue?.length) {
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(this.requestQueueMap));
    }

    return request;
  }

  private _deleteFirstRequestKey(request: LockInfo) {
    const firstKey = this.requestQueueMap[request.name][0].clientId;
    if (firstKey) {
      if (firstKey === request.clientId) {
        this._deleteRequestKey(request);
      } else {
        throw ('the first key in queue is not equal to the key should be delete!')
      }
    }
  }

  private _deleteSelfRequest({ name, clientId }: LockInfo) {
    const selfQueueIndex = this.selfRequestQueueMap[name].findIndex((request) => request.clientId === clientId);
    if (selfQueueIndex !== -1) {
      this.selfRequestQueueMap[name].splice(selfQueueIndex, 1);
    } else {
      throw ('could find this key in self Request queue!')
    }
  }

  private _deleteGlobalRequest({ name, clientId }: LockInfo) {
    const requestQueue = this.requestQueueMap[name];
    const globalQueueIndex = requestQueue.findIndex(request => request.clientId === clientId);
    if (globalQueueIndex !== -1) {
      requestQueue.splice(globalQueueIndex, 1);
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(this.requestQueueMap));
    } else {
      throw ('could find this key in global request queue!')
    }
  }

  private _deleteRequestKey(request: LockInfo) {
    this._deleteSelfRequest(request);
    this._deleteGlobalRequest(request);
  }

  private _init() {
    onLocalStorageInit();
    this._onUnload();
  }

  protected async request(name: string, options?: LockOptions, callback?: LockGrantedCallback) {
    return new Promise(async (resolve, reject) => {
      let cb;
      if (typeof options === "function" && !callback) {
        cb = options;
      } else if (!options && callback) {
        cb = callback;
      } else {
        throw Error("please input right options");
      }

      const _options = { ...this.defaultOptions, ...options };

      const requestQueue = this.requestQueueMap[name];

      if (!requestQueue || requestQueue.length === 0) {
        const request = this._addRequest(name, _options.mode);
        const result = await cb({ name, mode: _options.mode });
        this._deleteFirstRequestKey(request);
        resolve(result);
      } else {
        const _request = this._addRequest(name, _options.mode);
        const listener = async () => {
          if (_request.clientId === this.currentRequestKey(name).clientId) {
            const result = await cb({ name, mode: _options.mode });
            this._deleteFirstRequestKey(_request);
            resolve(result);
            return true;
          }
          return false;
        }
        onStorageChange(STORAGE_ITEM_KEY, listener);
      }
    })
  }

  currentRequestKey(name) {
    return this.requestQueueMap[name][0];
  }

  private _onUnload() {
    window.addEventListener('unload', (e) => {
      const selfRequestQueueMap = this.selfRequestQueueMap;
      for (const name in selfRequestQueueMap) {
        if (Object.prototype.hasOwnProperty.call(selfRequestQueueMap, name)) {
          const selfRequestQueue = selfRequestQueueMap[name];
          selfRequestQueue.forEach(request => {
            this._deleteGlobalRequest(request);
          });
        }
      }
    });
  }
}
