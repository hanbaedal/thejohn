(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var form = document.getElementById("pr-form");
    var statusEl = document.getElementById("pr-status");
    var deptHidden = document.getElementById("pr-pd-dept");
    var deptPickerRoot = document.getElementById("pr-dept-picker");
    var codeInput = document.getElementById("pr-pd-code");
    var nameInput = document.getElementById("pr-pd-name");
    var photoPreview = document.getElementById("pr-photo-preview");
    var photoPicker = null;
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

    var pendingImageData = "";
    var deptPicker = null;
    var nameDupCheck = null;
    var codeDupCheck = null;

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
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

    if (PF && deptPickerRoot && deptHidden) {
        deptPicker = PF.initDeptPicker({
            catalog: catalog,
            root: deptPickerRoot,
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

    function handlePhotoFile(dataUrl) {
        pendingImageData = dataUrl;
        updatePhotoPreview(dataUrl);
        setStatus("사진을 540×540·1MB 이하로 맞춰 적용했습니다.");
    }

    if (PF && PF.initProductPhotoPicker) {
        photoPicker = PF.initProductPhotoPicker({
            galleryInput: document.getElementById("pr-pd-image-gallery"),
            cameraInput: document.getElementById("pr-pd-image-camera"),
            btnGallery: document.getElementById("pr-photo-gallery-btn"),
            btnCamera: document.getElementById("pr-photo-camera-btn"),
            processOptions: PF.PRODUCT_IMAGE_PROCESS_OPTIONS,
            onSelect: handlePhotoFile,
            onError: function (err) {
                setStatus((err && err.message) || "이미지 오류", true);
                updatePhotoPreview("");
            }
        });
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
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
            pd_image: pendingImageData || "",
            pd_images: pendingImageData ? [pendingImageData] : [],
            pd_record_type: "new",
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
                .then(function () {
                    form.reset();
                    pendingImageData = "";
                    if (photoPicker) photoPicker.clear();
                    if (nameDupCheck) nameDupCheck.reset();
                    if (codeDupCheck) codeDupCheck.reset();
                    updatePhotoPreview("");
                    if (deptPicker) deptPicker.clear();
                    setStatus("신규상품을 저장했습니다. 신규상품 리스트에서 확인·수정할 수 있습니다.");
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
    }
})();
