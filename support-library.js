(function () {
    var api = window.THEJHON_API;
    var SN = window.THEJHON_SUPPORT_NEWS;
    if (!api || !SN) return;

    var listEl = document.getElementById("sl-list");
    var filterBtn = document.getElementById("sl-filter-dept");
    var deptHidden = document.getElementById("sl-dept");
    var detailModal = document.getElementById("sl-detail-modal");
    var detailBody = document.getElementById("sl-detail-body");
    var detailTitle = document.getElementById("sl-detail-title");
    var items = [];

    if (!listEl) return;

    var deptPicker = SN.initDeptModalPicker({
        displayInput: filterBtn,
        hiddenInput: deptHidden,
        modal: document.getElementById("sn-dept-modal"),
        modalBtns: document.getElementById("sn-dept-modal-btns"),
        includeAll: true,
        openOnHover: false,
        onSelect: function () {
            loadList();
        }
    });

    function previewText(body) {
        var t = String(body || "").trim();
        if (!t) return "내용 없음";
        return t.length > 56 ? t.slice(0, 56) + "…" : t;
    }

    function renderList(rows) {
        if (!rows.length) {
            listEl.innerHTML = '<li class="sp-empty" style="list-style:none">등록된 소식이 없습니다.</li>';
            return;
        }
        listEl.innerHTML = rows
            .map(function (it, index) {
                var meta = SN.formatDateKo(it.updatedAt || it.createdAt);
                var photoHint =
                    it.sn_images && it.sn_images.length
                        ? " · 사진 " + it.sn_images.length + "장"
                        : "";
                return (
                    '<li><button type="button" class="sn-news-row" data-index="' +
                    index +
                    '">' +
                    '<span class="sn-news-row__main">' +
                    '<span class="sn-news-row__dept">' +
                    SN.escapeHtml(SN.deptLabel(it.sn_dept)) +
                    "</span>" +
                    '<span class="sn-news-row__meta">' +
                    SN.escapeHtml(meta + photoHint) +
                    "</span>" +
                    '<span class="sn-news-row__preview">' +
                    SN.escapeHtml(previewText(it.sn_body)) +
                    "</span>" +
                    "</span>" +
                    '<span class="sn-list-chevron" aria-hidden="true">›</span>' +
                    "</button></li>"
                );
            })
            .join("");
    }

    function openDetail(it) {
        if (!detailModal || !detailBody) return;
        var title = SN.deptLabel(it.sn_dept);
        if (detailTitle) detailTitle.textContent = title;
        detailBody.innerHTML =
            '<span class="sn-detail-dept">' +
            SN.escapeHtml(title) +
            "</span>" +
            '<p class="sn-detail-meta">' +
            SN.escapeHtml(SN.formatDateKo(it.updatedAt || it.createdAt)) +
            (it.sn_created_by_name
                ? " · " + SN.escapeHtml(it.sn_created_by_name)
                : "") +
            "</p>" +
            SN.imagesHtml(it.sn_images) +
            '<p class="sn-detail-body">' +
            SN.escapeMultiline(String(it.sn_body || "")) +
            "</p>";
        detailModal.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeDetail() {
        if (!detailModal) return;
        detailModal.hidden = true;
        document.body.style.overflow = "";
        if (detailBody) detailBody.innerHTML = "";
    }

    function loadList() {
        listEl.innerHTML = '<li class="sp-empty" style="list-style:none">불러오는 중…</li>';
        var dept = deptPicker.getValue();
        var opts = dept ? { dept: dept } : undefined;
        api.listSupportNews(opts)
            .then(function (rows) {
                items = rows || [];
                renderList(items);
            })
            .catch(function () {
                listEl.innerHTML =
                    '<li class="sp-empty" style="list-style:none">소식을 불러오지 못했습니다.</li>';
            });
    }

    listEl.addEventListener("click", function (e) {
        var btn = e.target.closest(".sn-news-row");
        if (!btn) return;
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        if (Number.isFinite(idx) && items[idx]) openDetail(items[idx]);
    });

    var detailClose = document.getElementById("sl-detail-close");
    if (detailClose) detailClose.addEventListener("click", closeDetail);
    if (detailModal) {
        detailModal.addEventListener("click", function (e) {
            if (e.target === detailModal) closeDetail();
        });
    }
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && detailModal && !detailModal.hidden) closeDetail();
    });

    loadList();
})();
