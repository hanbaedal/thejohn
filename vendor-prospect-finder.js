(function () {
    var api = window.THEJHON_API;
    var statusEl = document.getElementById("vpf-status");
    var cardsEl = document.getElementById("vpf-region-cards");
    var detailEl = document.getElementById("vpf-detail");
    var params = new URLSearchParams(window.location.search || "");

    var regions = [];
    var activeSlug = "";
    var detailPanel = null;

    var DETAIL_IDS = {
        title: "vpf-detail-title",
        subtitle: "vpf-detail-subtitle",
        status: "vpf-detail-status",
        count: "vpf-detail-count",
        districts: "vpf-detail-districts",
        grid: "vpf-detail-grid",
        checkAll: "vpf-detail-check-all",
        refreshBtn: "vpf-detail-refresh-btn",
        importBtn: "vpf-detail-import-btn",
        result: "vpf-detail-result",
        saveModal: "vpf-save-modal",
        saveModalOk: "vpf-save-modal-ok"
    };

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

    function syncCardActiveState() {
        if (!cardsEl) return;
        cardsEl.querySelectorAll(".vpr-region-card").forEach(function (card) {
            var slug = card.getAttribute("data-slug") || "";
            card.classList.toggle("is-active", slug === activeSlug);
            card.setAttribute("aria-expanded", slug === activeSlug ? "true" : "false");
        });
    }

    function renderCards(list) {
        if (!cardsEl) return;
        if (!list || !list.length) {
            cardsEl.innerHTML = '<p class="vei-hint">표시할 지역 정보가 없습니다.</p>';
            return;
        }
        cardsEl.innerHTML = list
            .map(function (r) {
                var count = r.count || 0;
                var slug = r.slug || r.id || "";
                return (
                    '<button type="button" class="vpr-region-card" data-slug="' +
                    escapeAttr(slug) +
                    '" aria-expanded="false">' +
                    '<div class="vpr-region-card__head">' +
                    '<div class="vpr-region-card__title-wrap">' +
                    '<span class="vpr-region-card__icon" aria-hidden="true">' +
                    escapeHtml(r.icon || "🏢") +
                    "</span>" +
                    "<div>" +
                    '<p class="vpr-region-card__label">' +
                    escapeHtml(r.label) +
                    "</p>" +
                    '<p class="vpr-region-card__sub">' +
                    escapeHtml(r.sub) +
                    "</p>" +
                    "</div></div>" +
                    '<div class="vpr-region-card__count">' +
                    '<div class="vpr-region-card__count-num">' +
                    count +
                    '</div><div class="vpr-region-card__count-unit">개소</div></div></div>' +
                    '<div class="vpr-region-card__foot"><span>상세 정보 보기</span><span aria-hidden="true">→</span></div>' +
                    "</button>"
                );
            })
            .join("");

        cardsEl.querySelectorAll(".vpr-region-card").forEach(function (card) {
            card.addEventListener("click", function () {
                openRegion(card.getAttribute("data-slug") || "");
            });
        });
        syncCardActiveState();
    }

    function ensureDetailPanel() {
        if (detailPanel) return detailPanel;
        if (!window.THEJHON_VENDOR_PROSPECT_REGION || !THEJHON_VENDOR_PROSPECT_REGION.init) {
            return null;
        }
        detailPanel = THEJHON_VENDOR_PROSPECT_REGION.init({
            ids: DETAIL_IDS,
            region: activeSlug || "서울"
        });
        return detailPanel;
    }

    function openRegion(slug) {
        if (!slug) return;
        activeSlug = slug;
        syncCardActiveState();

        if (detailEl) {
            detailEl.hidden = false;
        }
        document.body.classList.add("vpf-detail-open");

        var panel = ensureDetailPanel();
        if (!panel) {
            setStatus("상세 목록 모듈을 불러오지 못했습니다.", "error");
            return;
        }
        panel.setRegion(slug);
        panel.load(false).then(function () {
            if (detailEl) {
                detailEl.scrollTop = 0;
            }
        });
    }

    function loadRegions() {
        if (!api || !api.getFhiRegions) {
            setStatus("API를 불러오지 못했습니다.", "error");
            return;
        }
        setStatus("지역 정보 불러오는 중…");
        api.getFhiRegions()
            .then(function (list) {
                regions = list || [];
                renderCards(regions);
                setStatus("", "ok");
                var initial = params.get("region") || "";
                if (initial) {
                    openRegion(initial);
                }
            })
            .catch(function (err) {
                if (cardsEl) cardsEl.innerHTML = "";
                setStatus(err.message || "지역 정보를 불러오지 못했습니다.", "error");
            });
    }

    function bindBackfillButton() {
        var btn = document.getElementById("vpf-backfill-logos-btn");
        if (!btn || !api || !api.backfillVendorFhiLogos) return;
        btn.addEventListener("click", function () {
            if (
                !window.confirm(
                    "로고(이미지)가 없는 사업부문 업체를 funeralhallinfo 데이터와 비교해 이미지를 저장합니다.\n\n계속할까요?"
                )
            ) {
                return;
            }
            btn.disabled = true;
            setStatus("업체 이미지 보강 중… (수도권 FHI 목록과 비교)");
            api.backfillVendorFhiLogos({ dryRun: false })
                .then(function (res) {
                    var msg =
                        "완료 — 대상 " +
                        (res.total || 0) +
                        "건 · 업데이트 " +
                        (res.updated || 0) +
                        "건 · 매칭 없음 " +
                        (res.skipped || 0) +
                        "건";
                    if (res.failed) msg += " · 실패 " + res.failed + "건";
                    setStatus(msg, "ok");
                    if (detailPanel && activeSlug) {
                        detailPanel.load(true);
                    }
                })
                .catch(function (err) {
                    setStatus((err && err.message) || "이미지 보강에 실패했습니다.", "error");
                })
                .finally(function () {
                    btn.disabled = false;
                });
        });
    }

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getProspectFinderAccess
            ? THEJHON_AUTH.getProspectFinderAccess()
            : { allowed: false };
    if (!access.allowed) {
        setStatus(access.reason || "접근 권한이 없습니다.", "error");
    } else {
        bindBackfillButton();
        loadRegions();
    }
})();
