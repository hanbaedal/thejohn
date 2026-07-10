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

    function previewBlockHtml(kind, url, filename) {
        return (
            '<div class="mm-file-item__preview-slot">' +
            (MM.isVisualKind(kind)
                ? MM.visualPreviewHtml(kind, url, filename)
                : MM.previewPlaceholderHtml(kind, "문서")) +
            "</div>"
        );
    }

    function keptPreviewUrl(materialId, fileIdx) {
        if (!api.marketingMaterialFileUrl) return "";
        return api.marketingMaterialFileUrl(materialId, fileIdx, { inline: true });
    }

    function renderFileList() {
        if (!fileListEl) return;
        var items = keptFiles
            .map(function (f, idx) {
                var kind = MM.resolveFileKind(f);
                var previewUrl = editMaterialId ? keptPreviewUrl(editMaterialId, idx) : "";
                return (
                    '<li class="mm-file-item" data-kind="kept" data-id="' +
                    MM.escapeHtml(f.id) +
                    '">' +
                    '<div class="mm-file-item__body">' +
                    '<div class="mm-file-item__meta">' +
                    '<p class="mm-file-item__name">' +
                    MM.escapeHtml(f.filename) +
                    "</p>" +
                    '<p class="mm-file-item__sub">' +
                    MM.escapeHtml(MM.kindLabel(kind)) +
                    " · " +
                    MM.escapeHtml(MM.formatBytes(f.size)) +
                    " · 기존 파일</p>" +
                    "</div>" +
                    previewBlockHtml(kind, previewUrl, f.filename) +
                    "</div>" +
                    '<button type="button" class="sp-btn sp-btn--danger mmr-remove-kept">제거</button>' +
                    "</li>"
                );
            })
            .concat(
                newFiles.map(function (entry, idx) {
                    var f = entry.file;
                    var kind = MM.fileKind(MM.fileExt(f.name));
                    return (
                        '<li class="mm-file-item" data-kind="new" data-idx="' +
                        idx +
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
                        previewBlockHtml(kind, entry.previewDataUrl, f.name) +
                        "</div>" +
                        '<button type="button" class="sp-btn sp-btn--danger mmr-remove-new">제거</button>' +
                        "</li>"
                    );
                })
            );
        fileListEl.innerHTML = items.length
            ? items.join("")
            : '<li class="mm-empty" style="list-style:none">첨부된 파일이 없습니다.</li>';
    }

    function addFiles(fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        var added = [];
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
            var entry = { file: file, previewDataUrl: "" };
            newFiles.push(entry);
            added.push(
                MM.filePreviewDataUrl(file).then(function (dataUrl) {
                    entry.previewDataUrl = dataUrl;
                })
            );
        }
        if (!added.length) return;
        Promise.all(added).then(function () {
            renderFileList();
            setStatus("");
        });
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
                keptFiles = keptFiles.filter(function (f) {
                    return f.id !== id;
                });
                renderFileList();
                return;
            }
            if (btn.classList.contains("mmr-remove-new")) {
                var idx = Number(row.getAttribute("data-idx"));
                newFiles.splice(idx, 1);
                renderFileList();
            }
        });
    }

    if (form) form.addEventListener("submit", onSubmit);

    renderFileList();

    var params = new URLSearchParams(window.location.search);
    var editId = params.get("id");
    if (editId) loadForEdit(editId);
})();
