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

    function groupItemsByDateClient(items) {
        var map = {};
        (items || []).forEach(function (row) {
            var ymd = formatYmd(row.issueDate);
            if (!map[ymd]) {
                map[ymd] = { issueDate: ymd, items: [], totalQuantity: 0, totalAmount: 0 };
            }
            map[ymd].items.push(row);
            map[ymd].totalQuantity += Number(row.quantity) || 0;
            map[ymd].totalAmount += Number(row.lineTotal) || 0;
        });
        return Object.keys(map)
            .sort(function (a, b) {
                return b.localeCompare(a);
            })
            .map(function (k) {
                return map[k];
            });
    }

    function renderLedgerLinesTable(tbody, itemsOrGroups) {
        if (!tbody) return;
        var dayGroups = itemsOrGroups;
        if (itemsOrGroups && itemsOrGroups.length && !itemsOrGroups[0].items) {
            dayGroups = groupItemsByDateClient(itemsOrGroups);
        }
        if (!dayGroups || !dayGroups.length) {
            tbody.innerHTML = '<tr><td colspan="7">조회 결과가 없습니다.</td></tr>';
            return;
        }
        var html = "";
        var totalAmount = 0;
        var totalQty = 0;
        var totalLines = 0;
        dayGroups.forEach(function (group) {
            var dayQty = 0;
            var dayAmount = 0;
            var dayYmd = group.issueDate || "";
            (group.items || []).forEach(function (row) {
                var qty = Number(row.quantity) || 0;
                var line = Number(row.lineTotal) || 0;
                dayQty += qty;
                dayAmount += line;
                totalQty += qty;
                totalAmount += line;
                totalLines += 1;
                html +=
                    "<tr>" +
                    "<td>" +
                    escapeHtml(dayYmd) +
                    "</td>" +
                    "<td class=\"vendor\">" +
                    escapeHtml(row.vendorCompany || "") +
                    "</td>" +
                    "<td class=\"code\">" +
                    escapeHtml(row.pd_code || "—") +
                    "</td>" +
                    "<td class=\"name\">" +
                    escapeHtml(row.productName || "") +
                    "</td>" +
                    '<td class="num">' +
                    escapeHtml(String(qty)) +
                    "</td>" +
                    '<td class="num">' +
                    escapeHtml(formatWon(row.unitPrice).replace("원", "")) +
                    "</td>" +
                    '<td class="num">' +
                    escapeHtml(formatWon(line).replace("원", "")) +
                    "</td>" +
                    "</tr>";
            });
            html +=
                '<tr class="srp-day-total">' +
                '<td colspan="4"><strong>일 소계</strong></td>' +
                '<td class="num"><strong>' +
                escapeHtml(String(dayQty)) +
                "</strong></td>" +
                "<td></td>" +
                '<td class="num"><strong>' +
                escapeHtml(formatWon(dayAmount).replace("원", "")) +
                "</strong></td>" +
                "</tr>";
        });
        html +=
            '<tr class="srp-total-row">' +
            '<td colspan="4"><strong>합계 (' +
            escapeHtml(String(dayGroups.length)) +
            "일 · " +
            escapeHtml(String(totalLines)) +
            "건)</strong></td>" +
            '<td class="num"><strong>' +
            escapeHtml(String(totalQty)) +
            "</strong></td>" +
            "<td></td>" +
            '<td class="num"><strong>' +
            escapeHtml(formatWon(totalAmount).replace("원", "")) +
            "</strong></td>" +
            "</tr>";
        tbody.innerHTML = html;
    }

    function renderResultsTable(tbody, items) {
        renderLedgerLinesTable(tbody, items);
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

    function renderDateLedgerTable(tbody, dayGroups) {
        renderLedgerLinesTable(tbody, dayGroups);
    }

    function renderDateGroupsTable(tbody, groups) {
        if (!tbody) return;
        if (!groups || !groups.length) {
            tbody.innerHTML = '<tr><td colspan="4">조회 결과가 없습니다.</td></tr>';
            return;
        }
        var html = "";
        var totalAmount = 0;
        var totalQty = 0;
        var totalCount = 0;
        groups.forEach(function (row) {
            totalAmount += Number(row.totalAmount) || 0;
            totalQty += Number(row.totalQuantity) || 0;
            totalCount += Number(row.count) || 0;
            html +=
                "<tr>" +
                "<td>" +
                escapeHtml(row.issueDate || "") +
                "</td>" +
                "<td class=\"num\">" +
                escapeHtml(String(row.count || 0)) +
                "</td>" +
                "<td class=\"num\">" +
                escapeHtml(String(row.totalQuantity || 0)) +
                "</td>" +
                "<td class=\"num\">" +
                escapeHtml(formatWon(row.totalAmount).replace("원", "")) +
                "</td>" +
                "</tr>";
        });
        html +=
            '<tr class="srp-total-row">' +
            '<td><strong>합계 (' + escapeHtml(String(groups.length)) + "일)</strong></td>" +
            '<td class="num"><strong>' +
            escapeHtml(String(totalCount)) +
            "</strong></td>" +
            '<td class="num"><strong>' +
            escapeHtml(String(totalQty)) +
            "</strong></td>" +
            '<td class="num"><strong>' +
            escapeHtml(formatWon(totalAmount).replace("원", "")) +
            "</strong></td>" +
            "</tr>";
        tbody.innerHTML = html;
    }

    global.THEJHON_SALES_REPORT = {
        escapeHtml: escapeHtml,
        formatWon: formatWon,
        formatYmd: formatYmd,
        setStatus: setStatus,
        readDateInput: readDateInput,
        defaultDateRange: defaultDateRange,
        renderResultsTable: renderResultsTable,
        renderDateGroupsTable: renderDateGroupsTable,
        renderDateLedgerTable: renderDateLedgerTable,
        renderSummary: renderSummary,
        openModal: openModal,
        closeModal: closeModal,
        wireModalClose: wireModalClose,
        printResults: printResults,
        downloadPdfBlob: downloadPdfBlob
    };
})(typeof window !== "undefined" ? window : global);
