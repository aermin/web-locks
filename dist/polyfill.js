"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebLocks = void 0;
var localStorageSubscribe_1 = require("./localStorageSubscribe");
var LOCK_MODE;
(function (LOCK_MODE) {
    LOCK_MODE["EXCLUSIVE"] = "exclusive";
    LOCK_MODE["SHARED"] = "shared";
})(LOCK_MODE || (LOCK_MODE = {}));
var STORAGE_KEYS;
(function (STORAGE_KEYS) {
    STORAGE_KEYS["REQUEST_QUEUE_MAP"] = "requestQueueMap";
    STORAGE_KEYS["HELD_LOCK_SET"] = "heldLockSet";
})(STORAGE_KEYS || (STORAGE_KEYS = {}));
var WebLocks = /** @class */ (function () {
    function WebLocks() {
        this._clientId = new Date().getTime() + "-" + String(Math.random()).substring(2);
        var controller = new AbortController();
        this.defaultOptions = {
            mode: LOCK_MODE.EXCLUSIVE,
            ifAvailable: false,
            steal: false,
            signal: controller.signal,
        };
        this._init();
    }
    WebLocks.prototype._requestLockQueueMap = function () {
        var requestQueueMap = window.localStorage.getItem(STORAGE_KEYS.REQUEST_QUEUE_MAP);
        return (requestQueueMap && JSON.parse(requestQueueMap)) || {};
    };
    WebLocks.prototype._heldLockSet = function () {
        var heldLockSet = window.localStorage.getItem(STORAGE_KEYS.HELD_LOCK_SET);
        return (heldLockSet && JSON.parse(heldLockSet)) || [];
    };
    // delete old held lock and add move first request Lock to held lock set
    WebLocks.prototype._updateHeldAndRequestLocks = function (request) {
        var heldLockSet = this._heldLockSet();
        var heldLockIndex = heldLockSet.findIndex(function (lock) { return lock.uuid === request.uuid; });
        if (heldLockIndex !== -1) {
            heldLockSet.splice(heldLockIndex, 1);
            var requestLockQueueMap = this._requestLockQueueMap();
            var requestLockQueue = requestLockQueueMap[request.name] || [];
            var firstRequestLock = requestLockQueue[0], restRequestLocks = requestLockQueue.slice(1);
            if (firstRequestLock) {
                if (firstRequestLock.mode === LOCK_MODE.EXCLUSIVE ||
                    restRequestLocks.length === 0) {
                    heldLockSet.push(firstRequestLock);
                    requestLockQueueMap[request.name] = restRequestLocks;
                }
                else if (firstRequestLock.mode === LOCK_MODE.SHARED) {
                    var nonSharedLockIndex = requestLockQueue.findIndex(function (lock) { return lock.mode !== LOCK_MODE.SHARED; });
                    heldLockSet = __spreadArray(__spreadArray([], heldLockSet), requestLockQueue.splice(0, nonSharedLockIndex));
                    requestLockQueueMap[request.name] = requestLockQueue;
                }
                this._storeHeldLockSetAndRequestLockQueueMap(heldLockSet, requestLockQueueMap);
                return firstRequestLock;
            }
            else {
                this._storeHeldLockSet(heldLockSet);
            }
        }
        else {
            console.log("this held lock which uuid is " + request.uuid + " had been steal");
        }
    };
    WebLocks.prototype._init = function () {
        localStorageSubscribe_1.onLocalStorageInit();
        this._onUnload();
    };
    WebLocks.prototype._pushToLockRequestQueueMap = function (request) {
        var requestQueueMap = this._requestLockQueueMap();
        var requestQueue = requestQueueMap[request.name] || [];
        requestQueueMap[request.name] = __spreadArray(__spreadArray([], requestQueue), [request]);
        this._storeRequestLockQueueMap(requestQueueMap);
        return request;
    };
    WebLocks.prototype._pushToHeldLockSet = function (request, currentHeldLockSet) {
        if (currentHeldLockSet === void 0) { currentHeldLockSet = this._heldLockSet(); }
        var heldLockSet = __spreadArray(__spreadArray([], currentHeldLockSet), [request]);
        this._storeHeldLockSet(heldLockSet);
        return request;
    };
    WebLocks.prototype.request = function (name, optionsOrCallback, callback) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var cb;
                        var _options;
                        if (typeof optionsOrCallback === "function" && !callback) {
                            cb = optionsOrCallback;
                            _options = _this.defaultOptions;
                        }
                        else if ((optionsOrCallback === null || optionsOrCallback === void 0 ? void 0 : optionsOrCallback.constructor.name) === "Object" && callback) {
                            cb = callback;
                            _options = __assign(__assign({}, _this.defaultOptions), optionsOrCallback);
                        }
                        else {
                            throw new Error("please input right options");
                        }
                        var request = {
                            name: name,
                            mode: _options.mode,
                            clientId: _this._clientId,
                            uuid: name + "-" + new Date().getTime() + "-" + String(Math.random()).substring(2),
                        };
                        var heldLockSet = _this._heldLockSet();
                        var heldLock = heldLockSet.find(function (e) {
                            return e.name === name;
                        });
                        var requestLockQueue = _this._requestLockQueueMap()[request.name] || [];
                        if (_options.steal) {
                            if (_options.mode !== LOCK_MODE.EXCLUSIVE) {
                                throw new DOMException("Failed to execute 'request' on 'LockManager': The 'steal' option may only be used with 'exclusive' locks.");
                            }
                            if (_options.ifAvailable) {
                                throw new DOMException("Failed to execute 'request' on 'LockManager': The 'steal' and 'ifAvailable' options cannot be used together.");
                            }
                            heldLockSet = heldLockSet.filter(function (e) { return e.name !== request.name; });
                            heldLock = heldLockSet.find(function (e) {
                                return e.name === name;
                            });
                        }
                        else if (_options.ifAvailable) {
                            if (heldLock || requestLockQueue.length) {
                                return resolve(cb(null));
                            }
                            else {
                                return _this._handleNewHeldLock(request, cb, resolve);
                            }
                        }
                        else if (_options.signal) {
                            if (_options.signal.aborted) {
                                return reject(new DOMException("Failed to execute 'request' on 'LockManager': The request was aborted."));
                            }
                            else {
                                _options.signal.onabort = function () {
                                    throw new DOMException("The request was aborted.");
                                };
                            }
                        }
                        if (heldLock) {
                            if (heldLock.mode === LOCK_MODE.EXCLUSIVE) {
                                _this._handleNewLockRequest(request, cb, resolve);
                            }
                            else if (heldLock.mode === LOCK_MODE.SHARED) {
                                // if this request lock is shared lock and is first request lock of this queue, then push held locks set
                                if (request.mode === LOCK_MODE.SHARED &&
                                    requestLockQueue.length === 0) {
                                    _this._handleNewHeldLock(request, cb, resolve, heldLockSet);
                                }
                                else {
                                    _this._handleNewLockRequest(request, cb, resolve);
                                }
                            }
                        }
                        else {
                            _this._handleNewHeldLock(request, cb, resolve, heldLockSet);
                        }
                    })];
            });
        });
    };
    WebLocks.prototype._handleNewHeldLock = function (request, cb, resolve, currentHeldLockSet) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._pushToHeldLockSet(request, currentHeldLockSet);
                        return [4 /*yield*/, cb({ name: request.name, mode: request.mode })];
                    case 1:
                        result = _a.sent();
                        this._updateHeldAndRequestLocks(request);
                        resolve(result);
                        return [2 /*return*/];
                }
            });
        });
    };
    WebLocks.prototype._storeHeldLockSet = function (heldLockSet) {
        window.localStorage.setItem(STORAGE_KEYS.HELD_LOCK_SET, JSON.stringify(heldLockSet));
    };
    WebLocks.prototype._storeRequestLockQueueMap = function (requestLockQueueMap) {
        window.localStorage.setItem(STORAGE_KEYS.REQUEST_QUEUE_MAP, JSON.stringify(requestLockQueueMap));
    };
    WebLocks.prototype._handleNewLockRequest = function (request, cb, resolve) {
        var _this = this;
        this._pushToLockRequestQueueMap(request);
        var heldLockWIP = false;
        var listener = function () { return __awaiter(_this, void 0, void 0, function () {
            var result, heldLockSet, existOtherUnreleasedSharedHeldLock, heldLockIndex, latestHeldLockSet, requestLockQueueMap, _a, firstRequestLock, restRequestLocks;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(!heldLockWIP &&
                            this._heldLockSet().some(function (e) { return e.uuid === request.uuid; }))) return [3 /*break*/, 2];
                        heldLockWIP = true;
                        return [4 /*yield*/, cb({ name: request.name, mode: request.mode })];
                    case 1:
                        result = _b.sent();
                        if (request.mode === LOCK_MODE.EXCLUSIVE) {
                            this._updateHeldAndRequestLocks(request);
                        }
                        else if (request.mode === LOCK_MODE.SHARED) {
                            heldLockSet = this._heldLockSet();
                            existOtherUnreleasedSharedHeldLock = heldLockSet.some(function (lock) {
                                return lock.name === request.name && lock.mode === LOCK_MODE.SHARED;
                            });
                            // there is a issue when the shared locks release at the same time,
                            // existOtherUnreleasedSharedHeldLock will be true, then could not move request lock to held lock set
                            if (existOtherUnreleasedSharedHeldLock) {
                                heldLockIndex = heldLockSet.findIndex(function (lock) { return lock.uuid === request.uuid; });
                                if (heldLockIndex !== -1) {
                                    heldLockSet.splice(heldLockIndex, 1);
                                    this._storeHeldLockSet(heldLockSet);
                                }
                                else {
                                    throw new Error("this held lock should exist but could not be found!");
                                }
                                latestHeldLockSet = this._heldLockSet();
                                if (!latestHeldLockSet.some(function (lock) { return lock.name === request.name; })) {
                                    requestLockQueueMap = this._requestLockQueueMap();
                                    _a = requestLockQueueMap[request.name] || [], firstRequestLock = _a[0], restRequestLocks = _a.slice(1);
                                    if (firstRequestLock) {
                                        latestHeldLockSet.push(firstRequestLock);
                                        requestLockQueueMap[request.name] = restRequestLocks;
                                        this._storeHeldLockSetAndRequestLockQueueMap(latestHeldLockSet, requestLockQueueMap);
                                    }
                                }
                            }
                            else {
                                this._updateHeldAndRequestLocks(request);
                            }
                        }
                        resolve(result);
                        return [2 /*return*/, true];
                    case 2: return [2 /*return*/, false];
                }
            });
        }); };
        localStorageSubscribe_1.onStorageChange(STORAGE_KEYS.HELD_LOCK_SET, listener);
    };
    WebLocks.prototype._storeHeldLockSetAndRequestLockQueueMap = function (heldLockSet, requestLockQueueMap) {
        this._storeHeldLockSet(heldLockSet);
        this._storeRequestLockQueueMap(requestLockQueueMap);
    };
    WebLocks.prototype.query = function () {
        var queryResult = {
            held: this._heldLockSet(),
            pending: [],
        };
        var requestLockQueueMap = this._requestLockQueueMap();
        for (var name_1 in requestLockQueueMap) {
            var requestLockQueue = requestLockQueueMap[name_1];
            queryResult.pending = queryResult.pending.concat(requestLockQueue);
        }
        return queryResult;
    };
    WebLocks.prototype._onUnload = function () {
        var _this = this;
        window.addEventListener("unload", function (e) {
            var requestLockQueueMap = _this._requestLockQueueMap();
            for (var sourceName in requestLockQueueMap) {
                var requestLockQueue = requestLockQueueMap[sourceName];
                requestLockQueueMap[sourceName] = requestLockQueue.filter(function (requestLock) {
                    requestLock.clientId !== _this._clientId;
                });
            }
            var heldLockSet = _this._heldLockSet();
            var removedHeldLockSet = [];
            var newHeldLockSet = [];
            heldLockSet.forEach(function (element) {
                if (element.clientId !== _this._clientId) {
                    newHeldLockSet.push(element);
                }
                else {
                    removedHeldLockSet.push(element);
                    var requestLockQueue = requestLockQueueMap[element.name];
                    var firstRequestLock = requestLockQueue[0], restRequestLocks = requestLockQueue.slice(1);
                    if (firstRequestLock) {
                        if (firstRequestLock.mode === LOCK_MODE.EXCLUSIVE ||
                            restRequestLocks.length === 0) {
                            newHeldLockSet.push(firstRequestLock);
                            requestLockQueueMap[element.name] = restRequestLocks;
                        }
                        else if (firstRequestLock.mode === LOCK_MODE.SHARED) {
                            var nonSharedLockIndex = requestLockQueue.findIndex(function (lock) { return lock.mode !== LOCK_MODE.SHARED; });
                            newHeldLockSet = __spreadArray(__spreadArray([], newHeldLockSet), requestLockQueue.splice(0, nonSharedLockIndex));
                            requestLockQueueMap[element.name] = requestLockQueue;
                        }
                    }
                }
            });
            _this._storeHeldLockSetAndRequestLockQueueMap(heldLockSet, requestLockQueueMap);
        });
    };
    return WebLocks;
}());
exports.WebLocks = WebLocks;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9seWZpbGwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcG9seWZpbGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlFQUE4RTtBQUU5RSxJQUFLLFNBR0o7QUFIRCxXQUFLLFNBQVM7SUFDWixvQ0FBdUIsQ0FBQTtJQUN2Qiw4QkFBaUIsQ0FBQTtBQUNuQixDQUFDLEVBSEksU0FBUyxLQUFULFNBQVMsUUFHYjtBQUVELElBQUssWUFHSjtBQUhELFdBQUssWUFBWTtJQUNmLHFEQUFxQyxDQUFBO0lBQ3JDLDZDQUE2QixDQUFBO0FBQy9CLENBQUMsRUFISSxZQUFZLEtBQVosWUFBWSxRQUdoQjtBQStCRDtJQU1FO1FBSlEsY0FBUyxHQUFNLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQUksTUFBTSxDQUNuRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQ2QsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFHLENBQUM7UUFHZixJQUFNLFVBQVUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxjQUFjLEdBQUc7WUFDcEIsSUFBSSxFQUFFLFNBQVMsQ0FBQyxTQUFTO1lBQ3pCLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLEtBQUssRUFBRSxLQUFLO1lBQ1osTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNO1NBQzFCLENBQUM7UUFDRixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDZixDQUFDO0lBRU8sdUNBQW9CLEdBQTVCO1FBQ0UsSUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQ2pELFlBQVksQ0FBQyxpQkFBaUIsQ0FDL0IsQ0FBQztRQUNGLE9BQU8sQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNo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QUF6V1ksNEJBQVEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBvbkxvY2FsU3RvcmFnZUluaXQsIG9uU3RvcmFnZUNoYW5nZSB9IGZyb20gXCIuL2xvY2FsU3RvcmFnZVN1YnNjcmliZVwiO1xuXG5lbnVtIExPQ0tfTU9ERSB7XG4gIEVYQ0xVU0lWRSA9IFwiZXhjbHVzaXZlXCIsXG4gIFNIQVJFRCA9IFwic2hhcmVkXCIsXG59XG5cbmVudW0gU1RPUkFHRV9LRVlTIHtcbiAgUkVRVUVTVF9RVUVVRV9NQVAgPSBcInJlcXVlc3RRdWV1ZU1hcFwiLFxuICBIRUxEX0xPQ0tfU0VUID0gXCJoZWxkTG9ja1NldFwiLFxufVxuaW50ZXJmYWNlIExvY2tPcHRpb25zIHtcbiAgbW9kZTogTE9DS19NT0RFO1xuICBpZkF2YWlsYWJsZTogQm9vbGVhbjtcbiAgc3RlYWw6IEJvb2xlYW47XG4gIHNpZ25hbDogQWJvcnRTaWduYWw7XG59XG5cbnR5cGUgTG9jayA9IHtcbiAgbW9kZTogTE9DS19NT0RFO1xuICBuYW1lOiBzdHJpbmc7XG59O1xuXG50eXBlIExvY2tHcmFudGVkQ2FsbGJhY2sgPSAobG9jaz86IExvY2sgfCBudWxsKSA9PiBQcm9taXNlPGFueT47XG5cbnR5cGUgTG9ja0luZm8gPSBMb2NrICYge1xuICBjbGllbnRJZDogc3RyaW5nO1xuICB1dWlkOiBzdHJpbmc7XG59O1xuXG50eXBlIExvY2tzSW5mbyA9IExvY2tJbmZvW107XG5cbmludGVyZmFjZSBSZXF1ZXN0UXVldWVNYXAge1xuICBba2V5OiBzdHJpbmddOiBMb2Nrc0luZm87XG59XG5cbmludGVyZmFjZSBMb2NrTWFuYWdlclNuYXBzaG90IHtcbiAgaGVsZDogTG9ja3NJbmZvO1xuICBwZW5kaW5nOiBMb2Nrc0luZm87XG59XG5cbmV4cG9ydCBjbGFzcyBXZWJMb2NrcyB7XG4gIHB1YmxpYyBkZWZhdWx0T3B0aW9uczogTG9ja09wdGlvbnM7XG4gIHByaXZhdGUgX2NsaWVudElkID0gYCR7bmV3IERhdGUoKS5nZXRUaW1lKCl9LSR7U3RyaW5nKFxuICAgIE1hdGgucmFuZG9tKClcbiAgKS5zdWJzdHJpbmcoMil9YDtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIHRoaXMuZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICBtb2RlOiBMT0NLX01PREUuRVhDTFVTSVZFLFxuICAgICAgaWZBdmFpbGFibGU6IGZhbHNlLFxuICAgICAgc3RlYWw6IGZhbHNlLFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9O1xuICAgIHRoaXMuX2luaXQoKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlcXVlc3RMb2NrUXVldWVNYXAoKTogUmVxdWVzdFF1ZXVlTWFwIHtcbiAgICBjb25zdCByZXF1ZXN0UXVldWVNYXAgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXG4gICAgICBTVE9SQUdFX0tFWVMuUkVRVUVTVF9RVUVVRV9NQVBcbiAgICApO1xuICAgIHJldHVybiAocmVxdWVzdFF1ZXVlTWFwICYmIEpTT04ucGFyc2UocmVxdWVzdFF1ZXVlTWFwKSkgfHwge307XG4gIH1cblxuICBwcml2YXRlIF9oZWxkTG9ja1NldCgpOiBMb2Nrc0luZm8ge1xuICAgIGNvbnN0IGhlbGRMb2NrU2V0ID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFNUT1JBR0VfS0VZUy5IRUxEX0xPQ0tfU0VUKTtcbiAgICByZXR1cm4gKGhlbGRMb2NrU2V0ICYmIEpTT04ucGFyc2UoaGVsZExvY2tTZXQpKSB8fCBbXTtcbiAgfVxuXG4gIC8vIGRlbGV0ZSBvbGQgaGVsZCBsb2NrIGFuZCBhZGQgbW92ZSBmaXJzdCByZXF1ZXN0IExvY2sgdG8gaGVsZCBsb2NrIHNldFxuICBwcml2YXRlIF91cGRhdGVIZWxkQW5kUmVxdWVzdExvY2tzKHJlcXVlc3Q6IExvY2tJbmZvKSB7XG4gICAgbGV0IGhlbGRMb2NrU2V0ID0gdGhpcy5faGVsZExvY2tTZXQoKTtcbiAgICBjb25zdCBoZWxkTG9ja0luZGV4ID0gaGVsZExvY2tTZXQuZmluZEluZGV4KFxuICAgICAgKGxvY2spID0+IGxvY2sudXVpZCA9PT0gcmVxdWVzdC51dWlkXG4gICAgKTtcbiAgICBpZiAoaGVsZExvY2tJbmRleCAhPT0gLTEpIHtcbiAgICAgIGhlbGRMb2NrU2V0LnNwbGljZShoZWxkTG9ja0luZGV4LCAxKTtcbiAgICAgIGNvbnN0IHJlcXVlc3RMb2NrUXVldWVNYXAgPSB0aGlzLl9yZXF1ZXN0TG9ja1F1ZXVlTWFwKCk7XG4gICAgICBjb25zdCByZXF1ZXN0TG9ja1F1ZXVlID0gcmVxdWVzdExvY2tRdWV1ZU1hcFtyZXF1ZXN0Lm5hbWVdIHx8IFtdO1xuICAgICAgY29uc3QgW2ZpcnN0UmVxdWVzdExvY2ssIC4uLnJlc3RSZXF1ZXN0TG9ja3NdID0gcmVxdWVzdExvY2tRdWV1ZTtcbiAgICAgIGlmIChmaXJzdFJlcXVlc3RMb2NrKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBmaXJzdFJlcXVlc3RMb2NrLm1vZGUgPT09IExPQ0tfTU9ERS5FWENMVVNJVkUgfHxcbiAgICAgICAgICByZXN0UmVxdWVzdExvY2tzLmxlbmd0aCA9PT0gMFxuICAgICAgICApIHtcbiAgICAgICAgICBoZWxkTG9ja1NldC5wdXNoKGZpcnN0UmVxdWVzdExvY2spO1xuICAgICAgICAgIHJlcXVlc3RMb2NrUXVldWVNYXBbcmVxdWVzdC5uYW1lXSA9IHJlc3RSZXF1ZXN0TG9ja3M7XG4gICAgICAgIH0gZWxzZSBpZiAoZmlyc3RSZXF1ZXN0TG9jay5tb2RlID09PSBMT0NLX01PREUuU0hBUkVEKSB7XG4gICAgICAgICAgY29uc3Qgbm9uU2hhcmVkTG9ja0luZGV4ID0gcmVxdWVzdExvY2tRdWV1ZS5maW5kSW5kZXgoXG4gICAgICAgICAgICAobG9jaykgPT4gbG9jay5tb2RlICE9PSBMT0NLX01PREUuU0hBUkVEXG4gICAgICAgICAgKTtcbiAgICAgICAgICBoZWxkTG9ja1NldCA9IFtcbiAgICAgICAgICAgIC4uLmhlbGRMb2NrU2V0LFxuICAgICAgICAgICAgLi4ucmVxdWVzdExvY2tRdWV1ZS5zcGxpY2UoMCwgbm9uU2hhcmVkTG9ja0luZGV4KSxcbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgcmVxdWVzdExvY2tRdWV1ZU1hcFtyZXF1ZXN0Lm5hbWVdID0gcmVxdWVzdExvY2tRdWV1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0b3JlSGVsZExvY2tTZXRBbmRSZXF1ZXN0TG9ja1F1ZXVlTWFwKFxuICAgICAgICAgIGhlbGRMb2NrU2V0LFxuICAgICAgICAgIHJlcXVlc3RMb2NrUXVldWVNYXBcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gZmlyc3RSZXF1ZXN0TG9jaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3N0b3JlSGVsZExvY2tTZXQoaGVsZExvY2tTZXQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYHRoaXMgaGVsZCBsb2NrIHdoaWNoIHV1aWQgaXMgJHtyZXF1ZXN0LnV1aWR9IGhhZCBiZWVuIHN0ZWFsYFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9pbml0KCkge1xuICAgIG9uTG9jYWxTdG9yYWdlSW5pdCgpO1xuICAgIHRoaXMuX29uVW5sb2FkKCk7XG4gIH1cblxuICBwcml2YXRlIF9wdXNoVG9Mb2NrUmVxdWVzdFF1ZXVlTWFwKHJlcXVlc3Q6IExvY2tJbmZvKSB7XG4gICAgY29uc3QgcmVxdWVzdFF1ZXVlTWFwID0gdGhpcy5fcmVxdWVzdExvY2tRdWV1ZU1hcCgpO1xuICAgIGNvbnN0IHJlcXVlc3RRdWV1ZSA9IHJlcXVlc3RRdWV1ZU1hcFtyZXF1ZXN0Lm5hbWVdIHx8IFtdO1xuICAgIHJlcXVlc3RRdWV1ZU1hcFtyZXF1ZXN0Lm5hbWVdID0gWy4uLnJlcXVlc3RRdWV1ZSwgcmVxdWVzdF07XG5cbiAgICB0aGlzLl9zdG9yZVJlcXVlc3RMb2NrUXVldWVNYXAocmVxdWVzdFF1ZXVlTWFwKTtcbiAgICByZXR1cm4gcmVxdWVzdDtcbiAgfVxuXG4gIHByaXZhdGUgX3B1c2hUb0hlbGRMb2NrU2V0KFxuICAgIHJlcXVlc3Q6IExvY2tJbmZvLFxuICAgIGN1cnJlbnRIZWxkTG9ja1NldCA9IHRoaXMuX2hlbGRMb2NrU2V0KClcbiAgKSB7XG4gICAgY29uc3QgaGVsZExvY2tTZXQgPSBbLi4uY3VycmVudEhlbGRMb2NrU2V0LCByZXF1ZXN0XTtcbiAgICB0aGlzLl9zdG9yZUhlbGRMb2NrU2V0KGhlbGRMb2NrU2V0KTtcbiAgICByZXR1cm4gcmVxdWVzdDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBjYWxsYmFjazogTG9ja0dyYW50ZWRDYWxsYmFja1xuICApOiBQcm9taXNlPGFueT47XG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBQYXJ0aWFsPExvY2tPcHRpb25zPixcbiAgICBjYWxsYmFjazogTG9ja0dyYW50ZWRDYWxsYmFja1xuICApOiBQcm9taXNlPGFueT47XG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBvcHRpb25zT3JDYWxsYmFjazogUGFydGlhbDxMb2NrT3B0aW9ucz4gfCBMb2NrR3JhbnRlZENhbGxiYWNrLFxuICAgIGNhbGxiYWNrPzogTG9ja0dyYW50ZWRDYWxsYmFja1xuICApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IGNiO1xuICAgICAgbGV0IF9vcHRpb25zOiBMb2NrT3B0aW9ucztcbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9uc09yQ2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIiAmJiAhY2FsbGJhY2spIHtcbiAgICAgICAgY2IgPSBvcHRpb25zT3JDYWxsYmFjaztcbiAgICAgICAgX29wdGlvbnMgPSB0aGlzLmRlZmF1bHRPcHRpb25zO1xuICAgICAgfSBlbHNlIGlmIChvcHRpb25zT3JDYWxsYmFjaz8uY29uc3RydWN0b3IubmFtZSA9PT0gXCJPYmplY3RcIiAmJiBjYWxsYmFjaykge1xuICAgICAgICBjYiA9IGNhbGxiYWNrO1xuICAgICAgICBfb3B0aW9ucyA9IHsgLi4udGhpcy5kZWZhdWx0T3B0aW9ucywgLi4ub3B0aW9uc09yQ2FsbGJhY2sgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInBsZWFzZSBpbnB1dCByaWdodCBvcHRpb25zXCIpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXF1ZXN0ID0ge1xuICAgICAgICBuYW1lLFxuICAgICAgICBtb2RlOiBfb3B0aW9ucy5tb2RlLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5fY2xpZW50SWQsXG4gICAgICAgIHV1aWQ6IGAke25hbWV9LSR7bmV3IERhdGUoKS5nZXRUaW1lKCl9LSR7U3RyaW5nKFxuICAgICAgICAgIE1hdGgucmFuZG9tKClcbiAgICAgICAgKS5zdWJzdHJpbmcoMil9YCxcbiAgICAgIH07XG5cbiAgICAgIGxldCBoZWxkTG9ja1NldCA9IHRoaXMuX2hlbGRMb2NrU2V0KCk7XG4gICAgICBsZXQgaGVsZExvY2sgPSBoZWxkTG9ja1NldC5maW5kKChlKSA9PiB7XG4gICAgICAgIHJldHVybiBlLm5hbWUgPT09IG5hbWU7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHJlcXVlc3RMb2NrUXVldWUgPSB0aGlzLl9yZXF1ZXN0TG9ja1F1ZXVlTWFwKClbcmVxdWVzdC5uYW1lXSB8fCBbXTtcblxuICAgICAgaWYgKF9vcHRpb25zLnN0ZWFsKSB7XG4gICAgICAgIGlmIChfb3B0aW9ucy5tb2RlICE9PSBMT0NLX01PREUuRVhDTFVTSVZFKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IERPTUV4Y2VwdGlvbihcbiAgICAgICAgICAgIFwiRmFpbGVkIHRvIGV4ZWN1dGUgJ3JlcXVlc3QnIG9uICdMb2NrTWFuYWdlcic6IFRoZSAnc3RlYWwnIG9wdGlvbiBtYXkgb25seSBiZSB1c2VkIHdpdGggJ2V4Y2x1c2l2ZScgbG9ja3MuXCJcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChfb3B0aW9ucy5pZkF2YWlsYWJsZSkge1xuICAgICAgICAgIHRocm93IG5ldyBET01FeGNlcHRpb24oXG4gICAgICAgICAgICBcIkZhaWxlZCB0byBleGVjdXRlICdyZXF1ZXN0JyBvbiAnTG9ja01hbmFnZXInOiBUaGUgJ3N0ZWFsJyBhbmQgJ2lmQXZhaWxhYmxlJyBvcHRpb25zIGNhbm5vdCBiZSB1c2VkIHRvZ2V0aGVyLlwiXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBoZWxkTG9ja1NldCA9IGhlbGRMb2NrU2V0LmZpbHRlcigoZSkgPT4gZS5uYW1lICE9PSByZXF1ZXN0Lm5hbWUpO1xuICAgICAgICBoZWxkTG9jayA9IGhlbGRMb2NrU2V0LmZpbmQoKGUpID0+IHtcbiAgICAgICAgICByZXR1cm4gZS5uYW1lID09PSBuYW1lO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoX29wdGlvbnMuaWZBdmFpbGFibGUpIHtcbiAgICAgICAgaWYgKGhlbGRMb2NrIHx8IHJlcXVlc3RMb2NrUXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoY2IobnVsbCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9oYW5kbGVOZXdIZWxkTG9jayhyZXF1ZXN0LCBjYiwgcmVzb2x2ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoX29wdGlvbnMuc2lnbmFsKSB7XG4gICAgICAgIGlmIChfb3B0aW9ucy5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3QoXG4gICAgICAgICAgICBuZXcgRE9NRXhjZXB0aW9uKFxuICAgICAgICAgICAgICBcIkZhaWxlZCB0byBleGVjdXRlICdyZXF1ZXN0JyBvbiAnTG9ja01hbmFnZXInOiBUaGUgcmVxdWVzdCB3YXMgYWJvcnRlZC5cIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX29wdGlvbnMuc2lnbmFsLm9uYWJvcnQgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRE9NRXhjZXB0aW9uKFwiVGhlIHJlcXVlc3Qgd2FzIGFib3J0ZWQuXCIpO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGhlbGRMb2NrKSB7XG4gICAgICAgIGlmIChoZWxkTG9jay5tb2RlID09PSBMT0NLX01PREUuRVhDTFVTSVZFKSB7XG4gICAgICAgICAgdGhpcy5faGFuZGxlTmV3TG9ja1JlcXVlc3QocmVxdWVzdCwgY2IsIHJlc29sdmUpO1xuICAgICAgICB9IGVsc2UgaWYgKGhlbGRMb2NrLm1vZGUgPT09IExPQ0tfTU9ERS5TSEFSRUQpIHtcbiAgICAgICAgICAvLyBpZiB0aGlzIHJlcXVlc3QgbG9jayBpcyBzaGFyZWQgbG9jayBhbmQgaXMgZmlyc3QgcmVxdWVzdCBsb2NrIG9mIHRoaXMgcXVldWUsIHRoZW4gcHVzaCBoZWxkIGxvY2tzIHNldFxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHJlcXVlc3QubW9kZSA9PT0gTE9DS19NT0RFLlNIQVJFRCAmJlxuICAgICAgICAgICAgcmVxdWVzdExvY2tRdWV1ZS5sZW5ndGggPT09IDBcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZU5ld0hlbGRMb2NrKHJlcXVlc3QsIGNiLCByZXNvbHZlLCBoZWxkTG9ja1NldCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZU5ld0xvY2tSZXF1ZXN0KHJlcXVlc3QsIGNiLCByZXNvbHZlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZU5ld0hlbGRMb2NrKHJlcXVlc3QsIGNiLCByZXNvbHZlLCBoZWxkTG9ja1NldCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9oYW5kbGVOZXdIZWxkTG9jayhcbiAgICByZXF1ZXN0OiBMb2NrSW5mbyxcbiAgICBjYjogYW55LFxuICAgIHJlc29sdmU6ICh2YWx1ZT86IHVua25vd24pID0+IHZvaWQsXG4gICAgY3VycmVudEhlbGRMb2NrU2V0PzogTG9ja3NJbmZvXG4gICkge1xuICAgIHRoaXMuX3B1c2hUb0hlbGRMb2NrU2V0KHJlcXVlc3QsIGN1cnJlbnRIZWxkTG9ja1NldCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2IoeyBuYW1lOiByZXF1ZXN0Lm5hbWUsIG1vZGU6IHJlcXVlc3QubW9kZSB9KTtcbiAgICB0aGlzLl91cGRhdGVIZWxkQW5kUmVxdWVzdExvY2tzKHJlcXVlc3QpO1xuICAgIHJlc29sdmUocmVzdWx0KTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0b3JlSGVsZExvY2tTZXQoaGVsZExvY2tTZXQ6IExvY2tzSW5mbykge1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcbiAgICAgIFNUT1JBR0VfS0VZUy5IRUxEX0xPQ0tfU0VULFxuICAgICAgSlNPTi5zdHJpbmdpZnkoaGVsZExvY2tTZXQpXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0b3JlUmVxdWVzdExvY2tRdWV1ZU1hcChyZXF1ZXN0TG9ja1F1ZXVlTWFwOiBSZXF1ZXN0UXVldWVNYXApIHtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXG4gICAgICBTVE9SQUdFX0tFWVMuUkVRVUVTVF9RVUVVRV9NQVAsXG4gICAgICBKU09OLnN0cmluZ2lmeShyZXF1ZXN0TG9ja1F1ZXVlTWFwKVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF9oYW5kbGVOZXdMb2NrUmVxdWVzdChcbiAgICByZXF1ZXN0OiBMb2NrSW5mbyxcbiAgICBjYjogKExvY2s6IExvY2spID0+IGFueSxcbiAgICByZXNvbHZlOiAodmFsdWU/OiB1bmtub3duKSA9PiB2b2lkXG4gICkge1xuICAgIHRoaXMuX3B1c2hUb0xvY2tSZXF1ZXN0UXVldWVNYXAocmVxdWVzdCk7XG4gICAgbGV0IGhlbGRMb2NrV0lQID0gZmFsc2U7XG4gICAgY29uc3QgbGlzdGVuZXIgPSBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgICFoZWxkTG9ja1dJUCAmJlxuICAgICAgICB0aGlzLl9oZWxkTG9ja1NldCgpLnNvbWUoKGUpID0+IGUudXVpZCA9PT0gcmVxdWVzdC51dWlkKVxuICAgICAgKSB7XG4gICAgICAgIGhlbGRMb2NrV0lQID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2IoeyBuYW1lOiByZXF1ZXN0Lm5hbWUsIG1vZGU6IHJlcXVlc3QubW9kZSB9KTtcbiAgICAgICAgaWYgKHJlcXVlc3QubW9kZSA9PT0gTE9DS19NT0RFLkVYQ0xVU0lWRSkge1xuICAgICAgICAgIHRoaXMuX3VwZGF0ZUhlbGRBbmRSZXF1ZXN0TG9ja3MocmVxdWVzdCk7XG4gICAgICAgIH0gZWxzZSBpZiAocmVxdWVzdC5tb2RlID09PSBMT0NLX01PREUuU0hBUkVEKSB7XG4gICAgICAgICAgY29uc3QgaGVsZExvY2tTZXQgPSB0aGlzLl9oZWxkTG9ja1NldCgpO1xuICAgICAgICAgIC8vIGhhdmUgb3RoZXIgdW5yZWxlYXNlZCBzaGFyZWQgaGVsZCBsb2NrIGZvciB0aGlzIHNvdXJjZSwganVzdCBkZWxldGUgdGhpcyBoZWxkIGxvY2ssIGVsc2UgYWxzbyBuZWVkIHRvIHB1c2ggbmV3IHJlcXVlc3QgbG9jayBhcyBoZWxkIGxvY2tcbiAgICAgICAgICBjb25zdCBleGlzdE90aGVyVW5yZWxlYXNlZFNoYXJlZEhlbGRMb2NrID0gaGVsZExvY2tTZXQuc29tZShcbiAgICAgICAgICAgIChsb2NrKSA9PlxuICAgICAgICAgICAgICBsb2NrLm5hbWUgPT09IHJlcXVlc3QubmFtZSAmJiBsb2NrLm1vZGUgPT09IExPQ0tfTU9ERS5TSEFSRURcbiAgICAgICAgICApO1xuICAgICAgICAgIC8vIHRoZXJlIGlzIGEgaXNzdWUgd2hlbiB0aGUgc2hhcmVkIGxvY2tzIHJlbGVhc2UgYXQgdGhlIHNhbWUgdGltZSxcbiAgICAgICAgICAvLyBleGlzdE90aGVyVW5yZWxlYXNlZFNoYXJlZEhlbGRMb2NrIHdpbGwgYmUgdHJ1ZSwgdGhlbiBjb3VsZCBub3QgbW92ZSByZXF1ZXN0IGxvY2sgdG8gaGVsZCBsb2NrIHNldFxuICAgICAgICAgIGlmIChleGlzdE90aGVyVW5yZWxlYXNlZFNoYXJlZEhlbGRMb2NrKSB7XG4gICAgICAgICAgICAvLyBqdXN0IGRlbGV0ZSB0aGlzIGhlbGQgbG9ja1xuICAgICAgICAgICAgY29uc3QgaGVsZExvY2tJbmRleCA9IGhlbGRMb2NrU2V0LmZpbmRJbmRleChcbiAgICAgICAgICAgICAgKGxvY2spID0+IGxvY2sudXVpZCA9PT0gcmVxdWVzdC51dWlkXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKGhlbGRMb2NrSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgIGhlbGRMb2NrU2V0LnNwbGljZShoZWxkTG9ja0luZGV4LCAxKTtcbiAgICAgICAgICAgICAgdGhpcy5fc3RvcmVIZWxkTG9ja1NldChoZWxkTG9ja1NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgXCJ0aGlzIGhlbGQgbG9jayBzaG91bGQgZXhpc3QgYnV0IGNvdWxkIG5vdCBiZSBmb3VuZCFcIlxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBoYW5kbGUgYWJvdmUgaXNzdWUgd2hlbiB0aGUgc2hhcmVkIGxvY2tzIHJlbGVhc2UgYXQgdGhlIHNhbWUgdGltZVxuICAgICAgICAgICAgbGV0IGxhdGVzdEhlbGRMb2NrU2V0ID0gdGhpcy5faGVsZExvY2tTZXQoKTtcbiAgICAgICAgICAgIGlmICghbGF0ZXN0SGVsZExvY2tTZXQuc29tZSgobG9jaykgPT4gbG9jay5uYW1lID09PSByZXF1ZXN0Lm5hbWUpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RMb2NrUXVldWVNYXAgPSB0aGlzLl9yZXF1ZXN0TG9ja1F1ZXVlTWFwKCk7XG4gICAgICAgICAgICAgIGNvbnN0IFtmaXJzdFJlcXVlc3RMb2NrLCAuLi5yZXN0UmVxdWVzdExvY2tzXSA9XG4gICAgICAgICAgICAgICAgcmVxdWVzdExvY2tRdWV1ZU1hcFtyZXF1ZXN0Lm5hbWVdIHx8IFtdO1xuICAgICAgICAgICAgICBpZiAoZmlyc3RSZXF1ZXN0TG9jaykge1xuICAgICAgICAgICAgICAgIGxhdGVzdEhlbGRMb2NrU2V0LnB1c2goZmlyc3RSZXF1ZXN0TG9jayk7XG4gICAgICAgICAgICAgICAgcmVxdWVzdExvY2tRdWV1ZU1hcFtyZXF1ZXN0Lm5hbWVdID0gcmVzdFJlcXVlc3RMb2NrcztcbiAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZUhlbGRMb2NrU2V0QW5kUmVxdWVzdExvY2tRdWV1ZU1hcChcbiAgICAgICAgICAgICAgICAgIGxhdGVzdEhlbGRMb2NrU2V0LFxuICAgICAgICAgICAgICAgICAgcmVxdWVzdExvY2tRdWV1ZU1hcFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlSGVsZEFuZFJlcXVlc3RMb2NrcyhyZXF1ZXN0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuICAgIG9uU3RvcmFnZUNoYW5nZShTVE9SQUdFX0tFWVMuSEVMRF9MT0NLX1NFVCwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3RvcmVIZWxkTG9ja1NldEFuZFJlcXVlc3RMb2NrUXVldWVNYXAoXG4gICAgaGVsZExvY2tTZXQ6IExvY2tzSW5mbyxcbiAgICByZXF1ZXN0TG9ja1F1ZXVlTWFwOiBSZXF1ZXN0UXVldWVNYXBcbiAgKSB7XG4gICAgdGhpcy5fc3RvcmVIZWxkTG9ja1NldChoZWxkTG9ja1NldCk7XG4gICAgdGhpcy5fc3RvcmVSZXF1ZXN0TG9ja1F1ZXVlTWFwKHJlcXVlc3RMb2NrUXVldWVNYXApO1xuICB9XG5cbiAgcHVibGljIHF1ZXJ5KCkge1xuICAgIGNvbnN0IHF1ZXJ5UmVzdWx0OiBMb2NrTWFuYWdlclNuYXBzaG90ID0ge1xuICAgICAgaGVsZDogdGhpcy5faGVsZExvY2tTZXQoKSxcbiAgICAgIHBlbmRpbmc6IFtdLFxuICAgIH07XG4gICAgY29uc3QgcmVxdWVzdExvY2tRdWV1ZU1hcCA9IHRoaXMuX3JlcXVlc3RMb2NrUXVldWVNYXAoKTtcbiAgICBmb3IgKGNvbnN0IG5hbWUgaW4gcmVxdWVzdExvY2tRdWV1ZU1hcCkge1xuICAgICAgY29uc3QgcmVxdWVzdExvY2tRdWV1ZSA9IHJlcXVlc3RMb2NrUXVldWVNYXBbbmFtZV07XG4gICAgICBxdWVyeVJlc3VsdC5wZW5kaW5nID0gcXVlcnlSZXN1bHQucGVuZGluZy5jb25jYXQocmVxdWVzdExvY2tRdWV1ZSk7XG4gICAgfVxuICAgIHJldHVybiBxdWVyeVJlc3VsdDtcbiAgfVxuXG4gIHByaXZhdGUgX29uVW5sb2FkKCkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwidW5sb2FkXCIsIChlKSA9PiB7XG4gICAgICBjb25zdCByZXF1ZXN0TG9ja1F1ZXVlTWFwID0gdGhpcy5fcmVxdWVzdExvY2tRdWV1ZU1hcCgpO1xuICAgICAgZm9yIChjb25zdCBzb3VyY2VOYW1lIGluIHJlcXVlc3RMb2NrUXVldWVNYXApIHtcbiAgICAgICAgY29uc3QgcmVxdWVzdExvY2tRdWV1ZSA9IHJlcXVlc3RMb2NrUXVldWVNYXBbc291cmNlTmFtZV07XG4gICAgICAgIHJlcXVlc3RMb2NrUXVldWVNYXBbc291cmNlTmFtZV0gPSByZXF1ZXN0TG9ja1F1ZXVlLmZpbHRlcihcbiAgICAgICAgICAocmVxdWVzdExvY2spID0+IHtcbiAgICAgICAgICAgIHJlcXVlc3RMb2NrLmNsaWVudElkICE9PSB0aGlzLl9jbGllbnRJZDtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhlbGRMb2NrU2V0ID0gdGhpcy5faGVsZExvY2tTZXQoKTtcbiAgICAgIGNvbnN0IHJlbW92ZWRIZWxkTG9ja1NldDogTG9ja3NJbmZvID0gW107XG5cbiAgICAgIGxldCBuZXdIZWxkTG9ja1NldDogTG9ja3NJbmZvID0gW107XG5cbiAgICAgIGhlbGRMb2NrU2V0LmZvckVhY2goKGVsZW1lbnQpID0+IHtcbiAgICAgICAgaWYgKGVsZW1lbnQuY2xpZW50SWQgIT09IHRoaXMuX2NsaWVudElkKSB7XG4gICAgICAgICAgbmV3SGVsZExvY2tTZXQucHVzaChlbGVtZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZW1vdmVkSGVsZExvY2tTZXQucHVzaChlbGVtZW50KTtcblxuICAgICAgICAgIGNvbnN0IHJlcXVlc3RMb2NrUXVldWUgPSByZXF1ZXN0TG9ja1F1ZXVlTWFwW2VsZW1lbnQubmFtZV07XG4gICAgICAgICAgY29uc3QgW2ZpcnN0UmVxdWVzdExvY2ssIC4uLnJlc3RSZXF1ZXN0TG9ja3NdID0gcmVxdWVzdExvY2tRdWV1ZTtcbiAgICAgICAgICBpZiAoZmlyc3RSZXF1ZXN0TG9jaykge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBmaXJzdFJlcXVlc3RMb2NrLm1vZGUgPT09IExPQ0tfTU9ERS5FWENMVVNJVkUgfHxcbiAgICAgICAgICAgICAgcmVzdFJlcXVlc3RMb2Nrcy5sZW5ndGggPT09IDBcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBuZXdIZWxkTG9ja1NldC5wdXNoKGZpcnN0UmVxdWVzdExvY2spO1xuICAgICAgICAgICAgICByZXF1ZXN0TG9ja1F1ZXVlTWFwW2VsZW1lbnQubmFtZV0gPSByZXN0UmVxdWVzdExvY2tzO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmaXJzdFJlcXVlc3RMb2NrLm1vZGUgPT09IExPQ0tfTU9ERS5TSEFSRUQpIHtcbiAgICAgICAgICAgICAgY29uc3Qgbm9uU2hhcmVkTG9ja0luZGV4ID0gcmVxdWVzdExvY2tRdWV1ZS5maW5kSW5kZXgoXG4gICAgICAgICAgICAgICAgKGxvY2spID0+IGxvY2subW9kZSAhPT0gTE9DS19NT0RFLlNIQVJFRFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBuZXdIZWxkTG9ja1NldCA9IFtcbiAgICAgICAgICAgICAgICAuLi5uZXdIZWxkTG9ja1NldCxcbiAgICAgICAgICAgICAgICAuLi5yZXF1ZXN0TG9ja1F1ZXVlLnNwbGljZSgwLCBub25TaGFyZWRMb2NrSW5kZXgpLFxuICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgIHJlcXVlc3RMb2NrUXVldWVNYXBbZWxlbWVudC5uYW1lXSA9IHJlcXVlc3RMb2NrUXVldWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fc3RvcmVIZWxkTG9ja1NldEFuZFJlcXVlc3RMb2NrUXVldWVNYXAoXG4gICAgICAgIGhlbGRMb2NrU2V0LFxuICAgICAgICByZXF1ZXN0TG9ja1F1ZXVlTWFwXG4gICAgICApO1xuICAgIH0pO1xuICB9XG59XG4iXX0=