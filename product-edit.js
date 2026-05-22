(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var filterRoot = document.getElementById("pe-dept-filter");
    var listEl = document.getElementById("pe-list");
    var statusEl = document.getElementById("pe-status");
    var formWrap = document.getElementById("pe-form-wrap");
    var form = document.getElementById("pe-form");
    var editIdInput = document.getElementById("pe-edit-id");
    var deptHidden = document.getElementById("pe-pd-dept");
    var deptPickerRoot = document.getElementById("pe-dept-picker");
    var nameInput = document.getElementById("pe-pd-name");
    var photoPreview = document.getElementById("pe-photo-preview");
    var photoPicker = null;
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

    var cachedItems = [];
    var filterDept = "";
    var pendingImageData = "";
    var deptPicker = null;
    var nameDupCheck = null;

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function itemDept(it) {
        return catalog ? catalog.normalizeDept(it.pd_dept) : "";
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

    function filteredItems() {
        if (!filterDept) return cachedItems.slice();
        return cachedItems.filter(function (it) {
            return itemDept(it) === filterDept;
        });
    }

    function pricesHtml(it) {
        var parts = [];
        var labels = ["가격1", "가격2", "가격3", "가격4"];
        var keys = ["pd_price1", "pd_price2", "pd_price3", "pd_price4"];
        for (var i = 0; i < 4; i++) {
            var v = Number(it[keys[i]]);
            if (isFinite(v) && v > 0) {
                parts.push(labels[i] + " " + PF.formatWon(v));
            }
        }
        return parts.length ? PF.escapeHtml(parts.join(" · ")) : PF.escapeHtml(PF.formatWon(0));
    }

    function renderList() {
        var items = filteredItems().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="am-list-empty">선택한 사업부문에 등록된 상품이 없습니다.</p>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it) {
                var deptTxt = PF.deptLabel(catalog, itemDept(it));
                return (
                    '<article class="pr-card" data-id="' +
                    PF.escapeHtml(it.id) +
                    '"><div class="pr-card-head"><div class="pr-card-body"><h3 class="pr-card-title">' +
                    PF.escapeHtml(it.pd_name || "") +
                    '</h3><p class="pr-card-meta"><span class="pr-card-spec">사업부문: ' +
                    PF.escapeHtml(deptTxt || "미지정") +
                    "</span></p><p class="pr-card-price'>" +
                    pricesHtml(it) +
                    '</p><div class="pr-card-actions"><button type="button" class="pr-btn-edit" data-id="' +
                    PF.escapeHtml(it.id) +
                    '">수정</button><button type="button" class="pr-btn-del" data-id="' +
                    PF.escapeHtml(it.id) +
                    '">삭제</button></div></div></div></article>'
                );
            })
            .join("");
    }

    function resetForm() {
        if (!form) return;
        form.reset();
        editIdInput.value = "";
        if (photoPicker) photoPicker.clear();
        if (nameDupCheck) nameDupCheck.reset();
        pendingImageData = "";
        updatePhotoPreview("");
        if (deptPicker) deptPicker.clear();
        if (formWrap) formWrap.hidden = true;
    }

    function loadIntoForm(id) {
        var it = cachedItems.filter(function (x) {
            return x.id === id;
        })[0];
        if (!it) return;
        editIdInput.value = it.id;
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
        if (photoPicker) photoPicker.clear();
        pendingImageData = it.pd_image || "";
        updatePhotoPreview(pendingImageData || "");
        if (deptPicker) deptPicker.setValue(itemDept(it));
        if (nameDupCheck) nameDupCheck.reset();
        if (formWrap) {
            formWrap.hidden = false;
            formWrap.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setStatus("수정 중: " + (it.pd_name || ""));
    }

    function deleteById(id) {
        if (!confirm("이 상품을 삭제할까요?")) return;
        api.deleteProduct(id)
            .then(function () {
                if (editIdInput.value === id) resetForm();
                return api.listProducts();
            })
            .then(function (items) {
                cachedItems = items;
                renderList();
                setStatus("삭제했습니다.");
            })
            .catch(function (err) {
                setStatus(err.message || "삭제에 실패했습니다.", true);
            });
    }

    if (PF && filterRoot && catalog) {
        PF.initDeptPicker({
            catalog: catalog,
            root: filterRoot,
            hiddenInput: document.getElementById("pe-filter-dept"),
            showAll: true,
            onSelect: function (deptId) {
                filterDept = deptId;
                renderList();
            }
        });
    }

    if (PF && deptPickerRoot && deptHidden) {
        deptPicker = PF.initDeptPicker({
            catalog: catalog,
            root: deptPickerRoot,
            hiddenInput: deptHidden,
            onSelect: function () {
                if (nameDupCheck) nameDupCheck.checkNow();
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

    listEl.addEventListener("click", function (e) {
        var t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.classList.contains("pr-btn-edit")) loadIntoForm(t.getAttribute("data-id"));
        else if (t.classList.contains("pr-btn-del")) deleteById(t.getAttribute("data-id"));
    });

    cancelBtn.addEventListener("click", resetForm);

    function handlePhotoFile(dataUrl) {
        pendingImageData = dataUrl;
        updatePhotoPreview(dataUrl);
        setStatus("사진을 1:1·1MB 이하로 맞춰 적용했습니다.");
    }

    if (PF && PF.initProductPhotoPicker) {
        photoPicker = PF.initProductPhotoPicker({
            galleryInput: document.getElementById("pe-pd-image-gallery"),
            cameraInput: document.getElementById("pe-pd-image-camera"),
            btnGallery: document.getElementById("pe-photo-gallery-btn"),
            btnCamera: document.getElementById("pe-photo-camera-btn"),
            onSelect: handlePhotoFile,
            onError: function (err) {
                setStatus((err && err.message) || "이미지 오류", true);
                if (photoPicker) photoPicker.clear();
                updatePhotoPreview(editIdInput.value ? pendingImageData : "");
            }
        });
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var id = editIdInput.value.trim();
        if (!id) {
            setStatus("목록에서 수정할 상품을 선택해 주세요.", true);
            return;
        }
        var body = {
            pd_name: nameInput.value.trim(),
            pd_explain: explainInput.value.trim(),
            pd_size: sizeInput.value.trim(),
            pd_dept: deptPicker ? deptPicker.getValue() : "",
            pd_group: "",
            pd_price1: PF.parsePriceInput(price1Input),
            pd_price2: PF.parsePriceInput(price2Input),
            pd_price3: PF.parsePriceInput(price3Input),
            pd_price4: PF.parsePriceInput(price4Input),
            pd_image: pendingImageData || "",
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
                    return api.listProducts();
                })
                .then(function (items) {
                    cachedItems = items;
                    renderList();
                    resetForm();
                    setStatus("수정했습니다.");
                })
                .catch(function (err2) {
                    setStatus(err2.message || "저장에 실패했습니다.", true);
                })
                .finally(function () {
                    submitBtn.disabled = false;
                });
        }

        if (!nameDupCheck) {
            saveProduct();
            return;
        }
        nameDupCheck.checkNow().then(function (res) {
            if (res && res.duplicate) {
                setStatus("같은 사업부문에 이미 등록된 상품 명칭입니다. 다른 명칭을 입력해 주세요.", true);
                nameInput.focus();
                return;
            }
            if (nameDupCheck.isChecking()) {
                setStatus("명칭 중복 확인 중입니다. 잠시 후 다시 시도해 주세요.", true);
                return;
            }
            saveProduct();
        });
    });

    var access = THEJHON_AUTH.getRegisterAccess();
    if (!access.allowed) {
        setStatus(access.reason, true);
        return;
    }
    setStatus("목록 불러오는 중…");
    api.listProducts()
        .then(function (items) {
            cachedItems = items;
            renderList();
            setStatus("");
        })
        .catch(function (err) {
            setStatus(err.message || "목록을 불러오지 못했습니다.", true);
        });
})();
