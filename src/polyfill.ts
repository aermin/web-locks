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
  private _updateHeldLockSetAndRequestLockQueueMap(request: LockInfo) {
    let heldLockSet = this._heldLockSet;
    const heldLockIndex = heldLockSet.findIndex(
      (lock) => lock.uuid === request.uuid
    );
    if (heldLockIndex !== -1) {
      heldLockSet.splice(heldLockIndex, 1);
      const requestLockQueueMap = this._requestLockQueueMap;
      const requestLockQueue = requestLockQueueMap[request.name] || [];
      const [firstRequestLock, ...restRequestLocks] = requestLockQueue;
      if (firstRequestLock) {
        if (
          firstRequestLock.mode === LOCK_MODE.EXCLUSIVE ||
          restRequestLocks.length === 0
        ) {
          heldLockSet.push(firstRequestLock);
          requestLockQueueMap[request.name] = restRequestLocks;
        } else if (firstRequestLock.mode === LOCK_MODE.SHARED) {
          const nonSharedLockIndex = requestLockQueue.findIndex(
            (lock) => lock.mode !== LOCK_MODE.SHARED
          );
          heldLockSet = [
            ...heldLockSet,
            ...requestLockQueue.splice(0, nonSharedLockIndex),
          ];

          requestLockQueueMap[request.name] = requestLockQueue;
        }

        this._storeHeldLockSetAndRequestLockQueueMap(
          heldLockSet,
          requestLockQueueMap
        );

        return firstRequestLock;
      } else {
        this._storeHeldLockSet(heldLockSet);
      }
    } else {
      throw `could not find this held lock by uuid: ${request.uuid}!`;
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
    const requestQueue = requestQueueMap[request.name] || [];
    requestQueueMap[request.name] = [...requestQueue, request];

    this._storeRequestLockQueueMap(requestQueueMap);
    return request;
  }

  private _pushToHeldLockSet(request) {
    const heldLockSet = [...this._heldLockSet, request];
    this._storeHeldLockSet(heldLockSet);
    return request;
  }

  public async request(
    name: string,
    options?: LockOptions,
    callback?: LockGrantedCallback
  ) {
    return new Promise(async (resolve, reject) => {
      let cb;
      if (options.constructor.name === "Function" && !callback) {
        cb = options;
      } else if (options.constructor.name === "Object" && callback) {
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
          this._handleNewLockRequest(request, cb, resolve);
        } else if (heldLock.mode === LOCK_MODE.SHARED) {
          // if this request lock is shared lock and is first request lock of this queue, then push held locks set
          const requestLockQueue =
            this._requestLockQueueMap[request.name] || [];
          if (
            request.mode === LOCK_MODE.SHARED &&
            requestLockQueue.length === 0
          ) {
            await this._handleNewHeldLock(request, cb, resolve);
          } else {
            this._handleNewLockRequest(request, cb, resolve);
          }
        }
      } else {
        await this._handleNewHeldLock(request, cb, resolve);
      }
    });
  }

  private async _handleNewHeldLock(
    request: LockInfo,
    cb: any,
    resolve: (value?: unknown) => void
  ) {
    this._pushToHeldLockSet(request);
    const result = await cb({ name: request.name, mode: request.mode });
    this._updateHeldLockSetAndRequestLockQueueMap(request);
    resolve(result);
  }

  private _storeHeldLockSet(heldLockSet: LocksInfo) {
    window.localStorage.setItem(
      STORAGE_KEYS.HELD_LOCK_SET,
      JSON.stringify(heldLockSet)
    );
  }

  private _storeRequestLockQueueMap(requestLockQueueMap: RequestQueueMap) {
    window.localStorage.setItem(
      STORAGE_KEYS.REQUEST_QUEUE_MAP,
      JSON.stringify(requestLockQueueMap)
    );
  }

  private _handleNewLockRequest(
    request: LockInfo,
    cb: any,
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
        const result = await cb({ name: request.name, mode: request.mode });
        if (request.mode === LOCK_MODE.EXCLUSIVE) {
          this._updateHeldLockSetAndRequestLockQueueMap(request);
        } else if (request.mode === LOCK_MODE.SHARED) {
          const heldLockSet = this._heldLockSet;
          // have other unreleased shared held lock for this source, just delete this held lock, else also need to push new request lock as held lock
          const existOtherUnreleasedSharedHeldLock = heldLockSet.some(
            (lock) =>
              lock.name === request.name && lock.mode === LOCK_MODE.SHARED
          );
          // there is a issue when the shared locks release at the same time,
          // existOtherUnreleasedSharedHeldLock will be true, then could not move request lock to held lock set
          if (existOtherUnreleasedSharedHeldLock) {
            // just delete this held lock
            const heldLockIndex = heldLockSet.findIndex(
              (lock) => lock.uuid === request.uuid
            );
            if (heldLockIndex !== -1) {
              heldLockSet.splice(heldLockIndex, 1);
              this._storeHeldLockSet(heldLockSet);
            } else {
              throw "this held lock should exist but could not be found!";
            }

            // handle above issue when the shared locks release at the same time
            let latestHeldLockSet = this._heldLockSet;
            if (!latestHeldLockSet.some((lock) => lock.name === request.name)) {
              const requestLockQueueMap = this._requestLockQueueMap;
              const [firstRequestLock, ...restRequestLocks] =
                requestLockQueueMap[request.name] || [];
              if (firstRequestLock) {
                latestHeldLockSet.push(firstRequestLock);
                requestLockQueueMap[request.name] = restRequestLocks;
                this._storeHeldLockSetAndRequestLockQueueMap(
                  latestHeldLockSet,
                  requestLockQueueMap
                );
              }
            }
          } else {
            this._updateHeldLockSetAndRequestLockQueueMap(request);
          }
        }
        resolve(result);
        return true;
      }
      return false;
    };
    onStorageChange(STORAGE_KEYS.HELD_LOCK_SET, listener);
  }

  private _storeHeldLockSetAndRequestLockQueueMap(
    heldLockSet: LocksInfo,
    requestLockQueueMap: RequestQueueMap
  ) {
    this._storeHeldLockSet(heldLockSet);
    this._storeRequestLockQueueMap(requestLockQueueMap);
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
      let removedHeldLockSet = [];

      heldLockSet = heldLockSet.reduce((pre, cur) => {
        if (cur.clientId !== this._clientId) {
          pre.push(cur);
        } else {
          removedHeldLockSet.push(cur);
        }
        return pre;
      }, []);

      removedHeldLockSet.forEach((lock) => {
        const requestLockQueue = requestLockQueueMap[lock.name];
        const [firstRequestLock, ...restRequestLocks] = requestLockQueue;
        if (firstRequestLock) {
          if (
            firstRequestLock.mode === LOCK_MODE.EXCLUSIVE ||
            restRequestLocks.length === 0
          ) {
            heldLockSet.push(firstRequestLock);
            requestLockQueueMap[lock.name] = restRequestLocks;
          } else if (firstRequestLock.mode === LOCK_MODE.SHARED) {
            const nonSharedLockIndex = requestLockQueue.findIndex(
              (lock) => lock.mode !== LOCK_MODE.SHARED
            );
            heldLockSet = [
              ...heldLockSet,
              ...requestLockQueue.splice(0, nonSharedLockIndex),
            ];

            requestLockQueueMap[lock.name] = requestLockQueue;
          }
        }
      });

      this._storeHeldLockSetAndRequestLockQueueMap(
        heldLockSet,
        requestLockQueueMap
      );
    });
  }
}
