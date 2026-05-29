(function () {
    var U = window.THEJHON_SUPPORT_COMMON;
    var A = window.THEJHON_AUTH;
    if (!U || !A) return;

    var KEY = U.KEYS.INQUIRY;
    var GUEST_ID_KEY = "thejhon_inquiry_guest_id";
    var UNLOCK_KEY = "thejhon_inquiry_unlocked";

    var statusEl = document.getElementById("si-status");
    var writeBtn = document.getElementById("si-write-btn");
    var writeModal = document.getElementById("si-write-modal");
    var pwdModal = document.getElementById("si-pwd-modal");
    var viewModal = document.getElementById("si-view-modal");
    var viewBody = document.getElementById("si-view-body");
    var viewTitle = document.getElementById("si-view-title");
    var newForm = document.getElementById("si-new-form");
    var pwdForm = document.getElementById("si-pwd-form");
    var subjInput = document.getElementById("si-subject");
    var bodyInput = document.getElementById("si-body");
    var pwdInput = document.getElementById("si-password");
    var pwdCheckInput = document.getElementById("si-pwd-input");
    var listEl = document.getElementById("si-list");
    var items = [];
    var pendingViewId = "";

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

    function authorLabel() {
        if (!loggedIn()) return "방문자";
        var role = A.getRole();
        var uid = A.getUserId();
        if (role === "supervisor") return "슈퍼바이저";
        if (role === "admin") return "관리자";
        if (role === "vendor") {
            var n = A.getLoggedInCompanyDisplayName && A.getLoggedInCompanyDisplayName();
            return (n && String(n).trim()) || uid || "업체";
        }
        if (role === "oauth") return "SNS 로그인";
        return uid || "회원";
    }

    function currentFromKey() {
        if (!loggedIn()) {
            return "guest\t" + guestAuthorId().toLowerCase();
        }
        return (A.getRole() || "") + "\t" + String(A.getUserId() || "").toLowerCase();
    }

    function fromMeta() {
        if (loggedIn()) {
            return {
                fromRole: A.getRole() || "member",
                fromUserId: A.getUserId() || "",
                fromLabel: authorLabel()
            };
        }
        return {
            fromRole: "guest",
            fromUserId: guestAuthorId(),
            fromLabel: "방문자"
        };
    }

    function matchesAuthor(it) {
        var key = (it.fromRole || "") + "\t" + String(it.fromUserId || "").toLowerCase();
        return key === currentFromKey();
    }

    function hasPassword(it) {
        return /^\d{6}$/.test(String(it.password || ""));
    }

    function getUnlockedIds() {
        try {
            var raw = sessionStorage.getItem(UNLOCK_KEY);
            var data = JSON.parse(raw || "[]");
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    function markUnlocked(id) {
        try {
            var ids = getUnlockedIds();
            if (ids.indexOf(id) === -1) ids.push(id);
            sessionStorage.setItem(UNLOCK_KEY, JSON.stringify(ids));
        } catch (e) {
            /* ignore */
        }
    }

    function isUnlocked(id) {
        return getUnlockedIds().indexOf(id) !== -1;
    }

    function canView(it) {
        if (!it) return false;
        if (isAdmin()) return true;
        if (matchesAuthor(it)) return true;
        if (!hasPassword(it)) return true;
        return isUnlocked(it.id);
    }

    function canDelete(it) {
        if (isAdmin()) return true;
        return matchesAuthor(it);
    }

    function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.classList.toggle("sp-status--err", !!isErr);
    }

    function getItems() {
        return U.getArray(KEY);
    }

    function setItems(arr) {
        U.setArray(KEY, arr);
    }

    function syncBodyScroll() {
        var anyOpen =
            (writeModal && !writeModal.hidden) ||
            (pwdModal && !pwdModal.hidden) ||
            (viewModal && !viewModal.hidden);
        document.body.style.overflow = anyOpen ? "hidden" : "";
    }

    function openModal(modal) {
        if (!modal) return;
        modal.hidden = false;
        syncBodyScroll();
    }

    function closeWriteModal() {
        if (writeModal) writeModal.hidden = true;
        if (newForm) newForm.reset();
        syncBodyScroll();
    }

    function closePwdModal() {
        if (pwdModal) pwdModal.hidden = true;
        pendingViewId = "";
        if (pwdCheckInput) pwdCheckInput.value = "";
        syncBodyScroll();
    }

    function closeViewModal() {
        if (viewModal) viewModal.hidden = true;
        if (viewBody) viewBody.innerHTML = "";
        syncBodyScroll();
    }

    function badgeHtml(status) {
        var answered = status === "answered";
        return answered
            ? '<span class="sp-badge sp-badge--done">답변완료</span>'
            : '<span class="sp-badge sp-badge--open">접수</span>';
    }

    function previewText(it) {
        if (!canView(it)) return "🔒 비밀글입니다";
        var t = String(it.body || "").trim();
        if (!t) return "";
        return t.length > 64 ? t.slice(0, 64) + "…" : t;
    }

    function renderList() {
        items = getItems().slice().sort(function (a, b) {
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML = '<li class="sp-empty" style="list-style:none">접수된 문의가 없습니다.</li>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it, index) {
                var title = String(it.subject || "").trim() || "제목 없음";
                var preview = previewText(it);
                var lock = hasPassword(it) && !canView(it) ? " 🔒" : "";
                return (
                    '<li><button type="button" class="sq-board-row" data-index="' +
                    index +
                    '">' +
                    '<span class="sq-board-row__main">' +
                    '<span class="sq-board-row__title">' +
                    U.escapeHtml(title) +
                    lock +
                    " " +
                    badgeHtml(it.status) +
                    "</span>" +
                    '<span class="sq-board-row__meta">' +
                    U.escapeHtml(it.fromLabel || "") +
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

    function renderViewContent(it) {
        if (!viewBody) return;
        var title = String(it.subject || "").trim() || "제목 없음";
        if (viewTitle) viewTitle.textContent = title;

        var replyBlock = "";
        if (it.reply && String(it.reply).trim() && !isAdmin()) {
            replyBlock =
                '<div class="si-reply-block">' +
                "<h3 class=\"si-reply-block__title\">답변</h3>" +
                '<div class="sq-view-content">' +
                U.escapeMultiline(String(it.reply).trim()) +
                "</div>" +
                (it.repliedAt
                    ? '<p class="sq-view-meta">' + U.escapeHtml(U.formatDateKo(it.repliedAt)) + "</p>"
                    : "") +
                "</div>";
        }

        var adminBlock = "";
        if (isAdmin()) {
            adminBlock =
                '<div class="si-admin-reply">' +
                '<h3 class="si-reply-block__title">관리자 답변</h3>' +
                '<div class="sp-field">' +
                "<label for=\"si-admin-reply-ta\">답변 내용</label>" +
                '<textarea id="si-admin-reply-ta" rows="5" maxlength="12000">' +
                U.escapeHtml(String(it.reply || "")) +
                "</textarea></div>" +
                '<div class="sp-field">' +
                "<label for=\"si-admin-status\">상태</label>" +
                '<select id="si-admin-status">' +
                '<option value="open"' +
                (it.status !== "answered" ? " selected" : "") +
                ">접수</option>" +
                '<option value="answered"' +
                (it.status === "answered" ? " selected" : "") +
                ">답변완료</option>" +
                "</select></div>" +
                '<div class="sp-actions">' +
                '<button type="button" class="sp-btn sp-btn--primary" id="si-save-reply" data-id="' +
                U.escapeHtml(it.id) +
                '">답변 저장</button>' +
                "</div></div>";
        }

        var delBtn = canDelete(it)
            ? '<div class="sq-view-actions"><button type="button" class="sp-btn sp-btn--danger si-del-inq" data-id="' +
              U.escapeHtml(it.id) +
              '">삭제</button></div>'
            : "";

        viewBody.innerHTML =
            '<p class="sq-view-meta">' +
            U.escapeHtml(it.fromLabel || "") +
            " · " +
            U.escapeHtml(U.formatDateKo(it.createdAt)) +
            " " +
            badgeHtml(it.status) +
            (hasPassword(it) ? ' · <span class="si-lock-label">비밀글</span>' : "") +
            "</p>" +
            '<div class="sq-view-content">' +
            U.escapeMultiline(String(it.body || "")) +
            "</div>" +
            replyBlock +
            adminBlock +
            delBtn;
    }

    function openViewModal(it) {
        if (!it) return;
        renderViewContent(it);
        openModal(viewModal);
    }

    function tryOpenInquiry(it) {
        if (!it) return;
        if (canView(it)) {
            openViewModal(it);
            return;
        }
        pendingViewId = it.id;
        if (pwdCheckInput) pwdCheckInput.value = "";
        openModal(pwdModal);
        if (pwdCheckInput) pwdCheckInput.focus();
    }

    function saveAdminReply(id) {
        var ta = document.getElementById("si-admin-reply-ta");
        var sel = document.getElementById("si-admin-status");
        var reply = ta ? ta.value.trim() : "";
        var status = sel && sel.value === "answered" ? "answered" : "open";
        var now = Date.now();
        var next = getItems().map(function (x) {
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
        var updated = next.filter(function (x) {
            return x.id === id;
        })[0];
        renderList();
        if (updated) renderViewContent(updated);
        setStatus("답변을 저장했습니다.");
    }

    function deleteById(id) {
        if (!confirm("이 문의를 삭제할까요?")) return;
        var next = getItems().filter(function (x) {
            return x.id !== id;
        });
        try {
            setItems(next);
        } catch (err) {
            setStatus("삭제에 실패했습니다.", true);
            return;
        }
        closeViewModal();
        renderList();
        setStatus("삭제했습니다.");
    }

    listEl.addEventListener("click", function (e) {
        var btn = e.target.closest(".sq-board-row");
        if (!btn) return;
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        if (Number.isFinite(idx) && items[idx]) tryOpenInquiry(items[idx]);
    });

    if (viewBody) {
        viewBody.addEventListener("click", function (e) {
            var t = e.target;
            if (!(t instanceof HTMLElement)) return;
            if (t.id === "si-save-reply" || t.classList.contains("si-save-reply")) {
                saveAdminReply(t.getAttribute("data-id"));
            } else if (t.classList.contains("si-del-inq")) {
                deleteById(t.getAttribute("data-id"));
            }
        });
    }

    if (writeBtn) writeBtn.addEventListener("click", function () {
        if (newForm) newForm.reset();
        openModal(writeModal);
        if (subjInput) subjInput.focus();
    });

    var writeClose = document.getElementById("si-write-close");
    var writeCancel = document.getElementById("si-write-cancel");
    if (writeClose) writeClose.addEventListener("click", closeWriteModal);
    if (writeCancel) writeCancel.addEventListener("click", closeWriteModal);
    if (writeModal) {
        writeModal.addEventListener("click", function (e) {
            if (e.target === writeModal) closeWriteModal();
        });
    }

    var pwdClose = document.getElementById("si-pwd-close");
    var pwdCancel = document.getElementById("si-pwd-cancel");
    if (pwdClose) pwdClose.addEventListener("click", closePwdModal);
    if (pwdCancel) pwdCancel.addEventListener("click", closePwdModal);
    if (pwdModal) {
        pwdModal.addEventListener("click", function (e) {
            if (e.target === pwdModal) closePwdModal();
        });
    }

    var viewClose = document.getElementById("si-view-close");
    if (viewClose) viewClose.addEventListener("click", closeViewModal);
    if (viewModal) {
        viewModal.addEventListener("click", function (e) {
            if (e.target === viewModal) closeViewModal();
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (writeModal && !writeModal.hidden) closeWriteModal();
        else if (pwdModal && !pwdModal.hidden) closePwdModal();
        else if (viewModal && !viewModal.hidden) closeViewModal();
    });

    if (pwdForm) {
        pwdForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var id = pendingViewId;
            var it = items.filter(function (x) {
                return x.id === id;
            })[0];
            if (!it) {
                closePwdModal();
                return;
            }
            var entered = pwdCheckInput ? pwdCheckInput.value.trim() : "";
            if (entered !== String(it.password || "")) {
                setStatus("비밀번호가 올바르지 않습니다.", true);
                if (pwdCheckInput) pwdCheckInput.focus();
                return;
            }
            markUnlocked(id);
            closePwdModal();
            setStatus("");
            openViewModal(it);
        });
    }

    if (newForm) {
        newForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var subject = (subjInput && subjInput.value.trim()) || "";
            var body = (bodyInput && bodyInput.value.trim()) || "";
            var pw = pwdInput ? pwdInput.value.trim() : "";
            if (!subject) {
                setStatus("제목을 입력해 주세요.", true);
                if (subjInput) subjInput.focus();
                return;
            }
            if (!body) {
                setStatus("내용을 입력해 주세요.", true);
                if (bodyInput) bodyInput.focus();
                return;
            }
            if (pw && !/^\d{6}$/.test(pw)) {
                setStatus("비밀번호는 6자리 숫자이거나 비워 두세요.", true);
                if (pwdInput) pwdInput.focus();
                return;
            }
            var meta = fromMeta();
            var rec = {
                id: U.newId("inq"),
                subject: subject,
                body: body,
                password: pw,
                fromRole: meta.fromRole,
                fromUserId: meta.fromUserId,
                fromLabel: meta.fromLabel,
                createdAt: Date.now(),
                status: "open",
                reply: "",
                repliedAt: null,
                replyBy: ""
            };
            var next = getItems().concat([rec]);
            try {
                setItems(next);
            } catch (err) {
                setStatus("저장에 실패했습니다.", true);
                return;
            }
            closeWriteModal();
            renderList();
            setStatus("문의를 접수했습니다.");
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
