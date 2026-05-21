(function () {
    var U = window.THEJHON_SUPPORT_COMMON;
    var A = window.THEJHON_AUTH;
    if (!U || !A) return;
    if (!A.canManageRegisters || !A.canManageRegisters()) {
        return;
    }

    var KEY = U.KEYS.INQUIRY;
    var statusEl = document.getElementById("sir-status");
    var adminListEl = document.getElementById("sir-admin-list");
    if (!adminListEl) return;

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

    function badgeHtml(status) {
        var answered = status === "answered";
        return answered
            ? '<span class="sp-badge sp-badge--done">답변완료</span>'
            : '<span class="sp-badge sp-badge--open">접수</span>';
    }

    function renderAdminList() {
        var items = getItems().slice().sort(function (a, b) {
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        if (!items.length) {
            adminListEl.innerHTML = '<p class="sp-empty">접수된 문의가 없습니다.</p>';
            return;
        }
        adminListEl.innerHTML = items
            .map(function (it) {
                return (
                    '<article class="sp-card" data-inq-id="' +
                    U.escapeHtml(it.id) +
                    '">' +
                    '<h2 class="sp-card-title">' +
                    U.escapeHtml(String(it.subject || "").trim() || "제목 없음") +
                    badgeHtml(it.status) +
                    "</h2>" +
                    '<p class="sp-card-meta">' +
                    U.escapeHtml(it.fromLabel || "") +
                    " (" +
                    U.escapeHtml(it.fromRole || "") +
                    ") · " +
                    U.escapeHtml(U.formatDateKo(it.createdAt)) +
                    "</p>" +
                    '<div class="sp-card-body sp-card-body--pre">' +
                    U.escapeMultiline(String(it.body || "")) +
                    "</div>" +
                    '<div class="sp-field" style="margin-top:0.65rem">' +
                    "<label for=\"sir-reply-" +
                    U.escapeHtml(it.id) +
                    "\">답변 내용</label>" +
                    '<textarea id="sir-reply-' +
                    U.escapeHtml(it.id) +
                    '" class="sir-admin-reply" rows="4" maxlength="12000">' +
                    U.escapeHtml(String(it.reply || "")) +
                    "</textarea>" +
                    "</div>" +
                    '<div class="sp-field">' +
                    "<label for=\"sir-st-" +
                    U.escapeHtml(it.id) +
                    "\">상태</label>" +
                    '<select id="sir-st-' +
                    U.escapeHtml(it.id) +
                    '" class="sir-admin-status">' +
                    '<option value="open"' +
                    (it.status !== "answered" ? " selected" : "") +
                    ">접수</option>" +
                    '<option value="answered"' +
                    (it.status === "answered" ? " selected" : "") +
                    ">답변완료</option>" +
                    "</select>" +
                    "</div>" +
                    '<div class="sp-card-actions">' +
                    '<button type="button" class="sp-btn sp-btn--primary sir-save-reply" data-id="' +
                    U.escapeHtml(it.id) +
                    '">답변 저장</button>' +
                    '<button type="button" class="sp-btn sp-btn--danger sir-del-inq" data-id="' +
                    U.escapeHtml(it.id) +
                    '">삭제</button>' +
                    "</div>" +
                    "</article>"
                );
            })
            .join("");
    }

    adminListEl.addEventListener("click", function (e) {
        var t = e.target;
        if (!(t instanceof HTMLElement)) return;
        var id = t.getAttribute("data-id");
        if (t.classList.contains("sir-save-reply")) {
            var ta = document.getElementById("sir-reply-" + id);
            var sel = document.getElementById("sir-st-" + id);
            var reply = ta ? ta.value.trim() : "";
            var status = sel && sel.value === "answered" ? "answered" : "open";
            var items = getItems();
            var now = Date.now();
            var next = items.map(function (x) {
                if (x.id !== id) return x;
                return Object.assign({}, x, {
                    reply: reply,
                    status: status,
                    repliedAt: reply ? now : x.repliedAt,
                    replyBy: "admin"
                });
            });
            try {
                setItems(next);
            } catch (err) {
                setStatus("저장에 실패했습니다.", true);
                return;
            }
            renderAdminList();
            setStatus("답변을 저장했습니다.");
        } else if (t.classList.contains("sir-del-inq")) {
            if (!confirm("이 문의를 삭제할까요?")) return;
            var next2 = getItems().filter(function (x) {
                return x.id !== id;
            });
            try {
                setItems(next2);
            } catch (e2) {
                setStatus("삭제에 실패했습니다.", true);
                return;
            }
            renderAdminList();
            setStatus("삭제했습니다.");
        }
    });

    function refresh() {
        renderAdminList();
    }

    refresh();
    window.addEventListener("storage", function (e) {
        if (e.key === KEY) refresh();
    });
    window.addEventListener("pageshow", function (e) {
        if (e.persisted) refresh();
    });
})();
