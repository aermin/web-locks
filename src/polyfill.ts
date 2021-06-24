import { onLocalStorageInit, onStorageChange } from "./localStorageSubscribe";

const LOCK_MODE = {
  EXCLUSIVE: "exclusive",
  SHARED: "shared",
} as const;

type LockMode = typeof LOCK_MODE[keyof typeof LOCK_MODE];

enum STORAGE_KEYS {
  REQUEST_QUEUE_MAP = "requestQueueMap",
  HELD_LOCK_SET = "heldLockSet",
}
interface LockOptions {
  mode: LockMode;
  ifAvailable: Boolean;
  steal: Boolean;
  signal?: AbortSignal;
}

export type Lock = {
  mode: LockMode;
  name: string;
};

type LockGrantedCallback = (lock?: Lock | null) => Promise<any> | any;

export type LockInfo = Lock & {
  clientId: string;
  uuid: string;
};

type Request = LockInfo & {
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
  cbResolve?: (value?: unknown) => void;
  cbReject?: (reason?: any) => void;
};

type LocksInfo = LockInfo[];

interface RequestQueueMap {
  [key: string]: LocksInfo;
}

interface LockManagerSnapshot {
  held: LocksInfo;
  pending: LocksInfo;
}

export function generateRandomId() {
  return `${new Date().getTime()}-${String(Math.random()).substring(2)}`;
}

export class WebLocks {
  public defaultOptions: LockOptions;
  private _clientId = generateRandomId();

