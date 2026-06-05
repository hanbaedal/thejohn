/**
 * 로그인 관리자·슈퍼바이저 — 본인 정보 수정
 */
(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var AF = window.THEJHON_ADDRESS_FIELDS;
    var form = document.getElementById("sm-self-form");
    var statusEl = document.getElementById("sm-status");
    var loadedStaff = null;
    var loadedFromServer = false;
    var pendingLogo = null;
    var logoTouched = false;
    var pendingSeal = null;
    var sealTouched = false;
    var saveModal = document.getElementById("sm-self-save-modal");
    var saveHintEl = document.getElementById("sm-self-save-hint");
    var saveLogoutBtn = document.getElementById("sm-self-save-logout");
    var saveContinueBtn = document.getElementById("sm-self-save-continue");
    var WORK_HUB_PAGE = "work-hub.html";

    var addrPicker =
        AF && AF.mount
            ? AF.mount(document.getElementById("sm-self-address-mount"), {
                  idPrefix: "sm-self-",
                  label: "사업장소재지"
              })
            : null;

    var STAFF_LOGO_PROCESS_OPTIONS =
        PF && PF.STAFF_LOGO_PROCESS_OPTIONS
            ? PF.STAFF_LOGO_PROCESS_OPTIONS
            : { maxDimension: 512, fixedDimension: true, fit: "contain", maxBytes: 1024 * 1024 };
    var STAFF_SEAL_PROCESS_OPTIONS =
        PF && PF.STAFF_SEAL_PROCESS_OPTIONS
            ? PF.STAFF_SEAL_PROCESS_OPTIONS
            : {
                  maxDimension: PF && PF.STAFF_SEAL_PIXEL_SIZE ? PF.STAFF_SEAL_PIXEL_SIZE : 160,
                  fixedDimension: true,
                  fit: "contain",
                  maxBytes: 1024 * 1024
              };

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "sm-status" + (kind === "err" ? " sm-status--err" : kind === "ok" ? " sm-status--ok" : "");
    }

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
        return PF.initProductPhotoPicker(opts);
    }

    var logoPicker = initImagePicker({
        galleryInput: document.getElementById("sm-self-logo-gallery"),
        cameraInput: document.getElementById("sm-self-logo-camera"),
        btnGallery: document.getElementById("sm-self-logo-gallery-btn"),
        btnCamera: document.getElementById("sm-self-logo-camera-btn"),
        processOptions: STAFF_LOGO_PROCESS_OPTIONS,
        onSelect: function (dataUrl) {
            logoTouched = true;
            pendingLogo = dataUrl || "";
            updateImagePreview(
                document.getElementById("sm-self-logo-preview"),
                document.getElementById("sm-self-logo-clear"),
                pendingLogo
            );
        },
        onError: function (err) {
            setStatus((err && err.message) || "로고 오류", "err");
        }
    });

    var logoClear = document.getElementById("sm-self-logo-clear");
    if (logoClear) {
        logoClear.addEventListener("click", function () {
            logoTouched = true;
            pendingLogo = "";
            if (logoPicker && logoPicker.clear) logoPicker.clear();
            updateImagePreview(
                document.getElementById("sm-self-logo-preview"),
                logoClear,
                ""
            );
        });
    }

    var sealPicker = initImagePicker({
        galleryInput: document.getElementById("sm-self-seal-gallery"),
        cameraInput: document.getElementById("sm-self-seal-camera"),
        btnGallery: document.getElementById("sm-self-seal-gallery-btn"),
        btnCamera: document.getElementById("sm-self-seal-camera-btn"),
        processOptions: STAFF_SEAL_PROCESS_OPTIONS,
        onSelect: function (dataUrl) {
            sealTouched = true;
            pendingSeal = dataUrl || "";
            updateImagePreview(
                document.getElementById("sm-self-seal-preview"),
                document.getElementById("sm-self-seal-clear"),
                pendingSeal
            );
        },
        onError: function (err) {
            setStatus((err && err.message) || "도장 오류", "err");
        }
    });

    var sealClear = document.getElementById("sm-self-seal-clear");
    if (sealClear) {
        sealClear.addEventListener("click", function () {
            sealTouched = true;
            pendingSeal = "";
            if (sealPicker && sealPicker.clear) sealPicker.clear();
            updateImagePreview(
                document.getElementById("sm-self-seal-preview"),
                sealClear,
                ""
            );
        });
    }

    function readForm() {
        if (!form) return { error: "양식을 찾을 수 없습니다." };
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
        if (addrPicker) {
            var addrErr = addrPicker.validate();
            if (addrErr) return { error: addrErr };
            addrPicker.applyToBody(body);
            body.st_address = addrPicker.getValues().formatted;
        }
        if (!body.password) delete body.password;
        return body;
    }

    function staffToUpdateBody(st, overrides) {
        var body = {
            st_company: st.st_company || "",
            st_phone: st.st_phone || "",
            st_fax: st.st_fax || "",
            st_email: st.st_email || "",
            st_web: st.st_web || "",
            st_ceo: st.st_ceo || "",
            st_ceo_tel: st.st_ceo_tel || "",
            st_biz_no: st.st_biz_no || "",
            st_biz_type: st.st_biz_type || "",
            st_biz_item: st.st_biz_item || "",
            st_zip: st.st_zip || "",
            st_addr: st.st_addr || "",
            st_addr_detail: st.st_addr_detail || "",
            st_address: st.st_address || "",
            st_facebook: st.st_facebook || "",
            st_instagram: st.st_instagram || "",
            st_naver_cafe: st.st_naver_cafe || "",
            st_youtube: st.st_youtube || "",
            st_kakao: st.st_kakao || "",
            st_logo: st.st_logo || "",
            st_seal: st.st_seal || ""
        };
        if (overrides) {
            Object.keys(overrides).forEach(function (k) {
                body[k] = overrides[k];
            });
        }
        return body;
    }

    function fillForm(st) {
        if (!st) return;
        loadedStaff = st;
        document.getElementById("sm-self-id").value = st.id || st.loginId || "";
        var loginInput = document.getElementById("sm-self-loginId");
        loginInput.value = st.loginId || "";
        loginInput.dataset.originalLoginId = st.loginId || "";
        document.getElementById("sm-self-password").value =
            st.password != null ? String(st.password) : "";
        document.getElementById("sm-self-st_company").value = st.st_company || "";
        document.getElementById("sm-self-st_phone").value = st.st_phone || "";
        document.getElementById("sm-self-st_fax").value = st.st_fax || "";
        document.getElementById("sm-self-st_ceo").value = st.st_ceo || "";
        document.getElementById("sm-self-st_email").value = st.st_email || "";
        document.getElementById("sm-self-st_web").value = st.st_web || "";
        document.getElementById("sm-self-st_ceo_tel").value = st.st_ceo_tel || "";
        document.getElementById("sm-self-st_biz_no").value = st.st_biz_no || "";
        document.getElementById("sm-self-st_biz_type").value = st.st_biz_type || "";
        document.getElementById("sm-self-st_biz_item").value = st.st_biz_item || "";
        if (addrPicker) {
            addrPicker.setValues({
                zip: st.st_zip,
                addr: st.st_addr || st.st_address || "",
                detail: st.st_addr_detail || ""
            });
        }
        document.getElementById("sm-self-st_facebook").value = st.st_facebook || "";
        document.getElementById("sm-self-st_instagram").value = st.st_instagram || "";
        document.getElementById("sm-self-st_naver_cafe").value = st.st_naver_cafe || "";
        document.getElementById("sm-self-st_youtube").value = st.st_youtube || "";
        document.getElementById("sm-self-st_kakao").value = st.st_kakao || "";
        pendingLogo = null;
        logoTouched = false;
        pendingSeal = null;
        sealTouched = false;
        updateImagePreview(
            document.getElementById("sm-self-logo-preview"),
            document.getElementById("sm-self-logo-clear"),
            st.st_logo || ""
        );
        updateImagePreview(
            document.getElementById("sm-self-seal-preview"),
            document.getElementById("sm-self-seal-clear"),
            st.st_seal || ""
        );
        if (logoPicker && logoPicker.clear) logoPicker.clear();
        if (sealPicker && sealPicker.clear) sealPicker.clear();
    }

    function openSaveModal(extraHint) {
        if (!saveModal) return;
        if (saveHintEl) {
            if (extraHint) {
                saveHintEl.textContent = extraHint;
                saveHintEl.hidden = false;
            } else {
                saveHintEl.textContent = "";
                saveHintEl.hidden = true;
            }
        }
        saveModal.hidden = false;
        document.body.style.overflow = "hidden";
        if (PF && PF.speakKorean) PF.speakKorean("저장되었습니다");
        if (saveLogoutBtn) saveLogoutBtn.focus();
    }

    function closeSaveModal() {
        if (!saveModal) return;
        saveModal.hidden = true;
        document.body.style.overflow = "";
    }

    function onSaveSuccess(result) {
        if (result && result.staff) {
            fillForm(result.staff);
            loadedFromServer = true;
        }
        var hint = "";
        if (result && result.loginIdChanged) {
            hint = "아이디가 변경되었습니다. 새 아이디로 다시 로그인해 주세요.";
        }
        setStatus("", "");
        openSaveModal(hint);
    }

    if (saveLogoutBtn) {
        saveLogoutBtn.addEventListener("click", function () {
            closeSaveModal();
            var Auth = window.THEJHON_AUTH;
            if (Auth && Auth.logout) {
                Auth.logout();
            } else {
                window.location.replace("login.html");
            }
        });
    }

    if (saveContinueBtn) {
        saveContinueBtn.addEventListener("click", function () {
            closeSaveModal();
            window.location.href = WORK_HUB_PAGE;
        });
    }

    function loadProfile() {
        if (!api || !api.getStaffProfile) {
            setStatus("API를 불러오지 못했습니다.", "err");
            return;
        }
        setStatus("정보 불러오는 중…");
        api
            .getStaffProfile()
            .then(function (st) {
                if (!st) throw new Error("관리자 정보를 찾을 수 없습니다.");
                fillForm(st);
                loadedFromServer = true;
                setStatus("수정 후 저장해 주세요.", "ok");
            })
            .catch(function (err) {
                loadedFromServer = false;
                setStatus((err && err.message) || "불러오기에 실패했습니다.", "err");
            });
    }

    function saveUpdate(body) {
        if (logoTouched) body.st_logo = pendingLogo || "";
        if (sealTouched) body.st_seal = pendingSeal || "";
        var payload = loadedStaff ? staffToUpdateBody(loadedStaff, body) : body;
        payload.loginId = body.loginId;
        if (body.password) payload.password = body.password;
        setStatus("저장 중…");
        api
            .updateStaffProfile(payload)
            .then(function (result) {
                if (result && result.staff) {
                    onSaveSuccess(result);
                } else {
                    loadProfile();
                    onSaveSuccess(result || {});
                }
            })
            .catch(function (err) {
                setStatus((err && err.message) || "저장에 실패했습니다.", "err");
            });
    }

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!loadedFromServer) {
                setStatus("계정 정보를 서버에서 불러온 뒤에 저장해 주세요.", "err");
                return;
            }
            var body = readForm();
            if (body.error) {
                setStatus(body.error, "err");
                return;
            }
            if (!body.loginId) {
                setStatus("아이디를 입력해 주세요.", "err");
                return;
            }
            if (!body.st_company) {
                setStatus("회사명을 입력해 주세요.", "err");
                return;
            }
            var loginInput = document.getElementById("sm-self-loginId");
            var origLoginId = (loginInput && loginInput.dataset.originalLoginId) || "";
            var loginChanged = origLoginId && body.loginId !== origLoginId;
            var staffId = document.getElementById("sm-self-id").value;

            if (loginChanged) {
                if (
                    !window.confirm(
                        "아이디를 「" +
                            origLoginId +
                            "」에서 「" +
                            body.loginId +
                            "」(으)로 변경합니다.\n\n등록 업체·상품·주문 등 담당 정보가 함께 갱신됩니다.\n\n계속할까요?"
                    )
                ) {
                    return;
                }
                if (!api.checkStaffLoginIdSelf) {
                    saveUpdate(body);
                    return;
                }
                setStatus("아이디 확인 중…");
                api
                    .checkStaffLoginIdSelf(body.loginId, staffId)
                    .then(function (check) {
                        if (check && (check.duplicate || check.invalid)) {
                            setStatus((check && check.error) || "사용할 수 없는 아이디입니다.", "err");
                            return;
                        }
                        saveUpdate(body);
                    })
                    .catch(function (err) {
                        setStatus((err && err.message) || "아이디 확인에 실패했습니다.", "err");
                    });
                return;
            }
            saveUpdate(body);
        });
    }

    loadProfile();
})();
