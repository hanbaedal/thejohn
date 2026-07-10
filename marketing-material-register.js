(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var MM = window.THEJHON_MARKETING_MATERIAL;
    if (!api || !Auth || !MM) return;
    if (!api.createMarketingMaterial || !api.updateMarketingMaterial) {
        var statusEarly = document.getElementById("mmr-status");
        if (statusEarly) {
            statusEarly.textContent =
                "API 스크립트가 오래된 버전입니다. Ctrl+Shift+R(강력 새로고침) 후 다시 시도해 주세요.";
            statusEarly.className = "shub-status shub-status--err";
        }
        return;
    }

    var statusEl = document.getElementById("mmr-status");
    var form = document.getElementById("mmr-form");
    var titleHeading = document.getElementById("mmr-title");
    var editIdInput = document.getElementById("mmr-edit-id");
    var titleInput = document.getElementById("mmr-title-input");
    var categoryInput = document.getElementById("mmr-category");
    var descriptionInput = document.getElementById("mmr-description");
    var fileInput = document.getElementById("mmr-file-input");
    var pickBtn = document.getElementById("mmr-pick-files");
    var fileListEl = document.getElementById("mmr-file-list");
    var submitBtn = document.getElementById("mmr-submit");
    var saving = false;

    var keptFiles = [];
    var newFiles = [];
    var editMaterialId = "";

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (isErr ? " shub-status--err" : "");
    }

    function revokeNewFileUrls() {
        newFiles.forEach(function (entry) {
            MM.revokeObjectUrl(entry.previewUrl);
            entry.previewUrl = "";
        });
    }

    function totalBytes() {
        var total = 0;
        keptFiles.forEach(function (f) {
            total += Number(f.size) || 0;
        });
        newFiles.forEach(function (f) {
            total += Number(f.file.size) || 0;
        });
        return total;
    }

    function previewSlotHtml(kind) {
        if (MM.isVisualKind(kind)) {
            return '<div class="mm-file-item__preview-slot" data-preview-slot></div>';
        }
        return (
            '<div class="mm-file-item__preview-slot">' + MM.previewPlaceholderHtml(kind, "문서") + "</div>"
        );
    }

    function renderFileList() {
        if (!fileListEl) return;
        var items = keptFiles
            .map(function (f, idx) {
                return (
                    '<li class="mm-file-item" data-kind="kept" data-id="' +
                    MM.escapeHtml(f.id) +
                    '" data-file-idx="' +
                    idx +
                    '" data-file-kind="' +
                    MM.escapeHtml(f.kind) +
                    '">' +
                    '<div class="mm-file-item__body">' +
                    '<div class="mm-file-item__meta">' +
                    '<p class="mm-file-item__name">' +
                    MM.escapeHtml(f.filename) +
                    "</p>" +
                    '<p class="mm-file-item__sub">' +
                    MM.escapeHtml(MM.kindLabel(f.kind)) +
                    " · " +
                    MM.escapeHtml(MM.formatBytes(f.size)) +
                    " · 기존 파일</p>" +
                    "</div>" +
                    previewSlotHtml(f.kind) +
                    "</div>" +
                    '<button type="button" class="sp-btn sp-btn--danger mmr-remove-kept">제거</button>' +
                    "</li>"
                );
            })
            .concat(
                newFiles.map(function (entry, idx) {
                    var f = entry.file;
                    var ext = MM.fileExt(f.name);
                    var kind = MM.fileKind(ext);
                    return (
                        '<li class="mm-file-item" data-kind="new" data-idx="' +
                        idx +
                        '" data-file-kind="' +
                        MM.escapeHtml(kind) +
                        '">' +
                        '<div class="mm-file-item__body">' +
                        '<div class="mm-file-item__meta">' +
                        '<p class="mm-file-item__name">' +
                        MM.escapeHtml(f.name) +
                        "</p>" +
                        '<p class="mm-file-item__sub">' +
                        MM.escapeHtml(MM.kindLabel(kind)) +
                        " · " +
                        MM.escapeHtml(MM.formatBytes(f.size)) +
                        " · 새 파일</p>" +
                        "</div>" +
                        previewSlotHtml(kind) +
                        "</div>" +
                        '<button type="button" class="sp-btn sp-btn--danger mmr-remove-new">제거</button>' +
                        "</li>"
                    );
                })
            );
        fileListEl.innerHTML = items.length
            ? items.join("")
            : '<li class="mm-empty" style="list-style:none">첨부된 파일이 없습니다.</li>';
        mountNewFilePreviews();
        if (editMaterialId) mountKeptFilePreviews(editMaterialId);
    }

    function mountNewFilePreviews() {
        if (!fileListEl) return;
        fileListEl.querySelectorAll('.mm-file-item[data-kind="new"]').forEach(function (row) {
            var idx = Number(row.getAttribute("data-idx"));
            var entry = newFiles[idx];
            if (!entry || !entry.file) return;
            var kind = row.getAttribute("data-file-kind");
            var slot = row.querySelector("[data-preview-slot]");
            if (!slot || !MM.isVisualKind(kind)) return;
            if (!entry.previewUrl) {
                entry.previewUrl = URL.createObjectURL(entry.file);
            }
            MM.mountVisualPreview(slot, kind, entry.previewUrl, entry.file.name);
        });
    }

    function mountKeptFilePreviews(materialId) {
        if (!fileListEl || !materialId) return;
        fileListEl.querySelectorAll('.mm-file-item[data-kind="kept"]').forEach(function (row) {
            var kind = row.getAttribute("data-file-kind");
            var slot = row.querySelector("[data-preview-slot]");
            var fileIdx = Number(row.getAttribute("data-file-idx"));
            var file = keptFiles[fileIdx];
            if (!slot || !file || !MM.isVisualKind(kind)) return;
            slot.innerHTML = '<span class="mm-preview-strip__loading">미리보기 로딩…</span>';
            api.fetchMarketingMaterialFileBlob(materialId, fileIdx)
                .then(function (blob) {
                    var url = URL.createObjectURL(blob);
                    row.setAttribute("data-preview-url", url);
                    MM.mountVisualPreview(slot, kind, url, file.filename);
                })
                .catch(function () {
                    slot.innerHTML = MM.previewPlaceholderHtml(kind, "미리보기 실패");
                });
        });
    }

    function revokeKeptPreviewUrls() {
        if (!fileListEl) return;
        fileListEl.querySelectorAll('.mm-file-item[data-kind="kept"][data-preview-url]').forEach(function (row) {
            MM.revokeObjectUrl(row.getAttribute("data-preview-url"));
            row.removeAttribute("data-preview-url");
        });
    }

    function addFiles(fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (keptFiles.length + newFiles.length >= MM.MAX_FILES) {
                setStatus("파일은 최대 " + MM.MAX_FILES + "개까지 등록할 수 있습니다.", true);
                break;
            }
            var err = MM.validateFile(file);
            if (err) {
                setStatus(err, true);
                continue;
            }
            if (totalBytes() + file.size > MM.MAX_TOTAL_BYTES) {
                setStatus("첨부 총 용량은 50MB 이하로 제한됩니다.", true);
                break;
            }
            newFiles.push({ file: file, previewUrl: "" });
        }
        renderFileList();
    }

    function loadForEdit(id) {
        editMaterialId = id;
        setStatus("불러오는 중…");
        return api
            .getMarketingMaterial(id)
            .then(function (item) {
                if (!item) throw new Error("자료를 찾을 수 없습니다.");
                if (editIdInput) editIdInput.value = item.id;
                if (titleInput) titleInput.value = item.mm_title || "";
                if (categoryInput) categoryInput.value = item.mm_category || "";
                if (descriptionInput) descriptionInput.value = item.mm_description || "";
                keptFiles = (item.mm_files || []).slice();
                revokeNewFileUrls();
                newFiles = [];
                renderFileList();
                if (titleHeading) titleHeading.textContent = "마케팅 자료 수정";
                if (submitBtn) submitBtn.textContent = "저장";
                setStatus("삭제 예정: " + MM.formatExpireKo(item.expireAt));
            })
            .catch(function (err) {
                setStatus((err && err.message) || "자료를 불러오지 못했습니다.", true);
            });
    }

    function buildPayload() {
        return Promise.all(
            newFiles.map(function (entry) {
                return MM.fileToBase64(entry.file).then(function (contentBase64) {
                    return {
                        filename: entry.file.name,
                        contentBase64: contentBase64
                    };
                });
            })
        ).then(function (uploads) {
            var body = {
                mm_title: titleInput ? titleInput.value.trim() : "",
                mm_category: categoryInput ? categoryInput.value.trim() : "",
                mm_description: descriptionInput ? descriptionInput.value.trim() : "",
                mm_uploads: uploads
            };
            if (editIdInput && editIdInput.value) {
                body.mm_keep_file_ids = keptFiles.map(function (f) {
                    return f.id;
                });
            }
            return body;
        });
    }

    function onSubmit(ev) {
        ev.preventDefault();
        if (saving) return;
        if (!titleInput || !titleInput.value.trim()) {
            setStatus("제목을 입력해 주세요.", true);
            return;
        }
        if (!keptFiles.length && !newFiles.length) {
            setStatus("파일을 1개 이상 첨부해 주세요.", true);
            return;
        }
        saving = true;
        if (submitBtn) submitBtn.disabled = true;
        setStatus("저장 중…");
        buildPayload()
            .then(function (body) {
                var editId = editIdInput ? editIdInput.value.trim() : "";
                if (editId) return api.updateMarketingMaterial(editId, body);
                return api.createMarketingMaterial(body);
            })
            .then(function () {
                window.location.href = "marketing-material-list.html";
            })
            .catch(function (err) {
                setStatus((err && err.message) || "저장에 실패했습니다.", true);
            })
            .then(function () {
                saving = false;
                if (submitBtn) submitBtn.disabled = false;
            });
    }

    if (!Auth.getOrderManageHubAccess || !Auth.getOrderManageHubAccess().allowed) {
        setStatus("이용 권한이 없습니다.", true);
        return;
    }
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    if (pickBtn && fileInput) {
        pickBtn.addEventListener("click", function () {
            fileInput.click();
        });
        fileInput.addEventListener("change", function () {
            addFiles(fileInput.files);
            fileInput.value = "";
        });
    }

    if (fileListEl) {
        fileListEl.addEventListener("click", function (ev) {
            var btn = ev.target.closest("button");
            if (!btn) return;
            var row = btn.closest(".mm-file-item");
            if (!row) return;
            if (btn.classList.contains("mmr-remove-kept")) {
                var id = row.getAttribute("data-id");
                MM.revokeObjectUrl(row.getAttribute("data-preview-url"));
                keptFiles = keptFiles.filter(function (f) {
                    return f.id !== id;
                });
                renderFileList();
                return;
            }
            if (btn.classList.contains("mmr-remove-new")) {
                var idx = Number(row.getAttribute("data-idx"));
                var entry = newFiles[idx];
                if (entry) MM.revokeObjectUrl(entry.previewUrl);
                newFiles.splice(idx, 1);
                renderFileList();
            }
        });
    }

    if (form) form.addEventListener("submit", onSubmit);

    window.addEventListener("pagehide", function () {
        revokeKeptPreviewUrls();
        revokeNewFileUrls();
    });

    renderFileList();

    var params = new URLSearchParams(window.location.search);
    var editId = params.get("id");
    if (editId) loadForEdit(editId);
})();
