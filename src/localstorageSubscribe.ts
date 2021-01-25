
function localStorageSubscribe() {
    const originalSetItem = localStorage.setItem;

    localStorage.setItem = function (key, value) {
        var event = new Event(key);

        event.value = value; // Optional..
        event.key = key; // Optional..

        document.dispatchEvent(event);

        originalSetItem.apply(this, arguments);
    };
}


function _onStorageChange(key, listener) {
    document.addEventListener(key, listener, false);
    window.addEventListener(
        "storage",
        function (event) {
            if (event.storageArea === localStorage && event.key === key) {
                console.log("event", event.oldValue, event.newValue);
                listener();
            }
        },
        false
    );
}


var localStorageSetHandler = function (e) {
    console.log('localStorage.set("' + e.key + '", "' + e.value + '") was called');
};

localStorage.setItem('foo', 'bar'); // Pops an alert
