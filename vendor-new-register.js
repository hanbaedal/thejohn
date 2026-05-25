/**
 * 신규업체 등록 — vn_record_type: new
 */
(function () {
    var api = window.THEJHON_API;
    var VF = window.THEJHON_VENDOR_FORM;
    var PF = window.THEJHON_PRODUCT_FORM;

    var form = document.getElementById("vr-form");
    var statusEl = document.getElementById("vr-status");
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
    var noteInput = document.getElementById("vr-note");
    var submitBtn = document.getElementById("vr-submit");

    var pendingLogoData = "";
    var logoPicker = null;
    var idDupCheck = null;
    var pwConfirmCheck = null;

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function getSelectedDepts() {
        return VF && VF.readDeptCheckboxValues
            ? VF.readDeptCheckboxValues(deptCheckboxesRoot)
            : [];
    }

    function clearSelectedDepts() {
        if (VF && VF.clearDeptCheckboxValues) VF.clearDeptCheckboxValues(deptCheckboxesRoot);
    }

    function updateLogoPreview(src) {
        if (PF && PF.showImagePreview) {
            PF.showImagePreview(logoPreview, src);
            return;
        }
        if (!logoPreview) return;
        if (src) {
            logoPreview.src = src;
            logoPreview.removeAttribute("hidden");
        } else {
            logoPreview.removeAttribute("src");
            logoPreview.setAttribute("hidden", "");
        }
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
            isReserved: VF.isReservedVendorLoginId,
            checkDuplicate: function (loginId, excludeId) {
                return api.checkVendorLoginId(loginId, excludeId);
            }
        });
    }

    function handleLogoFile(dataUrl) {
        pendingLogoData = dataUrl;
        updateLogoPreview(dataUrl);
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
                updateLogoPreview("");
            }
        });
    }

    if (gradeSelect) gradeSelect.value = "1";

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (pwConfirmCheck) {
            var pwMatchErr = pwConfirmCheck.validate(true);
            if (pwMatchErr) {
                setStatus(pwMatchErr, true);
                passwordInput.focus();
                return;
            }
        }

        var body = {
            loginId: loginIdInput.value.trim(),
            password: passwordInput ? String(passwordInput.value || "").trim() : "",
            vn_company: companyInput.value.trim(),
            vn_depts: getSelectedDepts(),
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
            vn_logo: pendingLogoData || "",
            vn_note: noteInput.value.trim(),
            vn_record_type: "new"
        };

        var err = VF ? VF.validateVendorFields(body, { requirePassword: true }) : "";
        if (err) {
            setStatus(err, true);
            return;
        }

        function saveVendor() {
            submitBtn.disabled = true;
            api.createVendor(body)
                .then(function () {
                    form.reset();
                    pendingLogoData = "";
                    if (logoPicker) logoPicker.clear();
                    if (idDupCheck) idDupCheck.reset();
                    updateLogoPreview("");
                    clearSelectedDepts();
                    if (gradeSelect) gradeSelect.value = "1";
                    setStatus("신규업체를 저장했습니다. 신규업체 리스트에서 확인·수정할 수 있습니다.");
                })
                .catch(function (err2) {
                    setStatus(err2.message || "저장에 실패했습니다.", true);
                })
                .finally(function () {
                    submitBtn.disabled = false;
                });
        }

        if (!idDupCheck) {
            saveVendor();
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
            saveVendor();
        });
    });

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getRegisterAccess
            ? THEJHON_AUTH.getRegisterAccess()
            : { allowed: false, reason: "인증 스크립트를 불러오지 못했습니다." };
    if (!access.allowed) {
        setStatus(access.reason, true);
        if (form) {
            var fields = form.querySelectorAll("input, textarea, button, select");
            for (var i = 0; i < fields.length; i++) fields[i].disabled = true;
        }
    } else {
        var hintEl = document.getElementById("vr-registrar-hint");
        if (hintEl && window.THEJHON_AUTH) {
            var who = THEJHON_AUTH.getLoggedInCompanyDisplayName
                ? THEJHON_AUTH.getLoggedInCompanyDisplayName()
                : "";
            var uid = THEJHON_AUTH.getUserId ? THEJHON_AUTH.getUserId() : "";
            hintEl.textContent =
                "신규 업체는 로그인한 관리자(" +
                (who || uid) +
                ") 담당으로 저장됩니다.";
            hintEl.hidden = false;
        }
    }
})();
