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
    var previewUrls = [];

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (isErr ? " shub-status--err" : "");
    }

    function clearPreviewUrls() {
        previewUrls.forEach(function (url) {
            MM.revokeObjectUrl(url);
        });
        previewUrls = [];
    }

    function filesSummary(files) {
        var list = files || [];
        if (!list.length) return "없음";
        var visual = list.filter(function (f) {
            return MM.isVisualKind(f.kind);
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
        var visual = (files || []).filter(function (f) {
            return MM.isVisualKind(f.kind);
        });
        if (!visual.length) {
            return "";
        }
        return (
            '<div class="mm-preview-strip" data-preview-strip="' +
            MM.escapeHtml(materialId) +
            '"><span class="mm-preview-strip__loading">미리보기 로딩…</span></div>'
        );
    }

    function renderRows(items) {
        if (!tbody) return;
        clearPreviewUrls();
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
                    '<td class="mm-table__date">' +
                    '<div class="mm-table__date-text">' +
                    MM.escapeHtml(MM.formatDateKo(it.createdAt)) +
                    "</div>" +
                    previewStripHtml(it.id, files) +
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
        loadRowPreviews(items);
    }

    function loadRowPreviews(items) {
        (items || []).forEach(function (it) {
            var strip = tbody.querySelector('[data-preview-strip="' + it.id + '"]');
            if (!strip) return;
            var visualFiles = (it.mm_files || [])
                .map(function (f, idx) {
                    return { file: f, idx: idx };
                })
                .filter(function (row) {
                    return MM.isVisualKind(row.file.kind);
                });
            if (!visualFiles.length) {
                strip.remove();
                return;
            }
            strip.innerHTML = "";
            visualFiles.forEach(function (row) {
                var wrap = document.createElement("div");
                wrap.className = "mm-preview-strip__item";
                wrap.innerHTML =
                    '<span class="mm-preview-strip__loading">…</span>' +
                    '<span class="mm-preview-strip__label">' +
                    MM.escapeHtml(row.file.filename) +
                    "</span>";
                strip.appendChild(wrap);
                api.fetchMarketingMaterialFileBlob(it.id, row.idx)
                    .then(function (blob) {
                        var url = URL.createObjectURL(blob);
                        previewUrls.push(url);
                        wrap.innerHTML =
                            '<span class="mm-preview-strip__label">' +
                            MM.escapeHtml(row.file.filename) +
                            "</span>";
                        var slot = document.createElement("div");
                        wrap.insertBefore(slot, wrap.firstChild);
                        var el = MM.mountVisualPreview(slot, row.file.kind, url, row.file.filename);
                        if (el) {
                            el.classList.add("mm-preview-thumb");
                            if (row.file.kind === "video") {
                                el.classList.add("mm-preview-thumb--video");
                            }
                        }
                    })
                    .catch(function () {
                        wrap.innerHTML =
                            MM.previewPlaceholderHtml(row.file.kind, "로드 실패") +
                            '<span class="mm-preview-strip__label">' +
                            MM.escapeHtml(row.file.filename) +
                            "</span>";
                    });
            });
        });
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
                onDownload(
                    dlBtn.getAttribute("data-id"),
                    dlBtn.getAttribute("data-idx"),
                    dlBtn.getAttribute("data-name")
                );
            }
        });
    }

    window.addEventListener("pagehide", clearPreviewUrls);

    loadList();
})();
