(function () {
    var U = window.THEJHON_SUPPORT_COMMON;
    var A = window.THEJHON_AUTH;
    var API = window.THEJHON_API;
    if (!U || !A || !API) return;

    var statusEl = document.getElementById("sq-status");
    var writeBtn = document.getElementById("sq-write-btn");
    var writeModal = document.getElementById("sq-write-modal");
    var viewModal = document.getElementById("sq-view-modal");
    var viewBody = document.getElementById("sq-view-body");
    var viewTitle = document.getElementById("sq-view-title");
    var form = document.getElementById("sq-form");
    var titleInput = document.getElementById("sq-title");
    var bodyInput = document.getElementById("sq-body");
    var listEl = document.getElementById("sq-list");
    var items = [];
    var loading = false;

    var GUEST_ID_KEY = "thejhon_board_guest_id";

    if (!listEl) return;

    function isAdmin() {
        return A.canManageRegisters && A.canManageRegisters();
    }

    function loggedIn() {
        return A.isLoggedIn && A.isLoggedIn();
    }

    function guestAuthorId() {
        try {
            var id = sessionStorage.getItem(GUEST_ID_KEY);
            if (!id) {
                id =
                    "guest_" +
                    Date.now().toString(36) +
                    "_" +
                    Math.random().toString(36).slice(2, 8);
                sessionStorage.setItem(GUEST_ID_KEY, id);
            }
            return id;
        } catch (e) {
            return "guest_anonymous";
        }
    }

    function currentAuthorKey() {
        if (!loggedIn()) {
            return "guest\t" + guestAuthorId().toLowerCase();
        }
        return (A.getRole() || "") + "\t" + String(A.getUserId() || "").toLowerCase();
    }

    function canDeletePost(post) {
        if (isAdmin()) return true;
        var key = (post.authorRole || "") + "\t" + String(post.authorUserId || "").toLowerCase();
        return key === currentAuthorKey();
    }

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.classList.toggle("sp-status--err", !!isErr);
    }

    function previewText(body) {
        var t = String(body || "").trim();
        if (!t) return "";
        return t.length > 64 ? t.slice(0, 64) + "…" : t;
    }

    function syncBodyScroll() {
        var anyOpen =
            (writeModal && !writeModal.hidden) || (viewModal && !viewModal.hidden);
        document.body.style.overflow = anyOpen ? "hidden" : "";
    }

    function openModal(modal) {
        if (!modal) return;
        modal.hidden = false;
        syncBodyScroll();
    }

    function closeWriteModal() {
        if (writeModal) writeModal.hidden = true;
        if (form) form.reset();
        syncBodyScroll();
    }

    function closeViewModal() {
        if (viewModal) viewModal.hidden = true;
        if (viewBody) viewBody.innerHTML = "";
        syncBodyScroll();
    }

    function openWriteModal() {
        if (form) form.reset();
        openModal(writeModal);
        if (titleInput) titleInput.focus();
    }

    function openViewModal(it) {
        if (!it || !viewModal || !viewBody) return;
        var title = String(it.title || "").trim() || "제목 없음";
        if (viewTitle) viewTitle.textContent = title;
        var delBtn = canDeletePost(it)
            ? '<div class="sq-view-actions"><button type="button" class="sp-btn sp-btn--danger sq-del" data-id="' +
              U.escapeHtml(it.id) +
              '">삭제</button></div>'
            : "";
        viewBody.innerHTML =
            '<p class="sq-view-meta">' +
            U.escapeHtml(it.authorLabel || "") +
            " · " +
            U.escapeHtml(U.formatDateKo(it.createdAt)) +
            "</p>" +
            '<div class="sq-view-content">' +
            U.escapeMultiline(String(it.body || "")) +
            "</div>" +
            delBtn;
        openModal(viewModal);
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
                setStatus(items.length ? "" : "");
            })
            .catch(function (err) {
                listEl.innerHTML = '<li class="sp-empty" style="list-style:none">목록을 불러오지 못했습니다.</li>';
                setStatus(err.message || "목록을 불러오지 못했습니다.", true);
            })
            .finally(function () {
                loading = false;
            });
    }

    function deleteById(id) {
        var it = items.filter(function (x) {
            return x.id === id;
        })[0];
        if (!it || !canDeletePost(it)) return;
        if (!confirm("이 글을 삭제할까요?")) return;
        var body = loggedIn() ? {} : { guestId: guestAuthorId() };
        API.deleteSupportBoard(id, body)
            .then(function () {
                closeViewModal();
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
        if (Number.isFinite(idx) && items[idx]) openViewModal(items[idx]);
    });

    if (viewBody) {
        viewBody.addEventListener("click", function (e) {
            var t = e.target;
            if (!(t instanceof HTMLElement) || !t.classList.contains("sq-del")) return;
            deleteById(t.getAttribute("data-id"));
        });
    }

    if (writeBtn) writeBtn.addEventListener("click", openWriteModal);

    var writeClose = document.getElementById("sq-write-close");
    var writeCancel = document.getElementById("sq-write-cancel");
    if (writeClose) writeClose.addEventListener("click", closeWriteModal);
    if (writeCancel) writeCancel.addEventListener("click", closeWriteModal);
    if (writeModal) {
        writeModal.addEventListener("click", function (e) {
            if (e.target === writeModal) closeWriteModal();
        });
    }

    var viewClose = document.getElementById("sq-view-close");
    if (viewClose) viewClose.addEventListener("click", closeViewModal);
    if (viewModal) {
        viewModal.addEventListener("click", function (e) {
            if (e.target === viewModal) closeViewModal();
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (writeModal && !writeModal.hidden) closeWriteModal();
        else if (viewModal && !viewModal.hidden) closeViewModal();
    });

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var title = (titleInput && titleInput.value.trim()) || "";
            var body = (bodyInput && bodyInput.value.trim()) || "";
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
            var payload = { title: title, body: body };
            if (!loggedIn()) payload.guestId = guestAuthorId();
            API.createSupportBoard(payload)
                .then(function () {
                    closeWriteModal();
                    setStatus("등록했습니다.");
                    loadList();
                })
                .catch(function (err) {
                    setStatus(err.message || "저장에 실패했습니다.", true);
                });
        });
    }

    loadList();
})();
