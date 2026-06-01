/**
 * 주문 상세 — 화면 중앙 모달 (업체·관리자·슈퍼바이저 공통)
 */
(function (global) {
    function buildPanelHtml(order, viewOpts) {
        var OrderUI = global.THEJHON_ORDER_UI;
        if (!OrderUI || !order) return "";
        viewOpts = viewOpts || {};
        var title = OrderUI.escapeHtml(viewOpts.title || "주문 상세");
        var showVendor = viewOpts.showVendor !== false;
        var actions = viewOpts.actions || [];

        var actionsHtml = actions
            .map(function (act) {
                var cls = "btn" + (act.primary ? " btn-primary" : "");
                return (
                    '<button type="button" class="' +
                    cls +
                    '" id="' +
                    OrderUI.escapeHtml(act.id) +
                    '">' +
                    OrderUI.escapeHtml(act.label) +
                    "</button>"
                );
            })
            .join("");
        actionsHtml +=
            '<button type="button" class="btn" id="odm-close-btn">닫기</button>';

        return (
            '<div class="odm-head">' +
            '<h2 id="odm-detail-title" class="odm-title">' +
            title +
            "</h2>" +
            '<button type="button" class="odm-head-close" id="odm-head-close" aria-label="닫기">×</button>' +
            "</div>" +
            '<div class="odm-layout">' +
            '<div class="odm-meta-wrap">' +
            OrderUI.renderOrderDetailMetaHtml(order, { showVendor: showVendor }) +
            "</div>" +
            '<div class="odm-items-scroll" tabindex="0" aria-label="주문 품목 목록">' +
            OrderUI.renderOrderDetailItemsHtml(order) +
            "</div>" +
            '<div class="odm-foot">' +
            OrderUI.renderOrderDetailTotalHtml(order) +
            '<div class="odm-actions">' +
            actionsHtml +
            "</div></div></div>"
        );
    }

    function createController(config) {
        config = config || {};
        var modalEl = document.getElementById(config.modalId);
        var panelEl = document.getElementById(config.panelId);
        var listEl = config.listEl || null;
        var itemSelector = config.itemSelector || ".odm-list-item";

        function openModal() {
            if (!modalEl) return;
            modalEl.hidden = false;
            modalEl.classList.add("is-open");
            document.body.classList.add("odm-modal-open");
            document.body.style.overflow = "hidden";
        }

        function closeModal() {
            if (modalEl) {
                modalEl.hidden = true;
                modalEl.classList.remove("is-open");
            }
            if (panelEl) panelEl.innerHTML = "";
            document.body.classList.remove("odm-modal-open");
            document.body.style.overflow = "";
        }

        function clearListSelection() {
            if (listEl) {
                listEl.querySelectorAll(itemSelector).forEach(function (li) {
                    li.classList.remove("is-selected");
                });
            }
            if (typeof config.onDismiss === "function") {
                config.onDismiss();
            }
        }

        function dismiss() {
            clearListSelection();
            closeModal();
        }

        function showLoading(msg) {
            if (!panelEl) return;
            openModal();
            panelEl.innerHTML =
                '<p class="odm-loading">' + (msg || "불러오는 중…") + "</p>";
        }

        function showError(msg) {
            if (!panelEl) return;
            openModal();
            panelEl.innerHTML =
                '<div class="odm-head"><h2 class="odm-title">주문 상세</h2>' +
                '<button type="button" class="odm-head-close" id="odm-head-close" aria-label="닫기">×</button></div>' +
                '<p class="odm-loading">' +
                String(msg || "불러오지 못했습니다.") +
                '</p><div class="odm-foot"><div class="odm-actions">' +
                '<button type="button" class="btn" id="odm-close-btn">닫기</button></div></div>';
            bindCloseOnly();
        }

        function bindCloseOnly() {
            var closeBtn = panelEl.querySelector("#odm-close-btn");
            if (closeBtn) closeBtn.addEventListener("click", dismiss);
            var headClose = panelEl.querySelector("#odm-head-close");
            if (headClose) headClose.addEventListener("click", dismiss);
        }

        function bindActions(order, viewOpts) {
            bindCloseOnly();
            (viewOpts.actions || []).forEach(function (act) {
                if (!act.id || typeof act.onClick !== "function") return;
                var btn = panelEl.querySelector("#" + act.id);
                if (btn) {
                    btn.addEventListener("click", function () {
                        act.onClick(order, btn);
                    });
                }
            });
        }

        function show(order, viewOpts) {
            if (!panelEl) return;
            if (!order) {
                dismiss();
                return;
            }
            openModal();
            panelEl.innerHTML = buildPanelHtml(order, viewOpts);
            bindActions(order, viewOpts);
        }

        if (panelEl) {
            panelEl.addEventListener("click", function (e) {
                e.stopPropagation();
            });
        }
        if (modalEl) {
            modalEl.addEventListener("click", function (e) {
                if (e.target === modalEl) dismiss();
            });
        }
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && modalEl && !modalEl.hidden) dismiss();
        });

        return {
            show: show,
            dismiss: dismiss,
            showLoading: showLoading,
            showError: showError,
            close: closeModal
        };
    }

    global.THEJHON_ORDER_DETAIL_MODAL = {
        create: createController,
        buildPanelHtml: buildPanelHtml
    };
})(typeof window !== "undefined" ? window : this);
