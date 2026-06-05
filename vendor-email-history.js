(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("veh-status");
    var fromEl = document.getElementById("veh-date-from");
    var toEl = document.getElementById("veh-date-to");
    var listEl = document.getElementById("veh-list");
    var refreshBtn = document.getElementById("veh-refresh-btn");

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function ts(v) {
        var n = Number(v || 0);
        if (!n) return "-";
        return new Date(n).toLocaleString("ko-KR");
    }

    function sourceText(it) {
        if (Array.isArray(it.sources) && it.sources.length) {
            var parts = [];
            if (it.sources.indexOf("vendors") >= 0) parts.push("등록업체");
            if (it.sources.indexOf("vendor_new") >= 0) parts.push("신규업체");
            if (parts.length) return parts.join(" · ");
        }
        if (it.source === "vendor_new") return "신규업체";
        if (it.source === "vendors") return "등록업체";
        if (it.source === "mixed") return "등록업체 · 신규업체";
        if (it.includeVendors && it.includeVendorNew) return "등록업체 · 신규업체";
        if (it.includeVendorNew) return "신규업체";
        if (it.includeVendors) return "등록업체";
        return "";
    }

    function renderHistory(items) {
        if (!listEl) return;
        var list = Array.isArray(items) ? items : [];
        if (!list.length) {
            listEl.innerHTML = "<li>발송 이력이 없습니다.</li>";
            return;
        }
        listEl.innerHTML = list
            .map(function (it) {
                var src = sourceText(it);
                return (
                    "<li><strong>" +
                    escapeHtml(it.subject || "(제목 없음)") +
                    "</strong><br>" +
                    (src ? "대상: " + escapeHtml(src) + " · " : "") +
                    "발송시각: " +
                    ts(it.createdAt) +
                    " · 성공 " +
                    String(it.sentCount || 0) +
                    "통 · 실패 " +
                    String(it.failedCount || 0) +
                    "통</li>"
                );
            })
            .join("");
    }

    function loadHistory() {
        if (!api || !api.listVendorEmailHistory) return;
        var fromText = String((fromEl && fromEl.value) || "").trim();
        var toText = String((toEl && toEl.value) || "").trim();
        if (fromText && toText && fromText > toText) {
            return setStatus("기간 선택이 올바르지 않습니다. (시작일 ≤ 종료일)", true);
        }
        setStatus("이력 불러오는 중…");
        api.listVendorEmailHistory(50, fromText, toText)
            .then(function (items) {
                renderHistory(items);
                setStatus(items && items.length ? "총 " + items.length + "건" : "", false);
            })
            .catch(function (e) {
                if (listEl) listEl.innerHTML = "<li>이력을 불러오지 못했습니다.</li>";
                setStatus((e && e.message) || "이력 조회에 실패했습니다.", true);
            });
    }

    var access = Auth && Auth.getRegisterAccess ? Auth.getRegisterAccess() : { allowed: false };
    if (!access.allowed) {
        setStatus(access.reason || "관리자 로그인이 필요합니다.", true);
        return;
    }

    loadHistory();
    if (refreshBtn) refreshBtn.addEventListener("click", loadHistory);
    if (fromEl) fromEl.addEventListener("change", loadHistory);
    if (toEl) toEl.addEventListener("change", loadHistory);
})();
