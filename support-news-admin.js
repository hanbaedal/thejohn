(function () {
    var api = window.THEJHON_API;
    var SN = window.THEJHON_SUPPORT_NEWS;
    var A = window.THEJHON_AUTH;
    if (!api || !SN || !A) return;
    if (!A.canManageRegisters || !A.canManageRegisters()) return;

    var statusEl = document.getElementById("sna-status");
    var form = document.getElementById("sna-form");
    var editIdInput = document.getElementById("sna-edit-id");
    var deptHidden = document.getElementById("sna-dept");
    var deptDisplay = document.getElementById("sna-dept-display");
    var bodyInput = document.getElementById("sna-body");
    var charCount = document.getElementById("sna-char-count");
    var cancelBtn = document.getElementById("sna-cancel");
    var submitBtn = document.getElementById("sna-submit");
    var listEl = document.getElementById("sna-list");
    var saving = false;

    var deptPicker = SN.initDeptModalPicker({
        displayInput: deptDisplay,
        hiddenInput: deptHidden,
        modal: document.getElementById("sn-dept-modal"),
        modalBtns: document.getElementById("sn-dept-modal-btns"),
        openOnFieldHover: true,
        siteNewsDept: SN.SITE_NEWS_DEPT,
        siteNewsLabel: "더존소식",
        siteNewsIcon: "📢"
    });

    var photoManager = SN.initPhotoManager({
        slotsEl: document.getElementById("sna-photo-slots"),
        galleryInput: document.getElementById("sna-gallery"),
        cameraInput: document.getElementById("sna-camera"),
        btnGallery: document.getElementById("sna-btn-gallery"),
        btnCamera: document.getElementById("sna-btn-camera")
    });

    if (!listEl) return;

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.classList.toggle("sp-status--err", !!isErr);
    }

    function syncCharCount() {
        if (!bodyInput || !charCount) return;
        var len = bodyInput.value.length;
        charCount.textContent = len + " / " + SN.MAX_BODY;
        charCount.classList.toggle("is-limit", len >= SN.MAX_BODY);
    }

    function resetForm() {
        if (!form) return;
        form.reset();
        if (editIdInput) editIdInput.value = "";
        deptPicker.setValue("");
        photoManager.clear();
        if (cancelBtn) cancelBtn.hidden = true;
        if (submitBtn) submitBtn.textContent = "등록";
        if (listEl) {
            listEl.querySelectorAll(".sn-admin-row.is-editing").forEach(function (row) {
                row.classList.remove("is-editing");
            });
        }
        syncCharCount();
        setStatus("");
    }

    function previewText(body) {
        var t = String(body || "").trim();
        if (!t) return "내용 없음";
        return t.length > 48 ? t.slice(0, 48) + "…" : t;
    }

    function renderList(items) {
        if (!items.length) {
            listEl.innerHTML = '<li class="sp-empty" style="list-style:none">등록된 소식이 없습니다.</li>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it) {
                var meta = SN.formatDateKo(it.updatedAt || it.createdAt);
                return (
                    '<li class="sn-admin-row sn-admin-row--clickable" data-id="' +
                    SN.escapeHtml(it.id) +
                    '" role="button" tabindex="0" aria-label="' +
                    SN.escapeHtml(SN.deptLabel(it.sn_dept)) +
                    ' 수정">' +
                    '<div class="sn-admin-row__main">' +
                    '<span class="sn-news-row__dept">' +
                    SN.escapeHtml(SN.deptLabel(it.sn_dept)) +
                    "</span>" +
                    '<span class="sn-news-row__meta">' +
                    SN.escapeHtml(meta) +
                    "</span>" +
                    '<p class="sn-news-row__preview">' +
                    SN.escapeHtml(previewText(it.sn_body)) +
                    "</p>" +
                    "</div>" +
                    '<div class="sn-admin-row__actions">' +
                    '<button type="button" class="sp-btn sp-btn--secondary sna-edit" data-id="' +
                    SN.escapeHtml(it.id) +
                    '">수정</button>' +
                    '<button type="button" class="sp-btn sp-btn--danger sna-del" data-id="' +
                    SN.escapeHtml(it.id) +
                    '">삭제</button>' +
                    "</div></li>"
                );
            })
            .join("");
    }

    function loadList() {
        listEl.innerHTML = '<li class="sp-empty" style="list-style:none">불러오는 중…</li>';
        return api
            .listSupportNews()
            .then(function (items) {
                renderList(items || []);
            })
            .catch(function (err) {
                listEl.innerHTML = '<li class="sp-empty" style="list-style:none">목록을 불러오지 못했습니다.</li>';
                setStatus((err && err.message) || "목록을 불러오지 못했습니다.", true);
            });
    }

    function loadIntoForm(id) {
        api.getSupportNews(id)
            .then(function (it) {
                if (!it) return;
                if (editIdInput) editIdInput.value = it.id;
                deptPicker.setValue(it.sn_dept || "");
                if (bodyInput) bodyInput.value = it.sn_body || "";
                photoManager.setPhotos(it.sn_images || []);
                if (cancelBtn) cancelBtn.hidden = false;
                if (submitBtn) submitBtn.textContent = "수정 저장";
                syncCharCount();
                setStatus("수정 중입니다. 저장하면 반영됩니다.");
                listEl.querySelectorAll(".sn-admin-row").forEach(function (row) {
                    row.classList.toggle("is-editing", row.getAttribute("data-id") === it.id);
                });
                if (form) {
                    try {
                        form.scrollIntoView({ behavior: "smooth", block: "start" });
                    } catch (e) {
                        form.scrollIntoView(true);
                    }
                }
                if (bodyInput) bodyInput.focus();
            })
            .catch(function (err) {
                setStatus((err && err.message) || "소식을 불러오지 못했습니다.", true);
            });
    }

    function deleteById(id) {
        if (!confirm("이 소식을 삭제할까요?")) return;
        api.deleteSupportNews(id)
            .then(function () {
                if (editIdInput && editIdInput.value === id) resetForm();
                loadList();
                setStatus("삭제했습니다.");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "삭제에 실패했습니다.", true);
            });
    }

    listEl.addEventListener("click", function (e) {
        var t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.classList.contains("sna-del")) {
            deleteById(t.getAttribute("data-id"));
            return;
        }
        if (t.classList.contains("sna-edit")) {
            loadIntoForm(t.getAttribute("data-id"));
            return;
        }
        if (t.closest(".sn-admin-row__actions")) return;
        var row = t.closest(".sn-admin-row");
        if (row) loadIntoForm(row.getAttribute("data-id"));
    });

    listEl.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var row = e.target.closest(".sn-admin-row");
        if (!row || e.target.closest(".sn-admin-row__actions")) return;
        e.preventDefault();
        loadIntoForm(row.getAttribute("data-id"));
    });

    if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
            resetForm();
            setStatus("편집을 취소했습니다.");
        });
    }

    if (bodyInput) {
        bodyInput.addEventListener("input", syncCharCount);
    }

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (saving) return;
            var dept = deptPicker.getValue();
            var body = (bodyInput && bodyInput.value.trim()) || "";
            if (!dept) {
                setStatus("사업부문을 선택해 주세요.", true);
                if (deptDisplay) deptDisplay.focus();
                return;
            }
            if (!body) {
                setStatus("내용을 입력해 주세요.", true);
                if (bodyInput) bodyInput.focus();
                return;
            }
            if (body.length > SN.MAX_BODY) {
                setStatus("내용은 256자 이내로 입력해 주세요.", true);
                return;
            }
            var payload = {
                sn_dept: dept,
                sn_body: body,
                sn_images: photoManager.getPhotos()
            };
            var editingId = (editIdInput && editIdInput.value.trim()) || "";
            saving = true;
            setStatus("저장 중…");
            var task = editingId
                ? api.updateSupportNews(editingId, payload)
                : api.createSupportNews(payload);
            task.then(function () {
                resetForm();
                return loadList();
            })
                .then(function () {
                    setStatus(editingId ? "수정했습니다." : "등록했습니다.");
                })
                .catch(function (err) {
                    setStatus((err && err.message) || "저장에 실패했습니다.", true);
                })
                .finally(function () {
                    saving = false;
                });
        });
    }

    syncCharCount();
    loadList();
})();
