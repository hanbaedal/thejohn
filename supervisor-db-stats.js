(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("sds-status");
    var totalsEl = document.getElementById("sds-totals");
    var byAdminEl = document.getElementById("sds-by-admin");

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
    function setStatus(msg, err) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (err ? " shub-status--err" : "");
    }

    function load() {
        setStatus("불러오는 중…");
        api.getSupervisorDbStats()
            .then(function (data) {
                var t = data.totals || {};
                if (totalsEl) {
                    totalsEl.hidden = false;
                    totalsEl.innerHTML =
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
                var rows = data.byAdmin || [];
                if (!rows.length) {
                    byAdminEl.innerHTML = '<p class="am-list-empty">집계 데이터가 없습니다.</p>';
                } else {
                    byAdminEl.innerHTML =
                        '<table class="shub-table"><thead><tr><th>담당</th><th>아이디</th><th>상품</th><th>업체</th><th>신규</th><th>예비</th><th>발주</th><th>합계</th></tr></thead><tbody>' +
                        rows
                            .map(function (r) {
                                return (
                                    "<tr><td>" +
                                    escapeHtml(r.name || r.loginId) +
                                    "</td><td>" +
                                    escapeHtml(r.loginId) +
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
                setStatus((err && err.message) || "조회 실패", true);
            });
    }

    if (!Auth || !Auth.getStaffManageAccess || !Auth.getStaffManageAccess().allowed) {
        setStatus("슈퍼바이저만 이용할 수 있습니다.", true);
        return;
    }
    Auth.normalizeLegacySession();
    load();
})();
