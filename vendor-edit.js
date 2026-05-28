(function () {
    var api = window.THEJHON_API;
    var VF = window.THEJHON_VENDOR_FORM;
    var PF = window.THEJHON_PRODUCT_FORM;

    function apiErrorMessage(err, fallback) {
        if (!err) return fallback || "요청에 실패했습니다.";
        if (err.status === 401) {
            return "로그인이 필요합니다. 관리자로 로그인한 뒤 다시 저장해 주세요.";
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

    function prepareLogoForSave(logoData) {
        return logoData || "";
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
    var submitBtn = document.getElementById("vr-submit");
    var backListLink = document.getElementById("ve-back-list");

    function queryParam(name) {
        try {
            return new URLSearchParams(window.location.search).get(name) || "";
        } catch (e) {
            return "";
        }
    }

    function listReturnUrl() {
        return queryParam("from") === "new" ? "vendor-new-list.html" : "vendor-list-admin.html";
    }

    function isFromNewVendorFlow() {
        return queryParam("from") === "new";
    }

    function syncNewVendorDeptCheckbox(depts) {
        if (!deptCheckboxesRoot) return;
        var el = deptCheckboxesRoot.querySelector("[data-vr-dept-new-only]");
        if (!el) return;
        var show =
            isFromNewVendorFlow() ||
            (depts || []).some(function (id) {
                return String(id || "").trim().toLowerCase() === "uncontracted";
            });
        el.hidden = !show;
    }

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
        if (g === "4") g = "3";
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

    if (VF && VF.initLoginIdDuplicateCheck && api) {
        idDupCheck = VF.initLoginIdDuplicateCheck({
            loginIdInput: loginIdInput,
            hintEl: document.getElementById("vr-id-dup-hint"),
            isReserved: VF.isReservedVendorLoginId,
            getExcludeId: function () {
                return editIdInput ? editIdInput.value.trim() : "";
            },
            checkDuplicate: function (loginId, excludeId) {
                if (isFromNewVendorFlow() && api.checkVendorProspectLoginId) {
                    return api.checkVendorProspectLoginId(loginId, excludeId);
                }
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
        cancelBtn.hidden = false;
        submitBtn.textContent = "수정 저장";
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

    function fillFormFromItem(it) {
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
        syncNewVendorDeptCheckbox(it.vn_depts || []);
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
        setStatus("수정 중: " + (it.vn_company || ""));
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
        location.href = listReturnUrl();
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var loginId = loginIdInput.value.trim();
        var vn_company = companyInput.value.trim();
        var editingId = editIdInput.value.trim();
        var pwdIn = passwordInput ? String(passwordInput.value || "").trim() : "";
        var vn_depts = getSelectedDepts();

        if (!editingId) {
            setStatus("업체를 찾을 수 없습니다. 리스트에서 다시 선택해 주세요.", true);
            return;
        }
        if (VF && pwConfirmCheck) {
            var pwErr = pwConfirmCheck.validate(false);
            if (pwErr) {
                setStatus(pwErr, true);
                passwordInput.focus();
                return;
            }
        }

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

        var fieldErr = VF ? VF.validateVendorFields(body, { requirePassword: false }) : "";
        if (fieldErr) {
            setStatus(fieldErr, true);
            return;
        }

        function doSave(logoData) {
            body.vn_logo = prepareLogoForSave(logoData);
            submitBtn.disabled = true;
            var saveApi =
                isFromNewVendorFlow() && api.updateVendorProspect
                    ? api.updateVendorProspect(editingId, body)
                    : api.updateVendor(editingId, body);
            saveApi
                .then(function () {
                    setStatus("수정했습니다. 리스트로 이동합니다…");
                    setTimeout(function () {
                        location.href = listReturnUrl();
                    }, 350);
                })
                .catch(function (err) {
                    setStatus(err.message || "저장에 실패했습니다.", true);
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
        return;
    }

    if (backListLink) backListLink.href = listReturnUrl();
    syncNewVendorDeptCheckbox();

    var editId = queryParam("id").trim();
    if (!editId) {
        location.replace("vendor-list-admin.html");
        return;
    }

    editIdInput.value = editId;
    setStatus("불러오는 중…");
    function loadItem() {
        if (isFromNewVendorFlow() && api.getVendorProspect) {
            return api.getVendorProspect(editId).catch(function (err) {
                if (err && err.status === 404 && api.getVendor) {
                    return api.getVendor(editId);
                }
                throw err;
            });
        }
        return api.getVendor(editId);
    }
    loadItem()
        .then(function (it) {
            if (!it || !it.id) throw new Error("업체를 찾을 수 없습니다.");
            fillFormFromItem(it);
        })
        .catch(function (err) {
            setStatus(apiErrorMessage(err, "업체 정보를 불러오지 못했습니다."), true);
            setFormDisabled(true);
        });
})();
