import { onLocalStorageInit, onStorageChange } from "./localStorageSubscribe";

const LOCK_MODE = {
  EXCLUSIVE: "exclusive",
  SHARED: "shared",
} as const;

const STORAGE_KEYS = {
  REQUEST_QUEUE_MAP: "requestQueueMap",
  HELD_LOCK_SET: "heldLockSet",
};

type LockMode = typeof LOCK_MODE[keyof typeof LOCK_MODE];
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
  uuid: string;
};

type LocksInfo = LockInfo[];

interface RequestQueueMap {
  [key: string]: LocksInfo;
}

interface LockManagerSnapshot {
  held: LocksInfo;
  pending: LocksInfo;
}

export class WebLocks {
  public defaultOptions: LockOptions;
  private _selfRequestQueueMap: RequestQueueMap = {};
  private _clientId: string;

  constructor() {
    const controller = new AbortController();
    this.defaultOptions = {
      mode: LOCK_MODE.EXCLUSIVE,
      ifAvailable: false,
      steal: false,
      signal: controller.signal,
    };
    this._init();
  }

  private get _requestLockQueueMap(): RequestQueueMap {
    const requestQueueMap = window.localStorage.getItem(
      STORAGE_KEYS.REQUEST_QUEUE_MAP
    );
    return (requestQueueMap && JSON.parse(requestQueueMap)) || {};
  }

  private get _heldLockSet(): LocksInfo {
    const heldLockSet = window.localStorage.getItem(STORAGE_KEYS.HELD_LOCK_SET);
    return (heldLockSet && JSON.parse(heldLockSet)) || [];
  }

  // delete old held lock and add move first request Lock to held lock set
  private _updateHeldLockSetAndRequestLockQueueMap(
    { uuid, name }: LockInfo,
    heldLockSet = this._heldLockSet,
    requestLockQueueMap = this._requestLockQueueMap
  ) {
    const heldLockIndex = heldLockSet.findIndex(
      (request) => request.uuid === uuid
    );
    if (heldLockIndex !== -1) {
      heldLockSet.splice(heldLockIndex, 1);
      const requestLockQueue = requestLockQueueMap[name] || [];
      const [firstRequestLock, ...restRequestLocks] = requestLockQueue;
      if (firstRequestLock) {
        heldLockSet.push(firstRequestLock);
        window.localStorage.setItem(
          STORAGE_KEYS.HELD_LOCK_SET,
          JSON.stringify(heldLockSet)
        );
        requestLockQueueMap[name] = restRequestLocks;
        window.localStorage.setItem(
          STORAGE_KEYS.REQUEST_QUEUE_MAP,
          JSON.stringify(requestLockQueueMap)
        );
        return firstRequestLock;
      }
    } else {
      throw `could not find this held lock by uuid: ${uuid}!`;
    }
  }

  private _init() {
    this._clientId = `${new Date().getTime()}-${String(Math.random()).substring(
      2
    )}`;
    onLocalStorageInit();
    this._onUnload();
  }

  private _pushToLockRequestQueueMap(request) {
    const requestQueueMap = this._requestLockQueueMap;
    const requestQueue = requestQueueMap[name] || [];
    const selfRequestQueue = this._selfRequestQueueMap[name] || [];

    requestQueueMap[name] = [...requestQueue, request];
    this._selfRequestQueueMap[name] = [...selfRequestQueue, request];

    window.localStorage.setItem(
      STORAGE_KEYS.REQUEST_QUEUE_MAP,
      JSON.stringify(requestQueueMap)
    );
    return request;
  }

  private _pushToHeldLockSet(request) {
    const _heldLockSet = [...this._heldLockSet, request];
    window.localStorage.setItem(
      STORAGE_KEYS.HELD_LOCK_SET,
      JSON.stringify(_heldLockSet)
    );
    return request;
  }

