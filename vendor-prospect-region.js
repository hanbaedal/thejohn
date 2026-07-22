(function (global) {
    var DEFAULT_IDS = {
        title: "vpr-title",
        subtitle: "vpr-subtitle",
        status: "vpr-status",
        count: "vpr-count",
        districts: "vpr-districts",
        grid: "vpr-grid",
        checkAll: "vpr-check-all",
        refreshBtn: "vpr-refresh-btn",
        importBtn: "vpr-import-btn",
        result: "vpr-result",
        saveModal: "vpr-save-modal",
        saveModalOk: "vpr-save-modal-ok"
    };

    function init(options) {
        options = options || {};
        var api = global.THEJHON_API;
        var MAP = global.THEJHON_EXCEL_IMPORT_MAP;
        var DIST = global.THEJHON_VENDOR_DISTRICT;
        var CARDS = global.THEJHON_VENDOR_LIST_CARDS;
        var ids = options.ids || DEFAULT_IDS;
        var regionParam = String(options.region || "서울").trim();

        function el(key) {
            return document.getElementById(ids[key]);
        }

        var titleEl = el("title");
        var subtitleEl = el("subtitle");
        var statusEl = el("status");
        var countEl = el("count");
        var districtsEl = el("districts");
        var gridEl = el("grid");
        var checkAllEl = el("checkAll");
        var refreshBtn = el("refreshBtn");
        var importBtn = el("importBtn");
        var resultEl = el("result");
        var saveModal = el("saveModal");
        var saveModalOk = el("saveModalOk");

        var items = [];
        var selected = {};
        var activeDistrict = "";
        var bound = false;
        var hoverPanel = null;
        var hoverHideTimer = null;
        var hoverRowId = "";

        function findRowById(id) {
            var key = String(id || "");
            for (var i = 0; i < items.length; i++) {
                if (String(items[i].fhi_id) === key) return items[i];
            }
            return null;
        }

        function ensureHoverPanel() {
            if (hoverPanel) return hoverPanel;
            hoverPanel = document.getElementById("vpr-hover-panel");
            if (!hoverPanel) {
                hoverPanel = document.createElement("div");
                hoverPanel.id = "vpr-hover-panel";
                hoverPanel.className = "vpr-hover-panel";
                hoverPanel.hidden = true;
                hoverPanel.setAttribute("role", "tooltip");
                document.body.appendChild(hoverPanel);
            }
            if (!hoverPanel.dataset.bound) {
                hoverPanel.dataset.bound = "1";
                hoverPanel.addEventListener("mouseenter", function () {
                    if (hoverHideTimer) {
                        clearTimeout(hoverHideTimer);
                        hoverHideTimer = null;
                    }
                });
                hoverPanel.addEventListener("mouseleave", function (e) {
                    if (e.relatedTarget && e.relatedTarget.closest(".vpr-card--browse")) return;
                    scheduleHideHoverPanel();
                });
            }
            return hoverPanel;
        }

        function scheduleHideHoverPanel() {
            if (hoverHideTimer) clearTimeout(hoverHideTimer);
            hoverHideTimer = window.setTimeout(function () {
                hoverHideTimer = null;
                if (hoverPanel) hoverPanel.hidden = true;
                hoverRowId = "";
            }, 120);
        }

        function hoverDetailRow(label, value) {
            var v = String(value || "").trim();
            return (
                '<div class="vpr-hover-panel__row"><dt>' +
                escapeHtml(label) +
                "</dt><dd>" +
                escapeHtml(v || "-") +
                "</dd></div>"
            );
        }

        function buildHoverPanelHtml(row) {
            var convHtml =
                CARDS && CARDS.convenienceHtml
                    ? CARDS.convenienceHtml(row)
                    : '<span class="vpr-hover-panel__empty">-</span>';
            var mort = row.vn_mortuary_count ? String(row.vn_mortuary_count) + " 구" : "-";
            var rooms = row.vn_room_count ? String(row.vn_room_count) + " 개" : "-";
            var park = row.vn_park_count ? String(row.vn_park_count) + " 대" : "-";
            return (
                '<div class="vpr-hover-panel__inner">' +
                '<p class="vpr-hover-panel__title">' +
                escapeHtml(row.vn_company || "") +
                "</p>" +
                '<dl class="vpr-hover-panel__list">' +
                hoverDetailRow("주소", row.vn_addr) +
                hoverDetailRow("전화번호", row.vn_phone) +
                hoverDetailRow("팩스번호", row.vn_fax) +
                hoverDetailRow("안치능력", mort) +
                hoverDetailRow("빈소수", rooms) +
                hoverDetailRow("주차가능대수", park) +
                "</dl>" +
                '<div class="vpr-hover-panel__amenities">' +
                '<p class="vpr-hover-panel__amenities-label">편의시설</p>' +
                '<div class="vpr-hover-panel__amenity-list">' +
                convHtml +
                "</div></div></div>"
            );
        }

        function positionHoverPanel(card) {
            if (!hoverPanel || !card) return;
            var rect = card.getBoundingClientRect();
            var panel = hoverPanel;
            panel.hidden = false;
            panel.style.visibility = "hidden";
            panel.style.left = "0px";
            panel.style.top = "0px";
            var pw = panel.offsetWidth;
            var ph = panel.offsetHeight;
            var gap = 8;
            var left = rect.left + rect.width / 2 - pw / 2;
            var top = rect.bottom + gap;
            if (top + ph > window.innerHeight - 8) {
                top = rect.top - ph - gap;
            }
            if (left < 8) left = 8;
            if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
            if (top < 8) top = rect.bottom + gap;
            panel.style.left = Math.round(left) + "px";
            panel.style.top = Math.round(top) + "px";
            panel.style.visibility = "";
        }

        function showHoverPanel(card, row) {
            if (!row) return;
            var panel = ensureHoverPanel();
            if (hoverHideTimer) {
                clearTimeout(hoverHideTimer);
                hoverHideTimer = null;
            }
            hoverRowId = String(row.fhi_id || "");
            panel.innerHTML = buildHoverPanelHtml(row);
            panel.hidden = false;
            positionHoverPanel(card);
        }

        function bindHoverCards(root) {
            if (!root) return;
            ensureHoverPanel();
            root.querySelectorAll(".vpr-card--browse").forEach(function (card) {
                card.addEventListener("mouseenter", function () {
                    var row = findRowById(card.getAttribute("data-id"));
                    if (row) showHoverPanel(card, row);
                });
                card.addEventListener("mouseleave", function (e) {
                    var next = e.relatedTarget;
                    if (next && (hoverPanel.contains(next) || card.contains(next))) return;
                    scheduleHideHoverPanel();
                });
                card.addEventListener("click", function (e) {
                    if (e.target.closest(".vpr-card__check")) return;
                    if (!window.matchMedia("(hover: hover)").matches) {
                        var row = findRowById(card.getAttribute("data-id"));
                        if (!row) return;
                        if (!hoverPanel.hidden && hoverRowId === String(row.fhi_id)) {
                            hoverPanel.hidden = true;
                            hoverRowId = "";
                            return;
                        }
                        showHoverPanel(card, row);
                    }
                });
            });
        }

        function setStatus(msg, kind) {
            if (!statusEl) return;
            statusEl.textContent = msg || "";
            statusEl.className = "vei-status";
            if (kind === "error") statusEl.classList.add("vei-status--error");
            if (kind === "ok") statusEl.classList.add("vei-status--ok");
        }

        function escapeHtml(s) {
            return String(s || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
        }

        function escapeAttr(s) {
            return escapeHtml(s).replace(/'/g, "&#39;");
        }

        function normalizeRow(row) {
            return MAP && MAP.normalizeImportRow ? MAP.normalizeImportRow(row || {}) : row || {};
        }

        function enrichDistricts() {
            if (DIST && DIST.enrichItems) DIST.enrichItems(items);
            else if (DIST && DIST.parse) {
                items.forEach(function (row) {
                    if (!row.district) row.district = DIST.parse(row.vn_addr);
                });
            }
        }

        function getVisibleItems() {
            enrichDistricts();
            if (!activeDistrict) return items;
            return items.filter(function (row) {
                return (row.district || "기타") === activeDistrict;
            });
        }

        function updateImportBtn() {
            var visible = getVisibleItems();
            var n = Object.keys(selected).filter(function (k) {
                return selected[k];
            }).length;
            if (importBtn) importBtn.disabled = n === 0;
            if (countEl) {
                var txt = "총 " + items.length + "건";
                if (activeDistrict) txt += " · " + activeDistrict + " " + visible.length + "건";
                txt += " · 선택 " + n + "건";
                countEl.textContent = txt;
            }
        }

        function renderCardHtml(row, idx) {
            var id = String(row.fhi_id || idx);
            if (CARDS && CARDS.renderCard) {
                return CARDS.renderCard(row, {
                    layout: "prospectBrowse",
                    mode: "prospect",
                    imgContain: true,
                    showCheck: true,
                    checkId: id,
                    cardId: id,
                    selected: !!selected[id],
                    registeredVendor: row.registered_vendor || null
                });
            }
            var checked = !!selected[id];
            return (
                '<article class="vpr-card' +
                (checked ? " is-selected" : "") +
                '" data-id="' +
                escapeAttr(id) +
                '">' +
                '<label class="vpr-card__check"><input type="checkbox" class="vpr-item-check" data-id="' +
                escapeAttr(id) +
                '"' +
                (checked ? " checked" : "") +
                "> 선택</label>" +
                '<div class="vpr-card__img-wrap">' +
                (CARDS && CARDS.logoHtml
                    ? CARDS.logoHtml(row)
                    : '<div class="vpr-card__img vpr-card__img--empty"></div>') +
                (row.vn_public_type
                    ? '<span class="vpr-card__badge">' + escapeHtml(row.vn_public_type) + "</span>"
                    : "") +
                "</div>" +
                '<div class="vpr-card__body">' +
                '<h3 class="vpr-card__name">' +
                escapeHtml(row.vn_company) +
                "</h3>" +
                '<p class="vpr-card__addr">' +
                escapeHtml(row.vn_addr) +
                "</p>" +
                '<dl class="vpr-card__meta">' +
                "<dt>시·구·군</dt><dd>" +
                escapeHtml(row.district || "-") +
                "</dd>" +
                "<dt>시설 형태</dt><dd>" +
                escapeHtml(row.vn_public_type || "-") +
                "</dd>" +
                "<dt>안치능력</dt><dd>" +
                (row.vn_mortuary_count ? escapeHtml(row.vn_mortuary_count) + "구" : "-") +
                "</dd>" +
                "<dt>빈소 정보</dt><dd>" +
                (row.vn_room_count ? escapeHtml(row.vn_room_count) + "개" : "-") +
                "</dd>" +
                "<dt>전화번호</dt><dd>" +
                escapeHtml(row.vn_phone || "-") +
                "</dd>" +
                "</dl></div></article>"
            );
        }

        function bindCardChecks(root) {
            if (!root) return;
            root.querySelectorAll(".vpr-item-check").forEach(function (inp) {
                inp.addEventListener("change", function () {
                    var id = inp.getAttribute("data-id");
                    selected[id] = inp.checked;
                    var card = inp.closest(".vpr-card");
                    if (card) card.classList.toggle("is-selected", inp.checked);
                    updateImportBtn();
                    syncCheckAll();
                });
            });
        }

        function renderDistrictBar() {
            if (!districtsEl) return;
            if (!items.length) {
                districtsEl.hidden = true;
                districtsEl.innerHTML = "";
                return;
            }
            enrichDistricts();
            var counts = DIST && DIST.countByDistrict ? DIST.countByDistrict(items) : {};
            var keys =
                DIST && DIST.sortDistrictKeys
                    ? DIST.sortDistrictKeys(Object.keys(counts))
                    : Object.keys(counts).sort();
            if (keys.length <= 1) {
                districtsEl.hidden = true;
                districtsEl.innerHTML = "";
                return;
            }
            districtsEl.hidden = false;
            districtsEl.innerHTML =
                '<p class="vpr-district-bar__label">시·구·군</p><div class="vpr-district-bar__chips" role="tablist">' +
                '<button type="button" class="vpr-district-chip' +
                (!activeDistrict ? " is-active" : "") +
                '" data-district="" role="tab" aria-selected="' +
                (!activeDistrict ? "true" : "false") +
                '">전체 <span class="vpr-district-chip__count">' +
                items.length +
                "</span></button>" +
                keys
                    .map(function (key) {
                        var on = activeDistrict === key;
                        return (
                            '<button type="button" class="vpr-district-chip' +
                            (on ? " is-active" : "") +
                            '" data-district="' +
                            escapeAttr(key) +
                            '" role="tab" aria-selected="' +
                            (on ? "true" : "false") +
                            '">' +
                            escapeHtml(key) +
                            ' <span class="vpr-district-chip__count">' +
                            counts[key] +
                            "</span></button>"
                        );
                    })
                    .join("") +
                "</div>";
            districtsEl.querySelectorAll(".vpr-district-chip").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    activeDistrict = btn.getAttribute("data-district") || "";
                    renderGrid();
                });
            });
        }

        function renderGrid() {
            if (!gridEl) return;
            if (!items.length) {
                gridEl.className = "vpr-district-wrap";
                gridEl.innerHTML = '<p class="vpr-loading">표시할 장례식장이 없습니다.</p>';
                if (districtsEl) {
                    districtsEl.hidden = true;
                    districtsEl.innerHTML = "";
                }
                updateImportBtn();
                return;
            }

            renderDistrictBar();
            var visible = getVisibleItems();
            if (!visible.length) {
                gridEl.className = "vpr-district-wrap";
                gridEl.innerHTML =
                    '<p class="vpr-loading">선택한 시·구·군에 표시할 장례식장이 없습니다.</p>';
                updateImportBtn();
                syncCheckAll();
                return;
            }

            if (!activeDistrict && DIST && DIST.groupByDistrict) {
                var groups = DIST.groupByDistrict(items);
                gridEl.className = "vpr-district-wrap";
                gridEl.innerHTML = groups
                    .map(function (group) {
                        return (
                            '<section class="vpr-district-group" id="vpr-district-' +
                            escapeAttr(group.district) +
                            '">' +
                            '<h3 class="vpr-district-title">' +
                            escapeHtml(group.district) +
                            ' <span class="vpr-district-count">' +
                            group.items.length +
                            "개소</span></h3>" +
                            '<div class="vpr-grid">' +
                            group.items
                                .map(function (row, idx) {
                                    return renderCardHtml(row, idx);
                                })
                                .join("") +
                            "</div></section>"
                        );
                    })
                    .join("");
            } else {
                gridEl.className = "vpr-district-wrap";
                gridEl.innerHTML =
                    '<div class="vpr-grid">' +
                    visible
                        .map(function (row, idx) {
                            return renderCardHtml(row, idx);
                        })
                        .join("") +
                    "</div>";
            }

            bindCardChecks(gridEl);
            bindHoverCards(gridEl);
            updateImportBtn();
            syncCheckAll();
        }

        function syncCheckAll() {
            if (!checkAllEl) return;
            var visible = getVisibleItems();
            if (!visible.length) {
                checkAllEl.checked = false;
                return;
            }
            checkAllEl.checked = visible.every(function (row) {
                return isRegisteredRow(row) || selected[String(row.fhi_id)];
            });
        }

        function isRegisteredRow(row) {
            return !!(row && row.registered_vendor && row.registered_vendor.id);
        }

        function toImportRows() {
            var out = [];
            items.forEach(function (row) {
                var id = String(row.fhi_id);
                if (!selected[id] || isRegisteredRow(row)) return;
                out.push(
                    normalizeRow({
                        vn_company: row.vn_company,
                        vn_phone: row.vn_phone,
                        vn_addr: row.vn_addr,
                        vn_room_count: row.vn_room_count,
                        vn_record_type: "new",
                        fhi_id: row.fhi_id || "",
                        vn_public_type: row.vn_public_type || ""
                    })
                );
            });
            return out;
        }

        function closeSaveModal() {
            if (saveModal) saveModal.hidden = true;
        }

        function showSavedModal() {
            if (saveModal) saveModal.hidden = false;
        }

        function load(refresh) {
            if (!api || !api.getFhiRegionItems) {
                setStatus("API를 불러오지 못했습니다.", "error");
                return Promise.reject(new Error("API"));
            }
            if (gridEl) {
                gridEl.className = "vpr-district-wrap";
                gridEl.innerHTML = '<p class="vpr-loading">불러오는 중…</p>';
            }
            if (districtsEl) {
                districtsEl.hidden = true;
                districtsEl.innerHTML = "";
            }
            setStatus(refresh ? "새로고침 중…" : "불러오는 중…");
            if (importBtn) importBtn.disabled = true;
            selected = {};
            activeDistrict = "";
            if (checkAllEl) checkAllEl.checked = false;
            if (resultEl) {
                resultEl.hidden = true;
                resultEl.innerHTML = "";
            }

            return api
                .getFhiRegionItems(regionParam, { refresh: !!refresh, phones: true })
                .then(function (data) {
                    items = data.items || [];
                    enrichDistricts();
                    var meta = data.region || {};
                    if (titleEl) titleEl.textContent = (meta.label || regionParam) + " 장례식장";
                    if (subtitleEl) subtitleEl.textContent = "";
                    renderGrid();
                    var regCount =
                        data.registeredCount != null
                            ? data.registeredCount
                            : items.filter(function (row) {
                                  return row.registered_vendor;
                              }).length;
                    var statusMsg =
                        (meta.label || regionParam) + " " + items.length + "건 조회 완료";
                    if (regCount > 0) {
                        statusMsg += " · 사업부문 등록 " + regCount + "곳(빨간 「등록업체」)";
                    }
                    setStatus(statusMsg, "ok");
                    return data;
                })
                .catch(function (err) {
                    if (gridEl) gridEl.innerHTML = "";
                    setStatus(err.message || "목록을 불러오지 못했습니다.", "error");
                    throw err;
                });
        }

        function bindEvents() {
            if (bound) return;
            bound = true;
            if (checkAllEl) {
                checkAllEl.addEventListener("change", function () {
                    var on = checkAllEl.checked;
                    getVisibleItems().forEach(function (row) {
                        if (isRegisteredRow(row)) return;
                        selected[String(row.fhi_id)] = on;
                    });
                    renderGrid();
                });
            }
            if (refreshBtn) {
                refreshBtn.addEventListener("click", function () {
                    load(true);
                });
            }
            if (importBtn) {
                importBtn.addEventListener("click", function () {
                    var payload = toImportRows();
                    if (!payload.length) {
                        setStatus("저장할 시설을 선택해 주세요.", "error");
                        return;
                    }
                    importBtn.disabled = true;
                    setStatus("선택 항목 저장 중… (" + payload.length + "건)");
                    api.importVendorProspects(payload)
                        .then(function (res) {
                            var inserted = (res && res.inserted) || 0;
                            var skipped = (res && res.skipped) || 0;
                            setStatus("저장 완료: " + inserted + "건 (중복 제외 " + skipped + "건)", "ok");
                            if (resultEl) {
                                resultEl.hidden = false;
                                resultEl.innerHTML =
                                    "<strong>결과</strong> 저장 " +
                                    inserted +
                                    "건, 중복·건너뜀 " +
                                    skipped +
                                    "건";
                            }
                            showSavedModal();
                        })
                        .catch(function (err) {
                            setStatus(err.message || "저장에 실패했습니다.", "error");
                        })
                        .finally(function () {
                            updateImportBtn();
                        });
                });
            }
            if (saveModalOk) saveModalOk.addEventListener("click", closeSaveModal);
            if (saveModal) {
                saveModal.addEventListener("click", function (e) {
                    if (e.target === saveModal) closeSaveModal();
                });
            }
            window.addEventListener(
                "scroll",
                function () {
                    scheduleHideHoverPanel();
                },
                true
            );
        }

        function setRegion(nextRegion) {
            regionParam = String(nextRegion || "").trim() || regionParam;
            activeDistrict = "";
        }

        bindEvents();

        return {
            load: load,
            setRegion: setRegion,
            getRegion: function () {
                return regionParam;
            }
        };
    }

    global.THEJHON_VENDOR_PROSPECT_REGION = { init: init };

    if (document.getElementById(DEFAULT_IDS.grid)) {
        var params = new URLSearchParams(window.location.search || "");
        var access =
            global.THEJHON_AUTH && global.THEJHON_AUTH.getProspectFinderAccess
                ? global.THEJHON_AUTH.getProspectFinderAccess()
                : { allowed: false };
        var panel = init({ region: params.get("region") || "서울" });
        if (!access.allowed) {
            var statusEl = document.getElementById(DEFAULT_IDS.status);
            if (statusEl) {
                statusEl.textContent = access.reason || "접근 권한이 없습니다.";
                statusEl.className = "vei-status vei-status--error";
            }
            var refreshBtn = document.getElementById(DEFAULT_IDS.refreshBtn);
            var importBtn = document.getElementById(DEFAULT_IDS.importBtn);
            if (refreshBtn) refreshBtn.disabled = true;
            if (importBtn) importBtn.disabled = true;
        } else {
            panel.load(false);
        }
    }
})(typeof window !== "undefined" ? window : this);
