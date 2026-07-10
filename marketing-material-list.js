(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var MM = window.THEJHON_MARKETING_MATERIAL;
    if (!api || !Auth || !MM) return;
    if (!api.listMarketingMaterials) {
        var statusEarly = document.getElementById("mml-status");
        if (statusEarly) {
            statusEarly.textContent =
                "API 스크립트가 오래된 버전입니다. Ctrl+Shift+R(강력 새로고침) 후 다시 시도해 주세요.";
            statusEarly.className = "shub-status shub-status--err";
        }
        return;
    }

    var statusEl = document.getElementById("mml-status");
    var tbody = document.getElementById("mml-tbody");
    var previewModal = document.getElementById("mml-preview-modal");
    var previewImage = document.getElementById("mml-preview-image");
    var previewTitle = document.getElementById("mml-preview-title");

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (isErr ? " shub-status--err" : "");
    }

    function filesSummary(files) {
        var list = files || [];
        if (!list.length) return "없음";
        var visual = list.filter(function (f) {
            return MM.isVisualKind(MM.resolveFileKind(f));
        }).length;
        var docs = list.length - visual;
        if (visual && docs) {
            return "이미지·동영상 " + visual + " · 문서 " + docs;
        }
        if (visual === list.length) {
            return visual + "개 (이미지·동영상)";
        }
        return list.length + "개 (문서)";
    }

    function previewStripHtml(materialId, files) {
        if (!api.marketingMaterialFileUrl) return "";
        var visual = (files || [])
            .map(function (f, idx) {
                return { file: f, idx: idx };
            })
            .filter(function (row) {
                return MM.isVisualKind(MM.resolveFileKind(row.file));
            });
        if (!visual.length) return "";
        var items = visual
            .map(function (row) {
                var kind = MM.resolveFileKind(row.file);
                var url = api.marketingMaterialFileUrl(materialId, row.idx, { inline: true });
                var previewHtml = MM.visualPreviewHtml(kind, url, row.file.filename, true, kind === "image");
                return (
                    '<div class="mm-preview-strip__item">' +
                    previewHtml +
                    '<span class="mm-preview-strip__label">' +
                    MM.escapeHtml(row.file.filename) +
                    "</span></div>"
                );
            })
            .join("");
        return '<div class="mm-preview-strip mm-preview-strip--row">' + items + "</div>";
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
                var previewHtml = previewStripHtml(it.id, files);
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
                var textRow =
                    '<tr class="mm-table__text-row">' +
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
                    "</tr>";
                var previewRow = previewHtml
                    ? '<tr class="mm-table__preview-row"><td colspan="6">' + previewHtml + "</td></tr>"
                    : "";
                return textRow + previewRow;
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

    function openPreview(url, filename) {
        if (!previewModal || !previewImage) return;
        previewImage.src = url;
        previewImage.alt = filename || "미리보기";
        if (previewTitle) previewTitle.textContent = filename || "이미지 미리보기";
        previewModal.hidden = false;
        document.body.classList.add("mm-preview-modal-open");
    }

    function closePreview() {
        if (!previewModal || !previewImage) return;
        previewModal.hidden = true;
        previewImage.removeAttribute("src");
        previewImage.alt = "";
        if (previewTitle) previewTitle.textContent = "";
        document.body.classList.remove("mm-preview-modal-open");
    }

    if (!Auth.getOrderManageHubAccess || !Auth.getOrderManageHubAccess().allowed) {
        setStatus("이용 권한이 없습니다.", true);
        return;
    }
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    if (tbody) {
        tbody.addEventListener("click", function (ev) {
            var previewImg = ev.target.closest(".mml-preview-image");
            if (previewImg && previewImg.src) {
                openPreview(previewImg.src, previewImg.title || previewImg.alt || "");
                return;
            }
            var delBtn = ev.target.closest(".mml-delete");
            if (delBtn) {
                onDelete(delBtn.getAttribute("data-id"));
                return;
            }
            var dlBtn = ev.target.closest(".mml-download");
            if (dlBtn) {
                onDownload(
                    dlBtn.getAttribute("data-id"),
                    dlBtn.getAttribute("data-idx"),
                    dlBtn.getAttribute("data-name")
                );
            }
        });
    }

    if (previewModal) {
        previewModal.querySelectorAll("[data-mml-preview-close]").forEach(function (el) {
            el.addEventListener("click", closePreview);
        });
    }
    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && previewModal && !previewModal.hidden) {
            closePreview();
        }
    });

    loadList();
})();
