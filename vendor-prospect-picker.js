/**
 * 예비거래처 선택 모달 — 신규업체 등록 등에서 공용
 */
(function (global) {
    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function deptSummary(item) {
        var depts = item && item.vn_depts ? item.vn_depts : [];
        if (!depts.length) return "";
        var PF = global.THEJHON_PRODUCT_FORM;
        var catalog = global.THEJHON_PRODUCT_CATALOG;
        if (PF && PF.deptLabel && catalog) {
            return depts
                .map(function (id) {
                    return PF.deptLabel(catalog, id);
                })
                .filter(Boolean)
                .join(" · ");
        }
        return depts.join(" · ");
    }

    /**
     * @param {object} options
     * @param {HTMLElement} options.modal
     * @param {HTMLElement} options.openBtn
     * @param {HTMLElement} [options.clearBtn]
     * @param {HTMLElement} options.prospectIdInput
     * @param {HTMLElement} options.companyInput
     * @param {HTMLElement} [options.badgeEl]
     * @param {HTMLElement} options.searchInput
     * @param {HTMLElement} options.listEl
     * @param {HTMLElement} options.statusEl
     * @param {function} [options.listProspects] — (q) => Promise<array>
     * @param {function} options.onSelect — (item) => void
     * @param {function} [options.onClear] — () => void
     */
    function init(options) {
        if (!options || !options.modal || !options.openBtn) return null;

        var modal = options.modal;
        var openBtn = options.openBtn;
        var clearBtn = options.clearBtn;
        var prospectIdInput = options.prospectIdInput;
        var companyInput = options.companyInput;
        var badgeEl = options.badgeEl;
        var searchInput = options.searchInput;
        var listEl = options.listEl;
        var statusEl = options.statusEl;
        var listProspects = options.listProspects;
        var onSelect = options.onSelect;
        var onClear = options.onClear;
        var closeBtn = options.closeBtn;
        var lastLoaded = [];
        var searchTimer = null;
        var loading = false;

        function setModalStatus(msg, isError) {
            if (!statusEl) return;
            statusEl.textContent = msg || "";
            statusEl.classList.toggle("vp-status--error", !!isError);
        }

        function updateBadge() {
            var has = prospectIdInput && prospectIdInput.value;
            if (badgeEl) badgeEl.hidden = !has;
            if (clearBtn) clearBtn.hidden = !has;
        }

        function clearProspectSelection() {
            if (prospectIdInput) prospectIdInput.value = "";
            updateBadge();
            if (onClear) onClear();
        }

        function openModal() {
            modal.hidden = false;
            if (searchInput) {
                searchInput.value = "";
                searchInput.focus();
            }
            loadList("");
        }

        function closeModal() {
            modal.hidden = true;
            setModalStatus("");
        }

        function renderList(items) {
            if (!listEl) return;
            listEl.innerHTML = "";
            if (!items || !items.length) {
                var empty = document.createElement("li");
                empty.className = "vp-list__item";
                empty.textContent = "등록된 예비거래처가 없습니다.";
                empty.style.padding = "1rem 0.55rem";
                empty.style.color = "#6a7d8f";
                empty.style.fontSize = "0.85rem";
                listEl.appendChild(empty);
                return;
            }
            items.forEach(function (item) {
                var li = document.createElement("li");
                li.className = "vp-list__item";
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "vp-list__btn";
                var meta = [];
                if (item.vn_ceo) meta.push("대표 " + item.vn_ceo);
                var ds = deptSummary(item);
                if (ds) meta.push(ds);
                btn.innerHTML =
                    '<span class="vp-list__name">' +
                    escapeHtml(item.vn_company || "(이름 없음)") +
                    "</span>" +
                    (meta.length
                        ? '<span class="vp-list__meta">' + escapeHtml(meta.join(" · ")) + "</span>"
                        : "");
                btn.addEventListener("click", function () {
                    if (prospectIdInput) prospectIdInput.value = item.id || "";
                    if (companyInput) companyInput.value = item.vn_company || "";
                    updateBadge();
                    if (onSelect) onSelect(item);
                    closeModal();
                });
                li.appendChild(btn);
                listEl.appendChild(li);
            });
        }

        function loadList(q) {
            if (!listProspects) {
                setModalStatus("API를 불러오지 못했습니다.", true);
                return;
            }
            loading = true;
            setModalStatus("불러오는 중…");
            listProspects(q)
                .then(function (items) {
                    lastLoaded = items || [];
                    renderList(lastLoaded);
                    if (lastLoaded.length) {
                        setModalStatus(lastLoaded.length + "건");
                    } else {
                        setModalStatus(q ? "검색 결과가 없습니다." : "등록된 예비거래처가 없습니다.");
                    }
                })
                .catch(function (err) {
                    renderList([]);
                    setModalStatus((err && err.message) || "목록을 불러오지 못했습니다.", true);
                })
                .finally(function () {
                    loading = false;
                });
        }

        openBtn.addEventListener("click", openModal);
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !modal.hidden) closeModal();
        });

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                if (searchTimer) clearTimeout(searchTimer);
                var q = searchInput.value.trim();
                searchTimer = setTimeout(function () {
                    loadList(q);
                }, 280);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener("click", function () {
                clearProspectSelection();
            });
        }

        if (companyInput && prospectIdInput) {
            companyInput.addEventListener("input", function () {
                if (!prospectIdInput.value) return;
                prospectIdInput.value = "";
                updateBadge();
                if (onClear) onClear();
            });
        }

        updateBadge();

        return {
            open: openModal,
            close: closeModal,
            clear: clearProspectSelection,
            reload: loadList
        };
    }

    global.THEJHON_VENDOR_PROSPECT_PICKER = { init: init };
})(typeof window !== "undefined" ? window : global);