  public async request(
    name: string,
    options?: LockOptions,
    callback?: LockGrantedCallback
  ) {
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

      const request = {
        name,
        mode: _options.mode,
        clientId: this._clientId,
        uuid: `${name}-${new Date().getTime()}-${String(
          Math.random()
        ).substring(2)}`,
      };

      const heldLock = this._heldLockSet.find((e) => {
        return e.name === name;
      });

      if (heldLock) {
        if (heldLock.mode === LOCK_MODE.EXCLUSIVE) {
          this._handleNewLockRequest(request, cb, name, resolve);
        } else if (heldLock.mode === LOCK_MODE.SHARED) {
          if (request.mode === LOCK_MODE.SHARED) {
            await this._handleNewHeldLock(request, cb, name, resolve);
          } else if (request.mode === LOCK_MODE.EXCLUSIVE) {
            this._handleNewLockRequest(request, cb, name, resolve);
          }
        }
      } else {
        await this._handleNewHeldLock(request, cb, name, resolve);
      }
    });
  }

  private async _handleNewHeldLock(
    request: { name: string; mode: LockMode; clientId: string; uuid: string },
    cb: any,
    name: string,
    resolve: (value?: unknown) => void
  ) {
    this._pushToHeldLockSet(request);
    const result = await cb({ name, mode: request.mode });
    this._updateHeldLockSetAndRequestLockQueueMap(request);
    resolve(result);
  }

  private _handleNewLockRequest(
    request: { name: string; mode: LockMode; clientId: string; uuid: string },
    cb: any,
    name: string,
    resolve: (value?: unknown) => void
  ) {
    this._pushToLockRequestQueueMap(request);
    let heldLockWIP = false;
    const listener = async () => {
      if (
        !heldLockWIP &&
        this._heldLockSet.some((e) => e.uuid === request.uuid)
      ) {
        heldLockWIP = true;
        const result = await cb({ name, mode: request.mode });
        this._updateHeldLockSetAndRequestLockQueueMap(request);
        resolve(result);
        return true;
      }
      return false;
    };
    onStorageChange(STORAGE_KEYS.HELD_LOCK_SET, listener);
  }

  public query() {
    const queryResult: LockManagerSnapshot = {
      held: this._heldLockSet,
      pending: [],
    };
    const requestLockQueueMap = this._requestLockQueueMap;
    for (const name in requestLockQueueMap) {
      const requestLockQueue = requestLockQueueMap[name];
      queryResult.pending = queryResult.pending.concat(requestLockQueue);
    }
    return queryResult;
  }

  private _onUnload() {
    window.addEventListener("unload", (e) => {
      const requestLockQueueMap = this._requestLockQueueMap;
      for (const sourceName in requestLockQueueMap) {
        const requestLockQueue = requestLockQueueMap[sourceName];
        requestLockQueueMap[sourceName] = requestLockQueue.filter(
          (requestLock) => {
            requestLock.clientId !== this._clientId;
          }
        );
      }

      let heldLockSet = this._heldLockSet;
      

      heldLockSet = [...heldLockSet].reduce((pre, cur) => {
        if (cur.clientId !== this._clientId) {
          pre.push(cur);
          if (cur.mode === LOCK_MODE.EXCLUSIVE) {
            this._updateHeldLockSetAndRequestLockQueueMap(
              cur,
              heldLockSet,
              requestLockQueueMap
            );
          } else if (cur.mode === LOCK_MODE.SHARED) {

          }
        }
        return pre;
      }, []);

      newHeldLockSet;

      window.localStorage.setItem(
        STORAGE_KEYS.HELD_LOCK_SET,
        JSON.stringify(heldLockSet)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.REQUEST_QUEUE_MAP,
        JSON.stringify(requestLockQueueMap)
      );
      return firstRequestLock;
      // const selfRequestQueueMap = this._selfRequestQueueMap;
      // for (const name in selfRequestQueueMap) {
      //   const selfRequestQueue = selfRequestQueueMap[name];
      //   selfRequestQueue.forEach((request) => {
      //     this._deleteGlobalRequest(request);
      //   });
      // }
    });
  }
}
