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
  const documentListener = async function () {
    const needRemoveListener = await listener();
    if (needRemoveListener) {
      document.removeEventListener(key, documentListener);
    }
  };

  document.addEventListener(key, documentListener, false);

  const windowListener = async function (event: StorageEvent) {
    if (event.storageArea === localStorage && event.key === key) {
      const needRemoveListener = await listener();
      if (needRemoveListener) {
        window.removeEventListener("storage", windowListener);
      }
    }
  };

  window.addEventListener("storage", windowListener, false);
}
