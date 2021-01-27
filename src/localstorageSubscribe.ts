export function onLocalStorageInit() {
    const originalSetItem = localStorage.setItem;

    localStorage.setItem = function (key, value) {
        console.log('key, value', key, value);
        var event = new Event(key);

        event.value = value;
        event.key = key;

        originalSetItem.apply(this, arguments);

        document.dispatchEvent(event);
    };
}


export function onStorageChange(key: string, listener: () => Promise<boolean> | boolean) {
    let needRemoveListener = false;

    document.addEventListener(key, async () => {
        console.log('document.addEventListener', key, listener)
        needRemoveListener = await listener()
    }, false);


    const windowListener = async (event) => {
        if (event.storageArea === localStorage && event.key === key) {
            console.log("event", event.oldValue, event.newValue);
            needRemoveListener = await listener();
            console.log('windowListener --end', needRemoveListener);
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
