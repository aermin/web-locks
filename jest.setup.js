// var localStorageMock = function () {
//   var store = {};
//   return {
//     getItem: function (key) {
//       console.error("getItem===");
//       return store[key];
//     },
//     setItem: function (key, value) {
//       console.log("setItem===");
//       store[key] = value.toString();
//       var event = new Event(key);
//       event.value = value;
//       event.key = key;
//       console.log("dispatchEvent===", event);
//       document.dispatchEvent(event);
//     },
//     clear: function () {
//       store = {};
//     },
//     removeItem: function (key) {
//       delete store[key];
//     },
//   };
// };

// global.localStorage = localStorageMock();
