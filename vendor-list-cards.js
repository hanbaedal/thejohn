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

    function logoHtml(it) {
        var src = String((it && it.vn_logo) || "").trim();
        if (!src) {
            return '<div class="vpr-card__img vpr-card__img--empty"></div>';
        }
        return (
            '<img class="vpr-card__img" src="' +
            escapeAttr(src) +
            '" alt="' +
            escapeAttr(it.vn_company || "") +
            '" loading="lazy">'
        );
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
            if (it.loginId) rows.push(metaRow("아이디", it.loginId));
            if (opts.registrar) rows.push(metaRow("담당", opts.registrar));
        }
        return rows.join("");
    }

    function renderCard(it, opts) {
        opts = opts || {};
        var name = String((it && it.vn_company) || "").trim() || "(업체명 없음)";
        var editHref = opts.editHref || "";
        var canWrite = opts.canWrite !== false;
        var badge = String(opts.badge || "").trim();
        var footActions = "";

        if (opts.showActions) {
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

        var nameHtml = editHref
            ? '<h3 class="vpr-card__name"><a class="vpr-card__name-link" href="' +
              escapeAttr(editHref) +
              '">' +
              escapeHtml(name) +
              "</a></h3>"
            : '<h3 class="vpr-card__name">' + escapeHtml(name) + "</h3>";

        return (
            '<article class="vpr-card vpr-card--list">' +
            '<div class="vpr-card__img-wrap">' +
            logoHtml(it) +
            (badge ? '<span class="vpr-card__badge">' + escapeHtml(badge) + "</span>" : "") +
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
            "</div></article>"
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
                        : options;
                return renderCard(it, cardOpts);
            })
            .join("");
        if (typeof options.onBind === "function") {
            options.onBind(container);
        }
    }

    global.THEJHON_VENDOR_LIST_CARDS = {
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        renderCard: renderCard,
        renderGrid: renderGrid
    };
})(typeof window !== "undefined" ? window : this);
