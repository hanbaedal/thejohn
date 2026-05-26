/**
 * 슈퍼바이저 — 관리자(staff) 등록·목록·모달 수정
 */
(function () {
    var api = window.THEJHON_API;
    var statusEl = document.getElementById("sm-status");
    var listEl = document.getElementById("sm-list");
    var regForm = document.getElementById("sm-register-form");
    var modal = document.getElementById("sm-edit-modal");
    var editForm = document.getElementById("sm-edit-form");
    var editMsg = document.getElementById("sm-edit-msg");
    var editDeleteBtn = document.getElementById("sm-edit-delete");
    var staffByKey = {};

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "sm-status" + (kind === "err" ? " sm-status--err" : kind === "ok" ? " sm-status--ok" : "");
    }

    function setEditMsg(msg, kind) {
        if (!editMsg) return;
        if (!msg) {
            editMsg.hidden = true;
            editMsg.textContent = "";
            return;
        }
        editMsg.hidden = false;
        editMsg.textContent = msg;
        editMsg.className = "sm-status" + (kind === "err" ? " sm-status--err" : " sm-status--ok");
    }

    function roleLabel(role) {
        if (role === "supervisor") return "슈퍼바이저";
        if (role === "admin") return "관리자";
        return role || "";
    }

    function roleClass(role) {
        return role === "supervisor" ? "sm-role sm-role--supervisor" : "sm-role";
    }

    function readForm(form) {
        var fd = new FormData(form);
        var body = {
            loginId: String(fd.get("loginId") || "").trim(),
            password: String(fd.get("password") || ""),
            st_company: String(fd.get("st_company") || "").trim(),
            st_phone: String(fd.get("st_phone") || "").trim(),
            st_fax: String(fd.get("st_fax") || "").trim(),
            st_email: String(fd.get("st_email") || "").trim(),
            st_web: String(fd.get("st_web") || "").trim(),
            st_ceo: String(fd.get("st_ceo") || "").trim(),
            st_ceo_tel: String(fd.get("st_ceo_tel") || "").trim(),
            st_biz_no: String(fd.get("st_biz_no") || "").trim(),
            st_biz_type: String(fd.get("st_biz_type") || "").trim(),
            st_biz_item: String(fd.get("st_biz_item") || "").trim(),
            st_address: String(fd.get("st_address") || "").trim()
        };
        if (!body.password) delete body.password;
        return body;
    }

    function staffKey(it) {
        return String((it && (it.id || it.loginId)) || "").trim();
    }

    function fillEditForm(st) {
        if (!st) return;
        document.getElementById("sm-edit-id").value = st.id || st.loginId || "";
        document.getElementById("sm-edit-loginId").value = st.loginId || "";
        document.getElementById("sm-edit-password").value = "";
        document.getElementById("sm-edit-st_company").value = st.st_company || "";
        document.getElementById("sm-edit-st_phone").value = st.st_phone || "";
        document.getElementById("sm-edit-st_fax").value = st.st_fax || "";
        document.getElementById("sm-edit-st_ceo").value = st.st_ceo || "";
        document.getElementById("sm-edit-st_email").value = st.st_email || "";
        document.getElementById("sm-edit-st_web").value = st.st_web || "";
        document.getElementById("sm-edit-st_ceo_tel").value = st.st_ceo_tel || "";
        document.getElementById("sm-edit-st_biz_no").value = st.st_biz_no || "";
        document.getElementById("sm-edit-st_biz_type").value = st.st_biz_type || "";
        document.getElementById("sm-edit-st_biz_item").value = st.st_biz_item || "";
        document.getElementById("sm-edit-st_address").value = st.st_address || "";
        var title = document.getElementById("sm-edit-title");
        if (title) {
            title.textContent =
                (st.role === "supervisor" ? "슈퍼바이저" : "관리자") + " 수정 — " + (st.loginId || "");
        }
        if (editDeleteBtn) {
            var canDelete = st.role === "admin";
            editDeleteBtn.hidden = false;
            editDeleteBtn.disabled = !canDelete;
            editDeleteBtn.title = canDelete
                ? "이 관리자 계정을 삭제합니다"
                : "슈퍼바이저·기본 계정은 삭제할 수 없습니다";
        }
    }

    function showEditModal() {
        if (modal) {
            modal.hidden = false;
            document.body.style.overflow = "hidden";
        }
    }

    function renderList(items) {
        if (!listEl) return;
        staffByKey = {};
        (items || []).forEach(function (it) {
            var key = staffKey(it);
            if (key) staffByKey[key] = it;
        });
        var rows = (items || []).slice().sort(function (a, b) {
            var ra = a.role === "supervisor" ? 0 : 1;
            var rb = b.role === "supervisor" ? 0 : 1;
            if (ra !== rb) return ra - rb;
            return String(a.loginId || "").localeCompare(String(b.loginId || ""), "ko");
        });
        if (!rows.length) {
            listEl.innerHTML = '<p class="am-list-empty">등록된 계정이 없습니다.</p>';
            return;
        }
        listEl.innerHTML =
            '<ul class="sm-list">' +
            rows
                .map(function (it) {
                    var meta = [
                        it.loginId ? "아이디: " + it.loginId : "",
                        it.st_ceo ? "대표: " + it.st_ceo : "",
                        it.st_biz_no ? "사업자: " + it.st_biz_no : ""
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    var key = staffKey(it);
                    return (
                        '<li><button type="button" class="sm-list-item" data-staff-id="' +
                        escapeHtml(key) +
                        '"><span class="sm-list-name">' +
                        escapeHtml(it.st_company || it.loginId || "(이름 없음)") +
                        '<span class="' +
                        roleClass(it.role) +
                        '">' +
                        escapeHtml(roleLabel(it.role)) +
                        "</span></span>" +
                        (meta ? '<span class="sm-list-meta">' + escapeHtml(meta) + "</span>" : "") +
                        "</button></li>"
                    );
                })
                .join("") +
            "</ul>";

        listEl.querySelectorAll(".sm-list-item").forEach(function (btn) {
            btn.addEventListener("click", function () {
                openEdit(btn.getAttribute("data-staff-id"));
            });
        });
    }

    function loadList() {
        if (!api || !api.listStaff) {
            setStatus("API를 불러오지 못했습니다.", "err");
            return Promise.resolve();
        }
        setStatus("목록 불러오는 중…");
        return api
            .listStaff()
            .then(function (items) {
                renderList(items);
                setStatus((items || []).length + "건");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "목록을 불러오지 못했습니다.", "err");
            });
    }

    function openEdit(id) {
        var key = String(id || "").trim();
        if (!key || !api.getStaff) return;
        setEditMsg("");
        var cached = staffByKey[key];
        if (cached) {
            fillEditForm(cached);
            showEditModal();
        }
        api
            .getStaff(key)
            .then(function (st) {
                if (!st) {
                    if (cached) return;
                    throw new Error("계정을 찾을 수 없습니다.");
                }
                var cacheKey = staffKey(st);
                if (cacheKey) staffByKey[cacheKey] = st;
                fillEditForm(st);
                setEditMsg("");
                showEditModal();
            })
            .catch(function (err) {
                if (cached) {
                    setEditMsg("서버에서 최신 정보를 불러오지 못했습니다. 목록 데이터를 표시합니다.", "err");
                    return;
                }
                setEditMsg((err && err.message) || "불러오기 실패", "err");
            });
    }

    function closeEdit() {
        if (modal) modal.hidden = true;
        document.body.style.overflow = "";
        setEditMsg("");
        if (editDeleteBtn) {
            editDeleteBtn.hidden = true;
            editDeleteBtn.disabled = false;
        }
    }

    if (regForm) {
        regForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var body = readForm(regForm);
            if (!body.loginId) {
                setStatus("아이디를 입력해 주세요.", "err");
                return;
            }
            if (!body.password || body.password.length < 4) {
                setStatus("비밀번호는 4자 이상입니다.", "err");
                return;
            }
            if (!body.st_company) {
                setStatus("회사명을 입력해 주세요.", "err");
                return;
            }
            setStatus("등록 중…");
            api
                .createStaff(body)
                .then(function () {
                    regForm.reset();
                    setStatus("관리자를 등록했습니다.", "ok");
                    loadList();
                })
                .catch(function (err) {
                    setStatus((err && err.message) || "등록에 실패했습니다.", "err");
                });
        });
    }

    if (editForm) {
        editForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var id = document.getElementById("sm-edit-id").value;
            var body = readForm(editForm);
            delete body.loginId;
            if (!body.st_company) {
                setEditMsg("회사명을 입력해 주세요.", "err");
                return;
            }
            setEditMsg("저장 중…");
            api
                .updateStaff(id, body)
                .then(function () {
                    setEditMsg("저장했습니다.", "ok");
                    loadList();
                    setTimeout(closeEdit, 600);
                })
                .catch(function (err) {
                    setEditMsg((err && err.message) || "저장에 실패했습니다.", "err");
                });
        });
    }

    if (editDeleteBtn) {
        editDeleteBtn.addEventListener("click", function () {
            var id = document.getElementById("sm-edit-id").value;
            var loginId = document.getElementById("sm-edit-loginId").value || "";
            if (!id || !api.deleteStaff) return;
            if (editDeleteBtn.disabled) return;
            var label = loginId ? "아이디 " + loginId : "이 관리자";
            if (
                !window.confirm(
                    label +
                        " 계정을 삭제할까요?\n\n로그인이 차단되며 목록에서 사라집니다. (DB에는 비활성 기록으로 남습니다.)"
                )
            ) {
                return;
            }
            setEditMsg("삭제 중…");
            api
                .deleteStaff(id)
                .then(function () {
                    closeEdit();
                    setStatus("관리자 계정을 삭제했습니다.", "ok");
                    loadList();
                })
                .catch(function (err) {
                    setEditMsg((err && err.message) || "삭제에 실패했습니다.", "err");
                });
        });
    }

    document.getElementById("sm-edit-close").addEventListener("click", closeEdit);
    document.getElementById("sm-edit-cancel").addEventListener("click", closeEdit);
    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeEdit();
        });
    }

    if (!window.THEJHON_AUTH || !THEJHON_AUTH.getStaffManageAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (THEJHON_AUTH.normalizeLegacySession) THEJHON_AUTH.normalizeLegacySession();
    var access = THEJHON_AUTH.getStaffManageAccess();
    if (!access.allowed) {
        setStatus(access.reason, "err");
        return;
    }

    loadList();
})();
