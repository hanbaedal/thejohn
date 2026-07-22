(function () {
    var api = window.THEJHON_API;
    var MAP = window.THEJHON_EXCEL_IMPORT_MAP;
    var params = new URLSearchParams(window.location.search || "");
    var regionParam = params.get("region") || "서울";

    var titleEl = document.getElementById("vpr-title");
    var subtitleEl = document.getElementById("vpr-subtitle");
    var statusEl = document.getElementById("vpr-status");
    var countEl = document.getElementById("vpr-count");
    var gridEl = document.getElementById("vpr-grid");
    var checkAllEl = document.getElementById("vpr-check-all");
    var refreshBtn = document.getElementById("vpr-refresh-btn");
    var importBtn = document.getElementById("vpr-import-btn");
    var resultEl = document.getElementById("vpr-result");
    var saveModal = document.getElementById("vpr-save-modal");
    var saveModalOk = document.getElementById("vpr-save-modal-ok");

    var items = [];
    var selected = {};

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

    function updateImportBtn() {
        var n = Object.keys(selected).filter(function (k) {
            return selected[k];
        }).length;
        if (importBtn) importBtn.disabled = n === 0;
        if (countEl) countEl.textContent = "총 " + items.length + "건 · 선택 " + n + "건";
    }

    function cardImageHtml(row) {
        var src =
            api && api.fhiImageUrl && row.fhi_id
                ? api.fhiImageUrl(row.fhi_id)
                : row.image_url || "";
        if (!src) {
            return '<div class="vpr-card__img vpr-card__img--empty"></div>';
        }
        return (
            '<img class="vpr-card__img" src="' +
            escapeAttr(src) +
            '" alt="' +
            escapeAttr(row.vn_company) +
            '" loading="lazy">'
        );
    }

    function renderGrid() {
        if (!gridEl) return;
        if (!items.length) {
            gridEl.innerHTML = '<p class="vpr-loading">표시할 장례식장이 없습니다.</p>';
            updateImportBtn();
            return;
        }
        gridEl.innerHTML = items
            .map(function (row, idx) {
                var id = String(row.fhi_id || idx);
                var checked = !!selected[id];
                var img = cardImageHtml(row);
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
                    img +
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
            })
            .join("");

        gridEl.querySelectorAll(".vpr-item-check").forEach(function (inp) {
            inp.addEventListener("change", function () {
                var id = inp.getAttribute("data-id");
                selected[id] = inp.checked;
                var card = inp.closest(".vpr-card");
                if (card) card.classList.toggle("is-selected", inp.checked);
                updateImportBtn();
                syncCheckAll();
            });
        });
        updateImportBtn();
    }

    function syncCheckAll() {
        if (!checkAllEl || !items.length) return;
        var all = items.every(function (row) {
            return selected[String(row.fhi_id)];
        });
        checkAllEl.checked = all;
    }

    function toImportRows() {
        var out = [];
        items.forEach(function (row) {
            var id = String(row.fhi_id);
            if (!selected[id]) return;
            out.push(
                normalizeRow({
                    vn_company: row.vn_company,
                    vn_phone: row.vn_phone,
                    vn_addr: row.vn_addr,
                    vn_room_count: row.vn_room_count,
                    vn_record_type: "new"
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
            return;
        }
        if (gridEl) {
            gridEl.innerHTML =
                '<p class="vpr-loading">목록을 불러오는 중입니다. 전화번호 조회는 최초 1회만 시간이 걸릴 수 있습니다…</p>';
        }
        setStatus(refresh ? "새로고침 중…" : "장례식장 목록 불러오는 중…");
        if (importBtn) importBtn.disabled = true;
        selected = {};

        api.getFhiRegionItems(regionParam, { refresh: !!refresh, phones: true })
            .then(function (data) {
                items = data.items || [];
                var meta = data.region || {};
                if (titleEl) titleEl.textContent = (meta.label || regionParam) + " 장례식장";
                if (subtitleEl) {
                    subtitleEl.textContent =
                        (meta.sub || "") +
                        " — 신규 발굴용 목록입니다. 저장할 시설만 선택하세요." +
                        (data.cached ? " (캐시)" : "");
                }
                renderGrid();
                setStatus(
                    (meta.label || regionParam) + " " + items.length + "건 조회 완료",
                    "ok"
                );
            })
            .catch(function (err) {
                if (gridEl) gridEl.innerHTML = "";
                setStatus(err.message || "목록을 불러오지 못했습니다.", "error");
            });
    }

    if (checkAllEl) {
        checkAllEl.addEventListener("change", function () {
            var on = checkAllEl.checked;
            items.forEach(function (row) {
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

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getProspectFinderAccess
            ? THEJHON_AUTH.getProspectFinderAccess()
            : { allowed: false };
    if (!access.allowed) {
        setStatus(access.reason || "접근 권한이 없습니다.", "error");
        if (refreshBtn) refreshBtn.disabled = true;
        if (importBtn) importBtn.disabled = true;
    } else {
        load(false);
    }
})();
