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

export class WebLocks {
  private _options: Options;
  public defaultOptions: Options;
  protected selfGrantedQueue: string[] = [];
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

  get globalGrantedQueue() {
    const grantedQueue = window.localStorage.getItem('grantedQueue');
    return grantedQueue ? JSON.parse(window.localStorage.getItem('grantedQueue')) : null;
  }

  private _addGrantedKey(lockName?: string) {
    const grantedQueue = this.globalGrantedQueue || [];
    let key;
    if (lockName) {
      key = `${lockName}${new Date().getTime()}`;
      grantedQueue.push(key);
      this.selfGrantedQueue.push(key);
    }
    window.localStorage.setItem('grantedQueue', JSON.stringify(grantedQueue));
    return key;
  }

  private _deleteFirstGrantedKey(key: string) {
    const firstKey = this.globalGrantedQueue[0];
    if (firstKey) {
      if (firstKey === key) {
        this._deleteGrantedKey(key);
      } else {
        throw ('the first key in queue is not equal to the key should be delete!')
      }
    }
  }

  private _deleteSelfGrantedKey(key: string) {
    const selfQueueIndex = this.selfGrantedQueue.indexOf(key);
    if (selfQueueIndex !== -1) {
      this.selfGrantedQueue.splice(selfQueueIndex, 1);
    } else {
      throw ('could find this key in self granted queue!')
    }
  }

  private _deleteGlobalGrantedKey(key: string) {
    const tempQueue = [...this.globalGrantedQueue];
    const globalQueueIndex = tempQueue.indexOf(key);
    if (globalQueueIndex !== -1) {
      tempQueue.splice(tempQueue.indexOf(globalQueueIndex), 1);
      window.localStorage.setItem('grantedQueue', JSON.stringify(tempQueue));
    } else {
      throw ('could find this key in global granted queue!')
    }
  }

  private _deleteGrantedKey(key: string) {
    this._deleteSelfGrantedKey(key);
    this._deleteGlobalGrantedKey(key);
  }

  private _init() {
    if (!this.globalGrantedQueue) {
      this._addGrantedKey();
    }
    this._onUnload();
  }

  protected async request(lockName: string, options?: Options, fn?: LockFn) {

    let func;
    if (typeof options === "function" && !fn) {
      func = options;
    } else if (!options && fn) {
      func = fn;
    } else {
      throw Error("please input right options");
    }
    this._options = { ...this.defaultOptions, ...options };

    if (this.globalGrantedQueue && this.globalGrantedQueue.length === 0) {
      const grantedKeyInQueue = this._addGrantedKey(lockName);
      await func({ name: lockName, mode: this._options.mode });
      this._deleteFirstGrantedKey(grantedKeyInQueue);
    } else {
      const grantedKeyInQueue = this._addGrantedKey(lockName);
      const listener = async () => {
        if (grantedKeyInQueue === this.currentGrantedKey) {
          await func({ name: lockName, mode: this._options.mode });
          this._deleteFirstGrantedKey(grantedKeyInQueue);
          window.removeEventListener('storage', listener)
        }
      }
      this._onStorageChange(listener);
    }
  }

  get currentGrantedKey() {
    return this.globalGrantedQueue[0];
  }

  private _onUnload() {
    window.addEventListener('unload', (e) => {
      this.selfGrantedQueue.forEach(key => {
        this._deleteGlobalGrantedKey(key);
      });
    });
  }

  private _onStorageChange(listener) {
    window.addEventListener(
      "storage",
      function(event) {
        if (event.storageArea === localStorage) {
          console.log("event", event.oldValue, event.newValue);
          listener();
        }
      },
      false
    );
  }
}
