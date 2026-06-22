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
        var list = document.getElementById("omh-link-list");
        var transaction = document.getElementById("omh-link-transaction");
        var sales = document.getElementById("omh-link-sales-inquiry");
        var tax = document.getElementById("omh-link-tax-invoice");
        if (list && links.list) list.setAttribute("href", links.list);
        if (transaction) {
            var txHref =
                links.transactionList ||
                links.transactionManualList ||
                links.transactionManual ||
                "";
            if (txHref) {
                transaction.setAttribute("href", txHref);
                transaction.hidden = false;
            } else {
                transaction.hidden = true;
            }
        }
        if (sales) {
            if (links.salesLedgerInquiry) {
                sales.setAttribute("href", links.salesLedgerInquiry);
                sales.hidden = false;
            } else {
                sales.hidden = true;
            }
        }
        if (tax && links.taxInvoice) {
            tax.setAttribute("href", links.taxInvoice);
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
