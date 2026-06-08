/**
 * API 클라이언트 — Node 서버와 같은 출처(또는 baseUrl)에서 /api 호출
 */
(function (global) {
    var TOKEN_KEY = "thejhon_api_token";
    var store = global.THEJHON_AUTH_STORAGE;

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
        return store ? store.get(TOKEN_KEY) : "";
    }

    function setToken(token) {
        if (store) store.set(TOKEN_KEY, token || "");
    }

    function hydrateTokenFromLocalIfPwa() {
        if (!store || !store.isPwaStandalone()) return;
        store.hydrateSessionFromLocal([TOKEN_KEY]);
    }

    if (store && !store.isPwaStandalone()) {
        store.clearLocalKeys([TOKEN_KEY]);
    }

    function headers() {
        var h = { Accept: "application/json", "Content-Type": "application/json" };
        var token = getToken();
        if (token) h.Authorization = "Bearer " + token;
        return h;
    }

    /** PDF blob — 브라우저 탭 미리보기용 MIME 보정 */
    function pdfBlobFromResponse(res) {
        return res.blob().then(function (b) {
            if (b && b.type === "application/pdf") return b;
            return new Blob([b], { type: "application/pdf" });
        });
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
                    if (
                        res.status === 401 &&
                        data &&
                        data.code === "SESSION_INVALID" &&
                        global.THEJHON_AUTH &&
                        THEJHON_AUTH.handleSessionInvalid
                    ) {
                        THEJHON_AUTH.handleSessionInvalid(data);
                    }
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
        hydrateTokenFromLocalIfPwa: hydrateTokenFromLocalIfPwa,
        get: function (path) {
            return request("GET", path);
        },
        post: function (path, body) {
            return request("POST", path, body);
        },
        put: function (path, body) {
            return request("PUT", path, body);
        },
        del: function (path, body) {
            return request("DELETE", path, body);
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
            if (opts.fullExplain) {
                parts.push("fullExplain=1");
            }
            if (opts.includeCover) {
                parts.push("includeCover=1");
            }
            var q = parts.length ? "?" + parts.join("&") : "";
            return request("GET", "/api/products" + q).then(function (d) {
                return d.items || [];
            });
        },
        getProductCovers: function (ids) {
            var list = (ids || []).filter(Boolean);
            if (!list.length) return Promise.resolve({});
            var q = "?ids=" + encodeURIComponent(list.join(","));
            return request("GET", "/api/products/covers" + q).then(function (d) {
                return (d && d.covers) || {};
            });
        },
        /** 목록 카드 — JPEG 썸네일 URL(img src 병렬 로드) */
        productThumbUrl: function (id) {
            var pid = String(id || "").trim();
            if (!pid) return "";
            var url = apiUrl("/api/products/" + encodeURIComponent(pid) + "/thumb.jpg");
            var token = getToken();
            if (token) {
                url += (url.indexOf("?") >= 0 ? "&" : "?") + "access=" + encodeURIComponent(token);
            }
            return url;
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
        checkProductCode: function (code, excludeId, dept) {
            var q = "?code=" + encodeURIComponent(String(code || ""));
            if (excludeId) q += "&excludeId=" + encodeURIComponent(String(excludeId));
            if (dept) q += "&dept=" + encodeURIComponent(String(dept));
            return request("GET", "/api/products/check-code" + q);
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
        getProductInfo: function (productId) {
            return request("GET", "/api/products/" + encodeURIComponent(productId) + "/info");
        },
        saveProductInfo: function (productId, values) {
            return request("PUT", "/api/products/" + encodeURIComponent(productId) + "/info", values || {}).then(
                function (d) {
                    return d.item;
                }
            );
        },
        deleteProductInfo: function (productId) {
            return request("DELETE", "/api/products/" + encodeURIComponent(productId) + "/info");
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
        checkStaffLoginId: function (loginId, excludeId) {
            var q = "?loginId=" + encodeURIComponent(String(loginId || ""));
            if (excludeId) q += "&excludeId=" + encodeURIComponent(String(excludeId));
            return request("GET", "/api/staff/check-login-id" + q);
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
        listVendorProspects: function (q) {
            var query = q ? "?q=" + encodeURIComponent(String(q)) : "";
            return request("GET", "/api/vendor-prospects" + query).then(function (d) {
                return d.items || [];
            });
        },
        deleteVendorProspect: function (id) {
            return request("DELETE", "/api/vendor-prospects/" + encodeURIComponent(id));
        },
        searchFuneralHalls: function (keyword, mode) {
            var q = "?q=" + encodeURIComponent(String(keyword || ""));
            if (mode) q += "&mode=" + encodeURIComponent(String(mode));
            return request("GET", "/api/vendor-prospects/search-funeral-halls" + q).then(function (d) {
                return d.items || [];
            });
        },
        importVendorProspects: function (rows) {
            return request("POST", "/api/vendor-prospects/import", { rows: rows || [] });
        },
        sendVendorBroadcastEmail: function (payload) {
            return request("POST", "/api/vendor-email/broadcast", payload || {});
        },
        sendVendorBroadcastTestEmail: function (payload) {
            return request("POST", "/api/vendor-email/broadcast-test", payload || {});
        },
        listVendorEmailHistory: function (limit, fromDateText, toDateText) {
            var qs = [];
            if (limit) qs.push("limit=" + encodeURIComponent(String(limit)));
            if (fromDateText) qs.push("dateFrom=" + encodeURIComponent(String(fromDateText)));
            if (toDateText) qs.push("dateTo=" + encodeURIComponent(String(toDateText)));
            var q = qs.length ? "?" + qs.join("&") : "";
            return request("GET", "/api/vendor-email/history" + q).then(function (d) {
                return d.items || [];
            });
        },
        enrichVendorProspectsPreview: function (rows, options) {
            options = options || {};
            return request("POST", "/api/vendor-prospects/enrich-preview", {
                rows: rows || [],
                useExternal: !!options.useExternal
            }).then(function (d) {
                return {
                    items: d.items || [],
                    enriched: d.enriched || 0,
                    diffs: d.diffs || [],
                    externalEnabled: !!d.externalEnabled,
                    naverConfigured: !!d.naverConfigured
                };
            });
        },
        listVendorNew: function (q) {
            var query = q ? "?q=" + encodeURIComponent(String(q)) : "";
            return request("GET", "/api/vendor-new" + query).then(function (d) {
                return d.items || [];
            });
        },
        getVendorNew: function (id) {
            return request("GET", "/api/vendor-new/" + encodeURIComponent(id)).then(function (d) {
                return d.item;
            });
        },
        checkVendorNewLoginId: function (loginId, excludeId) {
            var q = "?loginId=" + encodeURIComponent(String(loginId || ""));
            if (excludeId) q += "&excludeId=" + encodeURIComponent(String(excludeId));
            return request("GET", "/api/vendor-new/check-login-id" + q);
        },
        createVendorNew: function (body) {
            return request("POST", "/api/vendor-new", body).then(function (d) {
                return d.item;
            });
        },
        updateVendorNew: function (id, body) {
            return request("PUT", "/api/vendor-new/" + encodeURIComponent(id), body).then(function (d) {
                return d.item;
            });
        },
        deleteVendorNew: function (id) {
            return request("DELETE", "/api/vendor-new/" + encodeURIComponent(id));
        },
        promoteVendorNewToVendor: function (id, body) {
            return request(
                "POST",
                "/api/vendor-new/" + encodeURIComponent(id) + "/promote-to-vendor",
                body
            ).then(function (d) {
                return d.item;
            });
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
        logoutAsync: function (tokenOverride) {
            var opts = {
                method: "POST",
                headers: { Accept: "application/json", "Content-Type": "application/json" }
            };
            var token =
                tokenOverride != null && String(tokenOverride).trim()
                    ? String(tokenOverride).trim()
                    : getToken();
            if (token) opts.headers.Authorization = "Bearer " + token;
            return fetch(apiUrl("/api/auth/logout"), opts).then(function (res) {
                return parseJson(res).then(function (data) {
                    if (!res.ok || (data && data.ok === false)) {
                        var msg = (data && data.error) || "로그아웃에 실패했습니다.";
                        var err = new Error(msg);
                        err.status = res.status;
                        err.data = data;
                        throw err;
                    }
                    return data;
                });
            });
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
        updateStaffProfile: function (body) {
            return request("PUT", "/api/auth/staff-profile", body).then(function (d) {
                return d;
            });
        },
        checkStaffLoginIdSelf: function (loginId, excludeId) {
            var q = "?loginId=" + encodeURIComponent(String(loginId || ""));
            if (excludeId) q += "&excludeId=" + encodeURIComponent(String(excludeId));
            return request("GET", "/api/auth/check-staff-login-id" + q);
        },
        getPublicFooterStaff: function () {
            return request("GET", "/api/auth/public-footer-staff").then(function (d) {
                return d.item;
            });
        },
        submitOrder: function (body) {
            return request("POST", "/api/orders", body);
        },
        listOrders: function (opts) {
            opts = opts || {};
            var qs = [];
            if (opts.dateFrom) qs.push("dateFrom=" + encodeURIComponent(String(opts.dateFrom)));
            if (opts.dateTo) qs.push("dateTo=" + encodeURIComponent(String(opts.dateTo)));
            if (opts.vendorName) qs.push("vendorName=" + encodeURIComponent(String(opts.vendorName)));
            if (opts.adminStaffId) qs.push("adminStaffId=" + encodeURIComponent(String(opts.adminStaffId)));
            var q = qs.length ? "?" + qs.join("&") : "";
            return request("GET", "/api/orders" + q).then(function (d) {
                return d.items || [];
            });
        },
        getSupervisorOrderStats: function (opts) {
            opts = opts || {};
            var qs = [];
            if (opts.dateFrom) qs.push("dateFrom=" + encodeURIComponent(String(opts.dateFrom)));
            if (opts.dateTo) qs.push("dateTo=" + encodeURIComponent(String(opts.dateTo)));
            if (opts.adminStaffId) qs.push("adminStaffId=" + encodeURIComponent(String(opts.adminStaffId)));
            var q = qs.length ? "?" + qs.join("&") : "";
            return request("GET", "/api/supervisor/order-stats" + q);
        },
        getSupervisorAccessStats: function (opts) {
            opts = opts || {};
            var qs = [];
            if (opts.dateFrom) qs.push("dateFrom=" + encodeURIComponent(String(opts.dateFrom)));
            if (opts.dateTo) qs.push("dateTo=" + encodeURIComponent(String(opts.dateTo)));
            var q = qs.length ? "?" + qs.join("&") : "";
            return request("GET", "/api/supervisor/access-stats" + q);
        },
        getSupervisorUsageStats: function (opts) {
            opts = opts || {};
            var qs = [];
            if (opts.dateFrom) qs.push("dateFrom=" + encodeURIComponent(String(opts.dateFrom)));
            if (opts.dateTo) qs.push("dateTo=" + encodeURIComponent(String(opts.dateTo)));
            var q = qs.length ? "?" + qs.join("&") : "";
            return request("GET", "/api/supervisor/usage-stats" + q);
        },
        getSupervisorDbStats: function (opts) {
            opts = opts || {};
            var qs = [];
            if (opts.dateFrom) qs.push("dateFrom=" + encodeURIComponent(String(opts.dateFrom)));
            if (opts.dateTo) qs.push("dateTo=" + encodeURIComponent(String(opts.dateTo)));
            var q = qs.length ? "?" + qs.join("&") : "";
            return request("GET", "/api/supervisor/db-stats" + q);
        },
        getSupervisorSolapiStats: function (opts) {
            opts = opts || {};
            var qs = [];
            if (opts.dateFrom) qs.push("dateFrom=" + encodeURIComponent(String(opts.dateFrom)));
            if (opts.dateTo) qs.push("dateTo=" + encodeURIComponent(String(opts.dateTo)));
            var q = qs.length ? "?" + qs.join("&") : "";
            return request("GET", "/api/supervisor/solapi-stats" + q);
        },
        trackPageView: function (page) {
            var body = { page: page };
            var Auth = global.THEJHON_AUTH;
            if (Auth && Auth.getRole && Auth.getRole() === "guest" && Auth.getGuestId) {
                var gid = Auth.getGuestId();
                if (gid) body.guestId = gid;
            }
            return request("POST", "/api/access/page-view", body);
        },
        logGuestLogin: function (guestId) {
            return request("POST", "/api/access/guest-login", { guestId: guestId });
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
        fetchOrderPdfBlob: function (orderId, opts) {
            opts = opts || {};
            var url = apiUrl("/api/orders/" + encodeURIComponent(orderId) + "/pdf");
            if (opts.download) {
                url += (url.indexOf("?") >= 0 ? "&" : "?") + "download=1";
            }
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
                return pdfBlobFromResponse(res);
            });
        },
        fetchTransactionPdfBlob: function (orderId, opts) {
            opts = opts || {};
            var url = apiUrl("/api/orders/" + encodeURIComponent(orderId) + "/transaction-pdf");
            if (opts.download) {
                url += (url.indexOf("?") >= 0 ? "&" : "?") + "download=1";
            }
            return fetch(url, { method: "GET", headers: headers() }).then(function (res) {
                if (!res.ok) {
                    return res.text().then(function (text) {
                        var msg = "거래명세서 PDF를 불러오지 못했습니다.";
                        try {
                            var data = JSON.parse(text);
                            if (data && data.error) msg = data.error;
                        } catch (e) {}
                        throw new Error(msg);
                    });
                }
                return pdfBlobFromResponse(res);
            });
        },
        listTransactionManual: function (opts) {
            var q = "";
            if (opts && opts.issuerStaffId) {
                q = "?issuerStaffId=" + encodeURIComponent(String(opts.issuerStaffId));
            }
            return request("GET", "/api/transaction-manual" + q).then(function (d) {
                return d.items || [];
            });
        },
        getTransactionManual: function (id) {
            return request("GET", "/api/transaction-manual/" + encodeURIComponent(id)).then(function (d) {
                return d.item;
            });
        },
        createTransactionManual: function (body) {
            return request("POST", "/api/transaction-manual", body).then(function (d) {
                return d.item;
            });
        },
        updateTransactionManual: function (id, body) {
            return request("PUT", "/api/transaction-manual/" + encodeURIComponent(id), body).then(function (d) {
                return d.item;
            });
        },
        deleteTransactionManual: function (id) {
            return request("DELETE", "/api/transaction-manual/" + encodeURIComponent(id));
        },
        fetchTransactionManualPreviewPdf: function (body) {
            var url = apiUrl("/api/transaction-manual/pdf");
            return fetch(url, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify(body || {})
            }).then(function (res) {
                if (!res.ok) {
                    return res.text().then(function (text) {
                        var msg = "거래명세서 PDF를 만들지 못했습니다.";
                        try {
                            var data = JSON.parse(text);
                            if (data && data.error) msg = data.error;
                        } catch (e) {}
                        throw new Error(msg);
                    });
                }
                return pdfBlobFromResponse(res);
            });
        },
        fetchTransactionManualPdf: function (id, opts) {
            opts = opts || {};
            var url = apiUrl("/api/transaction-manual/" + encodeURIComponent(id) + "/pdf");
            if (opts.download) {
                url += (url.indexOf("?") >= 0 ? "&" : "?") + "download=1";
            }
            return fetch(url, { method: "GET", headers: headers() }).then(function (res) {
                if (!res.ok) {
                    return res.text().then(function (text) {
                        var msg = "거래명세서 PDF를 불러오지 못했습니다.";
                        try {
                            var data = JSON.parse(text);
                            if (data && data.error) msg = data.error;
                        } catch (e) {}
                        throw new Error(msg);
                    });
                }
                return pdfBlobFromResponse(res);
            });
        },
        listSupportNews: function (opts) {
            var q = "";
            if (opts && opts.dept) {
                q = "?dept=" + encodeURIComponent(String(opts.dept));
            }
            return request("GET", "/api/support-news" + q).then(function (d) {
                return d.items || [];
            });
        },
        getSupportNews: function (id) {
            return request("GET", "/api/support-news/" + encodeURIComponent(id)).then(function (d) {
                return d.item;
            });
        },
        createSupportNews: function (body) {
            return request("POST", "/api/support-news", body).then(function (d) {
                return d.item;
            });
        },
        updateSupportNews: function (id, body) {
            return request("PUT", "/api/support-news/" + encodeURIComponent(id), body).then(function (d) {
                return d.item;
            });
        },
        deleteSupportNews: function (id) {
            return request("DELETE", "/api/support-news/" + encodeURIComponent(id));
        },
        listSupportNewsComments: function (newsId) {
            return request("GET", "/api/support-news/" + encodeURIComponent(newsId) + "/comments").then(
                function (d) {
                    return d.items || [];
                }
            );
        },
        createSupportNewsComment: function (newsId, body) {
            return request("POST", "/api/support-news/" + encodeURIComponent(newsId) + "/comments", body).then(
                function (d) {
                    return d.item;
                }
            );
        },
        deleteSupportNewsComment: function (newsId, commentId) {
            return request(
                "DELETE",
                "/api/support-news/" + encodeURIComponent(newsId) + "/comments/" + encodeURIComponent(commentId)
            );
        },
        listSupportBoard: function () {
            return request("GET", "/api/support-board").then(function (d) {
                return d.items || [];
            });
        },
        createSupportBoard: function (body) {
            return request("POST", "/api/support-board", body).then(function (d) {
                return d.item;
            });
        },
        deleteSupportBoard: function (id, body) {
            return request("DELETE", "/api/support-board/" + encodeURIComponent(id), body || {});
        },
        updateSupportBoard: function (id, body) {
            return request("PUT", "/api/support-board/" + encodeURIComponent(id), body || {}).then(function (d) {
                return d.item;
            });
        },
        listSupportInquiry: function (opts) {
            var q = "";
            if (opts && opts.unlocked && opts.unlocked.length) {
                q = "?unlocked=" + encodeURIComponent(opts.unlocked.join(","));
            }
            return request("GET", "/api/support-inquiry" + q).then(function (d) {
                return d.items || [];
            });
        },
        getSupportInquiry: function (id, opts) {
            var q = "";
            if (opts && opts.unlocked && opts.unlocked.length) {
                q = "?unlocked=" + encodeURIComponent(opts.unlocked.join(","));
            }
            return request("GET", "/api/support-inquiry/" + encodeURIComponent(id) + q).then(function (d) {
                return d.item;
            });
        },
        unlockSupportInquiry: function (id, password) {
            return request("POST", "/api/support-inquiry/" + encodeURIComponent(id) + "/unlock", {
                password: password
            }).then(function (d) {
                return d.item;
            });
        },
        createSupportInquiry: function (body) {
            return request("POST", "/api/support-inquiry", body).then(function (d) {
                return d.item;
            });
        },
        saveSupportInquiryReply: function (id, body) {
            return request("PUT", "/api/support-inquiry/" + encodeURIComponent(id) + "/reply", body).then(
                function (d) {
                    return d.item;
                }
            );
        },
        deleteSupportInquiry: function (id, body) {
            return request("DELETE", "/api/support-inquiry/" + encodeURIComponent(id), body || {});
        }
    };
})(typeof window !== "undefined" ? window : this);
