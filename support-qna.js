(function () {
    var U = window.THEJHON_SUPPORT_COMMON;
    var A = window.THEJHON_AUTH;
    if (!U || !A) return;

    var KEY = U.KEYS.BOARD;
    var statusEl = document.getElementById("sq-status");
    var composePanel = document.getElementById("sq-compose");
    var loginHint = document.getElementById("sq-login-hint");
    var form = document.getElementById("sq-form");
    var titleInput = document.getElementById("sq-title");
    var bodyInput = document.getElementById("sq-body");
    var listEl = document.getElementById("sq-list");

    if (!listEl) return;

    function isAdmin() {
        return A.canManageRegisters && A.canManageRegisters();
    }

    function loggedIn() {
        return A.isLoggedIn && A.isLoggedIn();
    }

    function authorLabel() {
        var role = A.getRole();
        var uid = A.getUserId();
        if (role === "admin") return "관리자";
        if (role === "guest") return "게스트";
        if (role === "vendor") {
            var n = A.getLoggedInCompanyDisplayName && A.getLoggedInCompanyDisplayName();
            return (n && String(n).trim()) || uid || "업체";
        }
        if (role === "oauth") return "SNS 로그인";
        return uid || "회원";
    }

    function currentAuthorKey() {
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

    function getItems() {
        return U.getArray(KEY);
    }

    function setItems(items) {
        U.setArray(KEY, items);
    }

    function syncComposeUi() {
        var ok = loggedIn();
        if (composePanel) composePanel.hidden = !ok;
        if (loginHint) loginHint.hidden = ok;
    }

    function renderList() {
        var items = getItems().slice().sort(function (a, b) {
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML = '<p class="sp-empty">등록된 글이 없습니다.</p>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it) {
                var del = "";
                if (canDeletePost(it)) {
                    del =
                        '<div class="sp-card-actions">' +
                        '<button type="button" class="sp-btn sp-btn--danger sq-del" data-id="' +
                        U.escapeHtml(it.id) +
                        '">삭제</button>' +
                        "</div>";
                }
                return (
                    '<article class="sp-card">' +
                    '<h2 class="sp-card-title">' +
                    U.escapeHtml(String(it.title || "").trim() || "제목 없음") +
                    "</h2>" +
                    '<p class="sp-card-meta">' +
                    U.escapeHtml(it.authorLabel || "") +
                    " · " +
                    U.escapeHtml(U.formatDateKo(it.createdAt)) +
                    "</p>" +
                    '<div class="sp-card-body sp-card-body--pre">' +
                    U.escapeMultiline(String(it.body || "")) +
                    "</div>" +
                    del +
                    "</article>"
                );
            })
            .join("");
    }

    listEl.addEventListener("click", function (e) {
        var t = e.target;
        if (!(t instanceof HTMLElement) || !t.classList.contains("sq-del")) return;
        var id = t.getAttribute("data-id");
        var it = getItems().filter(function (x) {
            return x.id === id;
        })[0];
        if (!it || !canDeletePost(it)) return;
        if (!confirm("이 글을 삭제할까요?")) return;
        var next = getItems().filter(function (x) {
            return x.id !== id;
        });
        try {
            setItems(next);
        } catch (err) {
            setStatus("삭제에 실패했습니다.", true);
            return;
        }
        renderList();
        setStatus("삭제했습니다.");
    });

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!loggedIn()) {
                setStatus("로그인 후 작성할 수 있습니다.", true);
                return;
            }
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
            var post = {
                id: U.newId("board"),
                title: title,
                body: body,
                authorRole: A.getRole(),
                authorUserId: A.getUserId(),
                authorLabel: authorLabel(),
                createdAt: Date.now()
            };
            var next = getItems().concat([post]);
            try {
                setItems(next);
            } catch (err) {
                setStatus("저장에 실패했습니다.", true);
                return;
            }
            form.reset();
            renderList();
            setStatus("등록했습니다.");
        });
    }

    function refresh() {
        syncComposeUi();
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
