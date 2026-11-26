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

export function setStorageItem(key: string, value: string) {
  window.localStorage.setItem(key, value);
  dispatchEvent(key, value);
}

export function getStorageItem(key: string) {
  return window.localStorage.getItem(key);
}

export function removeStorageItem(key: string) {
  return window.localStorage.removeItem(key);
}

// 同一页面和其他页面的写入走不同的事件，取消订阅时必须同时移除两种监听。
export function onStorageChange(
  key: string,
  listener: (value: string | null) => void
) {
  const documentListener = (event: Event) => {
    listener((event as EventType).value ?? null);
  };
  const windowListener = (event: StorageEvent) => {
    if (event.storageArea === localStorage && event.key === key) {
      listener(event.newValue);
    }
  };

  document.addEventListener(key, documentListener, false);
  window.addEventListener("storage", windowListener, false);
  return () => {
    document.removeEventListener(key, documentListener);
    window.removeEventListener("storage", windowListener);
  };
}
