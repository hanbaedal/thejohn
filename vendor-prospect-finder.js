(function () {
    var api = window.THEJHON_API;
    var statusEl = document.getElementById("vpf-status");
    var cardsEl = document.getElementById("vpf-region-cards");

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

    function renderCards(regions) {
        if (!cardsEl) return;
        if (!regions || !regions.length) {
            cardsEl.innerHTML = '<p class="vei-hint">표시할 지역 정보가 없습니다.</p>';
            return;
        }
        cardsEl.innerHTML = regions
            .map(function (r) {
                var count = r.count || 0;
                return (
                    '<a class="vpr-region-card" href="vendor-prospect-region.html?region=' +
                    encodeURIComponent(r.slug || r.id) +
                    '">' +
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
                    '<ul class="vpr-region-card__features">' +
                    "<li>📊 총 " +
                    count +
                    "개 장례식장 운영</li>" +
                    "<li>📍 시설 위치 및 정보 제공</li>" +
                    "<li>💰 이용 요금 정보 공개</li>" +
                    "</ul>" +
                    '<div class="vpr-region-card__foot"><span>상세 정보 보기</span><span aria-hidden="true">→</span></div>' +
                    "</a>"
                );
            })
            .join("");
    }

    function load() {
        if (!api || !api.getFhiRegions) {
            setStatus("API를 불러오지 못했습니다.", "error");
            return;
        }
        setStatus("지역 정보 불러오는 중…");
        api.getFhiRegions()
            .then(function (regions) {
                renderCards(regions);
                setStatus("", "ok");
            })
            .catch(function (err) {
                if (cardsEl) cardsEl.innerHTML = "";
                setStatus(err.message || "지역 정보를 불러오지 못했습니다.", "error");
            });
    }

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getProspectFinderAccess
            ? THEJHON_AUTH.getProspectFinderAccess()
            : { allowed: false };
    if (!access.allowed) {
        setStatus(access.reason || "접근 권한이 없습니다.", "error");
    } else {
        load();
    }
})();
