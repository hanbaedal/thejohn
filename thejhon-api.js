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
            if (/^\s*</.test(text) || /<!DOCTYPE/i.test(text)) {
                return {
                    ok: false,
                    error: "API가 HTML을 반환했습니다. 서버 배포·주소를 확인해 주세요."
                };
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                return { ok: false, error: "JSON 응답 형식 오류" };
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
                if (!res.ok || (data && data.ok === false)) {
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
        listProducts: function (opts) {
            var parts = [];
            opts = opts || {};
            if (opts.registeredBy) {
                parts.push("registeredBy=" + encodeURIComponent(String(opts.registeredBy)));
            }
            if (opts.dept) {
                parts.push("dept=" + encodeURIComponent(String(opts.dept)));
            }
            var q = parts.length ? "?" + parts.join("&") : "";
            return request("GET", "/api/products" + q).then(function (d) {
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
        listVendors: function (opts) {
            var q = "";
            if (opts && opts.registeredBy) {
                q = "?registeredBy=" + encodeURIComponent(String(opts.registeredBy));
            }
            return request("GET", "/api/vendors" + q).then(function (d) {
                return d.items || [];
            });
        },
        listStaff: function () {
            return request("GET", "/api/staff").then(function (d) {
                return d.items || [];
            });
        },
        getStaff: function (id) {
            return request("GET", "/api/staff/" + encodeURIComponent(id)).then(function (d) {
                return d.staff || d.item || null;
            });
        },
        createStaff: function (body) {
            return request("POST", "/api/staff", body).then(function (d) {
                return d.staff;
            });
        },
        updateStaff: function (id, body) {
            return request("PUT", "/api/staff/" + encodeURIComponent(id), body).then(function (d) {
                return d.staff;
            });
        },
        deleteStaff: function (id) {
            return request("DELETE", "/api/staff/" + encodeURIComponent(id)).then(function (d) {
                return d;
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
        },
        getVendorProfile: function () {
            return request("GET", "/api/auth/vendor-profile").then(function (d) {
                return d.item;
            });
        },
        getStaffProfile: function () {
            return request("GET", "/api/auth/staff-profile").then(function (d) {
                return d.item;
            });
        },
        getPublicFooterStaff: function () {
            return request("GET", "/api/auth/public-footer-staff").then(function (d) {
                return d.item;
            });
        },
        submitOrder: function (body) {
            return request("POST", "/api/orders", body);
        },
        listOrders: function () {
            return request("GET", "/api/orders").then(function (d) {
                return d.items || [];
            });
        },
        getOrder: function (orderId) {
            return request("GET", "/api/orders/" + encodeURIComponent(orderId)).then(function (d) {
                return d.order;
            });
        },
        deleteOrder: function (orderId) {
            return request("DELETE", "/api/orders/" + encodeURIComponent(orderId)).then(function (d) {
                return d;
            });
        },
        orderPdfUrl: function (orderId) {
            return apiUrl("/api/orders/" + encodeURIComponent(orderId) + "/pdf");
        },
        fetchOrderPdfBlob: function (orderId) {
            var url = apiUrl("/api/orders/" + encodeURIComponent(orderId) + "/pdf");
            return fetch(url, { method: "GET", headers: headers() }).then(function (res) {
                if (!res.ok) {
                    return res.text().then(function (text) {
                        var msg = "PDF를 불러오지 못했습니다.";
                        try {
                            var data = JSON.parse(text);
                            if (data && data.error) msg = data.error;
                        } catch (e) {}
                        throw new Error(msg);
                    });
                }
                return res.blob();
            });
        }
    };
})(typeof window !== "undefined" ? window : this);
