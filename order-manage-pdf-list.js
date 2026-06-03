(function () {
    var cfg = window.OMPL_CONFIG || {};
    var mode = cfg.mode === "transaction" ? "transaction" : "order";
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var OrderUI = window.THEJHON_ORDER_UI;
    var prefix = cfg.idPrefix || "ompl";
    var statusEl = document.getElementById(prefix + "-status");
    var summaryEl = document.getElementById(prefix + "-summary");
    var listEl = document.getElementById(prefix + "-list");
    var dateFromEl = document.getElementById(prefix + "-date-from");
    var dateToEl = document.getElementById(prefix + "-date-to");
    var adminEl = document.getElementById(prefix + "-admin");
    var adminSection = document.getElementById(prefix + "-filter-admin");
    var searchBtn = document.getElementById(prefix + "-search");
    var listItems = [];

    function escapeHtml(s) {
        return OrderUI ? OrderUI.escapeHtml(s) : String(s);
    }
    function formatWon(n) {
        return OrderUI ? OrderUI.formatWon(n) : String(n);
    }
    function formatDate(ts) {
        return OrderUI ? OrderUI.formatDate(ts) : "";
    }
    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (isError ? " shub-status--err" : "");
    }

    function defaultDates() {
        var now = new Date();
        var to = now.toISOString().slice(0, 10);
        var fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 30);
        var from = fromD.toISOString().slice(0, 10);
        if (dateFromEl && !dateFromEl.value) dateFromEl.value = from;
        if (dateToEl && !dateToEl.value) dateToEl.value = to;
    }

    function loadAdminOptions() {
        if (!api || !api.listStaff || !adminEl) return Promise.resolve();
        return api.listStaff().then(function (items) {
            var opts = '<option value="">전체</option>';
            (items || [])
                .filter(function (it) {
                    return it && it.role === "admin" && it.active !== false;
                })
                .sort(function (a, b) {
                    return String(a.loginId || "").localeCompare(String(b.loginId || ""), "ko");
                })
                .forEach(function (it) {
                    var id = String(it.loginId || "").trim();
                    var label = (it.st_company || id) + " (" + id + ")";
                    opts += '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + "</option>";
                });
            adminEl.innerHTML = opts;
        });
    }

    function bindRowActions(li, id, row) {
        var viewBtn = li.querySelector("." + prefix + "-btn-view");
        if (viewBtn) {
            viewBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                viewBtn.disabled = true;
                var p =
                    mode === "transaction"
                        ? OrderUI.viewTransactionPdfWithAuth(api, id)
                        : OrderUI.viewOrderPdfWithAuth(api, id);
                p.catch(function (err) {
                    alert((err && err.message) || "PDF를 열지 못했습니다.");
                }).finally(function () {
                    viewBtn.disabled = false;
                });
            });
        }
        var saveBtn = li.querySelector("." + prefix + "-btn-save");
        if (saveBtn) {
            saveBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                saveBtn.disabled = true;
                var p =
                    mode === "transaction"
                        ? OrderUI.downloadTransactionPdfWithAuth(api, id, row)
                        : OrderUI.downloadOrderPdfWithAuth(api, id, row && row.orderNo, row);
                p.catch(function (err) {
                    alert((err && err.message) || "PDF 저장 실패");
                }).finally(function () {
                    saveBtn.disabled = false;
                });
            });
        }
        var printBtn = li.querySelector("." + prefix + "-btn-print");
        if (printBtn) {
            printBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                printBtn.disabled = true;
                OrderUI.printTransactionPdfWithAuth(api, id)
                    .catch(function (err) {
                        alert((err && err.message) || "인쇄 준비 실패");
                    })
                    .finally(function () {
                        printBtn.disabled = false;
                    });
            });
        }
    }

    function renderList(items) {
        listItems = items || [];
        if (!listEl) return;
        if (!listItems.length) {
            listEl.innerHTML = '<p class="am-list-empty">조회된 발주가 없습니다.</p>';
            return;
        }
        var actionsHtml =
            '<div class="ol-admin-actions">' +
            '<button type="button" class="btn btn-primary ' +
            prefix +
            '-btn-view">PDF 보기</button>' +
            '<button type="button" class="btn ' +
            prefix +
            '-btn-save">PDF 저장</button>';
        if (mode === "transaction") {
            actionsHtml +=
                '<button type="button" class="btn ' + prefix + '-btn-print">인쇄</button>';
        }
        actionsHtml += "</div>";

        listEl.innerHTML =
            '<ul class="ol-admin-list">' +
            listItems
                .map(function (it) {
                    return (
                        '<li class="ol-admin-item" data-order-id="' +
                        escapeHtml(it.id) +
                        '"><div class="ol-admin-main"><span class="ol-admin-name">' +
                        escapeHtml(it.orderNo || it.id) +
                        " · " +
                        escapeHtml(it.vendorCompany || "") +
                        '</span><span class="ol-admin-meta">' +
                        escapeHtml(formatDate(it.createdAt)) +
                        " · " +
                        escapeHtml(formatWon(it.totalAmount)) +
                        (it.vendorRegisteredByName
                            ? " · 담당 " + escapeHtml(it.vendorRegisteredByName)
                            : "") +
                        "</span></div>" +
                        actionsHtml +
                        "</li>"
                    );
                })
                .join("") +
            "</ul>";

        listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
            var id = li.getAttribute("data-order-id");
            var row = listItems.find(function (it) {
                return it.id === id;
            });
            bindRowActions(li, id, row);
        });
    }

    function loadData() {
        var dateFrom = String((dateFromEl && dateFromEl.value) || "").trim();
        var dateTo = String((dateToEl && dateToEl.value) || "").trim();
        var adminStaffId = adminEl ? String(adminEl.value || "").trim() : "";
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setStatus("시작일이 종료일보다 늦을 수 없습니다.", true);
            return;
        }
        setStatus("조회 중…");
        var opts = { dateFrom: dateFrom, dateTo: dateTo };
        if (adminStaffId) opts.adminStaffId = adminStaffId;

        var reqs = [api.listOrders(opts)];
        if (Auth.isSupervisorStaff && Auth.isSupervisorStaff()) {
            reqs.push(api.getSupervisorOrderStats(opts));
        }

        Promise.all(reqs)
            .then(function (results) {
                var items = results[0] || [];
                var stats = results[1] || null;
                if (summaryEl && stats && stats.summary) {
                    summaryEl.hidden = false;
                    summaryEl.innerHTML =
                        "<span><strong>건수</strong> " +
                        escapeHtml(String(stats.summary.count || items.length)) +
                        "건</span>" +
                        "<span><strong>총 금액</strong> " +
                        escapeHtml(formatWon(stats.summary.totalAmount || 0)) +
                        "</span>";
                } else if (summaryEl) {
                    summaryEl.hidden = false;
                    summaryEl.innerHTML =
                        "<span><strong>건수</strong> " + escapeHtml(String(items.length)) + "건</span>";
                }
                renderList(items);
                setStatus(items.length + "건 — PDF 보기로 확인하세요.");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "조회 실패", true);
            });
    }

    if (!Auth || !Auth.getOrderManageHubAccess) {
        setStatus("인증 오류", true);
        return;
    }
    Auth.normalizeLegacySession();
    var access = Auth.getOrderManageHubAccess();
    if (!access.allowed) {
        setStatus(access.reason || "이용할 수 없습니다.", true);
        return;
    }

    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (adminSection && Auth.isSupervisorStaff && !Auth.isSupervisorStaff()) {
        adminSection.hidden = true;
    }

    defaultDates();
    var boot = Promise.resolve();
    if (adminEl && adminSection && !adminSection.hidden) {
        boot = loadAdminOptions();
    }
    boot.then(loadData);
    if (searchBtn) searchBtn.addEventListener("click", loadData);
    if (dateFromEl) dateFromEl.addEventListener("change", loadData);
    if (dateToEl) dateToEl.addEventListener("change", loadData);
    if (adminEl) adminEl.addEventListener("change", loadData);
})();
