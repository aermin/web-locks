declare enum LOCK_MODE {
    EXCLUSIVE = "exclusive",
    SHARED = "shared"
}
interface LockOptions {
    mode: LOCK_MODE;
    ifAvailable: Boolean;
    steal: Boolean;
    signal: AbortSignal;
}
declare type Lock = {
    mode: LOCK_MODE;
    name: string;
};
declare type LockGrantedCallback = (lock?: Lock | null) => Promise<any>;
declare type LockInfo = Lock & {
    clientId: string;
    uuid: string;
};
declare type LocksInfo = LockInfo[];
interface LockManagerSnapshot {
    held: LocksInfo;
    pending: LocksInfo;
}
export declare class WebLocks {
    defaultOptions: LockOptions;
    private _clientId;
    constructor();
    private _requestLockQueueMap;
    private _heldLockSet;
    private _updateHeldAndRequestLocks;
    private _init;
    private _pushToLockRequestQueueMap;
    private _pushToHeldLockSet;
    request(name: string, callback: LockGrantedCallback): Promise<any>;
    request(name: string, options: Partial<LockOptions>, callback: LockGrantedCallback): Promise<any>;
    private _handleNewHeldLock;
    private _storeHeldLockSet;
    private _storeRequestLockQueueMap;
    private _handleNewLockRequest;
    private _storeHeldLockSetAndRequestLockQueueMap;
    query(): LockManagerSnapshot;
    private _onUnload;
}
export {};
//# sourceMappingURL=polyfill.d.ts.map