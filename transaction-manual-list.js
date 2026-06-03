/**
 * 수기 거래명세서 목록 — 주문서 관리
 */
(function () {
    var api = window.THEJHON_API;
    var OU = window.THEJHON_ORDER_UI;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("tml-status");
    var filterWrap = document.getElementById("tml-filter-wrap");
    var adminFilter = document.getElementById("tml-admin-filter");
    var listBody = document.getElementById("tml-list-body");
    var emptyEl = document.getElementById("tml-empty");
    var isSupervisor = false;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, "&#39;");
    }

    function formatWon(n) {
        if (OU && OU.formatWon) return OU.formatWon(n);
        var num = Number(n);
        if (!isFinite(num)) return "0원";
        return num.toLocaleString("ko-KR") + "원";
    }

    function formatDateYmd(ms) {
        var d = new Date(ms || Date.now());
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" + (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    function listOpts() {
        if (!isSupervisor || !adminFilter) return {};
        var id = String(adminFilter.value || "").trim();
        if (!id) return {};
        return { issuerStaffId: id };
    }

    function loadAdminOptions() {
        if (!api || !api.listStaff || !adminFilter) return Promise.resolve();
        return api.listStaff().then(function (items) {
            var html = '<option value="">전체 관리자</option>';
            (items || []).forEach(function (st) {
                if (!st || st.role !== "admin") return;
                var id = String(st.loginId || "").trim();
                if (!id) return;
                var label = (st.st_company || id) + " (" + id + ")";
                html +=
                    '<option value="' +
                    escapeAttr(id) +
                    '">' +
                    escapeHtml(label) +
                    "</option>";
            });
            adminFilter.innerHTML = html;
        });
    }

    function bindRowActions() {
        if (!listBody) return;
        listBody.querySelectorAll("[data-tml-edit]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var id = btn.getAttribute("data-id");
                if (!id) return;
                window.location.href =
                    "transaction-manual-register.html?id=" + encodeURIComponent(id);
            });
        });
        listBody.querySelectorAll("[data-tml-pdf]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var id = btn.getAttribute("data-id");
                if (!id || !api.fetchTransactionManualPdf) return;
                btn.disabled = true;
                setStatus("PDF 생성 중…");
                api
                    .fetchTransactionManualPdf(id)
                    .then(function (blob) {
                        var row = (cachedItems || []).find(function (it) {
                            return it.id === id;
                        });
                        var company = (row && row.vendorCompany) || "거래명세서";
                        var date = formatDateYmd(row && row.issueDate).replace(/-/g, "");
                        var name =
                            "거래명세서_" +
                            company.replace(/[<>:"/\\|?*]/g, "_") +
                            "_" +
                            date +
                            ".pdf";
                        if (OU && OU.openPdfBlobInModal) {
                            return OU.openPdfBlobInModal(blob, name).then(function () {
                                setStatus("PDF를 열었습니다.", "ok");
                            });
                        }
                        setStatus("PDF를 열었습니다.", "ok");
                    })
                    .catch(function (err) {
                        setStatus((err && err.message) || "PDF 실패", "err");
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        });
    }

    var cachedItems = [];

    function renderList(items) {
        cachedItems = items || [];
        if (!listBody) return;
        if (!cachedItems.length) {
            listBody.innerHTML = "";
            if (emptyEl) emptyEl.hidden = false;
            setStatus("0건");
            return;
        }
        if (emptyEl) emptyEl.hidden = true;
        listBody.innerHTML = cachedItems
            .map(function (it) {
                var itemCount = Array.isArray(it.items) ? it.items.length : 0;
                var title = it.title || it.vendorCompany || "";
                var issuer = it.issuerStaffName || it.issuerStaffLoginId || "";
                return (
                    "<tr>" +
                    "<td>" +
                    escapeHtml(formatDateYmd(it.issueDate)) +
                    "</td>" +
                    "<td>" +
                    escapeHtml(it.vendorCompany || "") +
                    "</td>" +
                    "<td>" +
                    escapeHtml(title) +
                    "</td>" +
                    "<td>" +
                    escapeHtml(issuer) +
                    "</td>" +
                    "<td>" +
                    escapeHtml(String(itemCount)) +
                    "건</td>" +
                    "<td>" +
                    escapeHtml(formatWon(it.totalAmount)) +
                    "</td>" +
                    '<td class="tml-col-act"><div class="tml-actions">' +
                    '<button type="button" class="btn btn-secondary" data-tml-edit data-id="' +
                    escapeAttr(it.id) +
                    '">수정</button>' +
                    '<button type="button" class="btn btn-primary" data-tml-pdf data-id="' +
                    escapeAttr(it.id) +
                    '">PDF 보기</button>' +
                    "</div></td>" +
                    "</tr>"
                );
            })
            .join("");
        bindRowActions();
        setStatus(cachedItems.length + "건");
    }

    function loadList() {
        if (!api || !api.listTransactionManual) {
            setStatus("API 오류", "err");
            return;
        }
        setStatus("불러오는 중…");
        api
            .listTransactionManual(listOpts())
            .then(renderList)
            .catch(function (e) {
                renderList([]);
                setStatus((e && e.message) || "목록을 불러오지 못했습니다.", "err");
            });
    }

    if (!Auth || !Auth.getOrderManageHubAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();
    var access = Auth.getOrderManageHubAccess();
    if (!access.allowed) {
        setStatus(access.reason || "이용할 수 없습니다.", "err");
        return;
    }

    isSupervisor = !!(Auth.isSupervisorStaff && Auth.isSupervisorStaff());
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    if (filterWrap) filterWrap.hidden = !isSupervisor;

    var init = isSupervisor ? loadAdminOptions() : Promise.resolve();
    init.then(loadList);

    document.getElementById("tml-btn-search")?.addEventListener("click", loadList);
    if (adminFilter) {
        adminFilter.addEventListener("change", loadList);
    }
})();
