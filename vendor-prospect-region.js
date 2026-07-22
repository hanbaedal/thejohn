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
                    mode: "prospect",
                    district: row.district,
                    facilityType: row.vn_public_type,
                    badge: row.vn_public_type,
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
                (api && api.fhiImageUrl && row.fhi_id
                    ? '<img class="vpr-card__img" src="' +
                      escapeAttr(api.fhiImageUrl(row.fhi_id)) +
                      '" alt="' +
                      escapeAttr(row.vn_company) +
                      '" loading="lazy">'
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
                gridEl.innerHTML =
                    '<p class="vpr-loading">목록을 불러오는 중입니다. 전화번호 조회는 최초 1회만 시간이 걸릴 수 있습니다…</p>';
            }
            if (districtsEl) {
                districtsEl.hidden = true;
                districtsEl.innerHTML = "";
            }
            setStatus(refresh ? "새로고침 중…" : "장례식장 목록 불러오는 중…");
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
                    if (subtitleEl) {
                        subtitleEl.textContent =
                            (meta.sub || "") +
                            " — 시·구·군별로 분류되어 있습니다. 저장할 시설만 선택하세요." +
                            (data.registeredCount
                                ? " · 사업부문 등록 " + data.registeredCount + "곳(빨간 표시)"
                                : "") +
                            (data.cached ? " (캐시)" : "");
                    }
                    renderGrid();
                    setStatus(
                        (meta.label || regionParam) + " " + items.length + "건 조회 완료",
                        "ok"
                    );
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
