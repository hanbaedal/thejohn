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
    var deptPicker = null;
    var companyInput = document.getElementById("vr-company");
    var ceoInput = document.getElementById("vr-ceo");
    var ceoTelInput = document.getElementById("vr-ceo-tel");
    var gradeSelect = document.getElementById("vr-grade");
    var roomCountInput = document.getElementById("vr-room-count");
    var webInput = document.getElementById("vr-web");
    var emailInput = document.getElementById("vr-email");
    var phoneInput = document.getElementById("vr-phone");
    var bizNoInput = document.getElementById("vr-biz-no");
    var bizItemInput = document.getElementById("vr-biz-item");
    var bizTypeInput = document.getElementById("vr-biz-type");
    var AF = window.THEJHON_ADDRESS_FIELDS;
    var addrPicker =
        AF && AF.mount
            ? AF.mount(document.getElementById("vr-address-mount"), {
                  idPrefix: "vr-",
                  zipName: "vn_zip",
                  addrName: "vn_addr",
                  detailName: "vn_addr_detail",
                  label: "회사 주소"
              })
            : null;
    var mgrNameInput = document.getElementById("vr-mgr-name");
    var mgrTelInput = document.getElementById("vr-mgr-tel");
    var mgrEmailInput = document.getElementById("vr-mgr-email");
    var logoPreview = document.getElementById("vr-logo-preview");
    var noteInput = document.getElementById("vr-note");
    var submitBtn = document.getElementById("vr-submit");

    var prospectIdInput = document.getElementById("vr-prospect-id");
    var pendingLogoData = "";
    var logoPicker = null;
    var idDupCheck = null;
    var pwConfirmCheck = null;
    var prospectPicker = null;

    var LOGIN_REQUIRED_MSG = "아이디와 비밀번호를 입력하세요";
    var loginAlertModal = document.getElementById("vr-login-alert-modal");
    var loginAlertOk = document.getElementById("vr-login-alert-ok");

    function speakAlert(text) {
        if (!text || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            var utter = new SpeechSynthesisUtterance(text);
            utter.lang = "ko-KR";
            utter.rate = 0.95;
            window.speechSynthesis.speak(utter);
        } catch (e) {}
    }

    function closeLoginAlertModal() {
        if (loginAlertModal) loginAlertModal.hidden = true;
    }

    function showLoginRequiredAlert() {
        setStatus(LOGIN_REQUIRED_MSG, true);
        if (loginAlertModal) loginAlertModal.hidden = false;
        speakAlert(LOGIN_REQUIRED_MSG);
        var focusTarget = loginIdInput;
        if (loginIdInput && !loginIdInput.value.trim()) focusTarget = loginIdInput;
        else if (passwordInput && !String(passwordInput.value || "").trim()) focusTarget = passwordInput;
        if (focusTarget) {
            setTimeout(function () {
                focusTarget.focus();
            }, 100);
        }
    }

    if (loginAlertOk) {
        loginAlertOk.addEventListener("click", closeLoginAlertModal);
    }
    if (loginAlertModal) {
        loginAlertModal.addEventListener("click", function (e) {
            if (e.target === loginAlertModal) closeLoginAlertModal();
        });
    }
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && loginAlertModal && !loginAlertModal.hidden) closeLoginAlertModal();
    });

    function hasLoginCredentials() {
        var id = loginIdInput ? loginIdInput.value.trim() : "";
        var pw = passwordInput ? String(passwordInput.value || "").trim() : "";
        return !!(id && pw);
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function getSelectedDepts() {
        return deptPicker ? deptPicker.getValues() : [];
    }

    function setSelectedDepts(ids) {
        if (deptPicker) deptPicker.setValues(ids);
    }

    function setDefaultDepts() {
        setSelectedDepts(["uncontracted"]);
    }

    function setGrade(value) {
        if (!gradeSelect) return;
        var g = String(value || "1");
        if (g === "4") g = "3";
        if (g !== "1" && g !== "2" && g !== "3") g = "1";
        gradeSelect.value = g;
    }

    function fillFromProspect(it) {
        if (!it) return;
        companyInput.value = it.vn_company || "";
        ceoInput.value = it.vn_ceo || "";
        ceoTelInput.value = it.vn_ceo_tel || "";
        setGrade(it.vn_grade || "1");
        if (roomCountInput) roomCountInput.value = it.vn_room_count || "";
        var depts = it.vn_depts && it.vn_depts.length ? it.vn_depts : ["uncontracted"];
        setSelectedDepts(depts);
        webInput.value = it.vn_web || "";
        emailInput.value = it.vn_email || "";
        phoneInput.value = it.vn_phone || "";
        if (bizNoInput) bizNoInput.value = it.vn_biz_no || "";
        if (bizItemInput) bizItemInput.value = it.vn_biz_item || "";
        if (bizTypeInput) bizTypeInput.value = it.vn_biz_type || "";
        if (addrPicker) {
            addrPicker.setValues({
                zip: it.vn_zip,
                addr: it.vn_addr || "",
                detail: it.vn_addr_detail || ""
            });
        }
        mgrNameInput.value = it.vn_mgr_name || "";
        mgrTelInput.value = it.vn_mgr_tel || "";
        mgrEmailInput.value = it.vn_mgr_email || "";
        noteInput.value = it.vn_note || "";
        pendingLogoData = it.vn_logo || "";
        updateLogoPreview(pendingLogoData);
        if (logoPicker && !pendingLogoData) logoPicker.clear();
        setStatus(
            "예비거래처 「" +
                (it.vn_company || "") +
                "」 정보를 불러왔습니다. 로그인 아이디·비밀번호는 새로 입력해 주세요."
        );
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

    if (VF && VF.initVendorDeptModalPicker) {
        deptPicker = VF.initVendorDeptModalPicker({
            catalog: window.THEJHON_PRODUCT_CATALOG,
            openBtn: document.getElementById("vr-dept-open"),
            summaryEl: document.getElementById("vr-dept-summary"),
            modal: document.getElementById("vr-dept-modal"),
            optionsRoot: document.getElementById("vr-dept-modal-options"),
            okBtn: document.getElementById("vr-dept-modal-ok"),
            closeBtn: document.getElementById("vr-dept-modal-close"),
            extraDepts: [{ id: "uncontracted", label: "미계약" }]
        });
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

    if (VF && VF.initLoginIdDuplicateCheck && api && api.checkVendorNewLoginId) {
        idDupCheck = VF.initLoginIdDuplicateCheck({
            loginIdInput: loginIdInput,
            hintEl: document.getElementById("vr-id-dup-hint"),
            isReserved: VF.isReservedVendorLoginId,
            getExcludeId: function () {
                return "";
            },
            checkDuplicate: function (loginId, excludeId) {
                return api.checkVendorNewLoginId(loginId, excludeId);
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
    setDefaultDepts();

    var VPP = window.THEJHON_VENDOR_PROSPECT_PICKER;
    if (VPP && VPP.init && api && api.listVendorProspects) {
        prospectPicker = VPP.init({
            modal: document.getElementById("vp-modal"),
            openBtn: document.getElementById("vr-prospect-open"),
            clearBtn: document.getElementById("vr-prospect-clear"),
            closeBtn: document.getElementById("vp-modal-close"),
            prospectIdInput: prospectIdInput,
            companyInput: companyInput,
            badgeEl: document.getElementById("vr-prospect-badge"),
            searchInput: document.getElementById("vp-search"),
            listEl: document.getElementById("vp-list"),
            statusEl: document.getElementById("vp-status"),
            listProspects: function (q) {
                return api.listVendorProspects(q);
            },
            onSelect: function (it) {
                if (prospectIdInput) prospectIdInput.value = it.id || "";
                fillFromProspect(it);
            },
            onClear: function () {}
        });
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (!hasLoginCredentials()) {
            showLoginRequiredAlert();
            return;
        }

        if (pwConfirmCheck) {
            var pwMatchErr = pwConfirmCheck.validate(true);
            if (pwMatchErr) {
                setStatus(pwMatchErr, true);
                passwordInput.focus();
                return;
            }
        }

        if (addrPicker) {
            var addrErr = addrPicker.validate();
            if (addrErr) {
                setStatus(addrErr, true);
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
            vn_room_count: roomCountInput ? roomCountInput.value.trim() : "",
            vn_web: webInput.value.trim(),
            vn_email: emailInput.value.trim(),
            vn_phone: phoneInput.value.trim(),
            vn_biz_no: bizNoInput ? bizNoInput.value.trim() : "",
            vn_biz_item: bizItemInput ? bizItemInput.value.trim() : "",
            vn_biz_type: bizTypeInput ? bizTypeInput.value.trim() : "",
            vn_mgr_name: mgrNameInput.value.trim(),
            vn_mgr_tel: mgrTelInput.value.trim(),
            vn_mgr_email: mgrEmailInput.value.trim(),
            vn_logo: pendingLogoData || "",
            vn_note: noteInput.value.trim(),
            vn_record_type: "new"
        };
        if (addrPicker) addrPicker.applyToBody(body);

        var prospectSourceId = prospectIdInput ? prospectIdInput.value.trim() : "";
        if (prospectSourceId) body.prospectId = prospectSourceId;
        var err = VF ? VF.validateVendorFields(body, { requirePassword: true }) : "";
        if (err) {
            setStatus(err, true);
            return;
        }

        function saveVendor() {
            submitBtn.disabled = true;
            var savePromise = api.createVendorNew(body);
            savePromise
                .then(function () {
                    form.reset();
                    pendingLogoData = "";
                    if (logoPicker) logoPicker.clear();
                    if (idDupCheck) idDupCheck.reset();
                    updateLogoPreview("");
                    setDefaultDepts();
                    if (gradeSelect) gradeSelect.value = "1";
                    if (prospectPicker) prospectPicker.clear();
                    setStatus("신규업체를 저장했습니다. 신규업체 리스트에서 확인·수정할 수 있습니다.");
                    if (PF && PF.speakKorean) PF.speakKorean("저장되었습니다");
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
        var prospectOpen = document.getElementById("vr-prospect-open");
        if (prospectOpen) prospectOpen.disabled = true;
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
