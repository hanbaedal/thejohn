(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("omh-status");

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    function applyLinks() {
        if (!Auth || !Auth.getOrderManageHubLinks) return;
        var links = Auth.getOrderManageHubLinks();
        var map = {
            list: document.getElementById("omh-link-list"),
            orderPdf: document.getElementById("omh-link-order-pdf"),
            transactionPdf: document.getElementById("omh-link-transaction-pdf")
        };
        if (map.list && links.list) map.list.setAttribute("href", links.list);
        if (map.orderPdf && links.orderPdf) map.orderPdf.setAttribute("href", links.orderPdf);
        if (map.transactionPdf && links.transactionPdf) {
            map.transactionPdf.setAttribute("href", links.transactionPdf);
            map.transactionPdf.hidden = false;
        } else if (map.transactionPdf) {
            map.transactionPdf.hidden = true;
        }
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

    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();
    applyLinks();

    document.querySelectorAll("[data-omh-link]").forEach(function (card) {
        card.addEventListener("click", function () {
            if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
        });
    });
})();
