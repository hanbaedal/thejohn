(function () {
    var RESERVED_LOGIN_IDS = ["thejohn", "thejhon", "aksangsa"];
    var api = window.THEJHON_API;
    var VF = window.THEJHON_VENDOR_FORM;
    var PF = window.THEJHON_PRODUCT_FORM;

    function apiErrorMessage(err, fallback) {
        if (!err) return fallback || "요청에 실패했습니다.";
        if (err.status === 401) {
            return "로그인이 필요합니다. 관리자(thejohn, aksangsa)로 로그인한 뒤 다시 저장해 주세요.";
        }
        if (err.status === 403) {
            return "관리자(스테프)만 업체를 등록·수정·삭제할 수 있습니다.";
        }
        if (err.status === 503) {
            return err.message || "데이터베이스에 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.";
        }
        return err.message || fallback || "요청에 실패했습니다.";
    }

    function setFormDisabled(disabled) {
        if (!form) return;
        var fields = form.querySelectorAll("input, textarea, button, select");
        for (var i = 0; i < fields.length; i++) {
            fields[i].disabled = disabled;
        }
    }

    function normalizeLoginIdLocal(s) {
        return String(s || "")
            .trim()
            .toLowerCase();
    }

    function isReservedVendorLoginId(loginId) {
        return RESERVED_LOGIN_IDS.indexOf(normalizeLoginIdLocal(loginId)) >= 0;
    }

    function apiHealthUrl() {
        var base =
            api && api.config && api.config.baseUrl
                ? String(api.config.baseUrl).replace(/\/$/, "")
                : "";
        if (base) return base + "/api/health";
        if (typeof location !== "undefined" && location.origin && /^https?:/.test(location.protocol)) {
            return location.origin + "/api/health";
        }
        return "/api/health";
    }

    function checkApiServer() {
        return fetch(apiHealthUrl())
            .then(function (res) {
                return res.json().catch(function () {
                    return {};
                });
            })
            .then(function (h) {
                if (!h || !h.db) {
                    throw new Error(
                        "API 서버(MongoDB)에 연결되지 않습니다. https://thejohn.onrender.com 에서 로그인·저장해 주세요."
                    );
                }
                return h;
            });
    }

    function prepareLogoForSave(logoData) {
        return logoData || "";
    }

    function saveVendorToServer(editingId, body) {
        if (!api || !api.getToken || !api.getToken()) {
            return Promise.reject(
                new Error(
                    "로그인 토큰이 없습니다. 로그아웃 후 thejohn / aksangsa 로 다시 로그인해 주세요."
                )
            );
        }
        return api.checkSession().then(function (sess) {
            if (!sess || !sess.loggedIn) {
                throw new Error(
                    (sess && sess.error) ||
                        "로그인 세션이 만료되었습니다. 다시 로그인해 주세요."
                );
            }
            if (sess.role !== "admin" && sess.role !== "supervisor") {
                throw new Error("관리자만 vendors 컬렉션에 저장할 수 있습니다.");
            }
            return editingId ? api.updateVendor(editingId, body) : api.createVendor(body);
        });
    }

    var form = document.getElementById("vr-form");
    var statusEl = document.getElementById("vr-status");
    var editIdInput = document.getElementById("vr-edit-id");
    var loginIdInput = document.getElementById("vr-login-id");
    var passwordInput = document.getElementById("vr-login-pw");
    var password2Input = document.getElementById("vr-login-pw2");
    var deptCheckboxesRoot = document.getElementById("vr-dept-checkboxes");
    var companyInput = document.getElementById("vr-company");
    var ceoInput = document.getElementById("vr-ceo");
    var ceoTelInput = document.getElementById("vr-ceo-tel");
    var gradeSelect = document.getElementById("vr-grade");
    var webInput = document.getElementById("vr-web");
    var emailInput = document.getElementById("vr-email");
    var phoneInput = document.getElementById("vr-phone");
    var addrInput = document.getElementById("vr-addr");
    var mgrNameInput = document.getElementById("vr-mgr-name");
    var mgrTelInput = document.getElementById("vr-mgr-tel");
    var mgrEmailInput = document.getElementById("vr-mgr-email");
    var logoPreview = document.getElementById("vr-logo-preview");
    var logoPicker = null;
    var noteInput = document.getElementById("vr-note");
    var cancelBtn = document.getElementById("vr-cancel-edit");
    var listEl = document.getElementById("vr-list");
    var isCreateOnly = !listEl;
    var submitBtn = document.getElementById("vr-submit");

    var pendingLogoData = "";
    var cachedItems = [];
    var idDupCheck = null;
    var pwConfirmCheck = null;

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeMultiline(s) {
        return String(s)
            .split("\n")
            .map(function (line) {
                return escapeHtml(line);
            })
            .join("<br>");
    }

    function safeWebHref(s) {
        var t = String(s || "").trim();
        if (!t) return "";
        if (/^https?:\/\//i.test(t)) return t;
        return "https://" + t;
    }

    function setGrade(value) {
        if (!gradeSelect) return;
        var g = String(value || "1");
        if (g !== "1" && g !== "2" && g !== "3") g = "1";
        gradeSelect.value = g;
    }

    function getSelectedDepts() {
        return VF && VF.readDeptCheckboxValues
            ? VF.readDeptCheckboxValues(deptCheckboxesRoot)
            : [];
    }

    function setSelectedDepts(ids) {
        if (VF && VF.writeDeptCheckboxValues) VF.writeDeptCheckboxValues(deptCheckboxesRoot, ids);
    }

    function clearSelectedDepts() {
        if (VF && VF.clearDeptCheckboxValues) VF.clearDeptCheckboxValues(deptCheckboxesRoot);
    }

    if (VF) {
        VF.initPasswordToggle(passwordInput, document.getElementById("vr-pw-toggle"));
        VF.initPasswordToggle(password2Input, document.getElementById("vr-pw2-toggle"));
        pwConfirmCheck = VF.initPasswordConfirm({
            passwordInput: passwordInput,
            confirmInput: password2Input,
            hintEl: document.getElementById("vr-pw-match-hint")
        });
    }

    if (VF && VF.initLoginIdDuplicateCheck && api && api.checkVendorLoginId) {
        idDupCheck = VF.initLoginIdDuplicateCheck({
            loginIdInput: loginIdInput,
            hintEl: document.getElementById("vr-id-dup-hint"),
            isReserved: isReservedVendorLoginId,
            getExcludeId: function () {
                return editIdInput ? editIdInput.value.trim() : "";
            },
            checkDuplicate: function (loginId, excludeId) {
                return api.checkVendorLoginId(loginId, excludeId);
            }
        });
    }

    function setPreview(imgEl, src) {
        if (PF && PF.showImagePreview) {
            PF.showImagePreview(imgEl, src);
            return;
        }
        if (!imgEl) return;
        if (src) {
            imgEl.src = src;
            imgEl.removeAttribute("hidden");
        } else {
            imgEl.removeAttribute("src");
            imgEl.setAttribute("hidden", "");
        }
    }

    function resetForm() {
        if (!form) return;
        form.reset();
        editIdInput.value = "";
        pendingLogoData = "";
        setPreview(logoPreview, "");
        if (logoPicker) logoPicker.clear();
        setGrade("1");
        clearSelectedDepts();
        if (idDupCheck) idDupCheck.reset();
        if (password2Input) password2Input.value = "";
        cancelBtn.hidden = true;
        submitBtn.textContent = "저장";
        submitBtn.disabled = false;
    }

    function thumbBlock(dataUrl, label) {
        if (dataUrl) {
            return "<img class=\"vr-thumb\" src=" + JSON.stringify(dataUrl) + ' alt="' + escapeHtml(label) + '">';
        }
        return (
            '<div class="vr-thumb vr-thumb--empty" role="img" aria-label="' +
            escapeHtml(label + " 없음") +
            '">' +
            escapeHtml(label) +
            "<br>없음</div>"
        );
    }

    function renderList() {
        var items = cachedItems.slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="vr-card-note">등록된 업체가 없습니다. 위 양식에서 저장해 보세요.</p>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it) {
                var w = it.vn_web && String(it.vn_web).trim();
                var em = it.vn_email && String(it.vn_email).trim();
                var webLine = "";
                if (w) {
                    var href = safeWebHref(w);
                    webLine =
                        '홈페이지: <a href="' +
                        escapeHtml(href) +
                        '" target="_blank" rel="noopener noreferrer">' +
                        escapeHtml(w) +
                        "</a><br>";
                }
                var emailLine = em
                    ? '회사 이메일: <a href="mailto:' + escapeHtml(em) + '">' + escapeHtml(em) + "</a><br>"
                    : "";
                var noteBlock = it.vn_note && String(it.vn_note).trim()
                    ? '<p class="vr-card-note">' + escapeMultiline(String(it.vn_note).trim()) + "</p>"
                    : "";
                var addrBlock = "";
                if (it.vn_addr && String(it.vn_addr).trim()) {
                    addrBlock =
                        '주소: <span class="vr-card-addr">' +
                        escapeMultiline(String(it.vn_addr).trim()) +
                        "</span><br>";
                }
                var grade = it.vn_grade || "1";
                return (
                    '<article class="vr-card" data-id="' +
                    escapeHtml(it.id) +
                    '"><div class="vr-card-head">' +
                    thumbBlock(it.vn_logo, "로고") +
                    '<div class="vr-card-main"><h3 class="vr-card-title">' +
                    escapeHtml(it.vn_company || "") +
                    '<span class="vr-grade-badge">등급 ' +
                    escapeHtml(grade) +
                    "</span></h3><p class="vr-card-meta">아이디: " +
                    escapeHtml(it.loginId || "—") +
                    "<br>" +
                    addrBlock +
                    "대표: " +
                    escapeHtml(it.vn_ceo || "—") +
                    " · 대표 연락처: " +
                    escapeHtml(it.vn_ceo_tel || "—") +
                    " · 회사 전화: " +
                    escapeHtml(it.vn_phone || "—") +
                    "<br>" +
                    "담당: " +
                    escapeHtml(it.vn_mgr_name || "—") +
                    " · " +
                    escapeHtml(it.vn_mgr_tel || "—") +
                    " · " +
                    escapeHtml(it.vn_mgr_email || "—") +
                    "<br>" +
                    webLine +
                    emailLine +
                    '</p>' +
                    noteBlock +
                    '<div class="vr-card-actions"><button type="button" class="vr-btn-edit" data-id="' +
                    escapeHtml(it.id) +
                    '">수정</button><button type="button" class="vr-btn-del" data-id="' +
                    escapeHtml(it.id) +
                    '">삭제</button></div></div></div></article>'
                );
            })
            .join("");
    }

    function loadList() {
        if (!api) {
            setStatus("API를 불러오지 못했습니다.", true);
            return Promise.resolve();
        }
        setStatus("목록 불러오는 중…");
        return api
            .listVendors()
            .then(function (items) {
                cachedItems = items;
                renderList();
                setStatus("");
            })
            .catch(function (err) {
                setStatus(apiErrorMessage(err, "목록을 불러오지 못했습니다."), true);
            });
    }

    function loadIntoForm(id) {
        var it = cachedItems.filter(function (x) {
            return x.id === id;
        })[0];
        if (!it) return;
        editIdInput.value = it.id;
        loginIdInput.value = it.loginId || "";
        passwordInput.value = "";
        if (password2Input) password2Input.value = "";
        if (idDupCheck) idDupCheck.reset();
        companyInput.value = it.vn_company || "";
        ceoInput.value = it.vn_ceo || "";
        ceoTelInput.value = it.vn_ceo_tel || "";
        setGrade(it.vn_grade || "1");
        setSelectedDepts(it.vn_depts || []);
        webInput.value = it.vn_web || "";
        emailInput.value = it.vn_email || "";
        phoneInput.value = it.vn_phone || "";
        addrInput.value = it.vn_addr || "";
        mgrNameInput.value = it.vn_mgr_name || "";
        mgrTelInput.value = it.vn_mgr_tel || "";
        mgrEmailInput.value = it.vn_mgr_email || "";
        noteInput.value = it.vn_note || "";
        if (logoPicker) logoPicker.clear();
        pendingLogoData = it.vn_logo || "";
        setPreview(logoPreview, pendingLogoData);
        cancelBtn.hidden = false;
        submitBtn.textContent = "수정 저장";
        setStatus("수정 중입니다. 저장하면 반영됩니다.");
        loginIdInput.focus();
    }

    function deleteById(id) {
        if (!confirm("이 업체 정보를 삭제할까요?")) return;
        api.deleteVendor(id)
            .then(function () {
                if (editIdInput.value === id) resetForm();
                return loadList();
            })
            .then(function () {
                setStatus("삭제했습니다.");
            })
            .catch(function (err) {
                setStatus(apiErrorMessage(err, "삭제에 실패했습니다."), true);
            });
    }

    if (listEl) {
        listEl.addEventListener("click", function (e) {
            var t = e.target;
            if (!(t instanceof HTMLElement)) return;
            if (t.classList.contains("vr-btn-edit")) loadIntoForm(t.getAttribute("data-id"));
            else if (t.classList.contains("vr-btn-del")) deleteById(t.getAttribute("data-id"));
        });
    }

    function handleLogoFile(dataUrl) {
        pendingLogoData = dataUrl;
        setPreview(logoPreview, dataUrl);
        setStatus("로고를 1:1·1MB 이하로 맞춰 적용했습니다.");
    }

    if (PF && PF.initProductPhotoPicker) {
        logoPicker = PF.initProductPhotoPicker({
            galleryInput: document.getElementById("vr-logo-gallery"),
            cameraInput: document.getElementById("vr-logo-camera"),
            btnGallery: document.getElementById("vr-logo-gallery-btn"),
            btnCamera: document.getElementById("vr-logo-camera-btn"),
            onSelect: handleLogoFile,
            onError: function (err) {
                setStatus((err && err.message) || "로고 오류", true);
                if (logoPicker) logoPicker.clear();
                setPreview(logoPreview, editIdInput.value ? pendingLogoData : "");
            }
        });
    }

    cancelBtn.addEventListener("click", function () {
        resetForm();
        setStatus("편집을 취소했습니다.");
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var loginId = loginIdInput.value.trim();
        var vn_company = companyInput.value.trim();
        var editingId = editIdInput.value.trim();
        var pwdIn = passwordInput ? String(passwordInput.value || "").trim() : "";
        var vn_depts = getSelectedDepts();

        if (!editingId && !pwdIn) {
            setStatus("비밀번호(8~16자)를 입력해 주세요.", true);
            if (passwordInput) passwordInput.focus();
            return;
        }

        if (VF) {
            var idFmt = VF.validateLoginIdFormat(loginId);
            if (idFmt) {
                setStatus(idFmt, true);
                loginIdInput.focus();
                return;
            }
        }
        if (isReservedVendorLoginId(loginId)) {
            var reservedMsg =
                "아이디 " + loginId + " 은 관리자 전용입니다. 업체 전용 아이디를 입력해 주세요.";
            setStatus(reservedMsg, true);
            loginIdInput.focus();
            return;
        }
        if (!vn_company) {
            setStatus("업체이름을 입력해 주세요.", true);
            companyInput.focus();
            return;
        }
        if (!vn_depts.length) {
            setStatus("사업부문을 하나 이상 선택해 주세요.", true);
            return;
        }
        if (VF && pwConfirmCheck) {
            var pwErr = pwConfirmCheck.validate(!editingId);
            if (pwErr) {
                setStatus(pwErr, true);
                passwordInput.focus();
                return;
            }
        }

        function doSave(logoData) {
            var wasEditing = !!editingId;
            var body = {
                loginId: loginId,
                vn_company: vn_company,
                vn_depts: vn_depts,
                vn_ceo: ceoInput.value.trim(),
                vn_ceo_tel: ceoTelInput.value.trim(),
                vn_grade: gradeSelect && gradeSelect.value ? gradeSelect.value : "1",
                vn_web: webInput.value.trim(),
                vn_email: emailInput.value.trim(),
                vn_phone: phoneInput.value.trim(),
                vn_addr: addrInput.value.trim(),
                vn_mgr_name: mgrNameInput.value.trim(),
                vn_mgr_tel: mgrTelInput.value.trim(),
                vn_mgr_email: mgrEmailInput.value.trim(),
                vn_logo: "",
                vn_note: noteInput.value.trim()
            };
            if (pwdIn) body.password = pwdIn;
            else if (!editingId) {
                setStatus("비밀번호(8~16자)를 입력해 주세요.", true);
                return;
            }

            submitBtn.disabled = true;
            setStatus("MongoDB vendors 컬렉션에 저장 중…");

            var logoPromise;
            try {
                body.vn_logo = prepareLogoForSave(logoData);
                logoPromise = Promise.resolve();
            } catch (logoErr) {
                logoPromise = Promise.reject(logoErr);
            }

            logoPromise
                .then(function () {
                    return saveVendorToServer(editingId, body);
                })
                .then(function (saved) {
                    resetForm();
                    if (isCreateOnly) {
                        var idMsg0 = saved && saved.id ? " (ID: " + saved.id + ")" : "";
                        setStatus("MongoDB vendors에 저장했습니다." + idMsg0);
                        return;
                    }
                    return loadList().then(function () {
                        return { saved: saved, wasEditing: wasEditing };
                    });
                })
                .then(function (result) {
                    if (!result) return;
                    var saved = result.saved;
                    var idMsg = saved && saved.id ? " (ID: " + saved.id + ")" : "";
                    setStatus(
                        (result.wasEditing ? "수정했습니다." : "MongoDB vendors에 저장했습니다.") + idMsg
                    );
                })
                .catch(function (err) {
                    var msg = apiErrorMessage(err, "저장에 실패했습니다.");
                    if (err.status === 409) {
                        msg = (err.data && err.data.error) || "이미 사용 중인 아이디입니다.";
                    }
                    if (err.status === 400) {
                        msg = (err.data && err.data.error) || msg;
                    }
                    setStatus(msg, true);
                    alert("vendors 컬렉션에 저장되지 않았습니다.\n\n" + msg);
                })
                .finally(function () {
                    submitBtn.disabled = false;
                });
        }

        function startSave() {
            doSave(pendingLogoData);
        }

        if (!idDupCheck) {
            startSave();
            return;
        }
        idDupCheck.checkNow().then(function (res) {
            if (res && res.duplicate) {
                setStatus((res && res.error) || "이미 사용 중인 아이디입니다.", true);
                loginIdInput.focus();
                return;
            }
            if (idDupCheck.isChecking()) {
                setStatus("아이디 중복 확인 중입니다. 잠시 후 다시 시도해 주세요.", true);
                return;
            }
            startSave();
        });
    });

    setGrade("1");

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getRegisterAccess
            ? THEJHON_AUTH.getRegisterAccess()
            : { allowed: false, reason: "인증 스크립트를 불러오지 못했습니다." };

    if (!access.allowed) {
        setStatus(access.reason, true);
        setFormDisabled(true);
        if (listEl) {
            listEl.innerHTML =
                '<p class="vr-card-note">MongoDB <strong>vendors</strong> 컬렉션에 저장하려면 관리자 로그인이 필요합니다. <a href="login.html?next=vendor-register.html">로그인</a></p>';
        }
        return;
    }

    setFormDisabled(true);
    setStatus("서버 로그인 세션 확인 중…");

    checkApiServer()
        .then(function () {
            return api.checkSession();
        })
        .then(function (sess) {
            if (!sess || !sess.loggedIn) {
                throw new Error(
                    (sess && sess.error) ||
                        "브라우저에만 로그인된 것처럼 보입니다. 로그아웃 후 thejohn 으로 다시 로그인해 주세요."
                );
            }
            if (sess.role !== "admin" && sess.role !== "supervisor") {
                throw new Error("관리자(스테프)만 저장할 수 있습니다. 업체 계정으로는 업체등록 메뉴를 쓸 수 없습니다.");
            }
            setFormDisabled(false);
            setStatus(
                "관리자 확인됨 (" +
                    sess.userId +
                    ") · 저장 시 Atlas DB thejhon → 컬렉션 vendors 에 기록됩니다."
            );
            if (isCreateOnly) {
                setStatus(
                    "관리자 확인됨 (" +
                        sess.userId +
                        ") · 저장 시 Atlas DB thejhon → 컬렉션 vendors 에 기록됩니다."
                );
                return;
            }
            return loadList();
        })
        .catch(function (err) {
            var msg = apiErrorMessage(err, err.message);
            setStatus(msg, true);
            if (/로그인|토큰|세션|401|403/i.test(msg)) {
                alert(msg);
                if (window.THEJHON_AUTH && THEJHON_AUTH.clearSession) {
                    THEJHON_AUTH.clearSession();
                }
            }
            if (listEl) {
                listEl.innerHTML =
                    '<p class="vr-card-note">컬렉션 이름은 <strong>vendors</strong> 입니다 (venders 아님).<br><a href="login.html?next=vendor-register.html">thejohn / aksangsa 로 다시 로그인</a> 후 저장하세요.</p>';
            }
        });
})();
