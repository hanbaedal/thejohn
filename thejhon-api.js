/**
 * API 클라이언트 — Node 서버와 같은 출처(또는 baseUrl)에서 /api 호출
 */
(function (global) {
    var TOKEN_KEY = "thejhon_api_token";

    var config = {
        baseUrl: ""
    };

    if (typeof global.THEJHON_API_BASE_URL === "string" && global.THEJHON_API_BASE_URL) {
        config.baseUrl = global.THEJHON_API_BASE_URL;
    }

    function apiBase() {
        return String(config.baseUrl || "").replace(/\/$/, "");
    }

    function apiUrl(path) {
        var p = path.charAt(0) === "/" ? path : "/" + path;
        return apiBase() + p;
    }

    function getToken() {
        try {
            return sessionStorage.getItem(TOKEN_KEY) || "";
        } catch (e) {
            return "";
        }
    }

    function setToken(token) {
        try {
            if (token) sessionStorage.setItem(TOKEN_KEY, token);
            else sessionStorage.removeItem(TOKEN_KEY);
        } catch (e) {}
    }

    function headers() {
        var h = { Accept: "application/json", "Content-Type": "application/json" };
        var token = getToken();
        if (token) h.Authorization = "Bearer " + token;
        return h;
    }

    function parseJson(res) {
        return res.text().then(function (text) {
            if (!text) return {};
            try {
                return JSON.parse(text);
            } catch (e) {
                return { ok: false, error: text || "응답 형식 오류" };
            }
        });
    }

    function request(method, path, body) {
        var opts = { method: method, headers: headers() };
        if (body !== undefined && body !== null) {
            opts.body = JSON.stringify(body);
        }
        return fetch(apiUrl(path), opts).then(function (res) {
            return parseJson(res).then(function (data) {
                if (!res.ok) {
                    var msg = (data && data.error) || "요청에 실패했습니다.";
                    if (data && data.hint) msg += "\n\n" + data.hint;
                    var err = new Error(msg);
                    err.status = res.status;
                    err.data = data;
                    throw err;
                }
                return data;
            });
        });
    }

    global.THEJHON_API = {
        config: config,
        TOKEN_KEY: TOKEN_KEY,
        getToken: getToken,
        setToken: setToken,
        get: function (path) {
            return request("GET", path);
        },
        post: function (path, body) {
            return request("POST", path, body);
        },
        put: function (path, body) {
            return request("PUT", path, body);
        },
        del: function (path) {
            return request("DELETE", path);
        },
        listProducts: function () {
            return request("GET", "/api/products").then(function (d) {
                return d.items || [];
            });
        },
        getProduct: function (id) {
            return request("GET", "/api/products/" + encodeURIComponent(id)).then(function (d) {
                return d.item;
            });
        },
        checkProductName: function (name, excludeId, dept) {
            var q = "?name=" + encodeURIComponent(String(name || ""));
            if (excludeId) q += "&excludeId=" + encodeURIComponent(String(excludeId));
            if (dept) q += "&dept=" + encodeURIComponent(String(dept));
            return request("GET", "/api/products/check-name" + q);
        },
        createProduct: function (body) {
            return request("POST", "/api/products", body).then(function (d) {
                return d.item;
            });
        },
        updateProduct: function (id, body) {
            return request("PUT", "/api/products/" + encodeURIComponent(id), body).then(function (d) {
                return d.item;
            });
        },
        deleteProduct: function (id) {
            return request("DELETE", "/api/products/" + encodeURIComponent(id));
        },
        listVendors: function () {
            return request("GET", "/api/vendors").then(function (d) {
                return d.items || [];
            });
        },
        getVendor: function (id) {
            return request("GET", "/api/vendors/" + encodeURIComponent(id)).then(function (d) {
                return d.item;
            });
        },
        checkVendorLoginId: function (loginId, excludeId) {
            var q = "?loginId=" + encodeURIComponent(String(loginId || ""));
            if (excludeId) q += "&excludeId=" + encodeURIComponent(String(excludeId));
            return request("GET", "/api/vendors/check-login-id" + q);
        },
        createVendor: function (body) {
            return request("POST", "/api/vendors", body).then(function (d) {
                return d.item;
            });
        },
        updateVendor: function (id, body) {
            return request("PUT", "/api/vendors/" + encodeURIComponent(id), body).then(function (d) {
                return d.item;
            });
        },
        deleteVendor: function (id) {
            return request("DELETE", "/api/vendors/" + encodeURIComponent(id));
        },
        login: function (loginId, password) {
            return request("POST", "/api/auth/login", { loginId: loginId, password: password });
        },
        checkSession: function () {
            return request("GET", "/api/auth/session");
        }
    };
})(typeof window !== "undefined" ? window : this);
