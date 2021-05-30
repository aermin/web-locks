import { onLocalStorageInit, onStorageChange } from "./localStorageSubscribe";

enum LOCK_MODE {
  EXCLUSIVE = "exclusive",
  SHARED = "shared",
}

enum STORAGE_KEYS {
  REQUEST_QUEUE_MAP = "requestQueueMap",
  HELD_LOCK_SET = "heldLockSet",
}
interface LockOptions {
  mode: LOCK_MODE;
  ifAvailable: Boolean;
  steal: Boolean;
  signal: AbortSignal;
}

type Lock = {
  mode: LOCK_MODE;
  name: string;
};

type LockGrantedCallback = (lock?: Lock | null) => Promise<any> | any;

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
  private _clientId = `${new Date().getTime()}-${String(
    Math.random()
  ).substring(2)}`;

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

  private _requestLockQueueMap(): RequestQueueMap {
    const requestQueueMap = window.localStorage.getItem(
      STORAGE_KEYS.REQUEST_QUEUE_MAP
    );
    return (requestQueueMap && JSON.parse(requestQueueMap)) || {};
  }

  private _heldLockSet(): LocksInfo {
    const heldLockSet = window.localStorage.getItem(STORAGE_KEYS.HELD_LOCK_SET);
    return (heldLockSet && JSON.parse(heldLockSet)) || [];
  }

  // delete old held lock and add move first request Lock to held lock set
  private _updateHeldAndRequestLocks(request: LockInfo) {
    let heldLockSet = this._heldLockSet();
    const heldLockIndex = heldLockSet.findIndex(
      (lock) => lock.uuid === request.uuid
    );
    if (heldLockIndex !== -1) {
      heldLockSet.splice(heldLockIndex, 1);
      const requestLockQueueMap = this._requestLockQueueMap();
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
      console.log(
        `this held lock which uuid is ${request.uuid} had been steal`
      );
    }
  }

  private _init() {
    onLocalStorageInit();
    this._onUnload();
  }

  private _pushToLockRequestQueueMap(request: LockInfo) {
    const requestQueueMap = this._requestLockQueueMap();
    const requestQueue = requestQueueMap[request.name] || [];
    requestQueueMap[request.name] = [...requestQueue, request];
    this._storeRequestLockQueueMap(requestQueueMap);
    return request;
  }

  private _pushToHeldLockSet(
    request: LockInfo,
    currentHeldLockSet = this._heldLockSet()
  ) {
    const heldLockSet = [...currentHeldLockSet, request];
    this._storeHeldLockSet(heldLockSet);
    return request;
  }

  public async request(
    name: string,
    callback: LockGrantedCallback
  ): Promise<any>;
  public async request(
    name: string,
    options: Partial<LockOptions>,
    callback: LockGrantedCallback
  ): Promise<any>;
  public async request(
    name: string,
    optionsOrCallback: Partial<LockOptions> | LockGrantedCallback,
    callback?: LockGrantedCallback
  ) {
    return new Promise((resolve, reject) => {
      let cb;
      let _options: LockOptions;
      if (typeof optionsOrCallback === "function" && !callback) {
        cb = optionsOrCallback;
        _options = this.defaultOptions;
      } else if (optionsOrCallback?.constructor.name === "Object" && callback) {
        cb = callback;
        _options = { ...this.defaultOptions, ...optionsOrCallback };
      } else {
        throw new Error("please input right options");
      }

      const request = {
        name,
        mode: _options.mode,
        clientId: this._clientId,
        uuid: `${name}-${new Date().getTime()}-${String(
          Math.random()
        ).substring(2)}`,
      };

      let heldLockSet = this._heldLockSet();
      let heldLock = heldLockSet.find((e) => {
        return e.name === name;
      });
      const requestLockQueue = this._requestLockQueueMap()[request.name] || [];

      if (_options.steal) {
        if (_options.mode !== LOCK_MODE.EXCLUSIVE) {
          throw new DOMException(
            "Failed to execute 'request' on 'LockManager': The 'steal' option may only be used with 'exclusive' locks."
          );
        }
        if (_options.ifAvailable) {
          throw new DOMException(
            "Failed to execute 'request' on 'LockManager': The 'steal' and 'ifAvailable' options cannot be used together."
          );
        }
        heldLockSet = heldLockSet.filter((e) => e.name !== request.name);
        heldLock = heldLockSet.find((e) => {
          return e.name === name;
        });
      } else if (_options.ifAvailable) {
        if (heldLock || requestLockQueue.length) {
          return resolve(cb(null));
        } else {
          return this._handleNewHeldLock(request, cb, resolve);
        }
      } else if (_options.signal) {
        if (_options.signal.aborted) {
          return reject(
            new DOMException(
              "Failed to execute 'request' on 'LockManager': The request was aborted."
            )
          );
        } else {
          _options.signal.onabort = () => {
            throw new DOMException("The request was aborted.");
          };
        }
      }
      if (heldLock) {
        if (heldLock.mode === LOCK_MODE.EXCLUSIVE) {
          this._handleNewLockRequest(request, cb, resolve);
        } else if (heldLock.mode === LOCK_MODE.SHARED) {
          // if this request lock is shared lock and is first request lock of this queue, then push held locks set
          if (
            request.mode === LOCK_MODE.SHARED &&
            requestLockQueue.length === 0
          ) {
            this._handleNewHeldLock(request, cb, resolve, heldLockSet);
          } else {
            this._handleNewLockRequest(request, cb, resolve);
          }
        }
      } else {
        this._handleNewHeldLock(request, cb, resolve, heldLockSet);
      }
    });
  }

  private async _handleNewHeldLock(
    request: LockInfo,
    cb: any,
    resolve: (value?: unknown) => void,
    currentHeldLockSet?: LocksInfo
  ) {
    this._pushToHeldLockSet(request, currentHeldLockSet);
    const result = await cb({ name: request.name, mode: request.mode });
    this._updateHeldAndRequestLocks(request);
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
    cb: (Lock: Lock) => any,
    resolve: (value?: unknown) => void
  ) {
    this._pushToLockRequestQueueMap(request);
    let heldLockWIP = false;
    const listener = async () => {
      if (
        !heldLockWIP &&
        this._heldLockSet().some((e) => e.uuid === request.uuid)
      ) {
        heldLockWIP = true;
        const result = await cb({ name: request.name, mode: request.mode });
        if (request.mode === LOCK_MODE.EXCLUSIVE) {
          this._updateHeldAndRequestLocks(request);
        } else if (request.mode === LOCK_MODE.SHARED) {
          const heldLockSet = this._heldLockSet();
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
              throw new Error(
                "this held lock should exist but could not be found!"
              );
            }

            // handle above issue when the shared locks release at the same time
            let latestHeldLockSet = this._heldLockSet();
            if (!latestHeldLockSet.some((lock) => lock.name === request.name)) {
              const requestLockQueueMap = this._requestLockQueueMap();
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
            this._updateHeldAndRequestLocks(request);
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
      held: this._heldLockSet(),
      pending: [],
    };
    const requestLockQueueMap = this._requestLockQueueMap();
    for (const name in requestLockQueueMap) {
      const requestLockQueue = requestLockQueueMap[name];
      queryResult.pending = queryResult.pending.concat(requestLockQueue);
    }
    return queryResult;
  }

  private _onUnload() {
    window.addEventListener("unload", (e) => {
      const requestLockQueueMap = this._requestLockQueueMap();
      for (const sourceName in requestLockQueueMap) {
        const requestLockQueue = requestLockQueueMap[sourceName];
        requestLockQueueMap[sourceName] = requestLockQueue.filter(
          (requestLock) => {
            requestLock.clientId !== this._clientId;
          }
        );
      }

      const heldLockSet = this._heldLockSet();
      const removedHeldLockSet: LocksInfo = [];

      let newHeldLockSet: LocksInfo = [];

      heldLockSet.forEach((element) => {
        if (element.clientId !== this._clientId) {
          newHeldLockSet.push(element);
        } else {
          removedHeldLockSet.push(element);

          const requestLockQueue = requestLockQueueMap[element.name];
          const [firstRequestLock, ...restRequestLocks] = requestLockQueue;
          if (firstRequestLock) {
            if (
              firstRequestLock.mode === LOCK_MODE.EXCLUSIVE ||
              restRequestLocks.length === 0
            ) {
              newHeldLockSet.push(firstRequestLock);
              requestLockQueueMap[element.name] = restRequestLocks;
            } else if (firstRequestLock.mode === LOCK_MODE.SHARED) {
              const nonSharedLockIndex = requestLockQueue.findIndex(
                (lock) => lock.mode !== LOCK_MODE.SHARED
              );
              newHeldLockSet = [
                ...newHeldLockSet,
                ...requestLockQueue.splice(0, nonSharedLockIndex),
              ];

              requestLockQueueMap[element.name] = requestLockQueue;
            }
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
