export type EventType = Event & {
  value?: string;
  key?: string;
};

export function dispatchEvent(key: string, value: string) {
  const event: EventType = new Event(key);

  event.value = value;
  event.key = key;
  document.dispatchEvent(event);
}

export function onLocalStorageInit() {
  const originalSetItem = localStorage.setItem;

  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, [key, value]);

    dispatchEvent(key, value);
  };
}

export function onStorageChange(
  key: string,
  listener: () => Promise<boolean> | boolean
) {
  let needRemoveListener = false;

  document.addEventListener(
    key,
    async () => {
      needRemoveListener = await listener();
    },
    false
  );

  const windowListener = async function (event: StorageEvent) {
    if (event.storageArea === localStorage && event.key === key) {
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
