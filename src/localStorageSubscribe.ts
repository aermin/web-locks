type EventType = Event & {
  value?: string;
  key?: string;
};

export function onLocalStorageInit() {
  // localStorage.setItem("test", "23333");
  console.log(
    "onLocalStorageInit====",
    global.localStorage.setItem.toString(),
    JSON.stringify(localStorage.setItem)
  );
  // const originalSetItem = window.localStorage.setItem;
  // console.log("originalSetItem===", window.localStorage);
  // window.localStorage.setItem = function (key, value) {
  //   console.log("setItem===", key, value);
  //   var event: EventType = new Event(key);

  //   event.value = value;
  //   event.key = key;

  //   originalSetItem.apply(this, [key, value]);
  //   console.log("dispatchEvent===", event);
  //   document.dispatchEvent(event);
  // };
}

export function onStorageChange(
  key: string,
  listener: () => Promise<boolean> | boolean
) {
  let needRemoveListener = false;
  console.log("onStorageChange===", key, listener);
  document.addEventListener(
    key,
    async () => {
      console.log("document.addEventListener===", key, listener);
      needRemoveListener = await listener();
    },
    false
  );

  const windowListener = async function (event: StorageEvent) {
    console.log("windowListener===", event);
    if (event.storageArea === window.localStorage && event.key === key) {
      needRemoveListener = await listener();
    }
  };

  window.addEventListener("storage", windowListener, false);

  // unsubscribe Listener
  if (needRemoveListener) {
    document.removeEventListener(key, listener);
    window.removeEventListener("storage", windowListener);
  }
}
