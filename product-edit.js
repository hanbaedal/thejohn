(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var PInfo = window.THEJHON_PRODUCT_INFO;

    var statusEl = document.getElementById("pe-status");
    var backListLink = document.getElementById("pe-back-list");

    function queryParam(name) {
        try {
            return new URLSearchParams(window.location.search).get(name) || "";
        } catch (e) {
            return "";
        }
    }

    function listReturnUrl() {
        return queryParam("from") === "new" ? "product-new-list.html" : "product-list-admin.html";
    }
    var formWrap = document.getElementById("pe-form-wrap");
    var form = document.getElementById("pe-form");
    var editIdInput = document.getElementById("pe-edit-id");
    var deptHidden = document.getElementById("pe-pd-dept");
    var codeInput = document.getElementById("pe-pd-code");
    var nameInput = document.getElementById("pe-pd-name");
    var photoPreview = document.getElementById("pe-photo-preview");
    var photoPicker = null;
    var pendingImageData = "";
    var explainInput = document.getElementById("pe-pd-explain");
    var price1Input = document.getElementById("pe-pd-price1");
    var price2Input = document.getElementById("pe-pd-price2");
    var price3Input = document.getElementById("pe-pd-price3");
    var price4Input = document.getElementById("pe-pd-price4");
    var sizeInput = document.getElementById("pe-pd-size");
    var perNameInput = document.getElementById("pe-per-name");
    var perNumberInput = document.getElementById("pe-per-number");
    var perEmailInput = document.getElementById("pe-per-email");
    var submitBtn = document.getElementById("pe-submit");
    var cancelBtn = document.getElementById("pe-cancel-edit");

    var deptPicker = null;
    var nameDupCheck = null;
    var codeDupCheck = null;
    var saveModal = document.getElementById("pe-save-modal");
    var saveOkBtn = document.getElementById("pe-save-ok");
    var saveContinueBtn = document.getElementById("pe-save-continue");

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function itemDept(it) {
        return catalog ? catalog.normalizeDept(it.pd_dept) : "";
    }

    function updatePhotoPreview(src) {
        if (PF && PF.showImagePreview) {
            PF.showImagePreview(photoPreview, src);
            return;
        }
        if (!photoPreview) return;
        if (src) {
            photoPreview.src = src;
            photoPreview.removeAttribute("hidden");
        } else {
            photoPreview.removeAttribute("src");
            photoPreview.setAttribute("hidden", "");
        }
    }

    function getPendingImage() {
        return pendingImageData || "";
    }

    function showSaveModal() {
        if (!saveModal) return;
        saveModal.hidden = false;
        if (PF && PF.speakKorean) PF.speakKorean("수정되었습니다");
    }

    if (saveOkBtn) {
        saveOkBtn.addEventListener("click", function () {
            location.href = listReturnUrl();
        });
    }
    if (saveContinueBtn) {
        saveContinueBtn.addEventListener("click", function () {
            if (saveModal) saveModal.hidden = true;
            setStatus("");
        });
    }

    function applyProductImage(src) {
        pendingImageData = src || "";
        updatePhotoPreview(pendingImageData);
    }

    function loadImageForItem(it) {
        var src = "";
        if (Array.isArray(it.pd_images) && it.pd_images.length) {
            src = String(it.pd_images[0] || "").trim();
        } else if (it.pd_image) {
            src = String(it.pd_image || "").trim();
        }
        if (src) {
            applyProductImage(src);
            return Promise.resolve();
        }
        if (!it.pd_has_image && !(it.pd_image_count > 0)) {
            applyProductImage("");
            return Promise.resolve();
        }
        return api
            .get("api/products/" + encodeURIComponent(it.id) + "/cover")
            .then(function (data) {
                applyProductImage((data && data.pd_image) || "");
            })
            .catch(function () {
                applyProductImage("");
            });
    }

    function resetForm() {
        if (!form) return;
        form.reset();
        editIdInput.value = "";
        pendingImageData = "";
        updatePhotoPreview("");
        if (photoPicker) photoPicker.clear();
        if (nameDupCheck) nameDupCheck.reset();
        if (codeDupCheck) codeDupCheck.reset();
        if (deptPicker) deptPicker.clear();
    }

    function fillFormFromItem(it) {
        if (!it) return Promise.resolve();
        editIdInput.value = it.id;
        if (codeInput) codeInput.value = it.pd_code || "";
        nameInput.value = it.pd_name || "";
        explainInput.value = it.pd_explain || "";
        price1Input.value = String(it.pd_price1 != null ? it.pd_price1 : 0);
        price2Input.value = String(it.pd_price2 != null ? it.pd_price2 : 0);
        price3Input.value = String(it.pd_price3 != null ? it.pd_price3 : 0);
        price4Input.value = String(it.pd_price4 != null ? it.pd_price4 : 0);
        sizeInput.value = it.pd_size != null ? String(it.pd_size) : "";
        perNameInput.value = it.per_name || "";
        perNumberInput.value = it["per-number"] || "";
        perEmailInput.value = it["per-email"] || "";
        pendingImageData = "";
        updatePhotoPreview("");
        if (photoPicker) photoPicker.clear();
        if (deptPicker) deptPicker.setValue(itemDept(it));
        if (nameDupCheck) nameDupCheck.reset();
        if (codeDupCheck) codeDupCheck.reset();
        return loadImageForItem(it).then(function () {
            setStatus("수정 중: " + (it.pd_name || ""));
        });
    }

    if (PF && PF.initProductDeptModalPicker && deptHidden) {
        deptPicker = PF.initProductDeptModalPicker({
            catalog: catalog,
            openBtn: document.getElementById("pe-dept-open"),
            summaryEl: document.getElementById("pe-dept-summary"),
            modal: document.getElementById("pe-dept-modal"),
            optionsRoot: document.getElementById("pe-dept-modal-options"),
            okBtn: document.getElementById("pe-dept-modal-ok"),
            closeBtn: document.getElementById("pe-dept-modal-close"),
            hiddenInput: deptHidden,
            onSelect: function () {
                if (nameDupCheck) nameDupCheck.checkNow();
                if (codeDupCheck) codeDupCheck.checkNow();
            }
        });
    }

    if (PF && PF.initProductNameDuplicateCheck && api && api.checkProductName) {
        nameDupCheck = PF.initProductNameDuplicateCheck({
            nameInput: nameInput,
            hintEl: document.getElementById("pe-name-dup-hint"),
            getExcludeId: function () {
                return editIdInput ? editIdInput.value.trim() : "";
            },
            getDeptId: function () {
                return deptPicker ? deptPicker.getValue() : "";
            },
            checkDuplicate: function (name, excludeId, dept) {
                return api.checkProductName(name, excludeId, dept);
            }
        });
    }

    if (PF && PF.initProductCodeDuplicateCheck && api && api.checkProductCode) {
        codeDupCheck = PF.initProductCodeDuplicateCheck({
            codeInput: codeInput,
            hintEl: document.getElementById("pe-code-dup-hint"),
            getExcludeId: function () {
                return editIdInput ? editIdInput.value.trim() : "";
            },
            getDeptId: function () {
                return deptPicker ? deptPicker.getValue() : "";
            },
            checkDuplicate: function (code, excludeId, dept) {
                return api.checkProductCode(code, excludeId, dept);
            }
        });
    }

    cancelBtn.addEventListener("click", function () {
        location.href = listReturnUrl();
    });

    if (PInfo && PInfo.bindOpenButton) {
        PInfo.bindOpenButton({
            api: api,
            openBtn: document.getElementById("pe-btn-product-info"),
            getProductName: function () {
                return nameInput ? nameInput.value.trim() : "";
            },
            getNetWeight: function () {
                return sizeInput ? sizeInput.value.trim() : "";
            }
        });
    }

    function handlePhotoFile(dataUrl) {
        pendingImageData = dataUrl;
        updatePhotoPreview(dataUrl);
        setStatus("사진을 540×540·1MB 이하로 맞춰 적용했습니다.");
    }

    if (PF && PF.initProductPhotoPicker) {
        photoPicker = PF.initProductPhotoPicker({
            galleryInput: document.getElementById("pe-pd-image-gallery"),
            cameraInput: document.getElementById("pe-pd-image-camera"),
            btnGallery: document.getElementById("pe-photo-gallery-btn"),
            btnCamera: document.getElementById("pe-photo-camera-btn"),
            processOptions: PF.PRODUCT_IMAGE_PROCESS_OPTIONS,
            onSelect: handlePhotoFile,
            onError: function (err) {
                setStatus((err && err.message) || "이미지 오류", true);
            }
        });
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var id = editIdInput.value.trim();
        if (!id) {
            setStatus("상품을 찾을 수 없습니다. 리스트에서 다시 선택해 주세요.", true);
            return;
        }
        var img = getPendingImage();
        var body = {
            pd_code: codeInput ? codeInput.value.trim() : "",
            pd_name: nameInput.value.trim(),
            pd_explain: explainInput.value.trim(),
            pd_size: sizeInput.value.trim(),
            pd_dept: deptPicker ? deptPicker.getValue() : "",
            pd_group: "",
            pd_price1: PF.parsePriceInput(price1Input),
            pd_price2: PF.parsePriceInput(price2Input),
            pd_price3: PF.parsePriceInput(price3Input),
            pd_price4: PF.parsePriceInput(price4Input),
            pd_image: img,
            pd_images: img ? [img] : [],
            per_name: perNameInput.value.trim(),
            "per-number": perNumberInput.value.trim(),
            "per-email": perEmailInput.value.trim()
        };
        var err = PF.validateProductFields(body, { requireImage: false });
        if (err) {
            setStatus(err, true);
            return;
        }

        function saveProduct() {
            submitBtn.disabled = true;
            api.updateProduct(id, body)
                .then(function () {
                    var infoP =
                        PInfo && PInfo.saveToServer ?
                            PInfo.saveToServer(api, id)
                        :   Promise.resolve();
                    return infoP.then(function () {
                        setStatus("");
                        showSaveModal();
                    });
                })
                .catch(function (err2) {
                    setStatus(err2.message || "저장에 실패했습니다.", true);
                })
                .finally(function () {
                    submitBtn.disabled = false;
                });
        }

        if (PF && PF.beforeProductSaveDuplicateCheck) {
            PF.beforeProductSaveDuplicateCheck(
                {
                    nameDupCheck: nameDupCheck,
                    codeDupCheck: codeDupCheck,
                    onStatus: setStatus,
                    nameInput: nameInput,
                    codeInput: codeInput
                },
                saveProduct
            );
            return;
        }
        saveProduct();
    });

    var access = THEJHON_AUTH.getRegisterAccess();
    if (!access.allowed) {
        setStatus(access.reason, true);
        return;
    }

    var VA = window.THEJHON_VENDOR_ADMIN;

    if (backListLink) backListLink.href = listReturnUrl();

    var editId = queryParam("id").trim();
    if (!editId) {
        location.replace("product-list-admin.html");
        return;
    }

    editIdInput.value = editId;
    setStatus("불러오는 중…");
    api.getProduct(editId)
        .then(function (it) {
            if (!it || !it.id) throw new Error("상품을 찾을 수 없습니다.");
            var canWrite =
                VA && VA.canWriteRegisteredItem
                    ? VA.canWriteRegisteredItem(it, "pd_registered_by")
                    : true;
            if (!canWrite) {
                if (formWrap) formWrap.hidden = true;
                if (submitBtn) submitBtn.hidden = true;
                if (cancelBtn) cancelBtn.textContent = "목록으로";
                throw new Error("다른 관리자가 등록한 상품은 수정할 수 없습니다.");
            }
            return fillFormFromItem(it).then(function () {
                if (PInfo) {
                    PInfo.setProductId(it.id);
                    return PInfo.loadFromServer(api, it.id);
                }
            });
        })
        .catch(function (err) {
            setStatus(err.message || "상품 정보를 불러오지 못했습니다.", true);
        });
})();
