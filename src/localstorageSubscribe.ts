type EventType = Event & {
    value?: string;
    key?: string;
}

export function onLocalStorageInit() {
    const originalSetItem = localStorage.setItem;

    localStorage.setItem = function (key, value) {
        var event: EventType = new Event(key);

        event.value = value;
        event.key = key;

        originalSetItem.apply(this, arguments);

        document.dispatchEvent(event);
    };
}


export function onStorageChange(key: string, listener: () => Promise<boolean> | boolean) {
    let needRemoveListener = false;

    document.addEventListener(key, async () => {
        needRemoveListener = await listener()
    }, false);


    const windowListener = async (event) => {
        if (event.storageArea === localStorage && event.key === key) {
            needRemoveListener = await listener();
        }
    }

    window.addEventListener(
        "storage",
        windowListener,
        false
    );

    // unsubscribe Listener
    if (needRemoveListener) {
        document.removeEventListener(key, listener);
        window.removeEventListener("storage", windowListener)
    }
}
