(function () {
    var api = window.THEJHON_API;
    var CARDS = window.THEJHON_VENDOR_LIST_CARDS;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("sp-partners-root");
    var DETAIL_HREF = "support-partner-detail.html";

    var GRADE_NAMES = { 1: "Silver", 2: "Gold", 3: "Diamond" };

    function detailHref(id) {
        return DETAIL_HREF + "?id=" + encodeURIComponent(String(id || ""));
    }

    function normalizeVendorDeptId(id) {
        var n = String(id || "").trim().toLowerCase();
        if (n === "uncontracted" || n === "미계약") return "uncontracted";
        return catalog ? catalog.normalizeDept(id) : n;
    }

    function vendorDeptIds(it) {
        var raw = it && it.vn_depts;
        if (!Array.isArray(raw)) return [];
        return raw.map(function (id) {
            return normalizeVendorDeptId(id);
        });
    }

    function vendorDeptLabels(it) {
        var ids = vendorDeptIds(it);
        var labels = [];
        for (var i = 0; i < ids.length; i++) {
            if (!ids[i]) continue;
            var lbl = PF && PF.deptLabel ? PF.deptLabel(catalog, ids[i]) : ids[i];
            if (lbl && labels.indexOf(lbl) < 0) labels.push(lbl);
        }
        return labels.join(", ");
    }

    function gradeLabel(it) {
        var n = parseInt(it && it.vn_grade, 10);
        if (n === 4) n = 3;
        if (n >= 1 && n <= 3) return GRADE_NAMES[n];
        return GRADE_NAMES[1];
    }

    function isPartnerVendor(it) {
        return (
            String((it && it.vn_record_type) || "partner")
                .trim()
                .toLowerCase() !== "new"
        );
    }

    function bindPartnerCardClicks() {
        if (!root) return;
        root.querySelectorAll(".vpr-card--clickable").forEach(function (card) {
            if (card.getAttribute("data-sp-card-bound") === "1") return;
            card.setAttribute("data-sp-card-bound", "1");
            card.addEventListener("click", function (e) {
                var href =
                    card.getAttribute("data-href") ||
                    (card.querySelector(".vpr-card__overlay-link") &&
                        card.querySelector(".vpr-card__overlay-link").getAttribute("href"));
                if (!href) return;
                window.location.href = href;
            });
            card.addEventListener("keydown", function (e) {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                var href = card.getAttribute("data-href");
                if (href) window.location.href = href;
            });
        });
    }

    function render(items) {
        if (!CARDS || !root) return;
        var vendors = (items || [])
            .filter(function (it) {
                return it && it.id && isPartnerVendor(it);
            })
            .slice()
            .sort(function (a, b) {
                return String(a.vn_company || "").localeCompare(String(b.vn_company || ""), "ko");
            });

        CARDS.renderGrid(root, vendors, {
            gridClass: "vpr-grid vpr-grid--cols3",
            emptyHtml:
                '<p class="sp-partners-empty">등록된 업체가 없습니다. <a href="vendor-register.html">업체등록</a>에서 정보를 등록하면 이곳에 표시됩니다.</p>',
            cardOptions: function (it) {
                return {
                    mode: "partner",
                    badge: gradeLabel(it),
                    gradeLabel: gradeLabel(it),
                    deptLabel: vendorDeptLabels(it) || "미지정",
                    registrar: it.vn_mgr_name || "",
                    editHref: detailHref(it.id),
                    cardLink: true,
                    showActions: false
                };
            },
            onBind: bindPartnerCardClicks
        });
    }

    function load() {
        if (!root) return;
        if (!api || !api.listVendors) {
            root.innerHTML = '<p class="sp-partners-empty">업체 목록을 불러올 수 없습니다.</p>';
            return;
        }
        root.className = "vpr-grid vpr-grid--cols3";
        root.innerHTML = '<p class="vpr-loading">불러오는 중…</p>';
        api.listVendors()
            .then(render)
            .catch(function () {
                root.className = "";
                root.innerHTML =
                    '<p class="sp-partners-empty">업체 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
            });
    }

    load();
})();
