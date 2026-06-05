(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("sas-status");
    var summaryEl = document.getElementById("sas-summary");
    var byDayEl = document.getElementById("sas-by-day");
    var itemsEl = document.getElementById("sas-items");
    var dateFromEl = document.getElementById("sas-date-from");
    var dateToEl = document.getElementById("sas-date-to");

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

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
    function catLabel(c) {
        if (c === "staff") return "관리자";
        if (c === "vendor") return "업체";
        return "게스트";
    }
    function catClass(c) {
        return "shub-cat--" + (c || "guest");
    }
    function setStatus(msg, err) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (err ? " shub-status--err" : "");
    }
    function defaultDates() {
        var now = new Date();
        var to = now.toISOString().slice(0, 10);
        var fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 7);
        if (dateFromEl && !dateFromEl.value) dateFromEl.value = fromD.toISOString().slice(0, 10);
        if (dateToEl && !dateToEl.value) dateToEl.value = to;
    }

    function load() {
        var dateFrom = String((dateFromEl && dateFromEl.value) || "").trim();
        var dateTo = String((dateToEl && dateToEl.value) || "").trim();
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setStatus("시작일이 종료일보다 늦을 수 없습니다.", true);
            return;
        }
        setStatus("조회 중…");
        api.getSupervisorAccessStats({ dateFrom: dateFrom, dateTo: dateTo })
            .then(function (data) {
                var sum = data.summary || {};
                if (summaryEl) {
                    summaryEl.hidden = false;
                    summaryEl.innerHTML =
                        '<span class="' +
                        catClass("staff") +
                        '"><strong>관리자</strong> ' +
                        escapeHtml(String(sum.staff || 0)) +
                        "건</span>" +
                        '<span class="' +
                        catClass("vendor") +
                        '"><strong>업체</strong> ' +
                        escapeHtml(String(sum.vendor || 0)) +
                        "건</span>" +
                        '<span class="' +
                        catClass("guest") +
                        '"><strong>게스트</strong> ' +
                        escapeHtml(String(sum.guest || 0)) +
                        "건</span>";
                }
                var byDay = data.byDay || [];
                if (!byDay.length) {
                    byDayEl.innerHTML = '<p class="am-list-empty">해당 기간 기록이 없습니다.</p>';
                } else {
                    byDayEl.innerHTML =
                        '<table class="shub-table"><thead><tr><th>날짜</th><th>관리자</th><th>업체</th><th>게스트</th></tr></thead><tbody>' +
                        byDay
                            .map(function (row) {
                                return (
                                    "<tr><td>" +
                                    escapeHtml(row.date) +
                                    "</td><td>" +
                                    escapeHtml(String(row.staff || 0)) +
                                    "</td><td>" +
                                    escapeHtml(String(row.vendor || 0)) +
                                    "</td><td>" +
                                    escapeHtml(String(row.guest || 0)) +
                                    "</td></tr>"
                                );
                            })
                            .join("") +
                        "</tbody></table>";
                }
                var items = data.items || [];
                if (!items.length) {
                    itemsEl.innerHTML = '<p class="am-list-empty">상세 기록이 없습니다.</p>';
                } else {
                    itemsEl.innerHTML =
                        '<table class="shub-table"><thead><tr><th>날짜</th><th>시간</th><th>구분</th><th>내용</th><th>페이지</th></tr></thead><tbody>' +
                        items
                            .map(function (it) {
                                var label =
                                    it.label ||
                                    it.userId ||
                                    (it.kind === "guest_login"
                                        ? "게스트 로그인"
                                        : it.kind === "page_view"
                                          ? "페이지 방문"
                                          : "");
                                return (
                                    "<tr><td>" +
                                    escapeHtml(it.date) +
                                    "</td><td>" +
                                    escapeHtml(it.time) +
                                    '</td><td class="' +
                                    catClass(it.category) +
                                    '">' +
                                    escapeHtml(catLabel(it.category)) +
                                    "</td><td>" +
                                    escapeHtml(label) +
                                    "</td><td>" +
                                    escapeHtml(it.page || "—") +
                                    "</td></tr>"
                                );
                            })
                            .join("") +
                        "</tbody></table>";
                }
                setStatus(items.length + "건");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "조회 실패", true);
            });
    }

    if (!Auth || !Auth.getStaffManageAccess || !Auth.getStaffManageAccess().allowed) {
        setStatus("슈퍼바이저만 이용할 수 있습니다.", true);
        return;
    }
    Auth.normalizeLegacySession();
    defaultDates();
    bindDatePickerOpen(dateFromEl);
    bindDatePickerOpen(dateToEl);
    document.getElementById("sas-search").addEventListener("click", load);
    if (dateFromEl) dateFromEl.addEventListener("change", load);
    if (dateToEl) dateToEl.addEventListener("change", load);
    load();
})();
