/**
 * 매출 집계 — 공통 유틸
 */
(function (global) {
    var OU = global.THEJHON_ORDER_UI;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatWon(n) {
        if (OU && OU.formatWon) return OU.formatWon(n);
        var num = Number(n);
        if (!isFinite(num)) return "0원";
        return num.toLocaleString("ko-KR") + "원";
    }

    function formatYmd(ts) {
        var d = new Date(ts || Date.now());
        return (
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0")
        );
    }

    function setStatus(el, msg, kind) {
        if (!el) return;
        el.textContent = msg || "";
        el.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    function readDateInput(el) {
        return el && el.value ? String(el.value).trim() : "";
    }

    function defaultDateRange(fromEl, toEl) {
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, "0");
        var first = y + "-" + m + "-01";
        var last = y + "-" + m + "-" + String(now.getDate()).padStart(2, "0");
        if (fromEl && !fromEl.value) fromEl.value = first;
        if (toEl && !toEl.value) toEl.value = last;
    }

    function renderResultsTable(tbody, items) {
        if (!tbody) return;
        if (!items || !items.length) {
            tbody.innerHTML = '<tr><td colspan="8">조회 결과가 없습니다.</td></tr>';
            return;
        }
        var html = "";
        var totalAmount = 0;
        items.forEach(function (row) {
            totalAmount += Number(row.lineTotal) || 0;
            html +=
                "<tr>" +
                "<td>" +
                escapeHtml(formatYmd(row.issueDate)) +
                "</td>" +
                "<td>" +
                escapeHtml(row.sourceLabel || row.source || "") +
                "</td>" +
                "<td>" +
                escapeHtml(row.orderNo || "—") +
                "</td>" +
                "<td>" +
                escapeHtml(row.vendorCompany || "") +
                "</td>" +
                "<td>" +
                escapeHtml(row.productName || "") +
                "</td>" +
                "<td class=\"num\">" +
                escapeHtml(String(row.quantity || 0)) +
                "</td>" +
                "<td class=\"num\">" +
                escapeHtml(formatWon(row.unitPrice).replace("원", "")) +
                "</td>" +
                "<td class=\"num\">" +
                escapeHtml(formatWon(row.lineTotal).replace("원", "")) +
                "</td>" +
                "</tr>";
        });
        html +=
            '<tr class="srp-total-row">' +
            '<td colspan="7"><strong>합계</strong></td>' +
            '<td class="num"><strong>' +
            escapeHtml(formatWon(totalAmount).replace("원", "")) +
            "</strong></td>" +
            "</tr>";
        tbody.innerHTML = html;
    }

    function renderSummary(el, summary) {
        if (!el || !summary) return;
        el.textContent =
            "건수 " +
            (summary.count || 0) +
            " · 수량 " +
            (summary.totalQuantity || 0).toLocaleString("ko-KR") +
            " · 합계 " +
            formatWon(summary.totalAmount);
        el.hidden = false;
    }

    function openModal(backdrop) {
        if (backdrop) backdrop.hidden = false;
    }

    function closeModal(backdrop) {
        if (backdrop) backdrop.hidden = true;
    }

    function wireModalClose(backdrop, closeBtn) {
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {
                closeModal(backdrop);
            });
        }
        if (backdrop) {
            backdrop.addEventListener("click", function (e) {
                if (e.target === backdrop) closeModal(backdrop);
            });
        }
    }

    function printResults() {
        window.print();
    }

    function downloadPdfBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename || "매출집계.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 2000);
    }

    global.THEJHON_SALES_REPORT = {
        escapeHtml: escapeHtml,
        formatWon: formatWon,
        formatYmd: formatYmd,
        setStatus: setStatus,
        readDateInput: readDateInput,
        defaultDateRange: defaultDateRange,
        renderResultsTable: renderResultsTable,
        renderSummary: renderSummary,
        openModal: openModal,
        closeModal: closeModal,
        wireModalClose: wireModalClose,
        printResults: printResults,
        downloadPdfBlob: downloadPdfBlob
    };
})(typeof window !== "undefined" ? window : global);
