(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var MM = window.THEJHON_MARKETING_MATERIAL;
    if (!api || !Auth || !MM) return;

    var statusEl = document.getElementById("mml-status");
    var tbody = document.getElementById("mml-tbody");

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (isErr ? " shub-status--err" : "");
    }

    function filesSummary(files) {
        var list = files || [];
        if (!list.length) return "없음";
        if (list.length === 1) {
            return MM.kindLabel(list[0].kind) + " · " + list[0].filename;
        }
        return list.length + "개 (" + MM.kindLabel(list[0].kind) + " 외)";
    }

    function renderRows(items) {
        if (!tbody) return;
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="mm-empty">등록된 자료가 없습니다.</td></tr>';
            return;
        }
        tbody.innerHTML = items
            .map(function (it) {
                var files = it.mm_files || [];
                var downloadBtns = files
                    .map(function (f, idx) {
                        return (
                            '<button type="button" class="sp-btn sp-btn--secondary mml-download" data-id="' +
                            MM.escapeHtml(it.id) +
                            '" data-idx="' +
                            idx +
                            '" data-name="' +
                            MM.escapeHtml(f.filename) +
                            '">다운로드' +
                            (files.length > 1 ? " " + (idx + 1) : "") +
                            "</button>"
                        );
                    })
                    .join("");
                return (
                    "<tr>" +
                    "<td>" +
                    MM.escapeHtml(MM.formatDateKo(it.createdAt)) +
                    "</td>" +
                    "<td>" +
                    MM.escapeHtml(it.mm_title) +
                    "</td>" +
                    "<td>" +
                    MM.escapeHtml(it.mm_category || "—") +
                    "</td>" +
                    "<td>" +
                    MM.escapeHtml(filesSummary(files)) +
                    "</td>" +
                    "<td>" +
                    MM.escapeHtml(MM.formatDateKo(it.expireAt)) +
                    "</td>" +
                    '<td><div class="mm-table__actions">' +
                    '<a class="sp-btn sp-btn--secondary" href="marketing-material-register.html?id=' +
                    encodeURIComponent(it.id) +
                    '">수정</a>' +
                    '<button type="button" class="sp-btn sp-btn--danger mml-delete" data-id="' +
                    MM.escapeHtml(it.id) +
                    '">삭제</button>' +
                    downloadBtns +
                    "</div></td>" +
                    "</tr>"
                );
            })
            .join("");
    }

    function loadList() {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="mm-empty">불러오는 중…</td></tr>';
        }
        return api
            .listMarketingMaterials()
            .then(function (items) {
                renderRows(items || []);
                setStatus((items || []).length ? "" : "");
            })
            .catch(function (err) {
                if (tbody) {
                    tbody.innerHTML =
                        '<tr><td colspan="6" class="mm-empty">목록을 불러오지 못했습니다.</td></tr>';
                }
                setStatus((err && err.message) || "목록을 불러오지 못했습니다.", true);
            });
    }

    function onDelete(id) {
        if (!window.confirm("이 마케팅 자료를 삭제할까요?")) return;
        setStatus("삭제 중…");
        api
            .deleteMarketingMaterial(id)
            .then(function () {
                setStatus("삭제했습니다.");
                return loadList();
            })
            .catch(function (err) {
                setStatus((err && err.message) || "삭제에 실패했습니다.", true);
            });
    }

    function onDownload(id, idx, filename) {
        setStatus("다운로드 준비 중…");
        api
            .fetchMarketingMaterialFileBlob(id, idx)
            .then(function (blob) {
                MM.triggerDownload(blob, filename);
                setStatus("");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "다운로드에 실패했습니다.", true);
            });
    }

    if (!Auth.getOrderManageHubAccess || !Auth.getOrderManageHubAccess().allowed) {
        setStatus("이용 권한이 없습니다.", true);
        return;
    }
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    if (tbody) {
        tbody.addEventListener("click", function (ev) {
            var delBtn = ev.target.closest(".mml-delete");
            if (delBtn) {
                onDelete(delBtn.getAttribute("data-id"));
                return;
            }
            var dlBtn = ev.target.closest(".mml-download");
            if (dlBtn) {
                onDownload(dlBtn.getAttribute("data-id"), dlBtn.getAttribute("data-idx"), dlBtn.getAttribute("data-name"));
            }
        });
    }

    loadList();
})();
