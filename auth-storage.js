/**
 * 로그인 세션 저장 — 탭별 sessionStorage, PWA만 localStorage (head 최상단 로드)
 */
(function (global) {
    function isPwaStandalone() {
        try {
            if (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches) {
                return true;
            }
        } catch (e) {}
        try {
            if (global.navigator && global.navigator.standalone === true) return true;
        } catch (e2) {}
        return false;
    }

    function get(key) {
        try {
            var s = sessionStorage.getItem(key);
            if (s != null && s !== "") return s;
        } catch (e) {}
        if (isPwaStandalone()) {
            try {
                var v = localStorage.getItem(key);
                if (v != null && v !== "") return v;
            } catch (e2) {}
        }
        return "";
    }

    function set(key, value) {
        try {
            if (value == null || value === "") sessionStorage.removeItem(key);
            else sessionStorage.setItem(key, String(value));
        } catch (e) {}
        if (isPwaStandalone()) {
            try {
                if (value == null || value === "") localStorage.removeItem(key);
                else localStorage.setItem(key, String(value));
            } catch (e2) {}
        } else {
            try {
                localStorage.removeItem(key);
            } catch (e3) {}
        }
    }

    function remove(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {}
        try {
            localStorage.removeItem(key);
        } catch (e2) {}
    }

    function clearLocalKeys(keys) {
        var i;
        for (i = 0; i < keys.length; i++) {
            try {
                localStorage.removeItem(keys[i]);
            } catch (e) {}
        }
    }

    function hydrateSessionFromLocal(keys) {
        if (!isPwaStandalone()) return;
        var i;
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            try {
                if (!sessionStorage.getItem(key)) {
                    var v = localStorage.getItem(key);
                    if (v != null && v !== "") sessionStorage.setItem(key, v);
                }
            } catch (e) {}
        }
    }

    global.THEJHON_AUTH_STORAGE = {
        isPwaStandalone: isPwaStandalone,
        get: get,
        set: set,
        remove: remove,
        clearLocalKeys: clearLocalKeys,
        hydrateSessionFromLocal: hydrateSessionFromLocal
    };
})(typeof window !== "undefined" ? window : this);
