(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var form = document.getElementById("pr-form");
    var statusEl = document.getElementById("pr-status");
    var deptHidden = document.getElementById("pr-pd-dept");
    var deptPickerRoot = document.getElementById("pr-dept-picker");
    var nameInput = document.getElementById("pr-pd-name");
    var photoInput = document.getElementById("pr-pd-image");
    var photoPreview = document.getElementById("pr-photo-preview");
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

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function updatePhotoPreview(src) {
        if (!photoPreview) return;
        if (src) {
            photoPreview.src = src;
            photoPreview.hidden = false;
        } else {
            photoPreview.removeAttribute("src");
            photoPreview.hidden = true;
        }
    }

    if (PF && deptPickerRoot && deptHidden) {
        deptPicker = PF.initDeptPicker({
            catalog: catalog,
            root: deptPickerRoot,
            hiddenInput: deptHidden
        });
    }

    photoInput.addEventListener("change", function () {
        var f = photoInput.files && photoInput.files[0];
        if (!f) {
            updatePhotoPreview("");
            return;
        }
        PF.readFileAsDataURL(f)
            .then(function (dataUrl) {
                pendingImageData = dataUrl;
                updatePhotoPreview(dataUrl);
            })
            .catch(function (err) {
                setStatus(err.message || "이미지 오류", true);
                photoInput.value = "";
                updatePhotoPreview("");
            });
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var body = {
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
            per_name: perNameInput ? perNameInput.value.trim() : "",
            "per-number": perNumberInput ? perNumberInput.value.trim() : "",
            "per-email": perEmailInput ? perEmailInput.value.trim() : ""
        };
        var err = PF.validateProductFields(body, { requireImage: true });
        if (err) {
            setStatus(err, true);
            return;
        }
        submitBtn.disabled = true;
        api.createProduct(body)
            .then(function () {
                form.reset();
                pendingImageData = "";
                updatePhotoPreview("");
                if (deptPicker) deptPicker.clear();
                setStatus("저장했습니다. 계속 등록하거나 상품 리스트에서 확인하세요.");
            })
            .catch(function (err2) {
                setStatus(err2.message || "저장에 실패했습니다.", true);
            })
            .finally(function () {
                submitBtn.disabled = false;
            });
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
