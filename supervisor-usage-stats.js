(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("sus-status");
    var summaryEl = document.getElementById("sus-summary");
    var truncatedEl = document.getElementById("sus-truncated");
    var staffEl = document.getElementById("sus-staff");
    var vendorsByAdminEl = document.getElementById("sus-vendors-by-admin");
    var vendorsEl = document.getElementById("sus-vendors");
    var guestsEl = document.getElementById("sus-guests");
    var recentEl = document.getElementById("sus-recent");
    var dateFromEl = document.getElementById("sus-date-from");
    var dateToEl = document.getElementById("sus-date-to");

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
            d.toLocaleDateString("ko-KR") +
            " " +
            d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        );
    }

    function roleLabel(role) {
        if (role === "supervisor") return "슈퍼바이저";
        if (role === "admin") return "관리자";
        return role || "—";
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
        fromD.setDate(fromD.getDate() - 30);
        if (dateFromEl && !dateFromEl.value) dateFromEl.value = fromD.toISOString().slice(0, 10);
        if (dateToEl && !dateToEl.value) dateToEl.value = to;
    }

    function renderSummary(sum) {
        if (!summaryEl) return;
        sum = sum || {};
        summaryEl.hidden = false;
        summaryEl.innerHTML =
            '<span class="shub-cat--staff"><strong>관리자</strong> 로그인 ' +
            escapeHtml(String(sum.staffLogins || 0)) +
            " · 방문 " +
            escapeHtml(String(sum.staffPageViews || 0)) +
            " · " +
            escapeHtml(formatDuration(sum.staffDurationMs)) +
            "</span>" +
            '<span class="shub-cat--vendor"><strong>업체</strong> 로그인 ' +
            escapeHtml(String(sum.vendorLogins || 0)) +
            " · 방문 " +
            escapeHtml(String(sum.vendorPageViews || 0)) +
            " · " +
            escapeHtml(formatDuration(sum.vendorDurationMs)) +
            "</span>" +
            '<span class="shub-cat--guest"><strong>게스트</strong> 로그인 ' +
            escapeHtml(String(sum.guestLogins || 0)) +
            " · 방문 " +
            escapeHtml(String(sum.guestPageViews || 0)) +
            " · " +
            escapeHtml(formatDuration(sum.guestDurationMs)) +
            "</span>";
    }

    function usageCells(row) {
        return (
            "<td>" +
            escapeHtml(row.label || row.userId) +
            "</td><td>" +
            escapeHtml(row.userId || "") +
            "</td><td>" +
            escapeHtml(String(row.loginCount || 0)) +
            "</td><td>" +
            escapeHtml(String(row.pageViews || 0)) +
            "</td><td>" +
            escapeHtml(String(row.sessionCount || 0)) +
            "</td><td>" +
            escapeHtml(formatDuration(row.totalDurationMs)) +
            "</td><td>" +
            escapeHtml(formatDuration(row.avgSessionMs)) +
            "</td><td>" +
            escapeHtml(formatDateTime(row.lastLoginAt)) +
            "</td>"
        );
    }

    function renderStaff(rows) {
        if (!staffEl) return;
        if (!rows.length) {
            staffEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        staffEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>구분</th><th>이름</th><th>아이디</th><th>로그인</th><th>페이지 방문</th>" +
            "<th>세션</th><th>총 머무른 시간</th><th>평균 세션</th><th>마지막 로그인</th>" +
            "</tr></thead><tbody>" +
            rows
                .map(function (r) {
                    return (
                        "<tr><td>" +
                        escapeHtml(roleLabel(r.role)) +
                        "</td>" +
                        usageCells(r) +
                        "</tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function renderVendors(rows) {
        if (!vendorsEl) return;
        if (!rows.length) {
            vendorsEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        vendorsEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>담당 관리자</th><th>이름</th><th>아이디</th><th>로그인</th><th>페이지 방문</th>" +
            "<th>세션</th><th>총 머무른 시간</th><th>평균 세션</th><th>마지막 로그인</th>" +
            "</tr></thead><tbody>" +
            rows
                .map(function (r) {
                    return (
                        "<tr><td>" +
                        escapeHtml(r.adminName || r.vendorRegisteredBy || "—") +
                        "</td>" +
                        usageCells(r) +
                        "</tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function renderVendorsByAdmin(groups) {
        if (!vendorsByAdminEl) return;
        if (!groups.length) {
            vendorsByAdminEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        vendorsByAdminEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>담당 관리자</th><th>업체 수</th><th>로그인</th><th>페이지 방문</th><th>총 머무른 시간</th>" +
            "</tr></thead><tbody>" +
            groups
                .map(function (g) {
                    return (
                        "<tr><td>" +
                        escapeHtml(g.adminName || g.adminLoginId) +
                        "</td><td>" +
                        escapeHtml(String(g.vendorCount || 0)) +
                        "</td><td>" +
                        escapeHtml(String(g.loginCount || 0)) +
                        "</td><td>" +
                        escapeHtml(String(g.pageViews || 0)) +
                        "</td><td>" +
                        escapeHtml(formatDuration(g.totalDurationMs)) +
                        "</td></tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function renderGuests(rows) {
        if (!guestsEl) return;
        if (!rows.length) {
            guestsEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        guestsEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>이름</th><th>아이디</th><th>로그인</th><th>페이지 방문</th>" +
            "<th>세션</th><th>총 머무른 시간</th><th>평균 세션</th><th>마지막 로그인</th>" +
            "</tr></thead><tbody>" +
            rows
                .map(function (r) {
                    return "<tr>" + usageCells(r) + "</tr>";
                })
                .join("") +
            "</tbody></table>";
    }

    function kindLabel(kind) {
        if (kind === "staff_login") return "관리자 로그인";
        if (kind === "vendor_login") return "업체 로그인";
        if (kind === "guest_login") return "게스트 로그인";
        if (kind === "session_end") return "세션 종료";
        if (kind === "page_view") return "페이지 방문";
        return kind || "—";
    }

    function renderRecent(rows) {
        if (!recentEl) return;
        if (!rows.length) {
            recentEl.innerHTML = '<p class="am-list-empty">기록이 없습니다.</p>';
            return;
        }
        recentEl.innerHTML =
            '<table class="shub-table"><thead><tr>' +
            "<th>날짜</th><th>시간</th><th>구분</th><th>내용</th><th>페이지</th>" +
            "</tr></thead><tbody>" +
            rows
                .map(function (it) {
                    return (
                        "<tr><td>" +
                        escapeHtml(it.date) +
                        "</td><td>" +
                        escapeHtml(it.time) +
                        "</td><td>" +
                        escapeHtml(kindLabel(it.kind)) +
                        "</td><td>" +
                        escapeHtml(it.label || it.userId || "—") +
                        "</td><td>" +
                        escapeHtml(it.page || "—") +
                        "</td></tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function load() {
        var dateFrom = String((dateFromEl && dateFromEl.value) || "").trim();
        var dateTo = String((dateToEl && dateToEl.value) || "").trim();
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setStatus("시작일이 종료일보다 늦을 수 없습니다.", true);
            return;
        }
        setStatus("조회 중…");
        api.getSupervisorUsageStats({ dateFrom: dateFrom, dateTo: dateTo })
            .then(function (data) {
                renderSummary(data.summary);
                if (truncatedEl) truncatedEl.hidden = !data.truncated;
                renderStaff(data.staff || []);
                renderVendorsByAdmin(data.vendorsByAdmin || []);
                renderVendors(data.vendors || []);
                renderGuests(data.guests || []);
                renderRecent(data.recent || []);
                var total =
                    (data.staff || []).length +
                    (data.vendors || []).length +
                    (data.guests || []).length;
                setStatus("이용자 " + total + "명 집계 완료", false);
            })
            .catch(function (err) {
                setStatus((err && err.message) || "조회 실패", true);
            });
    }

    if (!Auth || !Auth.isSupervisorStaff || !Auth.isSupervisorStaff()) {
        setStatus("슈퍼바이저만 이용할 수 있습니다.", true);
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();
    defaultDates();
    bindDatePickerOpen(dateFromEl);
    bindDatePickerOpen(dateToEl);
    document.getElementById("sus-search").addEventListener("click", load);
    if (dateFromEl) dateFromEl.addEventListener("change", load);
    if (dateToEl) dateToEl.addEventListener("change", load);
    load();
})();
