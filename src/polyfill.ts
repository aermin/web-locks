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

type LockMode = (typeof LOCK_MODE)[keyof typeof LOCK_MODE];

const LIB_PREFIX = "$navigator.locks";

enum STORAGE_KEYS {
  REQUEST_QUEUE_MAP = "$navigator.locks-requestQueueMap",
  HELD_LOCK_SET = "$navigator.locks-heldLockSet",
  CLIENT_IDS = "$navigator.locks-clientIds",
}
interface LockOptions {
  mode: LockMode;
  ifAvailable: boolean;
  steal: boolean;
  signal?: AbortSignal;
}

export type Lock = {
  mode: LockMode;
  name: string;
};

type LockGrantedCallback = (lock?: Lock | null) => Promise<any> | any;

type ResolveWithCallback = (
  lock: Lock | null,
  release?: () => void
) => Promise<void>;

export type LockInfo = Lock & {
  clientId: string;
  uuid: string;
};

type Request = LockInfo & {
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
  closeSignal?: () => void;
  signal?: AbortSignal;
};

type RequestArgsCase1 = [name: string, callback: LockGrantedCallback];

type RequestArgsCase2 = [
  name: string,
  options: Partial<LockOptions>,
  callback: LockGrantedCallback,
];

type RequestArgsCase3 = [
  name: string,
  optionsOrCallback: Partial<LockOptions> | LockGrantedCallback,
  callback?: LockGrantedCallback,
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
    this._clientId = `${LIB_PREFIX}-clientId-${generateRandomId()}`;
    this._init();
  }

  private _init() {
    this._storeThisClientId();
    const heartBeat = new HeartBeat({ key: this._clientId });
    heartBeat.start();
    // Clean stale clients if pagehide does not fire or a client crashes.
    heartBeat.detect(() => this._cleanUnliveClientLocks());
    this._onPageHide();
  }

  private _getClientIds(): string[] {
    const clientIds = getStorageItem(STORAGE_KEYS.CLIENT_IDS);
    return (clientIds && JSON.parse(clientIds)) || [];
  }

  private _storeClientIds(clientIds: string[]) {
    setStorageItem(STORAGE_KEYS.CLIENT_IDS, JSON.stringify(clientIds));
  }

  private _storeThisClientId() {
    const prevClientIds = this._getClientIds();
    const curClientIds = [...prevClientIds, this._clientId];
    this._storeClientIds(curClientIds);
  }

  public async request(...args: RequestArgsCase1): Promise<any>;
  public async request(...args: RequestArgsCase2): Promise<any>;
  public async request(...args: RequestArgsCase3) {
    const self = this;
    return new Promise(function (resolve, reject) {
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
        signal: _options.signal,
      };

      const resolveWithCB = self._resolveWithCB(cb, resolve, reject);

      let heldLockSet = self._heldLockSet();
      let heldLock = heldLockSet.find((e) => {
        return e.name === request.name;
      });
      const requestLockQueue = self._requestLockQueueMap()[request.name] || [];

      // handle request options
      if (_options.steal === true) {
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

  // 被抢占的回调仍可能结束，此时释放操作应保留抢占者的锁和队列。
  private _updateHeldAndRequestLocks(request: Request) {
    const heldLockSet = this._heldLockSet();
    const heldLockIndex = heldLockSet.findIndex(
      (lock) => lock.uuid === request.uuid
    );
    if (heldLockIndex === -1) {
      this._handleHeldLockBeSteal(request);
      return;
    }

    heldLockSet.splice(heldLockIndex, 1);
    const requestLockQueueMap = this._requestLockQueueMap();
    if (
      this._grantPendingLocks(request.name, heldLockSet, requestLockQueueMap)
    ) {
      this._storeHeldLockSetAndRequestLockQueueMap(
        heldLockSet,
        requestLockQueueMap
      );
    } else {
      this._storeHeldLockSet(heldLockSet);
    }
  }

  // 按队首请求与同名持有锁的兼容性授予锁。连续的共享请求可以一起获批。
  private _grantPendingLocks(
    name: string,
    heldLockSet: LocksInfo,
    requestLockQueueMap: RequestQueueMap
  ): boolean {
    const queue = requestLockQueueMap[name] || [];
    const head = queue[0];
    if (
      !head ||
      heldLockSet.some(
        (lock) =>
          lock.name === name &&
          (head.mode === LOCK_MODE.EXCLUSIVE ||
            lock.mode === LOCK_MODE.EXCLUSIVE)
      )
    ) {
      return false;
    }

    let count = 1;
    if (head.mode === LOCK_MODE.SHARED) {
      const firstExclusive = queue.findIndex(
        (lock) => lock.mode === LOCK_MODE.EXCLUSIVE
      );
      count = firstExclusive === -1 ? queue.length : firstExclusive;
    }
    queue.slice(0, count).forEach((lock) => heldLockSet.push(lock));
    requestLockQueueMap[name] = queue.slice(count);
    return true;
  }

  private _getAbortError(signal: AbortSignal) {
    return (
      signal.reason ||
      new DOMException("The request was aborted.", "AbortError")
    );
  }

  private _handleSignalExisted(
    { signal }: LockOptions,
    reject: (reason?: any) => void,
    request: Request
  ) {
    if (!(signal instanceof AbortSignal)) {
      reject(
        new TypeError(
          "Failed to execute 'request' on 'LockManager': member signal is not of type AbortSignal."
        )
      );
      return false;
    } else if (signal.aborted) {
      reject(this._getAbortError(signal));
      return false;
    } else {
      const listener = this._signalOnabort(signal, request);
      signal.addEventListener("abort", listener);
      request.closeSignal = () => signal.removeEventListener("abort", listener);
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
          "Failed to execute 'request' on 'LockManager': Names cannot start with '-'.",
          "NotSupportedError"
        )
      );
      return null;
    }

    if (_options.signal && _options.steal) {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': The 'signal' and 'steal' options cannot be used together.",
          "NotSupportedError"
        )
      );
      return null;
    }

    if (_options.signal && _options.ifAvailable) {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': The 'signal' and 'ifAvailable' options cannot be used together.",
          "NotSupportedError"
        )
      );
      return null;
    }

    if (_options.steal && _options.ifAvailable) {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': The 'steal' and 'ifAvailable' options cannot be used together.",
          "NotSupportedError"
        )
      );
      return null;
    }

    if (_options.steal && _options.mode !== LOCK_MODE.EXCLUSIVE) {
      reject(
        new DOMException(
          "Failed to execute 'request' on 'LockManager': The 'steal' option may only be used with 'exclusive' locks.",
          "NotSupportedError"
        )
      );
      return null;
    }

    return { cb, _options };
  }

  private _handleHeldLockAndRequest(
    heldLock: LockInfo | undefined,
    request: Request,
    resolveWithCB: ResolveWithCallback,
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

  private _signalOnabort(signal: AbortSignal, { name, uuid, reject }: Request) {
    return () => {
      // clean the lock request when it is aborted
      const _requestLockQueueMap = this._requestLockQueueMap();
      const requestLockQueue = _requestLockQueueMap[name];

      if (requestLockQueue) {
        const requestLockIndex = requestLockQueue.findIndex(
          (lock) => lock.uuid === uuid
        );
        if (requestLockIndex !== -1) {
          requestLockQueue.splice(requestLockIndex, 1);
          this._storeRequestLockQueueMap(_requestLockQueueMap);
        }
      }

      reject(this._getAbortError(signal));
    };
  }

  // 在微任务中运行回调，等持有记录移除后再兑现 request() 返回的 Promise。
  private _resolveWithCB(
    cb: LockGrantedCallback,
    resolve: (value?: unknown) => void,
    reject: (reason?: any) => void
  ): ResolveWithCallback {
    return (lock, release) =>
      Promise.resolve()
        .then(async () => {
          try {
            return await cb(lock);
          } finally {
            release?.();
          }
        })
        .then(resolve, reject);
  }

  private async _handleNewHeldLock(
    request: Request,
    resolveWithCB: ResolveWithCallback,
    currentHeldLockSet?: LocksInfo
  ) {
    this._pushToHeldLockSet(request, currentHeldLockSet);

    // give sync aborts a chance to be processed first
    await new Promise((resolve) => setTimeout(resolve, 0));

    // ignore any further attempts to abort the request
    request.closeSignal?.();

    if (request.signal?.aborted) {
      this._updateHeldAndRequestLocks(request);
      return request.reject(this._getAbortError(request.signal));
    }

    await this._runHeldLockCallback(request, resolveWithCB);
  }

  // 回调运行期间持续监听抢占，使 request() 可以在回调结束前拒绝。
  private _runHeldLockCallback(
    request: Request,
    resolveWithCB: ResolveWithCallback
  ) {
    const rejectIfStolen = () => {
      if (!this._isInHeldLockSet(request.uuid)) {
        unsubscribe();
        this._handleHeldLockBeSteal(request);
      }
    };
    const unsubscribe = onStorageChange(
      STORAGE_KEYS.HELD_LOCK_SET,
      rejectIfStolen
    );
    rejectIfStolen();

    return resolveWithCB({ name: request.name, mode: request.mode }, () => {
      unsubscribe();
      this._updateHeldAndRequestLocks(request);
    });
  }

  private _handleHeldLockBeSteal(request: Request) {
    request.reject(
      new DOMException(
        "Lock broken by another request with the 'steal' option.",
        "AbortError"
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

  // 等待任一页面把该请求放入持有集合，再切换到持有期间的抢占监听。
  private _handleNewLockRequest(
    request: Request,
    resolveWithCB: ResolveWithCallback
  ) {
    this._pushToLockRequestQueueMap(request);
    const unsubscribe = onStorageChange(STORAGE_KEYS.HELD_LOCK_SET, (value) => {
      // 按通知中的快照识别授予，避免后续抢占已覆盖 localStorage 时漏掉该请求。
      const heldLockSet: LocksInfo = (value && JSON.parse(value)) || [];
      if (heldLockSet.some((lock) => lock.uuid === request.uuid)) {
        unsubscribe();
        void this._runHeldLockCallback(request, resolveWithCB);
      }
    });
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

  private _onPageHide() {
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) {
        this._cleanClientLocksByClientId(this._clientId);
      }
    });
  }

  // 先移除离开客户端的所有请求，再用剩余持有锁判断队列能否继续。
  private _cleanClientLocksByClientId(clientId: string) {
    const requestLockQueueMap = this._requestLockQueueMap();
    this._cleanRequestLockQueueByClientId(requestLockQueueMap, clientId);

    const releasedNames = new Set<string>();
    const heldLockSet = this._heldLockSet().filter((lock) => {
      if (lock.clientId !== clientId) return true;
      releasedNames.add(lock.name);
      return false;
    });
    releasedNames.forEach((name) => {
      this._grantPendingLocks(name, heldLockSet, requestLockQueueMap);
    });
    this._storeHeldLockSetAndRequestLockQueueMap(
      heldLockSet,
      requestLockQueueMap
    );
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
    const uniqueClientIds = [...new Set(this._getClientIds())];
    if (!uniqueClientIds.length) {
      this._storeClientIds([]);
      return;
    }

    const aliveClientIds: string[] = [];
    uniqueClientIds.forEach((clientId) => {
      const timeStamp = getStorageItem(clientId);
      // if unlive
      if (!timeStamp || Date.now() - Number(timeStamp) > 3100) {
        removeStorageItem(clientId);
        this._cleanClientLocksByClientId(clientId);
      } else {
        aliveClientIds.push(clientId);
      }
    });
    if (JSON.stringify(uniqueClientIds) !== JSON.stringify(aliveClientIds)) {
      this._storeClientIds(aliveClientIds);
    }
  }
}
