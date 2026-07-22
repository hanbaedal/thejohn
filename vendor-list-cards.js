/**
 * 업체·신규업체·예비업체 리스트 — 예비업체 찾기 상세보기와 동일 카드
 */
(function (global) {
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

    function logoHtml(it, opts) {
        opts = opts || {};
        var alt = escapeAttr(it && it.vn_company ? it.vn_company : "");
        var stored = String((it && it.vn_logo) || "").trim();
        if (stored) {
            return (
                '<img class="vpr-card__img' +
                (opts.imgContain ? " vpr-card__img--contain" : "") +
                '" src="' +
                escapeAttr(stored) +
                '" alt="' +
                alt +
                '" loading="lazy">'
            );
        }
        var api = global.THEJHON_API;
        var fhiId = String((it && it.fhi_id) || "").trim();
        var fileurl = String((it && it.fileurl) || "").trim();
        if (fhiId && api && api.fhiImageUrl && opts.allowFhiImage !== false) {
            var fhiSrc = api.fhiImageUrl(fhiId, fileurl);
            if (fhiSrc) {
                return (
                    '<img class="vpr-card__img' +
                    (opts.imgContain ? " vpr-card__img--contain" : "") +
                    '" src="' +
                    escapeAttr(fhiSrc) +
                    '" alt="' +
                    alt +
                    '" loading="lazy">'
                );
            }
        }
        return '<div class="vpr-card__img vpr-card__img--empty"></div>';
    }

    function metaRow(label, value) {
        var v = String(value || "").trim();
        return (
            "<dt>" +
            escapeHtml(label) +
            "</dt><dd>" +
            escapeHtml(v || "-") +
            "</dd>"
        );
    }

    function eskyFlagOn(v) {
        return String(v || "").trim() === "TBC1300001";
    }

    function convenienceItems(it) {
        var row = it || {};
        var out = [];
        if (eskyFlagOn(row.mealroomyn)) out.push({ icon: "🍽️", label: "식당" });
        if (eskyFlagOn(row.waitroomyn)) out.push({ icon: "🛋️", label: "유족대기실" });
        if (eskyFlagOn(row.parkyn)) out.push({ icon: "🅿️", label: "주차장" });
        if (eskyFlagOn(row.superyn)) out.push({ icon: "🏪", label: "매점" });
        return out;
    }

    function convenienceHtml(it) {
        var items = convenienceItems(it);
        if (!items.length) {
            return '<span class="vpr-hover-panel__empty">-</span>';
        }
        return items
            .map(function (item) {
                return (
                    '<span class="vpr-hover-panel__amenity" title="' +
                    escapeAttr(item.label) +
                    '"><span class="vpr-hover-panel__amenity-icon" aria-hidden="true">' +
                    item.icon +
                    '</span><span class="vpr-hover-panel__amenity-label">' +
                    escapeHtml(item.label) +
                    "</span></span>"
                );
            })
            .join("");
    }

    function roomCountLabel(it) {
        var n = String((it && it.vn_room_count) || "").trim();
        if (!n) return "";
        return "빈소 " + n + "실";
    }

    function renderProspectBrowseCard(it, opts) {
        opts = opts || {};
        var name = String((it && it.vn_company) || "").trim() || "(업체명 없음)";
        var cardId = String(opts.cardId || opts.checkId || "").trim();
        var cardClass = "vpr-card vpr-card--browse";
        if (opts.selected) cardClass += " is-selected";
        if (opts.registeredVendor && opts.registeredVendor.id) {
            cardClass += " vpr-card--registered";
        }

        var checkHtml = "";
        if (opts.showCheck) {
            var isRegistered = !!(opts.registeredVendor && opts.registeredVendor.id);
            checkHtml =
                '<label class="vpr-card__check' +
                (isRegistered ? " vpr-card__check--disabled" : "") +
                '"><input type="checkbox" class="vpr-item-check" data-id="' +
                escapeAttr(opts.checkId || cardId) +
                '"' +
                (opts.selected ? " checked" : "") +
                (isRegistered ? " disabled" : "") +
                "> 선택</label>";
        }

        var registered = opts.registeredVendor || null;
        var imgWrapClass = registered ? " vpr-card__img-wrap--registered" : "";
        var registeredOverlay = "";
        if (registered) {
            var regLabel = "등록업체";
            var regTitle = String(registered.vn_company || name).trim();
            var regHref = registered.id
                ? "vendor-edit.html?id=" + encodeURIComponent(registered.id)
                : "";
            if (regHref) {
                registeredOverlay =
                    '<a class="vpr-card__registered-overlay" href="' +
                    escapeAttr(regHref) +
                    '" title="' +
                    escapeAttr(regTitle) +
                    '">' +
                    escapeHtml(regLabel) +
                    "</a>";
            } else {
                registeredOverlay =
                    '<span class="vpr-card__registered-overlay" title="' +
                    escapeAttr(regTitle) +
                    '">' +
                    escapeHtml(regLabel) +
                    "</span>";
            }
        }

        var rooms = roomCountLabel(it);
        var roomsHtml = rooms
            ? '<p class="vpr-card__rooms">' + escapeHtml(rooms) + "</p>"
            : '<p class="vpr-card__rooms vpr-card__rooms--empty">빈소 정보 없음</p>';

        var editHref = opts.editHref || "";
        var canWrite = opts.canWrite !== false;
        var footActions = "";
        if (opts.showActions) {
            cardClass += " vpr-card--list";
            footActions = '<div class="vpr-card__actions">';
            if (editHref) {
                footActions +=
                    '<a class="btn btn-secondary vpr-card__btn" href="' +
                    escapeAttr(editHref) +
                    '">수정</a>';
            }
            if (canWrite && opts.deleteId) {
                footActions +=
                    '<button type="button" class="btn vpr-card__btn vpr-card__btn--del" data-vl-delete="' +
                    escapeAttr(opts.deleteId) +
                    '" data-vl-name="' +
                    escapeAttr(name) +
                    '">삭제</button>';
            }
            footActions += "</div>";
        }

        return (
            "<article" +
            (cardId ? ' data-id="' + escapeAttr(cardId) + '"' : "") +
            ' class="' +
            cardClass +
            '">' +
            checkHtml +
            '<div class="vpr-card__img-wrap' +
            imgWrapClass +
            '">' +
            logoHtml(it, Object.assign({}, opts, { imgContain: true })) +
            registeredOverlay +
            "</div>" +
            '<div class="vpr-card__body vpr-card__body--browse">' +
            '<h3 class="vpr-card__name">' +
            escapeHtml(name) +
            "</h3>" +
            roomsHtml +
            footActions +
            "</div></article>"
        );
    }

    function hoverDetailRow(label, value) {
        return (
            '<div class="vpr-hover-panel__row"><dt>' +
            escapeHtml(label) +
            "</dt><dd>" +
            escapeHtml(String(value || "").trim() || "-") +
            "</dd></div>"
        );
    }

    function buildHoverPanelHtml(row, opts) {
        opts = opts || {};
        row = row || {};
        var convHtml = convenienceHtml(row);
        var mort = row.vn_mortuary_count ? String(row.vn_mortuary_count) + " 구" : "-";
        var rooms = row.vn_room_count ? String(row.vn_room_count) + " 개" : "-";
        var park = row.vn_park_count ? String(row.vn_park_count) + " 대" : "-";
        var extraRows = "";
        if (opts.deptLabel) extraRows += hoverDetailRow("사업부문", opts.deptLabel);
        if (opts.districtLabel) extraRows += hoverDetailRow("지역", opts.districtLabel);
        if (opts.gradeLabel) extraRows += hoverDetailRow("등급", opts.gradeLabel);
        if (opts.registrar) extraRows += hoverDetailRow("담당", opts.registrar);
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
            extraRows +
            "</dl>" +
            '<div class="vpr-hover-panel__amenities">' +
            '<p class="vpr-hover-panel__amenities-label">편의시설</p>' +
            '<div class="vpr-hover-panel__amenity-list">' +
            convHtml +
            "</div></div></div>"
        );
    }

    var hoverPanel = null;
    var hoverHideTimer = null;
    var hoverRowId = "";
    var hoverScrollBound = false;

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
        if (!hoverScrollBound) {
            hoverScrollBound = true;
            window.addEventListener(
                "scroll",
                function () {
                    scheduleHideHoverPanel();
                },
                true
            );
        }
        return hoverPanel;
    }

    function scheduleHideHoverPanel() {
        if (hoverHideTimer) clearTimeout(hoverHideTimer);
        hoverHideTimer = global.setTimeout(function () {
            hoverHideTimer = null;
            if (hoverPanel) hoverPanel.hidden = true;
            hoverRowId = "";
        }, 120);
    }

    function rowHoverKey(row) {
        return String((row && (row.fhi_id || row.id)) || "");
    }

    function positionHoverPanel(card) {
        if (!hoverPanel || !card) return;
        var rect = card.getBoundingClientRect();
        hoverPanel.hidden = false;
        hoverPanel.style.visibility = "hidden";
        hoverPanel.style.left = "0px";
        hoverPanel.style.top = "0px";
        var pw = hoverPanel.offsetWidth;
        var ph = hoverPanel.offsetHeight;
        var gap = 8;
        var left = rect.left + rect.width / 2 - pw / 2;
        var top = rect.bottom + gap;
        if (top + ph > window.innerHeight - 8) top = rect.top - ph - gap;
        if (left < 8) left = 8;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (top < 8) top = rect.bottom + gap;
        hoverPanel.style.left = Math.round(left) + "px";
        hoverPanel.style.top = Math.round(top) + "px";
        hoverPanel.style.visibility = "";
    }

    function showHoverPanel(card, row, panelOpts) {
        if (!row) return;
        var panel = ensureHoverPanel();
        if (hoverHideTimer) {
            clearTimeout(hoverHideTimer);
            hoverHideTimer = null;
        }
        hoverRowId = rowHoverKey(row);
        panel.innerHTML = buildHoverPanelHtml(row, panelOpts);
        panel.hidden = false;
        positionHoverPanel(card);
    }

    function bindBrowseHover(root, findRow, panelOptsForRow) {
        if (!root || typeof findRow !== "function") return;
        ensureHoverPanel();
        root.querySelectorAll(".vpr-card--browse").forEach(function (card) {
            if (card.dataset.hoverBound === "1") return;
            card.dataset.hoverBound = "1";
            card.addEventListener("mouseenter", function () {
                var row = findRow(card.getAttribute("data-id"));
                if (!row) return;
                var panelOpts =
                    typeof panelOptsForRow === "function" ? panelOptsForRow(row) || {} : {};
                showHoverPanel(card, row, panelOpts);
            });
            card.addEventListener("mouseleave", function (e) {
                var next = e.relatedTarget;
                if (next && (hoverPanel.contains(next) || card.contains(next))) return;
                scheduleHideHoverPanel();
            });
            card.addEventListener("click", function (e) {
                if (e.target.closest(".vpr-card__check")) return;
                if (e.target.closest(".vpr-card__actions")) return;
                if (!global.matchMedia("(hover: hover)").matches) {
                    var row = findRow(card.getAttribute("data-id"));
                    if (!row) return;
                    var key = rowHoverKey(row);
                    if (!hoverPanel.hidden && hoverRowId === key) {
                        hoverPanel.hidden = true;
                        hoverRowId = "";
                        return;
                    }
                    var panelOpts =
                        typeof panelOptsForRow === "function" ? panelOptsForRow(row) || {} : {};
                    showHoverPanel(card, row, panelOpts);
                }
            });
        });
    }

    function buildMeta(it, opts) {
        var rows = [];
        var mode = opts.mode || "prospect";

        if (mode === "prospect") {
            rows.push(metaRow("시·구·군", opts.district));
            rows.push(metaRow("시설 형태", opts.facilityType || "예비"));
            rows.push(
                metaRow(
                    "안치능력",
                    it.vn_mortuary_count ? String(it.vn_mortuary_count) + "구" : ""
                )
            );
            rows.push(
                metaRow(
                    "빈소 정보",
                    it.vn_room_count ? String(it.vn_room_count) + "개" : ""
                )
            );
            rows.push(metaRow("전화번호", it.vn_phone));
        } else {
            rows.push(metaRow("사업부문", opts.deptLabel));
            rows.push(metaRow("등급", opts.gradeLabel));
            rows.push(
                metaRow(
                    "빈소 정보",
                    it.vn_room_count ? String(it.vn_room_count) + "개" : ""
                )
            );
            rows.push(metaRow("전화번호", it.vn_phone));
            rows.push(metaRow("담당", opts.registrar || it.loginId || ""));
        }
        return rows.join("");
    }

    function renderCard(it, opts) {
        opts = opts || {};
        if (opts.layout === "prospectBrowse") {
            return renderProspectBrowseCard(it, opts);
        }
        var name = String((it && it.vn_company) || "").trim() || "(업체명 없음)";
        var editHref = opts.editHref || "";
        var canWrite = opts.canWrite !== false;
        var badge = String(opts.badge || "").trim();
        var footActions = "";
        var checkHtml = "";
        var cardId = String(opts.cardId || opts.checkId || "").trim();
        var cardClass = "vpr-card";

        if (opts.showCheck) {
            var checked = !!opts.selected;
            var isRegistered = !!(opts.registeredVendor && opts.registeredVendor.id);
            if (checked) cardClass += " is-selected";
            if (isRegistered) cardClass += " vpr-card--registered";
            checkHtml =
                '<label class="vpr-card__check' +
                (isRegistered ? " vpr-card__check--disabled" : "") +
                '"><input type="checkbox" class="vpr-item-check" data-id="' +
                escapeAttr(opts.checkId || cardId) +
                '"' +
                (checked ? " checked" : "") +
                (isRegistered ? " disabled" : "") +
                "> 선택</label>";
        } else if (opts.showActions) {
            checkHtml =
                '<div class="vpr-card__check vpr-card__check--placeholder" aria-hidden="true"></div>';
        }

        if (opts.showActions) {
            cardClass += " vpr-card--list";
            footActions = '<div class="vpr-card__actions">';
            if (editHref) {
                footActions +=
                    '<a class="btn btn-secondary vpr-card__btn" href="' +
                    escapeAttr(editHref) +
                    '">수정</a>';
            }
            if (canWrite && opts.deleteId) {
                footActions +=
                    '<button type="button" class="btn vpr-card__btn vpr-card__btn--del" data-vl-delete="' +
                    escapeAttr(opts.deleteId) +
                    '" data-vl-name="' +
                    escapeAttr(name) +
                    '">삭제</button>';
            }
            footActions += "</div>";
        }

        var cardLink = !!(opts.cardLink && editHref && !opts.showActions);
        if (cardLink) {
            cardClass += " vpr-card--clickable";
        }

        var nameHtml =
            editHref && !cardLink
                ? '<h3 class="vpr-card__name"><a class="vpr-card__name-link" href="' +
                  escapeAttr(editHref) +
                  '">' +
                  escapeHtml(name) +
                  "</a></h3>"
                : '<h3 class="vpr-card__name">' + escapeHtml(name) + "</h3>";

        var registered = opts.registeredVendor || null;
        var imgWrapClass = registered ? " vpr-card__img-wrap--registered" : "";
        var registeredOverlay = "";
        if (registered) {
            var regLabel = "등록업체";
            var regTitle = String(registered.vn_company || name).trim();
            var regHref = registered.id
                ? "vendor-edit.html?id=" + encodeURIComponent(registered.id)
                : "";
            if (regHref) {
                registeredOverlay =
                    '<a class="vpr-card__registered-overlay" href="' +
                    escapeAttr(regHref) +
                    '" title="' +
                    escapeAttr(regTitle) +
                    '">' +
                    escapeHtml(regLabel) +
                    "</a>";
            } else {
                registeredOverlay =
                    '<span class="vpr-card__registered-overlay" title="' +
                    escapeAttr(regTitle) +
                    '">' +
                    escapeHtml(regLabel) +
                    "</span>";
            }
        }

        var overlayLink = cardLink
            ? '<a class="vpr-card__overlay-link" href="' +
              escapeAttr(opts.suppressNavHref ? "#" : editHref) +
              '" aria-label="' +
              escapeAttr(name) +
              ' 상세보기"></a>'
            : "";

        return (
            "<article" +
            (cardId ? ' data-id="' + escapeAttr(cardId) + '"' : "") +
            (cardLink ? ' data-href="' + escapeAttr(editHref) + '"' : "") +
            (cardLink ? ' tabindex="0" role="link"' : "") +
            ' class="' +
            cardClass +
            '">' +
            checkHtml +
            '<div class="vpr-card__img-wrap' +
            imgWrapClass +
            '">' +
            logoHtml(it, opts) +
            (badge ? '<span class="vpr-card__badge">' + escapeHtml(badge) + "</span>" : "") +
            registeredOverlay +
            "</div>" +
            '<div class="vpr-card__body">' +
            nameHtml +
            '<p class="vpr-card__addr">' +
            escapeHtml(it.vn_addr || "주소 미입력") +
            "</p>" +
            '<dl class="vpr-card__meta">' +
            buildMeta(it, opts) +
            "</dl>" +
            footActions +
            "</div>" +
            overlayLink +
            "</article>"
        );
    }

    function renderGrid(container, items, options) {
        if (!container) return;
        options = options || {};
        var gridClass = options.gridClass || "vpr-grid vpr-grid--cols3";
        if (!items || !items.length) {
            container.className = gridClass;
            container.innerHTML =
                options.emptyHtml ||
                '<p class="vpr-loading">표시할 업체가 없습니다.</p>';
            return;
        }
        container.className = gridClass;
        container.innerHTML = items
            .map(function (it) {
                var cardOpts =
                    typeof options.cardOptions === "function"
                        ? options.cardOptions(it) || {}
                        : Object.assign({}, options);
                if (options.layout && !cardOpts.layout) cardOpts.layout = options.layout;
                if (cardOpts.layout === "prospectBrowse") {
                    if (!cardOpts.cardId && it.id) cardOpts.cardId = String(it.id);
                    if (!cardOpts.checkId && it.fhi_id) cardOpts.checkId = String(it.fhi_id);
                }
                return renderCard(it, cardOpts);
            })
            .join("");
        if (options.layout === "prospectBrowse") {
            bindBrowseHover(
                container,
                function (id) {
                    var key = String(id || "");
                    for (var i = 0; i < items.length; i++) {
                        var row = items[i];
                        if (String(row.fhi_id || row.id) === key) return row;
                    }
                    return null;
                },
                options.hoverPanelOptions
            );
        }
        if (typeof options.onBind === "function") {
            options.onBind(container);
        }
    }

    global.THEJHON_VENDOR_LIST_CARDS = {
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        logoHtml: logoHtml,
        convenienceItems: convenienceItems,
        convenienceHtml: convenienceHtml,
        roomCountLabel: roomCountLabel,
        buildHoverPanelHtml: buildHoverPanelHtml,
        bindBrowseHover: bindBrowseHover,
        renderCard: renderCard,
        renderGrid: renderGrid
    };
})(typeof window !== "undefined" ? window : this);
