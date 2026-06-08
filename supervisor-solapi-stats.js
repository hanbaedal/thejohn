(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("sls-status");
    var configNoteEl = document.getElementById("sls-config-note");
    var summaryEl = document.getElementById("sls-summary");
    var truncatedEl = document.getElementById("sls-truncated");
    var byAdminEl = document.getElementById("sls-by-admin");
    var vendorsEl = document.getElementById("sls-vendors");
    var recentEl = document.getElementById("sls-recent");
    var dateFromEl = document.getElementById("sls-date-from");
    var dateToEl = document.getElementById("sls-date-to");

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function kstYmd(d) {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d || new Date());
    }

    function formatDateTime(ts) {
        if (!ts) return "—";
        var d = new Date(ts);
        return (
            d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) +
            " " +
            d.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Seoul"
            })
        );
    }

    function setStatus(msg, err) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (err ? " shub-status--err" : "");
    }

    function bindDatePickerOpen(el) {
        if (!el) return;
        function openPicker() {
            try {
                if (typeof el.showPicker === "function") el.showPicker();
            } catch (e) {}
        }
        el.addEventListener("click", openPicker);
        el.addEventListener("focus", openPicker);
    }

    function defaultDates() {
        var now = new Date();
        var to = kstYmd(now);
        var fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 30);
        if (dateFromEl && !dateFromEl.value) dateFromEl.value = kstYmd(fromD);
        if (dateToEl && !dateToEl.value) dateToEl.value = to;
    }

    function resultLabel(row) {
        if (row.skipped) return "건너뜀";
        if (row.ok) return "성공";
        return "실패";
    }

    function renderSummary(sum) {
        if (!summaryEl) return;
        sum = sum || {};
        summaryEl.hidden = false;
        summaryEl.innerHTML =
            "<span><strong>발송 시도</strong> " +
            escapeHtml(String(sum.attempts || 0)) +
            "</span>" +
            "<span><strong>성공</strong> " +
            escapeHtml(String(sum.success || 0)) +
            "</span>" +
            "<span><strong>실패</strong> " +
            escapeHtml(String(sum.failed || 0)) +
            "</span>" +
            "<span><strong>건너뜀</strong> " +
            escapeHtml(String(sum.skipped || 0)) +
            "</span>";
    }

    function renderByAdmin(rows) {
        if (!byAdminEl) return;
        if (!rows.length) {
            byAdminEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        byAdminEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>담당</th><th>아이디</th><th>등록 업체 수</th><th>발송 시도</th><th>성공</th><th>실패</th><th>건너뜀</th>" +
            "</tr></thead><tbody>" +
            rows
                .map(function (r) {
                    return (
                        "<tr><td>" +
                        escapeHtml(r.name || r.loginId) +
                        "</td><td>" +
                        escapeHtml(r.loginId) +
                        "</td><td>" +
                        escapeHtml(String(r.vendorCount || 0)) +
                        "</td><td><strong>" +
                        escapeHtml(String(r.attempts || 0)) +
                        "</strong></td><td>" +
                        escapeHtml(String(r.success || 0)) +
                        "</td><td>" +
                        escapeHtml(String(r.failed || 0)) +
                        "</td><td>" +
                        escapeHtml(String(r.skipped || 0)) +
                        "</td></tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function renderVendors(groups) {
        if (!vendorsEl) return;
        var flat = [];
        (groups || []).forEach(function (g) {
            (g.vendors || []).forEach(function (v) {
                flat.push({
                    adminName: g.name || g.loginId,
                    adminLoginId: g.loginId,
                    vendorUserId: v.vendorUserId,
                    vendorCompany: v.vendorCompany,
                    attempts: v.attempts,
                    success: v.success,
                    failed: v.failed,
                    skipped: v.skipped,
                    lastAt: v.lastAt
                });
            });
        });
        flat.sort(function (a, b) {
            var ak = (a.adminName || "") + (a.vendorCompany || a.vendorUserId || "");
            var bk = (b.adminName || "") + (b.vendorCompany || b.vendorUserId || "");
            if ((b.attempts || 0) !== (a.attempts || 0)) return (b.attempts || 0) - (a.attempts || 0);
            return ak.localeCompare(bk, "ko");
        });
        if (!flat.length) {
            vendorsEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        vendorsEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>담당 관리자</th><th>업체명</th><th>업체 아이디</th><th>발송 시도</th><th>성공</th><th>실패</th><th>건너뜀</th><th>마지막 발송</th>" +
            "</tr></thead><tbody>" +
            flat
                .map(function (r) {
                    return (
                        "<tr><td>" +
                        escapeHtml(r.adminName || r.adminLoginId) +
                        "</td><td>" +
                        escapeHtml(r.vendorCompany || "—") +
                        "</td><td>" +
                        escapeHtml(r.vendorUserId || "—") +
                        "</td><td><strong>" +
                        escapeHtml(String(r.attempts || 0)) +
                        "</strong></td><td>" +
                        escapeHtml(String(r.success || 0)) +
                        "</td><td>" +
                        escapeHtml(String(r.failed || 0)) +
                        "</td><td>" +
                        escapeHtml(String(r.skipped || 0)) +
                        "</td><td>" +
                        escapeHtml(formatDateTime(r.lastAt)) +
                        "</td></tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function renderRecent(rows) {
        if (!recentEl) return;
        if (!rows.length) {
            recentEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        recentEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>일시</th><th>담당 관리자</th><th>업체명</th><th>업체 아이디</th><th>주문번호</th><th>결과</th><th>비고</th>" +
            "</tr></thead><tbody>" +
            rows
                .map(function (r) {
                    return (
                        "<tr><td>" +
                        escapeHtml(formatDateTime(r.at)) +
                        "</td><td>" +
                        escapeHtml(r.adminName || r.adminLoginId || "—") +
                        "</td><td>" +
                        escapeHtml(r.vendorCompany || "—") +
                        "</td><td>" +
                        escapeHtml(r.vendorUserId || "—") +
                        "</td><td>" +
                        escapeHtml(r.orderNo || "—") +
                        "</td><td>" +
                        escapeHtml(resultLabel(r)) +
                        "</td><td>" +
                        escapeHtml(r.error || "") +
                        "</td></tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function load() {
        var opts = {};
        if (dateFromEl && dateFromEl.value) opts.dateFrom = dateFromEl.value;
        if (dateToEl && dateToEl.value) opts.dateTo = dateToEl.value;
        setStatus("불러오는 중…");
        api.getSupervisorSolapiStats(opts)
            .then(function (data) {
                if (configNoteEl) configNoteEl.hidden = !!data.configured;
                renderSummary(data.summary);
                if (truncatedEl) truncatedEl.hidden = !data.truncated;
                renderByAdmin(data.byAdmin || []);
                renderVendors(data.byAdmin || []);
                renderRecent(data.recent || []);
                var adminCount = (data.byAdmin || []).length;
                setStatus(adminCount ? adminCount + "명 담당 집계" : "선택 기간에 기록이 없습니다.");
            })
            .catch(function (err) {
                var msg = (err && err.message) || "조회 실패";
                if (err && err.data && err.data.error) msg = err.data.error;
                setStatus(msg, true);
            });
    }

    if (!Auth || !Auth.getStaffManageAccess || !Auth.getStaffManageAccess().allowed) {
        setStatus("슈퍼바이저만 이용할 수 있습니다.", true);
        return;
    }
    Auth.normalizeLegacySession();
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("work");
    defaultDates();
    bindDatePickerOpen(dateFromEl);
    bindDatePickerOpen(dateToEl);
    var searchBtn = document.getElementById("sls-search");
    if (searchBtn) searchBtn.addEventListener("click", load);
    if (dateFromEl) dateFromEl.addEventListener("change", load);
    if (dateToEl) dateToEl.addEventListener("change", load);
    load();
})();
