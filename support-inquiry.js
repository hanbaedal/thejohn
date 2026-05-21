(function () {
    var U = window.THEJHON_SUPPORT_COMMON;
    var A = window.THEJHON_AUTH;
    if (!U || !A) return;

    var KEY = U.KEYS.INQUIRY;
    var statusEl = document.getElementById("si-status");
    var hintNotLogin = document.getElementById("si-hint-notlogin");
    var userPanel = document.getElementById("si-user-panel");
    var adminPanel = document.getElementById("si-admin-panel");
    var newForm = document.getElementById("si-new-form");
    var subjInput = document.getElementById("si-subject");
    var bodyInput = document.getElementById("si-body");
    var myListEl = document.getElementById("si-my-list");
    var adminListEl = document.getElementById("si-admin-list");

    function isAdmin() {
        return A.canManageRegisters && A.canManageRegisters();
    }

    function loggedIn() {
        return A.isLoggedIn && A.isLoggedIn();
    }

    function authorLabel() {
        var role = A.getRole();
        var uid = A.getUserId();
        if (role === "supervisor") return "슈퍼바이저";
        if (role === "admin") return "관리자";
        if (role === "guest") return "게스트";
        if (role === "vendor") {
            var n = A.getLoggedInCompanyDisplayName && A.getLoggedInCompanyDisplayName();
            return (n && String(n).trim()) || uid || "업체";
        }
        if (role === "oauth") return "SNS 로그인";
        return uid || "회원";
    }

    function currentFromKey() {
        return (A.getRole() || "") + "\t" + String(A.getUserId() || "").toLowerCase();
    }

    function matchesAuthor(it) {
        var key = (it.fromRole || "") + "\t" + String(it.fromUserId || "").toLowerCase();
        return key === currentFromKey();
    }

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

    function syncPanels() {
        var li = loggedIn();
        var ad = isAdmin();
        if (hintNotLogin) hintNotLogin.hidden = li;
        if (userPanel) userPanel.hidden = !li || ad;
        if (adminPanel) adminPanel.hidden = !ad;
    }

    function renderMyList() {
        if (!myListEl) return;
        if (!loggedIn() || isAdmin()) {
            myListEl.innerHTML = "";
            return;
        }
        var mine = getItems()
            .filter(matchesAuthor)
            .slice()
            .sort(function (a, b) {
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
        if (!mine.length) {
            myListEl.innerHTML = '<p class="sp-empty">작성한 문의가 없습니다.</p>';
            return;
        }
        myListEl.innerHTML = mine.map(renderInquiryCardUser).join("");
    }

    function badgeHtml(status) {
        var answered = status === "answered";
        return answered
            ? '<span class="sp-badge sp-badge--done">답변완료</span>'
            : '<span class="sp-badge sp-badge--open">접수</span>';
    }

    function renderInquiryCardUser(it) {
        var replyBlock = "";
        if (it.reply && String(it.reply).trim()) {
            replyBlock =
                '<div class="sp-card-body" style="margin-top:0.65rem;padding-top:0.65rem;border-top:1px solid #e8edf2">' +
                "<strong>답변</strong><p class=\"sp-card-body sp-card-body--pre\" style=\"margin:0.35rem 0 0\">" +
                U.escapeMultiline(String(it.reply).trim()) +
                "</p>" +
                (it.repliedAt
                    ? '<p class="sp-card-meta" style="margin:0.35rem 0 0">' +
                      U.escapeHtml(U.formatDateKo(it.repliedAt)) +
                      "</p>"
                    : "") +
                "</div>";
        }
        return (
            '<article class="sp-card">' +
            '<h2 class="sp-card-title">' +
            U.escapeHtml(String(it.subject || "").trim() || "제목 없음") +
            badgeHtml(it.status) +
            "</h2>" +
            '<p class="sp-card-meta">' +
            U.escapeHtml(U.formatDateKo(it.createdAt)) +
            "</p>" +
            '<div class="sp-card-body sp-card-body--pre">' +
            U.escapeMultiline(String(it.body || "")) +
            "</div>" +
            replyBlock +
            "</article>"
        );
    }

    function renderAdminList() {
        if (!adminListEl) return;
        if (!isAdmin()) {
            adminListEl.innerHTML = "";
            return;
        }
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
                    "<label for=\"si-reply-" +
                    U.escapeHtml(it.id) +
                    "\">답변 내용</label>" +
                    '<textarea id="si-reply-' +
                    U.escapeHtml(it.id) +
                    '" class="si-admin-reply" rows="4" maxlength="12000">' +
                    U.escapeHtml(String(it.reply || "")) +
                    "</textarea>" +
                    "</div>" +
                    '<div class="sp-field">' +
                    "<label for=\"si-st-" +
                    U.escapeHtml(it.id) +
                    "\">상태</label>" +
                    '<select id="si-st-' +
                    U.escapeHtml(it.id) +
                    '" class="si-admin-status">' +
                    '<option value="open"' +
                    (it.status !== "answered" ? " selected" : "") +
                    ">접수</option>" +
                    '<option value="answered"' +
                    (it.status === "answered" ? " selected" : "") +
                    ">답변완료</option>" +
                    "</select>" +
                    "</div>" +
                    '<div class="sp-card-actions">' +
                    '<button type="button" class="sp-btn sp-btn--primary si-save-reply" data-id="' +
                    U.escapeHtml(it.id) +
                    '">답변 저장</button>' +
                    '<button type="button" class="sp-btn sp-btn--danger si-del-inq" data-id="' +
                    U.escapeHtml(it.id) +
                    '">삭제</button>' +
                    "</div>" +
                    "</article>"
                );
            })
            .join("");
    }

    if (adminListEl) {
        adminListEl.addEventListener("click", function (e) {
            var t = e.target;
            if (!(t instanceof HTMLElement)) return;
            var id = t.getAttribute("data-id");
            if (t.classList.contains("si-save-reply")) {
                var ta = document.getElementById("si-reply-" + id);
                var sel = document.getElementById("si-st-" + id);
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
            } else if (t.classList.contains("si-del-inq")) {
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
    }

    if (newForm) {
        newForm.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!loggedIn() || isAdmin()) {
                setStatus("문의 작성은 업체·게스트·SNS 로그인 회원만 가능합니다.", true);
                return;
            }
            var subject = (subjInput && subjInput.value.trim()) || "";
            var body = (bodyInput && bodyInput.value.trim()) || "";
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
            var rec = {
                id: U.newId("inq"),
                subject: subject,
                body: body,
                fromRole: A.getRole(),
                fromUserId: A.getUserId(),
                fromLabel: authorLabel(),
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
            newForm.reset();
            renderMyList();
            setStatus("문의를 접수했습니다.");
        });
    }

    function refresh() {
        syncPanels();
        renderMyList();
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
