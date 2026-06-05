/**
 * 슈퍼바이저 — 관리자(staff) 등록
 */
(function () {
    var api = window.THEJHON_API;
    var statusEl = document.getElementById("sm-status");
    var regForm = document.getElementById("sm-register-form");
    var pendingRegLogo = "";
    var pendingRegSeal = "";
    var PF = window.THEJHON_PRODUCT_FORM;
    var AF = window.THEJHON_ADDRESS_FIELDS;

    var regAddrPicker =
        AF && AF.mount
            ? AF.mount(document.getElementById("sm-reg-address-mount"), {
                  idPrefix: "sm-reg-",
                  label: "사업장소재지"
              })
            : null;
    var STAFF_LOGO_PROCESS_OPTIONS =
        PF && PF.STAFF_LOGO_PROCESS_OPTIONS
            ? PF.STAFF_LOGO_PROCESS_OPTIONS
            : { maxDimension: 512, fixedDimension: true, fit: "contain", maxBytes: 1024 * 1024 };
    var STAFF_SEAL_PIXEL_SIZE = PF && PF.STAFF_SEAL_PIXEL_SIZE ? PF.STAFF_SEAL_PIXEL_SIZE : 160;
    var STAFF_SEAL_PROCESS_OPTIONS =
        PF && PF.STAFF_SEAL_PROCESS_OPTIONS
            ? PF.STAFF_SEAL_PROCESS_OPTIONS
            : {
                  maxDimension: STAFF_SEAL_PIXEL_SIZE,
                  fixedDimension: true,
                  fit: "contain",
                  maxBytes: 1024 * 1024
              };

    function updateImagePreview(imgEl, clearBtn, src) {
        if (PF && PF.showImagePreview) {
            PF.showImagePreview(imgEl, src);
        } else if (imgEl) {
            if (src) {
                imgEl.src = src;
                imgEl.removeAttribute("hidden");
            } else {
                imgEl.removeAttribute("src");
                imgEl.setAttribute("hidden", "");
            }
        }
        if (clearBtn) clearBtn.hidden = !src;
    }

    function initImagePicker(opts) {
        if (!PF || !PF.initProductPhotoPicker) return null;
        return PF.initProductPhotoPicker({
            galleryInput: opts.galleryInput,
            cameraInput: opts.cameraInput,
            btnGallery: opts.btnGallery,
            btnCamera: opts.btnCamera,
            onSelect: opts.onSelect,
            onError: opts.onError,
            processOptions: opts.processOptions || STAFF_LOGO_PROCESS_OPTIONS
        });
    }

    var regLogoPicker = initImagePicker({
        galleryInput: document.getElementById("sm-reg-logo-gallery"),
        cameraInput: document.getElementById("sm-reg-logo-camera"),
        btnGallery: document.getElementById("sm-reg-logo-gallery-btn"),
        btnCamera: document.getElementById("sm-reg-logo-camera-btn"),
        processOptions: STAFF_LOGO_PROCESS_OPTIONS,
        onSelect: function (dataUrl) {
            pendingRegLogo = dataUrl || "";
            updateImagePreview(
                document.getElementById("sm-reg-logo-preview"),
                document.getElementById("sm-reg-logo-clear"),
                pendingRegLogo
            );
        },
        onError: function (err) {
            setStatus((err && err.message) || "로고 오류", "err");
            pendingRegLogo = "";
            updateImagePreview(
                document.getElementById("sm-reg-logo-preview"),
                document.getElementById("sm-reg-logo-clear"),
                ""
            );
        }
    });

    var regSealPicker = initImagePicker({
        galleryInput: document.getElementById("sm-reg-seal-gallery"),
        cameraInput: document.getElementById("sm-reg-seal-camera"),
        btnGallery: document.getElementById("sm-reg-seal-gallery-btn"),
        btnCamera: document.getElementById("sm-reg-seal-camera-btn"),
        processOptions: STAFF_SEAL_PROCESS_OPTIONS,
        onSelect: function (dataUrl) {
            pendingRegSeal = dataUrl || "";
            updateImagePreview(
                document.getElementById("sm-reg-seal-preview"),
                document.getElementById("sm-reg-seal-clear"),
                pendingRegSeal
            );
        },
        onError: function (err) {
            setStatus((err && err.message) || "도장 오류", "err");
            pendingRegSeal = "";
            updateImagePreview(
                document.getElementById("sm-reg-seal-preview"),
                document.getElementById("sm-reg-seal-clear"),
                ""
            );
        }
    });

    var regLogoClear = document.getElementById("sm-reg-logo-clear");
    if (regLogoClear) {
        regLogoClear.addEventListener("click", function () {
            pendingRegLogo = "";
            if (regLogoPicker && regLogoPicker.clear) regLogoPicker.clear();
            updateImagePreview(
                document.getElementById("sm-reg-logo-preview"),
                regLogoClear,
                ""
            );
        });
    }

    var regSealClear = document.getElementById("sm-reg-seal-clear");
    if (regSealClear) {
        regSealClear.addEventListener("click", function () {
            pendingRegSeal = "";
            if (regSealPicker && regSealPicker.clear) regSealPicker.clear();
            updateImagePreview(
                document.getElementById("sm-reg-seal-preview"),
                regSealClear,
                ""
            );
        });
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "sm-status" + (kind === "err" ? " sm-status--err" : kind === "ok" ? " sm-status--ok" : "");
    }

    function readForm(form, addrPicker) {
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
            st_facebook: String(fd.get("st_facebook") || "").trim(),
            st_instagram: String(fd.get("st_instagram") || "").trim(),
            st_naver_cafe: String(fd.get("st_naver_cafe") || "").trim(),
            st_youtube: String(fd.get("st_youtube") || "").trim(),
            st_kakao: String(fd.get("st_kakao") || "").trim()
        };
        var orderEl = form.querySelector('[name="orderEnabled"]');
        body.orderEnabled = !!(orderEl && orderEl.checked);
        if (addrPicker) {
            var addrErr = addrPicker.validate();
            if (addrErr) return { error: addrErr };
            addrPicker.applyToBody(body);
            body.st_address = addrPicker.getValues().formatted;
        }
        if (!body.password) delete body.password;
        return body;
    }

    function resetBrandMedia() {
        pendingRegLogo = "";
        pendingRegSeal = "";
        updateImagePreview(
            document.getElementById("sm-reg-logo-preview"),
            document.getElementById("sm-reg-logo-clear"),
            ""
        );
        updateImagePreview(
            document.getElementById("sm-reg-seal-preview"),
            document.getElementById("sm-reg-seal-clear"),
            ""
        );
        if (regLogoPicker && regLogoPicker.clear) regLogoPicker.clear();
        if (regSealPicker && regSealPicker.clear) regSealPicker.clear();
    }

    if (regForm) {
        regForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var body = readForm(regForm, regAddrPicker);
            if (body.error) {
                setStatus(body.error, "err");
                return;
            }
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
            if (pendingRegLogo) body.st_logo = pendingRegLogo;
            if (pendingRegSeal) body.st_seal = pendingRegSeal;
            setStatus("등록 중…");
            api
                .createStaff(body)
                .then(function () {
                    regForm.reset();
                    resetBrandMedia();
                    if (regAddrPicker && regAddrPicker.clear) regAddrPicker.clear();
                    setStatus("관리자를 등록했습니다. 목록에서 확인·수정할 수 있습니다.", "ok");
                    if (PF && PF.speakKorean) PF.speakKorean("저장되었습니다");
                })
                .catch(function (err) {
                    setStatus((err && err.message) || "등록에 실패했습니다.", "err");
                });
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
    }
})();
