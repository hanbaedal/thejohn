/**
 * 주문서 목록·상세 표시, PDF 다운로드(인증 헤더)
 */
(function (global) {
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

    function renderOrderDetailHtml(order, opts) {
        opts = opts || {};
        if (!order) return '<p class="order-detail-empty">주문 정보가 없습니다.</p>';

        return (
            '<div class="order-detail-panel">' +
            renderOrderDetailMetaHtml(order, opts) +
            renderOrderDetailItemsHtml(order) +
            renderOrderDetailTotalHtml(order) +
            "</div>"
        );
    }

    function buildOrderDetailMeta(order, opts) {
        opts = opts || {};
        var meta = [];
        meta.push("<dt>주문번호</dt><dd>" + escapeHtml(order.orderNo || order.id || "") + "</dd>");
        meta.push("<dt>주문일시</dt><dd>" + escapeHtml(formatDate(order.createdAt)) + "</dd>");
        if (opts.showVendor !== false) {
            meta.push(
                "<dt>주문 업체</dt><dd>" +
                    escapeHtml(order.vendorCompany || order.vendorUserId || "") +
                    "</dd>"
            );
        }
        if (order.vendorMgrName) {
            meta.push("<dt>주문하는 분</dt><dd>" + escapeHtml(order.vendorMgrName) + "</dd>");
        }
        if (order.vendorMgrTel) {
            meta.push("<dt>주문 연락처</dt><dd>" + escapeHtml(order.vendorMgrTel) + "</dd>");
        }
        if (order.vendorRegisteredMgrName) {
            meta.push(
                "<dt>등록 담당자</dt><dd>" + escapeHtml(order.vendorRegisteredMgrName) + "</dd>"
            );
        }
        if (order.vendorRegisteredMgrTel) {
            meta.push(
                "<dt>등록 연락처</dt><dd>" + escapeHtml(order.vendorRegisteredMgrTel) + "</dd>"
            );
        }
        if (order.vendorRegisteredByName) {
            meta.push(
                "<dt>등록 담당</dt><dd>" + escapeHtml(order.vendorRegisteredByName) + "</dd>"
            );
        }
        if (order.note) {
            meta.push("<dt>비고</dt><dd>" + escapeHtml(order.note) + "</dd>");
        }
        return meta;
    }

    function renderOrderDetailMetaHtml(order, opts) {
        if (!order) return "";
        return '<dl class="order-detail-meta">' + buildOrderDetailMeta(order, opts).join("") + "</dl>";
    }

    function renderOrderDetailItemsHtml(order) {
        if (!order) return "";
        var rows = (order.items || [])
            .map(function (it, idx) {
                return (
                    "<tr><td data-label=\"#\">" +
                    escapeHtml(String(idx + 1)) +
                    '</td><td data-label="상품">' +
                    escapeHtml(it.productName || "") +
                    '</td><td data-label="규격">' +
                    escapeHtml(String(it.pd_size || "").trim() || "—") +
                    '</td><td data-label="단가">' +
                    escapeHtml(it.priceLabel || "") +
                    " " +
                    escapeHtml(formatWon(it.unitPrice)) +
                    '</td><td data-label="수량">' +
                    escapeHtml(String(it.quantity || 0)) +
                    '</td><td data-label="금액">' +
                    escapeHtml(formatWon(it.lineTotal)) +
                    "</td></tr>"
                );
            })
            .join("");
        return (
            '<div class="order-detail-table-wrap"><table class="order-detail-table"><thead><tr>' +
            "<th>#</th><th>상품</th><th>규격</th><th>단가</th><th>수량</th><th>금액</th>" +
            "</tr></thead><tbody>" +
            (rows || '<tr><td colspan="6">품목 없음</td></tr>') +
            "</tbody></table></div>"
        );
    }

    function renderOrderDetailTotalHtml(order) {
        if (!order) return "";
        return (
            '<p class="order-detail-total">합계: <strong>' +
            escapeHtml(formatWon(order.totalAmount)) +
            "</strong></p>"
        );
    }

    function safeFilePart(s) {
        return String(s || "")
            .trim()
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, " ")
            .slice(0, 60);
    }

    function ymd(ts) {
        var d = new Date(ts || Date.now());
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return "" + y + m + day;
    }

    function triggerPdfDownload(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 2000);
    }

    function downloadOrderPdfWithAuth(api, orderId, orderNo, orderMeta) {
        if (!api || !api.fetchOrderPdfBlob) {
            return Promise.reject(new Error("PDF API를 사용할 수 없습니다."));
        }
        return api.fetchOrderPdfBlob(orderId, { download: true }).then(function (blob) {
            var meta = orderMeta || null;
            if (!meta && window.THEJHON_ORDER_UI) meta = THEJHON_ORDER_UI._lastOrderForPdf;
            var company = meta && meta.vendorCompany ? meta.vendorCompany : "";
            var createdAt = meta && meta.createdAt ? meta.createdAt : null;
            var base = safeFilePart(company || "주문서") + "_" + ymd(createdAt);
            triggerPdfDownload(blob, base + ".pdf");
        });
    }

    function downloadTransactionPdfWithAuth(api, orderId, orderMeta) {
        if (!api || !api.fetchTransactionPdfBlob) {
            return Promise.reject(new Error("거래명세서 PDF API를 사용할 수 없습니다."));
        }
        return api.fetchTransactionPdfBlob(orderId, { download: true }).then(function (blob) {
            var meta = orderMeta || null;
            var company = meta && meta.vendorCompany ? meta.vendorCompany : "";
            var createdAt = meta && meta.createdAt ? meta.createdAt : null;
            var base = "거래명세서_" + safeFilePart(company || "거래처") + "_" + ymd(createdAt);
            triggerPdfDownload(blob, base + ".pdf");
        });
    }

    function ensurePdfBlob(blob) {
        if (!blob) return blob;
        if (blob.type === "application/pdf") return blob;
        return new Blob([blob], { type: "application/pdf" });
    }

    function prefersPdfInlineViewUnsupported() {
        if (typeof window.matchMedia === "function") {
            if (window.matchMedia("(max-width: 720px)").matches) return true;
            if (window.matchMedia("(pointer: coarse)").matches) return true;
        }
        var ua = navigator.userAgent || "";
        return /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
    }

    var pdfModalUi = {
        el: null,
        frame: null,
        objectEl: null,
        titleEl: null,
        mobileActionsEl: null,
        url: null,
        currentBlob: null,
        currentFilename: "document.pdf",
        escBound: false
    };

    function closePdfBlobModal() {
        if (!pdfModalUi.el || pdfModalUi.el.hidden) return;
        pdfModalUi.el.hidden = true;
        pdfModalUi.el.classList.remove("pdf-view-modal--mobile-inline");
        if (pdfModalUi.frame) pdfModalUi.frame.removeAttribute("src");
        if (pdfModalUi.objectEl) pdfModalUi.objectEl.removeAttribute("data");
        if (pdfModalUi.url) {
            URL.revokeObjectURL(pdfModalUi.url);
            pdfModalUi.url = null;
        }
        pdfModalUi.currentBlob = null;
        document.body.classList.remove("pdf-view-modal-open");
        document.body.style.overflow = "";
    }

    function openPdfBlobFromModalUi() {
        if (!pdfModalUi.url) return;
        var a = document.createElement("a");
        a.href = pdfModalUi.url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function ensurePdfBlobModal() {
        if (pdfModalUi.el && !document.getElementById("thejhonPdfViewModalMobileActions")) {
            pdfModalUi.el.remove();
            pdfModalUi.el = null;
            pdfModalUi.frame = null;
            pdfModalUi.objectEl = null;
            pdfModalUi.mobileActionsEl = null;
        }
        if (pdfModalUi.el) return pdfModalUi.el;
        var modal = document.createElement("div");
        modal.id = "thejhonPdfViewModal";
        modal.className = "pdf-view-modal";
        modal.hidden = true;
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "thejhonPdfViewModalTitle");
        modal.innerHTML =
            '<div class="pdf-view-modal__panel">' +
            '<div class="pdf-view-modal__head">' +
            '<h2 class="pdf-view-modal__title" id="thejhonPdfViewModalTitle">PDF 보기</h2>' +
            '<button type="button" class="pdf-view-modal__close" id="thejhonPdfViewModalClose" aria-label="닫기">&times;</button>' +
            "</div>" +
            '<div class="pdf-view-modal__mobile-actions" id="thejhonPdfViewModalMobileActions" hidden>' +
            '<p class="pdf-view-modal__mobile-hint">스마트폰에서는 아래 <strong>PDF 열기</strong>를 눌러 주세요. (브라우저 PDF 뷰어로 열립니다)</p>' +
            '<div class="pdf-view-modal__mobile-btns">' +
            '<button type="button" class="btn btn-primary" id="thejhonPdfViewModalOpenBtn">PDF 열기</button>' +
            '<button type="button" class="btn" id="thejhonPdfViewModalSaveBtn">파일 저장</button>' +
            "</div></div>" +
            '<div class="pdf-view-modal__body">' +
            '<object class="pdf-view-modal__object" id="thejhonPdfViewModalObject" type="application/pdf" aria-label="PDF 미리보기"></object>' +
            '<iframe class="pdf-view-modal__frame" id="thejhonPdfViewModalFrame" title="PDF 미리보기"></iframe>' +
            "</div>" +
            "</div>";
        document.body.appendChild(modal);
        pdfModalUi.el = modal;
        pdfModalUi.frame = document.getElementById("thejhonPdfViewModalFrame");
        pdfModalUi.objectEl = document.getElementById("thejhonPdfViewModalObject");
        pdfModalUi.titleEl = document.getElementById("thejhonPdfViewModalTitle");
        pdfModalUi.mobileActionsEl = document.getElementById("thejhonPdfViewModalMobileActions");
        document.getElementById("thejhonPdfViewModalClose").addEventListener("click", closePdfBlobModal);
        document.getElementById("thejhonPdfViewModalOpenBtn").addEventListener("click", openPdfBlobFromModalUi);
        document.getElementById("thejhonPdfViewModalSaveBtn").addEventListener("click", function () {
            if (pdfModalUi.currentBlob) {
                triggerPdfDownload(pdfModalUi.currentBlob, pdfModalUi.currentFilename);
            }
        });
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closePdfBlobModal();
        });
        if (!pdfModalUi.escBound) {
            pdfModalUi.escBound = true;
            document.addEventListener("keydown", function (e) {
                if (e.key === "Escape" && pdfModalUi.el && !pdfModalUi.el.hidden) closePdfBlobModal();
            });
        }
        return modal;
    }

    function openPdfBlobInModal(blob, fallbackName) {
        blob = ensurePdfBlob(blob);
        closePdfBlobModal();
        ensurePdfBlobModal();
        var filename = String(fallbackName || "document.pdf");
        if (!/\.pdf$/i.test(filename)) filename += ".pdf";
        var title = filename.replace(/\.pdf$/i, "").replace(/</g, "");
        var url = URL.createObjectURL(blob);
        var mobileInline = prefersPdfInlineViewUnsupported();

        pdfModalUi.url = url;
        pdfModalUi.currentBlob = blob;
        pdfModalUi.currentFilename = filename;
        if (pdfModalUi.titleEl) pdfModalUi.titleEl.textContent = title;
        if (pdfModalUi.frame) pdfModalUi.frame.src = mobileInline ? "" : url;
        if (pdfModalUi.objectEl) {
            if (mobileInline) pdfModalUi.objectEl.setAttribute("data", url);
            else pdfModalUi.objectEl.removeAttribute("data");
        }
        if (pdfModalUi.mobileActionsEl) pdfModalUi.mobileActionsEl.hidden = !mobileInline;
        pdfModalUi.el.classList.toggle("pdf-view-modal--mobile-inline", mobileInline);
        pdfModalUi.el.hidden = false;
        document.body.classList.add("pdf-view-modal-open");
        document.body.style.overflow = "hidden";
        return Promise.resolve();
    }

    /** @deprecated 보기는 openPdfBlobInModal 사용. 새 탭이 필요할 때만 opts.newTab */
    function openPdfBlobInTab(blob, fallbackName, opts) {
        opts = opts || {};
        if (!opts.newTab) {
            return openPdfBlobInModal(blob, fallbackName);
        }
        blob = ensurePdfBlob(blob);
        var url = URL.createObjectURL(blob);
        var title = String(fallbackName || "PDF").replace(/</g, "");
        var w = window.open("", "_blank", "noopener");
        if (!w) {
            if (opts.noDownloadFallback) {
                return openPdfBlobInModal(blob, fallbackName);
            }
            triggerPdfDownload(blob, fallbackName || "document.pdf");
            return Promise.resolve();
        }
        try {
            w.document.write(
                "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" +
                    title +
                    "</title></head><body style=\"margin:0;height:100vh\"><embed src=\"" +
                    url +
                    "\" type=\"application/pdf\" width=\"100%\" height=\"100%\" /></body></html>"
            );
            w.document.close();
        } catch (e) {
            w.location.href = url;
        }
        return new Promise(function (resolve) {
            try {
                w.focus();
            } catch (e2) {
                /* ignore */
            }
            setTimeout(resolve, 400);
        });
    }

    function openPdfForPrint(blob) {
        var url = URL.createObjectURL(blob);
        var w = window.open(url, "_blank", "noopener");
        if (!w) {
            triggerPdfDownload(blob, "거래명세서.pdf");
            return Promise.resolve();
        }
        return new Promise(function (resolve) {
            w.addEventListener("load", function () {
                try {
                    w.focus();
                    w.print();
                } catch (e) {
                    /* 사용자가 직접 인쇄 */
                }
                resolve();
            });
            setTimeout(resolve, 1500);
        });
    }

    function viewOrderPdfWithAuth(api, orderId) {
        if (!api || !api.fetchOrderPdfBlob) {
            return Promise.reject(new Error("PDF API를 사용할 수 없습니다."));
        }
        return api.fetchOrderPdfBlob(orderId).then(function (blob) {
            return openPdfBlobInModal(blob, "발주서.pdf");
        });
    }

    function viewTransactionPdfWithAuth(api, orderId) {
        if (!api || !api.fetchTransactionPdfBlob) {
            return Promise.reject(new Error("거래명세서 PDF API를 사용할 수 없습니다."));
        }
        return api.fetchTransactionPdfBlob(orderId).then(function (blob) {
            return openPdfBlobInModal(blob, "거래명세서.pdf");
        });
    }

    function printTransactionPdfWithAuth(api, orderId) {
        if (!api || !api.fetchTransactionPdfBlob) {
            return Promise.reject(new Error("거래명세서 PDF API를 사용할 수 없습니다."));
        }
        return api.fetchTransactionPdfBlob(orderId).then(openPdfForPrint);
    }

    global.THEJHON_ORDER_UI = {
        escapeHtml: escapeHtml,
        formatWon: formatWon,
        formatDate: formatDate,
        renderOrderDetailHtml: renderOrderDetailHtml,
        renderOrderDetailMetaHtml: renderOrderDetailMetaHtml,
        renderOrderDetailItemsHtml: renderOrderDetailItemsHtml,
        renderOrderDetailTotalHtml: renderOrderDetailTotalHtml,
        // 내부 상태: downloadOrderPdfWithAuth 저장명 생성에 사용
        _lastOrderForPdf: null,
        downloadOrderPdfWithAuth: downloadOrderPdfWithAuth,
        downloadTransactionPdfWithAuth: downloadTransactionPdfWithAuth,
        viewOrderPdfWithAuth: viewOrderPdfWithAuth,
        viewTransactionPdfWithAuth: viewTransactionPdfWithAuth,
        printTransactionPdfWithAuth: printTransactionPdfWithAuth,
        triggerPdfDownload: triggerPdfDownload,
        openPdfBlobInModal: openPdfBlobInModal,
        closePdfBlobModal: closePdfBlobModal,
        openPdfBlobInTab: openPdfBlobInTab
    };
})(typeof window !== "undefined" ? window : this);
