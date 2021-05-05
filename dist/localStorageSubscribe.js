"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onStorageChange = exports.onLocalStorageInit = void 0;
function onLocalStorageInit() {
    var originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
        var event = new Event(key);
        event.value = value;
        event.key = key;
        originalSetItem.apply(this, [key, value]);
        document.dispatchEvent(event);
    };
}
exports.onLocalStorageInit = onLocalStorageInit;
function onStorageChange(key, listener) {
    var _this = this;
    var needRemoveListener = false;
    document.addEventListener(key, function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, listener()];
                case 1:
                    needRemoveListener = _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, false);
    var windowListener = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(event.storageArea === localStorage && event.key === key)) return [3 /*break*/, 2];
                        return [4 /*yield*/, listener()];
                    case 1:
                        needRemoveListener = _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    window.addEventListener("storage", windowListener, false);
    // unsubscribe Listener
    if (needRemoveListener) {
        document.removeEventListener(key, listener);
        window.removeEventListener("storage", windowListener);
    }
}
exports.onStorageChange = onStorageChange;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxTdG9yYWdlU3Vic2NyaWJlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2xvY2FsU3RvcmFnZVN1YnNjcmliZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFLQSxTQUFnQixrQkFBa0I7SUFDaEMsSUFBTSxlQUFlLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUU3QyxZQUFZLENBQUMsT0FBTyxHQUFHLFVBQVUsR0FBRyxFQUFFLEtBQUs7UUFDekMsSUFBSSxLQUFLLEdBQWMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFdEMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDcEIsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFFaEIsZUFBZSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUUxQyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFiRCxnREFhQztBQUVELFNBQWdCLGVBQWUsQ0FDN0IsR0FBVyxFQUNYLFFBQTBDO0lBRjVDLGlCQTJCQztJQXZCQyxJQUFJLGtCQUFrQixHQUFHLEtBQUssQ0FBQztJQUUvQixRQUFRLENBQUMsZ0JBQWdCLENBQ3ZCLEdBQUcsRUFDSDs7O3dCQUN1QixxQkFBTSxRQUFRLEVBQUUsRUFBQTs7b0JBQXJDLGtCQUFrQixHQUFHLFNBQWdCLENBQUM7Ozs7U0FDdkMsRUFDRCxLQUFLLENBQ04sQ0FBQztJQUVGLElBQU0sY0FBYyxHQUFHLFVBQWdCLEtBQW1COzs7Ozs2QkFDcEQsQ0FBQSxLQUFLLENBQUMsV0FBVyxLQUFLLFlBQVksSUFBSSxLQUFLLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQSxFQUF2RCx3QkFBdUQ7d0JBQ3BDLHFCQUFNLFFBQVEsRUFBRSxFQUFBOzt3QkFBckMsa0JBQWtCLEdBQUcsU0FBZ0IsQ0FBQzs7Ozs7O0tBRXpDLENBQUM7SUFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUUxRCx1QkFBdUI7SUFDdkIsSUFBSSxrQkFBa0IsRUFBRTtRQUN0QixRQUFRLENBQUMsbUJBQW1CLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUM7S0FDdkQ7QUFDSCxDQUFDO0FBM0JELDBDQTJCQyIsInNvdXJjZXNDb250ZW50IjpbInR5cGUgRXZlbnRUeXBlID0gRXZlbnQgJiB7XG4gIHZhbHVlPzogc3RyaW5nO1xuICBrZXk/OiBzdHJpbmc7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gb25Mb2NhbFN0b3JhZ2VJbml0KCkge1xuICBjb25zdCBvcmlnaW5hbFNldEl0ZW0gPSBsb2NhbFN0b3JhZ2Uuc2V0SXRlbTtcblxuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgdmFyIGV2ZW50OiBFdmVudFR5cGUgPSBuZXcgRXZlbnQoa2V5KTtcblxuICAgIGV2ZW50LnZhbHVlID0gdmFsdWU7XG4gICAgZXZlbnQua2V5ID0ga2V5O1xuXG4gICAgb3JpZ2luYWxTZXRJdGVtLmFwcGx5KHRoaXMsIFtrZXksIHZhbHVlXSk7XG5cbiAgICBkb2N1bWVudC5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uU3RvcmFnZUNoYW5nZShcbiAga2V5OiBzdHJpbmcsXG4gIGxpc3RlbmVyOiAoKSA9PiBQcm9taXNlPGJvb2xlYW4+IHwgYm9vbGVhblxuKSB7XG4gIGxldCBuZWVkUmVtb3ZlTGlzdGVuZXIgPSBmYWxzZTtcblxuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFxuICAgIGtleSxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBuZWVkUmVtb3ZlTGlzdGVuZXIgPSBhd2FpdCBsaXN0ZW5lcigpO1xuICAgIH0sXG4gICAgZmFsc2VcbiAgKTtcblxuICBjb25zdCB3aW5kb3dMaXN0ZW5lciA9IGFzeW5jIGZ1bmN0aW9uIChldmVudDogU3RvcmFnZUV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LnN0b3JhZ2VBcmVhID09PSBsb2NhbFN0b3JhZ2UgJiYgZXZlbnQua2V5ID09PSBrZXkpIHtcbiAgICAgIG5lZWRSZW1vdmVMaXN0ZW5lciA9IGF3YWl0IGxpc3RlbmVyKCk7XG4gICAgfVxuICB9O1xuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwic3RvcmFnZVwiLCB3aW5kb3dMaXN0ZW5lciwgZmFsc2UpO1xuXG4gIC8vIHVuc3Vic2NyaWJlIExpc3RlbmVyXG4gIGlmIChuZWVkUmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGtleSwgbGlzdGVuZXIpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwic3RvcmFnZVwiLCB3aW5kb3dMaXN0ZW5lcik7XG4gIH1cbn1cbiJdfQ==