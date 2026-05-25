(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var listEl = document.getElementById("ol-list");
    var statusEl = document.getElementById("ol-status");
    var hintEl = document.getElementById("ol-hint");

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatWon(n) {
        var num = Number(n);
        if (!isFinite(num)) return "0원";
        return num.toLocaleString("ko-KR") + "원";
    }

    function formatDate(ts) {
        if (!ts) return "";
        return new Date(ts).toLocaleString("ko-KR");
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    var access =
        Auth && Auth.getOrderManageAccess
            ? Auth.getOrderManageAccess()
            : { allowed: false };
    if (!access.allowed) {
        setStatus(access.reason || "aksangsa 관리자 로그인이 필요합니다.", true);
        return;
    }

    if (hintEl) {
        hintEl.textContent =
            "aksangsa 담당으로 등록된 업체에서 접수된 주문 내역입니다.";
        hintEl.hidden = false;
    }

    setStatus("불러오는 중…");
    api.listOrders()
        .then(function (items) {
            if (!items.length) {
                listEl.innerHTML = '<p class="am-list-empty">접수된 주문이 없습니다.</p>';
                setStatus("0건");
                return;
            }
            listEl.innerHTML =
                '<ul class="ol-admin-list">' +
                items
                    .map(function (it) {
                        var pdfHref = api.orderPdfUrl(it.id);
                        return (
                            '<li class="ol-admin-item">' +
                            '<div class="ol-admin-main">' +
                            '<span class="ol-admin-name">' +
                            escapeHtml(it.orderNo || it.id) +
                            " · " +
                            escapeHtml(it.vendorCompany || it.vendorUserId || "") +
                            "</span>" +
                            '<span class="ol-admin-meta">' +
                            escapeHtml(formatDate(it.createdAt)) +
                            " · " +
                            escapeHtml(formatWon(it.totalAmount)) +
                            " · 품목 " +
                            escapeHtml(String(it.itemCount || 0)) +
                            "건" +
                            (it.vendorRegisteredByName
                                ? " · 담당 " + escapeHtml(it.vendorRegisteredByName)
                                : "") +
                            "</span></div>" +
                            '<div class="ol-admin-actions">' +
                            '<a class="btn btn-primary" href="' +
                            escapeHtml(pdfHref) +
                            '" target="_blank" rel="noopener">PDF</a>' +
                            "</div></li>"
                        );
                    })
                    .join("") +
                "</ul>";
            setStatus(items.length + "건");
        })
        .catch(function (err) {
            setStatus(err.message || "목록을 불러오지 못했습니다.", true);
        });
})();
