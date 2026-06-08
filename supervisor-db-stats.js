(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("sds-status");
    var totalsEl = document.getElementById("sds-totals");
    var truncatedEl = document.getElementById("sds-truncated");
    var byAdminEl = document.getElementById("sds-by-admin");
    var dateFromEl = document.getElementById("sds-date-from");
    var dateToEl = document.getElementById("sds-date-to");

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function kstYmd(d) {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d || new Date());
    }

    function formatBytes(n) {
        var num = Math.max(0, Number(n) || 0);
        if (!num) return "0 B";
        if (num < 1024) return num + " B";
        if (num < 1024 * 1024) return (num / 1024).toFixed(1) + " KB";
        if (num < 1024 * 1024 * 1024) return (num / (1024 * 1024)).toFixed(2) + " MB";
        return (num / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    }

    function formatDuration(ms) {
        var n = Math.max(0, Number(ms) || 0);
        if (!n) return "0분";
        var min = Math.round(n / 60000);
        if (min < 60) return min + "분";
        var h = Math.floor(min / 60);
        var rm = min % 60;
        return h + "시간 " + rm + "분";
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

    function load() {
        var opts = {};
        if (dateFromEl && dateFromEl.value) opts.dateFrom = dateFromEl.value;
        if (dateToEl && dateToEl.value) opts.dateTo = dateToEl.value;
        setStatus("불러오는 중…");
        api.getSupervisorDbStats(opts)
            .then(function (data) {
                var t = data.totals || {};
                var period = data.period || {};
                if (totalsEl) {
                    totalsEl.hidden = false;
                    totalsEl.innerHTML =
                        "<span><strong>DB 용량</strong> " +
                        escapeHtml(formatBytes(t.storageBytes)) +
                        "</span>" +
                        "<span><strong>이용시간</strong> " +
                        escapeHtml(formatDuration(t.usageDurationMs)) +
                        (period.dateFrom && period.dateTo
                            ? " <small>(" +
                              escapeHtml(period.dateFrom) +
                              "~" +
                              escapeHtml(period.dateTo) +
                              ")</small>"
                            : "") +
                        "</span>" +
                        "<span><strong>상품</strong> " +
                        escapeHtml(String(t.products || 0)) +
                        "</span>" +
                        "<span><strong>업체</strong> " +
                        escapeHtml(String(t.vendors || 0)) +
                        "</span>" +
                        "<span><strong>신규업체</strong> " +
                        escapeHtml(String(t.vendorNew || 0)) +
                        "</span>" +
                        "<span><strong>예비업체</strong> " +
                        escapeHtml(String(t.vendorProspects || 0)) +
                        "</span>" +
                        "<span><strong>발주</strong> " +
                        escapeHtml(String(t.orders || 0)) +
                        "</span>" +
                        "<span><strong>스태프</strong> " +
                        escapeHtml(String(t.staff || 0)) +
                        "</span>";
                }
                if (truncatedEl) truncatedEl.hidden = !data.usageTruncated;
                var rows = data.byAdmin || [];
                if (!rows.length) {
                    byAdminEl.innerHTML = '<p class="am-list-empty">집계 데이터가 없습니다.</p>';
                } else {
                    byAdminEl.innerHTML =
                        '<table class="shub-table"><thead><tr>' +
                        "<th>담당</th><th>아이디</th><th>DB용량</th><th>이용시간</th><th>마지막접속</th>" +
                        "<th>상품</th><th>업체</th><th>신규</th><th>예비</th><th>발주</th><th>합계</th>" +
                        "</tr></thead><tbody>" +
                        rows
                            .map(function (r) {
                                return (
                                    "<tr><td>" +
                                    escapeHtml(r.name || r.loginId) +
                                    "</td><td>" +
                                    escapeHtml(r.loginId) +
                                    "</td><td>" +
                                    escapeHtml(formatBytes(r.storageBytes)) +
                                    "</td><td>" +
                                    escapeHtml(formatDuration(r.usageDurationMs)) +
                                    "</td><td>" +
                                    escapeHtml(formatDateTime(r.lastActiveAt)) +
                                    "</td><td>" +
                                    escapeHtml(String(r.products || 0)) +
                                    "</td><td>" +
                                    escapeHtml(String(r.vendors || 0)) +
                                    "</td><td>" +
                                    escapeHtml(String(r.vendorNew || 0)) +
                                    "</td><td>" +
                                    escapeHtml(String(r.vendorProspects || 0)) +
                                    "</td><td>" +
                                    escapeHtml(String(r.orders || 0)) +
                                    "</td><td><strong>" +
                                    escapeHtml(String(r.total || 0)) +
                                    "</strong></td></tr>"
                                );
                            })
                            .join("") +
                        "</tbody></table>";
                }
                setStatus(rows.length + "명 담당 집계");
            })
            .catch(function (err) {
                var msg = (err && err.message) || "조회 실패";
                if (err && err.data && err.data.detail) {
                    msg += " — " + err.data.detail;
                }
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
    var searchBtn = document.getElementById("sds-search");
    if (searchBtn) searchBtn.addEventListener("click", load);
    if (dateFromEl) dateFromEl.addEventListener("change", load);
    if (dateToEl) dateToEl.addEventListener("change", load);
    load();
})();
