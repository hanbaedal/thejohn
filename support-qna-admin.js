(function () {
    var U = window.THEJHON_SUPPORT_COMMON;
    var A = window.THEJHON_AUTH;
    var API = window.THEJHON_API;
    if (!U || !A || !API) return;

    var statusEl = document.getElementById("sqa-status");
    var listEl = document.getElementById("sqa-list");
    var viewModal = document.getElementById("sqa-view-modal");
    var viewTitle = document.getElementById("sqa-view-title");
    var metaEl = document.getElementById("sqa-view-meta");
    var form = document.getElementById("sqa-edit-form");
    var idInput = document.getElementById("sqa-edit-id");
    var titleInput = document.getElementById("sqa-edit-title");
    var bodyInput = document.getElementById("sqa-edit-body");
    var delBtn = document.getElementById("sqa-del-btn");
    var items = [];
    var loading = false;

    if (!listEl) return;

    function isAdmin() {
        return A.canManageRegisters && A.canManageRegisters();
    }

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.classList.toggle("sp-status--err", !!isErr);
    }

    function syncBodyScroll() {
        document.body.style.overflow = viewModal && !viewModal.hidden ? "hidden" : "";
    }

    function openModal() {
        if (!viewModal) return;
        viewModal.hidden = false;
        syncBodyScroll();
    }

    function closeModal() {
        if (viewModal) viewModal.hidden = true;
        if (form) form.reset();
        if (idInput) idInput.value = "";
        syncBodyScroll();
    }

    function previewText(body) {
        var t = String(body || "").trim();
        if (!t) return "";
        return t.length > 64 ? t.slice(0, 64) + "…" : t;
    }

    function openEditModal(it) {
        if (!it || !isAdmin()) return;
        if (idInput) idInput.value = it.id;
        if (titleInput) titleInput.value = String(it.title || "");
        if (bodyInput) bodyInput.value = String(it.body || "");
        if (viewTitle) viewTitle.textContent = String(it.title || "").trim() || "게시글 관리";
        if (metaEl) {
            metaEl.textContent =
                (it.authorLabel || "") + " · " + U.formatDateKo(it.createdAt);
        }
        openModal();
        if (titleInput) titleInput.focus();
    }

    function renderList() {
        if (!items.length) {
            listEl.innerHTML = '<li class="sp-empty" style="list-style:none">등록된 글이 없습니다.</li>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it, index) {
                var title = String(it.title || "").trim() || "제목 없음";
                var preview = previewText(it.body);
                return (
                    '<li><button type="button" class="sq-board-row" data-index="' +
                    index +
                    '">' +
                    '<span class="sq-board-row__main">' +
                    '<span class="sq-board-row__title">' +
                    U.escapeHtml(title) +
                    "</span>" +
                    '<span class="sq-board-row__meta">' +
                    U.escapeHtml(it.authorLabel || "") +
                    " · " +
                    U.escapeHtml(U.formatDateKo(it.createdAt)) +
                    "</span>" +
                    (preview
                        ? '<span class="sq-board-row__preview">' + U.escapeHtml(preview) + "</span>"
                        : "") +
                    "</span>" +
                    '<span class="sn-list-chevron" aria-hidden="true">›</span>' +
                    "</button></li>"
                );
            })
            .join("");
    }

    function loadList() {
        if (loading) return;
        loading = true;
        setStatus("불러오는 중…");
        API.listSupportBoard()
            .then(function (rows) {
                items = (rows || []).slice().sort(function (a, b) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                });
                renderList();
                setStatus("");
            })
            .catch(function (err) {
                listEl.innerHTML =
                    '<li class="sp-empty" style="list-style:none">목록을 불러오지 못했습니다.</li>';
                setStatus(err.message || "목록을 불러오지 못했습니다.", true);
            })
            .finally(function () {
                loading = false;
            });
    }

    function deleteById(id) {
        if (!id || !confirm("이 글을 삭제할까요?")) return;
        API.deleteSupportBoard(id, {})
            .then(function () {
                closeModal();
                setStatus("삭제했습니다.");
                loadList();
            })
            .catch(function (err) {
                setStatus(err.message || "삭제에 실패했습니다.", true);
            });
    }

    listEl.addEventListener("click", function (e) {
        var btn = e.target.closest(".sq-board-row");
        if (!btn) return;
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        if (Number.isFinite(idx) && items[idx]) openEditModal(items[idx]);
    });

    var viewClose = document.getElementById("sqa-view-close");
    var viewCancel = document.getElementById("sqa-view-cancel");
    if (viewClose) viewClose.addEventListener("click", closeModal);
    if (viewCancel) viewCancel.addEventListener("click", closeModal);
    if (viewModal) {
        viewModal.addEventListener("click", function (e) {
            if (e.target === viewModal) closeModal();
        });
    }
    if (delBtn) {
        delBtn.addEventListener("click", function () {
            var id = idInput ? idInput.value : "";
            if (id) deleteById(id);
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && viewModal && !viewModal.hidden) closeModal();
    });

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var id = idInput ? idInput.value : "";
            var title = titleInput ? titleInput.value.trim() : "";
            var body = bodyInput ? bodyInput.value.trim() : "";
            if (!id) return;
            if (!title) {
                setStatus("제목을 입력해 주세요.", true);
                if (titleInput) titleInput.focus();
                return;
            }
            if (!body) {
                setStatus("내용을 입력해 주세요.", true);
                if (bodyInput) bodyInput.focus();
                return;
            }
            API.updateSupportBoard(id, { title: title, body: body })
                .then(function (updated) {
                    var idx = items.findIndex(function (x) {
                        return x.id === id;
                    });
                    if (idx >= 0) items[idx] = updated;
                    closeModal();
                    setStatus("저장했습니다.");
                    loadList();
                })
                .catch(function (err) {
                    setStatus(err.message || "저장에 실패했습니다.", true);
                });
        });
    }

    if (!isAdmin()) {
        window.location.replace("support.html");
        return;
    }
    loadList();
})();
