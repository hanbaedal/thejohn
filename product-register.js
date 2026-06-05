(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var PInfo = window.THEJHON_PRODUCT_INFO;

    var form = document.getElementById("pr-form");
    var statusEl = document.getElementById("pr-status");
    var deptHidden = document.getElementById("pr-pd-dept");
    var codeInput = document.getElementById("pr-pd-code");
    var nameInput = document.getElementById("pr-pd-name");
    var photoGallery = null;
    var explainInput = document.getElementById("pr-pd-explain");
    var price1Input = document.getElementById("pr-pd-price1");
    var price2Input = document.getElementById("pr-pd-price2");
    var price3Input = document.getElementById("pr-pd-price3");
    var price4Input = document.getElementById("pr-pd-price4");
    var sizeInput = document.getElementById("pr-pd-size");
    var perNameInput = document.getElementById("pr-per-name");
    var perNumberInput = document.getElementById("pr-per-number");
    var perEmailInput = document.getElementById("pr-per-email");
    var submitBtn = document.getElementById("pr-submit");

    var deptPicker = null;
    var nameDupCheck = null;
    var codeDupCheck = null;

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function getPendingImages() {
        return photoGallery ? photoGallery.getImages() : [];
    }

    if (PF && PF.initProductDeptModalPicker && deptHidden) {
        deptPicker = PF.initProductDeptModalPicker({
            catalog: catalog,
            openBtn: document.getElementById("pr-dept-open"),
            summaryEl: document.getElementById("pr-dept-summary"),
            modal: document.getElementById("pr-dept-modal"),
            optionsRoot: document.getElementById("pr-dept-modal-options"),
            okBtn: document.getElementById("pr-dept-modal-ok"),
            closeBtn: document.getElementById("pr-dept-modal-close"),
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
            hintEl: document.getElementById("pr-name-dup-hint"),
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
            hintEl: document.getElementById("pr-code-dup-hint"),
            getDeptId: function () {
                return deptPicker ? deptPicker.getValue() : "";
            },
            checkDuplicate: function (code, excludeId, dept) {
                return api.checkProductCode(code, excludeId, dept);
            }
        });
    }

    if (PInfo && PInfo.bindOpenButton) {
        PInfo.bindOpenButton({
            api: api,
            openBtn: document.getElementById("pr-btn-product-info"),
            getProductName: function () {
                return nameInput ? nameInput.value.trim() : "";
            },
            getNetWeight: function () {
                return sizeInput ? sizeInput.value.trim() : "";
            }
        });
    }

    if (PF && PF.initProductPhotoGallery) {
        photoGallery = PF.initProductPhotoGallery({
            slotsRoot: document.getElementById("pr-photo-gallery"),
            countEl: document.getElementById("pr-photo-count"),
            hintEl: document.getElementById("pr-photo-hint"),
            galleryInput: document.getElementById("pr-pd-image-gallery"),
            cameraInput: document.getElementById("pr-pd-image-camera"),
            btnGallery: document.getElementById("pr-photo-gallery-btn"),
            btnCamera: document.getElementById("pr-photo-camera-btn"),
            onError: function (err) {
                setStatus((err && err.message) || "이미지 오류", true);
            },
            onStatus: function (msg) {
                setStatus(msg, false);
            }
        });
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var imgs = getPendingImages();
        var body = {
            pd_code: codeInput ? codeInput.value.trim() : "",
            pd_name: nameInput.value.trim(),
            pd_explain: explainInput.value.trim(),
            pd_size: sizeInput ? sizeInput.value.trim() : "",
            pd_dept: deptPicker ? deptPicker.getValue() : "",
            pd_group: "",
            pd_price1: PF.parsePriceInput(price1Input),
            pd_price2: PF.parsePriceInput(price2Input),
            pd_price3: PF.parsePriceInput(price3Input),
            pd_price4: PF.parsePriceInput(price4Input),
            pd_images: imgs,
            pd_image: imgs[0] || "",
            pd_record_type: "catalog",
            per_name: perNameInput ? perNameInput.value.trim() : "",
            "per-number": perNumberInput ? perNumberInput.value.trim() : "",
            "per-email": perEmailInput ? perEmailInput.value.trim() : ""
        };
        var err = PF.validateProductFields(body, { requireImage: true });
        if (err) {
            setStatus(err, true);
            return;
        }

        function saveProduct() {
            submitBtn.disabled = true;
            api.createProduct(body)
                .then(function (item) {
                    var infoP =
                        PInfo && PInfo.saveToServer && item && item.id ?
                            PInfo.saveToServer(api, item.id)
                        :   Promise.resolve();
                    return infoP.then(function () {
                        if (PInfo) {
                            PInfo.setProductId("");
                            PInfo.setValues(PInfo.emptyValues());
                        }
                        form.reset();
                        if (photoGallery) photoGallery.clear();
                        if (nameDupCheck) nameDupCheck.reset();
                        if (codeDupCheck) codeDupCheck.reset();
                        if (deptPicker) deptPicker.clear();
                        setStatus("저장했습니다. 계속 등록하거나 상품 리스트에서 확인하세요.");
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

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getRegisterAccess
            ? THEJHON_AUTH.getRegisterAccess()
            : { allowed: false, reason: "인증 스크립트를 불러오지 못했습니다." };
    if (!access.allowed) {
        setStatus(access.reason, true);
        if (form) {
            var fields = form.querySelectorAll("input, textarea, button");
            for (var i = 0; i < fields.length; i++) fields[i].disabled = true;
        }
    } else {
        var hintEl = document.getElementById("pr-registrar-hint");
        if (hintEl && window.THEJHON_AUTH) {
            var who = THEJHON_AUTH.getLoggedInCompanyDisplayName
                ? THEJHON_AUTH.getLoggedInCompanyDisplayName()
                : "";
            var uid = THEJHON_AUTH.getUserId ? THEJHON_AUTH.getUserId() : "";
            hintEl.textContent =
                "이 상품은 로그인한 관리자(" +
                (who || uid) +
                ") 사업 영역으로 등록됩니다. 업체는 담당 관리자 상품만 등급가, 타 관리자 상품은 가격1로 표시됩니다.";
            hintEl.hidden = false;
        }
    }
})();
