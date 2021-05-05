"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locks = void 0;
var polyfill_1 = require("./polyfill");
var locks = (function () {
    var navigator = window === null || window === void 0 ? void 0 : window.navigator;
    // if (!window?.navigator?.locks || true) {
    if (!(navigator === null || navigator === void 0 ? void 0 : navigator.locks)) {
        var webLocks = new polyfill_1.WebLocks();
        // TODO: follow navigator properties setting of native browser
        Object.defineProperty(window, "navigator", {
            value: {
                locks: webLocks,
            },
            writable: true,
        });
    }
    return navigator === null || navigator === void 0 ? void 0 : navigator.locks;
})();
exports.locks = locks;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsdUNBQXNDO0FBRXRDLElBQU0sS0FBSyxHQUFHLENBQUM7SUFDYixJQUFNLFNBQVMsR0FBRyxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsU0FBNEMsQ0FBQztJQUN2RSwyQ0FBMkM7SUFDM0MsSUFBSSxDQUFDLENBQUEsU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLEtBQUssQ0FBQSxFQUFFO1FBQ3JCLElBQU0sUUFBUSxHQUFHLElBQUksbUJBQVEsRUFBRSxDQUFDO1FBQ2hDLDhEQUE4RDtRQUM5RCxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUU7WUFDekMsS0FBSyxFQUFFO2dCQUNMLEtBQUssRUFBRSxRQUFRO2FBQ2hCO1lBQ0QsUUFBUSxFQUFFLElBQUk7U0FDZixDQUFDLENBQUM7S0FDSjtJQUNELE9BQU8sU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLEtBQUssQ0FBQztBQUMxQixDQUFDLENBQUMsRUFBRSxDQUFDO0FBRUksc0JBQUsiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBXZWJMb2NrcyB9IGZyb20gXCIuL3BvbHlmaWxsXCI7XG5cbmNvbnN0IGxvY2tzID0gKGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgbmF2aWdhdG9yID0gd2luZG93Py5uYXZpZ2F0b3IgYXMgTmF2aWdhdG9yICYgeyBsb2NrczogV2ViTG9ja3MgfTtcbiAgLy8gaWYgKCF3aW5kb3c/Lm5hdmlnYXRvcj8ubG9ja3MgfHwgdHJ1ZSkge1xuICBpZiAoIW5hdmlnYXRvcj8ubG9ja3MpIHtcbiAgICBjb25zdCB3ZWJMb2NrcyA9IG5ldyBXZWJMb2NrcygpO1xuICAgIC8vIFRPRE86IGZvbGxvdyBuYXZpZ2F0b3IgcHJvcGVydGllcyBzZXR0aW5nIG9mIG5hdGl2ZSBicm93c2VyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdywgXCJuYXZpZ2F0b3JcIiwge1xuICAgICAgdmFsdWU6IHtcbiAgICAgICAgbG9ja3M6IHdlYkxvY2tzLFxuICAgICAgfSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIH0pO1xuICB9XG4gIHJldHVybiBuYXZpZ2F0b3I/LmxvY2tzO1xufSkoKTtcblxuZXhwb3J0IHsgbG9ja3MgfTtcbiJdfQ==