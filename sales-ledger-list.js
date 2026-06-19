/**
 * 매출장 목록
 */
(function () {
    var api = window.THEJHON_API;
    var OU = window.THEJHON_ORDER_UI;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("sll-status");
    var filterWrap = document.getElementById("sll-filter-wrap");
    var adminFilter = document.getElementById("sll-admin-filter");
    var listBody = document.getElementById("sll-list-body");
    var emptyEl = document.getElementById("sll-empty");
    var isSupervisor = false;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatWon(n) {
        if (OU && OU.formatWon) return OU.formatWon(n);
        var num = Number(n);
        if (!isFinite(num)) return "0원";
        return num.toLocaleString("ko-KR") + "원";
    }

    function formatDateYmd(ms) {
        var d = new Date(ms || Date.now());
        return (
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0")
        );
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    function listOpts() {
        if (!isSupervisor || !adminFilter) return {};
        var v = String(adminFilter.value || "").trim();
        return v ? { issuerStaffId: v } : {};
    }

    function renderRows(items) {
        if (!listBody) return;
        if (!items.length) {
            listBody.innerHTML = "";
            if (emptyEl) emptyEl.hidden = false;
            return;
        }
        if (emptyEl) emptyEl.hidden = true;
        listBody.innerHTML = items
            .map(function (it) {
                var cnt = Array.isArray(it.items) ? it.items.length : 0;
                return (
                    "<tr>" +
                    "<td>" +
                    escapeHtml(formatDateYmd(it.issueDate)) +
                    "</td>" +
                    "<td>" +
                    escapeHtml(it.vendorCompany || "") +
                    "</td>" +
                    "<td>" +
                    escapeHtml(it.note || "") +
                    "</td>" +
                    "<td>" +
                    escapeHtml(it.issuerStaffName || it.issuerStaffLoginId || "") +
                    "</td>" +
                    "<td>" +
                    cnt +
                    "</td>" +
                    "<td>" +
                    escapeHtml(formatWon(it.totalAmount)) +
                    "</td>" +
                    '<td class="tml-col-act">' +
                    '<a class="btn btn-secondary btn-sm" href="sales-ledger-register.html?id=' +
                    encodeURIComponent(it.id) +
                    '">수정</a> ' +
                    '<button type="button" class="btn btn-secondary btn-sm" data-del="' +
                    escapeHtml(it.id) +
                    '">삭제</button>' +
                    "</td></tr>"
                );
            })
            .join("");

        listBody.querySelectorAll("[data-del]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-del");
                if (!id || !window.confirm("이 매출장을 삭제할까요?")) return;
                api.deleteSalesLedger(id)
                    .then(function () {
                        setStatus("삭제했습니다.", "ok");
                        loadList();
                    })
                    .catch(function (err) {
                        setStatus((err && err.message) || "삭제에 실패했습니다.", "err");
                    });
            });
        });
    }

    function loadList() {
        if (!api || !api.listSalesLedgers) return;
        setStatus("불러오는 중…");
        api
            .listSalesLedgers(listOpts())
            .then(function (items) {
                renderRows(items || []);
                setStatus((items || []).length ? "" : "매출장이 없습니다.");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "목록을 불러오지 못했습니다.", "err");
            });
    }

    function init() {
        if (!Auth || !Auth.getOrderManageHubAccess || !Auth.getOrderManageHubAccess().allowed) {
            setStatus("로그인·권한을 확인해 주세요.", "err");
            return;
        }
        isSupervisor = Auth.isSupervisorStaff && Auth.isSupervisorStaff();
        if (isSupervisor && filterWrap && adminFilter && api.listStaff) {
            filterWrap.hidden = false;
            api.listStaff()
                .then(function (rows) {
                    (rows || [])
                        .filter(function (st) {
                            return st.role === "admin";
                        })
                        .forEach(function (st) {
                            var opt = document.createElement("option");
                            opt.value = st.loginId || "";
                            opt.textContent = st.st_company || st.loginId || "";
                            adminFilter.appendChild(opt);
                        });
                })
                .catch(function () {});
        }
        var searchBtn = document.getElementById("sll-btn-search");
        if (searchBtn) searchBtn.addEventListener("click", loadList);
        loadList();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
