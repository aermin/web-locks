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

interface RequestQueueMap {
  [key: string]: LockInfo[];
}

const STORAGE_ITEM_KEY = 'requestQueue';
export class WebLocks {
  public defaultOptions: LockOptions;
  protected selfRequestQueueMap: RequestQueueMap = {};
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

  protected get requestQueueMap(): RequestQueueMap {
    const requestQueueMap = window.localStorage.getItem(STORAGE_ITEM_KEY);
    return requestQueueMap && JSON.parse(requestQueueMap) || {};
  }

  private _addRequest(name: string, mode: LockMode) {
    const requestQueueMap = this.requestQueueMap;
    const requestQueue = requestQueueMap[name] || [];
    const selfRequestQueue = this.selfRequestQueueMap[name] || [];

    const request = {
      clientId: `${name}-${new Date().getTime()}-${String(Math.random()).substring(2)}`,
      name,
      mode
    };

    requestQueueMap[name] = [...requestQueue, request];
    this.selfRequestQueueMap[name] = [...selfRequestQueue, request];

    if (requestQueueMap[name].length !== requestQueue?.length) {
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(requestQueueMap));
    }

    return request;
  }

  private _deleteFirstRequest(request: LockInfo) {
    const clientId = this.requestQueueMap[request.name][0].clientId;
    if (clientId) {
      if (clientId === request.clientId) {
        this._deleteRequest(request);
      } else {
        throw (`first request in queue is not found or not correct which should be ${request}!`);
      }
    }
  }

  private _deleteSelfRequest({ name, clientId }: LockInfo) {
    const selfQueueIndex = this.selfRequestQueueMap[name].findIndex((request) => request.clientId === clientId);
    if (selfQueueIndex !== -1) {
      this.selfRequestQueueMap[name].splice(selfQueueIndex, 1);
    } else {
      throw (`first request in self Request queue is not found or not correct which clientId should be ${clientId}!`);
    }
  }

  private _deleteGlobalRequest({ name, clientId }: LockInfo) {
    const requestQueueMap = this.requestQueueMap;
    const requestQueue = requestQueueMap[name];
    const globalQueueIndex = requestQueue.findIndex(request => request.clientId === clientId);
    if (globalQueueIndex !== -1) {
      requestQueue.splice(globalQueueIndex, 1);
      window.localStorage.setItem(STORAGE_ITEM_KEY, JSON.stringify(requestQueueMap));
    } else {
      throw (`first request in global Request queue is not found or not correct which clientId should be ${clientId}!`);
    }
  }

  private _deleteRequest(request: LockInfo) {
    this._deleteSelfRequest(request);
    this._deleteGlobalRequest(request);
  }

  private _init() {
    onLocalStorageInit();
    this._onUnload();
  }

  public async request(name: string, options?: LockOptions, callback?: LockGrantedCallback) {
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
        this._deleteFirstRequest(request);
        resolve(result);
      } else {
        const _request = this._addRequest(name, _options.mode);
        const listener = async () => {
          if (_request.clientId === this._getCurrentRequest(name).clientId) {
            const result = await cb({ name, mode: _options.mode });
            this._deleteFirstRequest(_request);
            resolve(result);
            return true;
          }
          return false;
        }
        onStorageChange(STORAGE_ITEM_KEY, listener);
      }
    })
  }

  private _getCurrentRequest(name) {
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
