import { HeartBeat } from "./heartBeat";
import {
  onStorageChange,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from "./localStorageSubscribe";

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

type RequestArgsCase1 = [name: string, callback: LockGrantedCallback];

type RequestArgsCase2 = [
  name: string,
  options: Partial<LockOptions>,
  callback: LockGrantedCallback
];

type RequestArgsCase3 = [
  name: string,
  optionsOrCallback: Partial<LockOptions> | LockGrantedCallback,
  callback?: LockGrantedCallback
];

export type LocksInfo = LockInfo[];

interface RequestQueueMap {
  [key: string]: LocksInfo;
}

export interface LockManagerSnapshot {
  held: LocksInfo;
  pending: LocksInfo;
}

export function generateRandomId() {
  return `${new Date().getTime()}-${String(Math.random()).substring(2)}`;
}

export class LockManager {
  private _defaultOptions: LockOptions;
  private _clientId: string;

  constructor() {
    this._defaultOptions = {
      mode: LOCK_MODE.EXCLUSIVE,
      ifAvailable: false,
      steal: false,
    };
    this._clientId = generateRandomId();
    this._init();
  }

  private _init() {
    const heartBeat = new HeartBeat({ key: this._clientId });
    heartBeat.start();
    heartBeat.detect(() => this._cleanUnliveClientLocks());
    this._onUnload();
  }

  public async request(...args: RequestArgsCase1): Promise<any>;
  public async request(...args: RequestArgsCase2): Promise<any>;
  public async request(...args: RequestArgsCase3) {
    const self = this;
    return new Promise(async function (resolve, reject) {
      self._cleanUnliveClientLocks();

      const res = self._handleRequestArgs(args, reject);
      if (!res) return;
      const { cb, _options } = res;

      const name = args[0];
      const request: Request = {
        name,
        mode: _options.mode,
        clientId: self._clientId,
        uuid: `${name}-${generateRandomId()}`,
        resolve,
        reject,
      };

      const resolveWithCB = self._resolveWithCB(request, cb, resolve, reject);

      let heldLockSet = self._heldLockSet();
      let heldLock = heldLockSet.find((e) => {
        return e.name === request.name;
      });
      const requestLockQueue = self._requestLockQueueMap()[request.name] || [];

      // handle request options
      if (_options.steal === true) {
        if (!self._handleExceptionWhenStealIsTrue(_options, reject)) return;
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
        if (!self._handleSignalExisted(_options, reject, request)) return;
      }

      self._handleHeldLockAndRequest(
        heldLock,
        request,
        resolveWithCB,
        requestLockQueue,
        heldLockSet
      );
    });
  }

  // add async for align with native api and type
  public async query() {
    return this._query();
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

  private _requestLockQueueMap(): RequestQueueMap {
    const requestQueueMap = getStorageItem(STORAGE_KEYS.REQUEST_QUEUE_MAP);
    return (requestQueueMap && JSON.parse(requestQueueMap)) || {};
  }

  private _heldLockSet(): LocksInfo {
    const heldLockSet = getStorageItem(STORAGE_KEYS.HELD_LOCK_SET);
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

  private _handleSignalExisted(
    _options: LockOptions,
    reject: (reason?: any) => void,
    request: Request
  ) {
    if (!(_options.signal instanceof AbortSignal)) {
      reject(
        new TypeError(
          "Failed to execute 'request' on 'LockManager': member signal is not of type AbortSignal."
        )
      );
      return false;
    } else if (_options.signal.aborted) {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': The request was aborted."
        )
      );
      return false;
    } else {
      this._signalOnabort(_options.signal, request);
    }
    return true;
  }

  private _handleExceptionWhenStealIsTrue(
    _options: LockOptions,
    reject: (reason?: any) => void
  ) {
    if (_options.mode !== LOCK_MODE.EXCLUSIVE) {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': The 'steal' option may only be used with 'exclusive' locks."
        )
      );
      return false;
    }
    if (_options.ifAvailable === true) {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': The 'steal' and 'ifAvailable' options cannot be used together."
        )
      );
      return false;
    }
    return true;
  }

  private _handleRequestArgs(
    args: RequestArgsCase1 | RequestArgsCase2 | RequestArgsCase3,
    reject: (reason?: any) => void
  ) {
    const argsLength = args.length;
    let cb: LockGrantedCallback;
    let _options: LockOptions;
    // handle args in different case
    if (argsLength < 2) {
      reject(
        new TypeError(
          `Failed to execute 'request' on 'LockManager': 2 arguments required, but only ${args.length} present.`
        )
      );
      return null;
    } else if (argsLength === 2) {
      if (typeof args[1] !== "function") {
        reject(
          new TypeError(
            "Failed to execute 'request' on 'LockManager': parameter 2 is not of type 'Function'."
          )
        );
        return null;
      } else {
        cb = args[1];
        _options = this._defaultOptions;
      }
    } else {
      if (typeof args[2] !== "function") {
        reject(
          new TypeError(
            "Failed to execute 'request' on 'LockManager': parameter 3 is not of type 'Function'."
          )
        );
        return null;
      } else {
        cb = args[2];
        _options = { ...this._defaultOptions, ...args[1] };
      }
    }
    if (Object.values(LOCK_MODE).indexOf(_options.mode) < 0) {
      reject(
        new TypeError(
          `Failed to execute 'request' on 'LockManager': The provided value '${_options.mode}' is not a valid enum value of type LockMode.`
        )
      );
      return null;
    }

    // handle source name
    if (args[0][0] === "-") {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': Names cannot start with '-'."
        )
      );
      return null;
    }
    return { cb, _options };
  }

  private _handleHeldLockAndRequest(
    heldLock: LockInfo | undefined,
    request: Request,
    resolveWithCB: (args: Lock | null) => Promise<unknown>,
    requestLockQueue: LocksInfo,
    heldLockSet: LocksInfo
  ) {
    if (heldLock) {
      if (heldLock.mode === LOCK_MODE.EXCLUSIVE) {
        this._handleNewLockRequest(request, resolveWithCB);
      } else if (heldLock.mode === LOCK_MODE.SHARED) {
        // if this request lock is shared lock and is first request lock of this queue, then push held locks set
        if (
          request.mode === LOCK_MODE.SHARED &&
          requestLockQueue.length === 0
        ) {
          this._handleNewHeldLock(request, resolveWithCB, heldLockSet);
        } else {
          this._handleNewLockRequest(request, resolveWithCB);
        }
      }
    } else {
      this._handleNewHeldLock(request, resolveWithCB, heldLockSet);
    }
  }

  private _signalOnabort(signal: AbortSignal, { name, uuid }: Request) {
    signal.onabort = () => {
      // clean the lock request when it is aborted
      const _requestLockQueueMap = this._requestLockQueueMap();
      const requestLockIndex = _requestLockQueueMap[name].findIndex(
        (lock) => lock.uuid === uuid
      );
      if (requestLockIndex !== -1) {
        _requestLockQueueMap[name].splice(requestLockIndex, 1);
        this._storeRequestLockQueueMap(_requestLockQueueMap);
      }
    };
  }

  // let cb executed in Micro task
  private _resolveWithCB(
    request: Request,
    cb: LockGrantedCallback,
    resolve: (value?: unknown) => void,
    reject: (reason?: any) => void
  ) {
    return (args: Lock | null) => {
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
        "Lock broken by another request with the 'steal' option."
      )
    );
  }

  private _storeHeldLockSet(heldLockSet: LocksInfo) {
    setStorageItem(STORAGE_KEYS.HELD_LOCK_SET, JSON.stringify(heldLockSet));
  }

  private _storeRequestLockQueueMap(requestLockQueueMap: RequestQueueMap) {
    setStorageItem(
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
          this._handleSharedLockFromListener(request);
        }
        return true;
      }
      return false;
    };
    onStorageChange(STORAGE_KEYS.HELD_LOCK_SET, listener);
  }

  private _handleSharedLockFromListener(request: Request) {
    const heldLockSet = this._heldLockSet();
    // have other unreleased shared held lock for this source, just delete this held lock, else also need to push new request lock as held lock
    const existOtherUnreleasedSharedHeldLock = heldLockSet.some(
      (lock) => lock.name === request.name && lock.mode === LOCK_MODE.SHARED
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
        throw new Error("this held lock should exist but could not be found!");
      }

      // handle above issue when the shared locks release at the same time
      this._handleSharedLocksRelease(request);
    } else {
      this._updateHeldAndRequestLocks(request);
    }
  }

  private _handleSharedLocksRelease(request: Request) {
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
  }

  private _storeHeldLockSetAndRequestLockQueueMap(
    heldLockSet: LocksInfo,
    requestLockQueueMap: RequestQueueMap
  ) {
    this._storeHeldLockSet(heldLockSet);
    this._storeRequestLockQueueMap(requestLockQueueMap);
  }

  private _query() {
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
      this._cleanClientLocksByClientId(this._clientId);
    });
  }

  private _cleanClientLocksByClientId(clientId: string) {
    const requestLockQueueMap = this._requestLockQueueMap();
    this._cleanRequestLockQueueByClientId(requestLockQueueMap, clientId);

    let newHeldLockSet: LocksInfo = this._cleanThisClientLockAndRequests(
      requestLockQueueMap,
      clientId
    );

    this._storeHeldLockSetAndRequestLockQueueMap(
      newHeldLockSet,
      requestLockQueueMap
    );
  }

  private _cleanThisClientLockAndRequests(
    requestLockQueueMap: RequestQueueMap,
    clientId: string
  ) {
    const heldLockSet = this._heldLockSet();
    let newHeldLockSet: LocksInfo = [];

    heldLockSet.forEach((element) => {
      if (element.clientId !== clientId) {
        newHeldLockSet.push(element);
      } else {
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
            let nonSharedLockIndex = requestLockQueue.findIndex(
              (lock) => lock.mode !== LOCK_MODE.SHARED
            );
            if (nonSharedLockIndex === -1)
              nonSharedLockIndex = requestLockQueue.length;
            newHeldLockSet = [
              ...newHeldLockSet,
              ...requestLockQueue.splice(0, nonSharedLockIndex),
            ];

            requestLockQueueMap[element.name] = requestLockQueue;
          }
        }
      }
    });
    return newHeldLockSet;
  }

  private _cleanRequestLockQueueByClientId(
    requestLockQueueMap: RequestQueueMap,
    clientId: string
  ) {
    for (const sourceName in requestLockQueueMap) {
      const requestLockQueue = requestLockQueueMap[sourceName];
      requestLockQueueMap[sourceName] = requestLockQueue.filter(
        (requestLock) => requestLock.clientId !== clientId
      );
    }
  }

  private _cleanUnliveClientLocks() {
    const { held, pending } = this._query();
    const allClientIds = [...held, ...pending].reduce((pre, cur) => {
      pre.push(cur.clientId);
      return pre;
    }, [] as string[]);
    const uniqueClientIds = [...new Set(allClientIds)];
    if (!uniqueClientIds.length) return;
    uniqueClientIds.forEach((clientId) => {
      const timeStamp = getStorageItem(clientId);
      // if unlive
      if (!timeStamp || Date.now() - Number(timeStamp) > 3100) {
        removeStorageItem(clientId);
        this._cleanClientLocksByClientId(clientId);
      }
    });
  }
}