  constructor() {
    this.defaultOptions = {
      mode: LOCK_MODE.EXCLUSIVE,
      ifAvailable: false,
      steal: false,
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
  private _updateHeldAndRequestLocks(request: Request) {
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

  private _pushToLockRequestQueueMap(request: Request) {
    const requestQueueMap = this._requestLockQueueMap();
    const requestQueue = requestQueueMap[request.name] || [];
    requestQueueMap[request.name] = [...requestQueue, request];

    this._storeRequestLockQueueMap(requestQueueMap);
    return request;
  }

  private _pushToHeldLockSet(
    request: Request,
    currentHeldLockSet = this._heldLockSet()
  ) {
    const heldLockSet = [...currentHeldLockSet, request];
    this._storeHeldLockSet(heldLockSet);
    return request;
  }

  public async request(
    ...args: [name: string, callback: LockGrantedCallback]
  ): Promise<any>;
  public async request(
    ...args: [
      name: string,
      options: Partial<LockOptions>,
      callback: LockGrantedCallback
    ]
  ): Promise<any>;
  public async request(
    ...args: [
      name: string,
      optionsOrCallback: Partial<LockOptions> | LockGrantedCallback,
      callback?: LockGrantedCallback
    ]
  ) {
    const self = this;
    return new Promise(async function (resolve, reject) {
      let cb: LockGrantedCallback;
      let _options: LockOptions;
      const argsLength = args.length;

      // handle args in different case
      if (argsLength < 2) {
        return reject(
          new TypeError(
            `Failed to execute 'request' on 'LockManager': 2 arguments required, but only ${args.length} present.`
          )
        );
      } else if (argsLength === 2) {
        if (typeof args[1] !== "function") {
          return reject(
            new TypeError(
              "Failed to execute 'request' on 'LockManager': parameter 2 is not of type 'Function'."
            )
          );
        } else {
          cb = args[1];
          _options = self.defaultOptions;
        }
      } else {
        if (typeof args[2] !== "function") {
          return reject(
            new TypeError(
              "Failed to execute 'request' on 'LockManager': parameter 3 is not of type 'Function'."
            )
          );
        } else {
          cb = args[2];
          _options = { ...self.defaultOptions, ...args[1] };
        }
      }
      if (Object.values(LOCK_MODE).indexOf(_options.mode) < 0) {
        return reject(
          new TypeError(
            `Failed to execute 'request' on 'LockManager': The provided value '${_options.mode}' is not a valid enum value of type LockMode.`
          )
        );
      }

      const name = args[0];

      // handle source name
      if (name[0] === "-") {
        return reject(
          new DOMException(
            "Failed to execute 'request' on 'LockManager': Names cannot start with '-'."
          )
        );
      }

      const request: Request = {
        name,
        mode: _options.mode,
        clientId: self._clientId,
        uuid: `${name}-${generateRandomId()}`,
        resolve,
        reject,
      };

      // let cb executed in Micro task
      const resolveWithCB = (args: Lock | null) => {
        return new Promise((_resolve, _reject) => {
          request.cbResolve = _resolve;
          request.cbReject = _reject;
          new Promise((res) => res("")).then(async () => {
            try {
              const res = await cb(args);
              _resolve(res);
              resolve(res);
            } catch (error) {
              reject(error);
            }
          });
        });
      };

      let heldLockSet = self._heldLockSet();
      let heldLock = heldLockSet.find((e) => {
        return e.name === name;
      });
      const requestLockQueue = self._requestLockQueueMap()[request.name] || [];

      // handle request options
      if (_options.steal === true) {
        if (_options.mode !== LOCK_MODE.EXCLUSIVE) {
          return reject(
            new DOMException(
              "Failed to execute 'request' on 'LockManager': The 'steal' option may only be used with 'exclusive' locks."
            )
          );
        }
        if (_options.ifAvailable === true) {
          return reject(
            new DOMException(
              "Failed to execute 'request' on 'LockManager': The 'steal' and 'ifAvailable' options cannot be used together."
            )
          );
        }
        // one held lock or multiple shared locks of this source should be remove
        heldLockSet = heldLockSet.filter((e) => e.name !== request.name);
        heldLock = heldLockSet.find((e) => {
          return e.name === request.name;
        });
      } else if (_options.ifAvailable === true) {
        if (
          (heldLock &&
            !(
              heldLock.mode === LOCK_MODE.SHARED &&
              request.mode === LOCK_MODE.SHARED
            )) ||
          requestLockQueue.length
        ) {
          return resolveWithCB(null);
        } else {
          return self._handleNewHeldLock(request, resolveWithCB);
        }
      } else if (_options.signal !== undefined) {
        if (!(_options.signal instanceof AbortSignal)) {
          return reject(
            new TypeError(
              "Failed to execute 'request' on 'LockManager': member signal is not of type AbortSignal."
            )
          );
        } else if (_options.signal.aborted) {
          return reject(
            new DOMException(
              "Failed to execute 'request' on 'LockManager': The request was aborted."
            )
          );
        } else {
          _options.signal.onabort = () => {
            // clean the lock request when it is aborted
            const _requestLockQueueMap = self._requestLockQueueMap();
            const requestLockIndex = _requestLockQueueMap[name].findIndex(
              (lock) => lock.uuid === request.uuid
            );
            if (requestLockIndex !== -1) {
              _requestLockQueueMap[name].splice(requestLockIndex, 1);
              self._storeRequestLockQueueMap(_requestLockQueueMap);
            }
          };
        }
      }

      if (heldLock) {
        if (heldLock.mode === LOCK_MODE.EXCLUSIVE) {
          self._handleNewLockRequest(request, resolveWithCB);
        } else if (heldLock.mode === LOCK_MODE.SHARED) {
          // if this request lock is shared lock and is first request lock of this queue, then push held locks set
          if (
            request.mode === LOCK_MODE.SHARED &&
            requestLockQueue.length === 0
          ) {
            self._handleNewHeldLock(request, resolveWithCB, heldLockSet);
          } else {
            self._handleNewLockRequest(request, resolveWithCB);
          }
        }
      } else {
        self._handleNewHeldLock(request, resolveWithCB, heldLockSet);
      }
    });
  }

  private async _handleNewHeldLock(
    request: Request,
    resolveWithCB: (args: Lock | null) => Promise<unknown>,
    currentHeldLockSet?: LocksInfo
  ) {
    this._pushToHeldLockSet(request, currentHeldLockSet);

    // check and handle if this held lock has been steal
    let callBackResolved = false;
    let rejectedForSteal = false;
    const listener = () => {
      if (
        !callBackResolved &&
        !rejectedForSteal &&
        !this._isInHeldLockSet(request.uuid)
      ) {
        this._handleHeldLockBeSteal(request);
        rejectedForSteal = true;
        return true;
      }
      return false;
    };
    onStorageChange(STORAGE_KEYS.HELD_LOCK_SET, listener);

    resolveWithCB({ name: request.name, mode: request.mode }).then(() => {
      callBackResolved = true;
      this._updateHeldAndRequestLocks(request);
    });
  }

  private _handleHeldLockBeSteal(request: Request) {
    request.reject(
      new DOMException(
        " Lock broken by another request with the 'steal' option."
      )
    );
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

  private _isInHeldLockSet(uuid: string) {
    return this._heldLockSet().some((e) => e.uuid === uuid);
  }

  private _handleNewLockRequest(
    request: Request,
    resolveWithCB: (args: Lock | null) => Promise<unknown>
  ) {
    this._pushToLockRequestQueueMap(request);
    let heldLockWIP = false;
    const listener = async () => {
      if (!heldLockWIP && this._isInHeldLockSet(request.uuid)) {
        heldLockWIP = true;
        await resolveWithCB({ name: request.name, mode: request.mode });

        // check and handle if this held lock has been steal
        if (!this._isInHeldLockSet(request.uuid)) {
          this._handleHeldLockBeSteal(request);
        }

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
