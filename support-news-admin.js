(function () {
    var U = window.THEJHON_SUPPORT_COMMON;
    var A = window.THEJHON_AUTH;
    if (!U || !A) return;
    if (!A.canManageRegisters || !A.canManageRegisters()) {
        return;
    }

    var KEY = U.KEYS.NEWS;
    var statusEl = document.getElementById("sna-status");
    var form = document.getElementById("sna-form");
    var editIdInput = document.getElementById("sna-edit-id");
    var titleInput = document.getElementById("sna-title");
    var bodyInput = document.getElementById("sna-body");
    var cancelBtn = document.getElementById("sna-cancel");
    var listEl = document.getElementById("sna-list");

    if (!listEl) return;

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.classList.toggle("sp-status--err", !!isErr);
    }

    function getItems() {
        return U.getArray(KEY);
    }

    function setItems(items) {
        U.setArray(KEY, items);
    }

    function resetForm() {
        if (!form) return;
        form.reset();
        if (editIdInput) editIdInput.value = "";
        if (cancelBtn) cancelBtn.hidden = true;
        setStatus("");
    }

    function renderList() {
        var items = getItems().slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML = '<p class="sp-empty">등록된 소식이 없습니다.</p>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it) {
                var meta = U.formatDateKo(it.updatedAt || it.createdAt);
                return (
                    '<article class="sp-card" data-id="' +
                    U.escapeHtml(it.id) +
                    '">' +
                    '<h2 class="sp-card-title">' +
                    U.escapeHtml(String(it.title || "").trim() || "제목 없음") +
                    "</h2>" +
                    '<p class="sp-card-meta">' +
                    U.escapeHtml(meta) +
                    "</p>" +
                    '<div class="sp-card-body">' +
                    U.escapeMultiline(String(it.body || "")) +
                    "</div>" +
                    '<div class="sp-card-actions">' +
                    '<button type="button" class="sp-btn sp-btn--secondary sna-edit" data-id="' +
                    U.escapeHtml(it.id) +
                    '">수정</button>' +
                    '<button type="button" class="sp-btn sp-btn--danger sna-del" data-id="' +
                    U.escapeHtml(it.id) +
                    '">삭제</button>' +
                    "</div>" +
                    "</article>"
                );
            })
            .join("");
    }

    function loadIntoForm(id) {
        var it = getItems().filter(function (x) {
            return x.id === id;
        })[0];
        if (!it || !titleInput || !bodyInput || !editIdInput) return;
        editIdInput.value = it.id;
        titleInput.value = it.title || "";
        bodyInput.value = it.body || "";
        if (cancelBtn) cancelBtn.hidden = false;
        setStatus("수정 중입니다. 저장하면 반영됩니다.");
        titleInput.focus();
    }

    function deleteById(id) {
        if (!confirm("이 소식을 삭제할까요?")) return;
        var next = getItems().filter(function (x) {
            return x.id !== id;
        });
        try {
            setItems(next);
        } catch (e) {
            setStatus("삭제에 실패했습니다.", true);
            return;
        }
        if (editIdInput && editIdInput.value === id) resetForm();
        renderList();
        setStatus("삭제했습니다.");
    }

    listEl.addEventListener("click", function (e) {
        var t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.classList.contains("sna-edit")) {
            loadIntoForm(t.getAttribute("data-id"));
        } else if (t.classList.contains("sna-del")) {
            deleteById(t.getAttribute("data-id"));
        }
    });

    if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
            resetForm();
            setStatus("편집을 취소했습니다.");
        });
    }

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
            var now = Date.now();
            var editingId = (editIdInput && editIdInput.value.trim()) || "";
            var items = getItems();
            var record = {
                id: editingId || U.newId("news"),
                title: title,
                body: body,
                createdAt: editingId
                    ? (items.filter(function (x) {
                          return x.id === editingId;
                      })[0] || {}).createdAt || now
                    : now,
                updatedAt: now
            };
            var next;
            if (editingId) {
                next = items.map(function (x) {
                    return x.id === editingId ? record : x;
                });
            } else {
                next = items.concat([record]);
            }
            try {
                setItems(next);
            } catch (err) {
                setStatus("저장에 실패했습니다. 내용 길이를 줄여 보세요.", true);
                return;
            }
            resetForm();
            renderList();
            setStatus(editingId ? "수정했습니다." : "등록했습니다.");
        });
    }

    function refresh() {
        renderList();
    }

    refresh();
    window.addEventListener("storage", function (e) {
        if (e.key === KEY) refresh();
    });
    window.addEventListener("pageshow", function (e) {
        if (e.persisted) refresh();
    });
})();
