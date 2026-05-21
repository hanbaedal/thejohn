(function () {
    var MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    var api = window.THEJHON_API;

    var form = document.getElementById("pr-form");
    var statusEl = document.getElementById("pr-status");
    var editIdInput = document.getElementById("pr-edit-id");
    var nameInput = document.getElementById("pr-pd-name");
    var photoInput = document.getElementById("pr-pd-image");
    var photoPreview = document.getElementById("pr-photo-preview");
    var explainInput = document.getElementById("pr-pd-explain");
    var priceInput = document.getElementById("pr-pd-price");
    var sizeInput = document.getElementById("pr-pd-size");
    var perNameInput = document.getElementById("pr-per-name");
    var perNumberInput = document.getElementById("pr-per-number");
    var perEmailInput = document.getElementById("pr-per-email");
    var cancelBtn = document.getElementById("pr-cancel-edit");
    var listEl = document.getElementById("pr-list");
    var submitBtn = document.getElementById("pr-submit");

    var pendingImageData = "";
    var cachedItems = [];

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

    function formatWon(n) {
        var num = Number(n);
        if (!isFinite(num)) return "0";
        return num.toLocaleString("ko-KR") + "원";
    }

    function readFileAsDataURL(file) {
        return new Promise(function (resolve, reject) {
            if (file.size > MAX_IMAGE_BYTES) {
                reject(new Error("이미지는 2MB 이하로 선택해 주세요."));
                return;
            }
            var r = new FileReader();
            r.onload = function () {
                resolve(r.result);
            };
            r.onerror = function () {
                reject(new Error("이미지를 읽을 수 없습니다."));
            };
            r.readAsDataURL(file);
        });
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

    function resetForm() {
        if (!form) return;
        form.reset();
        editIdInput.value = "";
        pendingImageData = "";
        updatePhotoPreview("");
        cancelBtn.hidden = true;
        submitBtn.textContent = "저장";
        submitBtn.disabled = false;
    }

    function contactLine(it) {
        var parts = [];
        if (it.per_name) parts.push("담당: " + escapeHtml(it.per_name));
        if (it["per-number"]) parts.push(escapeHtml(it["per-number"]));
        if (it["per-email"]) parts.push(escapeHtml(it["per-email"]));
        if (!parts.length) return "";
        return '<p class="pr-card-contact">' + parts.join(" · ") + "</p>";
    }

    function renderList() {
        var items = cachedItems.slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="pr-card-content">등록된 상품이 없습니다. 위 양식에서 저장해 보세요.</p>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it) {
                var imgBlock = it.pd_image
                    ? "<img class=\"pr-card-img\" src=" + JSON.stringify(it.pd_image) + ' alt="">'
                    : '<div class="pr-card-img pr-card-img--empty" role="img" aria-label="사진 없음">사진<br>없음</div>';
                var specHtml = "";
                if (it.pd_size && String(it.pd_size).trim()) {
                    specHtml =
                        '<span class="pr-card-spec">규격: ' + escapeHtml(String(it.pd_size).trim()) + "</span>";
                }
                return (
                    '<article class="pr-card" data-id="' +
                    escapeHtml(it.id) +
                    '"><div class="pr-card-head">' +
                    imgBlock +
                    '<div class="pr-card-body"><h3 class="pr-card-title">' +
                    escapeHtml(it.pd_name) +
                    '</h3><p class="pr-card-price"><span>' +
                    escapeHtml(formatWon(it.pd_price)) +
                    "</span>" +
                    specHtml +
                    '</p><p class="pr-card-content">' +
                    escapeHtml(it.pd_explain) +
                    "</p>" +
                    contactLine(it) +
                    '<div class="pr-card-actions"><button type="button" class="pr-btn-edit" data-id="' +
                    escapeHtml(it.id) +
                    '">수정</button><button type="button" class="pr-btn-del" data-id="' +
                    escapeHtml(it.id) +
                    '">삭제</button></div></div></div></article>'
                );
            })
            .join("");
    }

    function loadList() {
        if (!api) {
            setStatus("API를 불러오지 못했습니다. 서버를 실행했는지 확인해 주세요.", true);
            return Promise.resolve();
        }
        setStatus("목록 불러오는 중…");
        return api
            .listProducts()
            .then(function (items) {
                cachedItems = items;
                renderList();
                setStatus("");
            })
            .catch(function (err) {
                setStatus(err.message || "목록을 불러오지 못했습니다.", true);
            });
    }

    function loadIntoForm(id) {
        var it = cachedItems.filter(function (x) {
            return x.id === id;
        })[0];
        if (!it) return;
        editIdInput.value = it.id;
        nameInput.value = it.pd_name || "";
        explainInput.value = it.pd_explain || "";
        priceInput.value = String(it.pd_price != null ? it.pd_price : 0);
        if (sizeInput) sizeInput.value = it.pd_size != null ? String(it.pd_size) : "";
        if (perNameInput) perNameInput.value = it.per_name || "";
        if (perNumberInput) perNumberInput.value = it["per-number"] || "";
        if (perEmailInput) perEmailInput.value = it["per-email"] || "";
        photoInput.value = "";
        pendingImageData = it.pd_image || "";
        updatePhotoPreview(pendingImageData || "");
        cancelBtn.hidden = false;
        submitBtn.textContent = "수정 저장";
        setStatus("수정 중입니다. 저장하면 반영됩니다.");
        nameInput.focus();
    }

    function deleteById(id) {
        if (!confirm("이 상품을 삭제할까요?")) return;
        api.deleteProduct(id)
            .then(function () {
                if (editIdInput.value === id) resetForm();
                return loadList();
            })
            .then(function () {
                setStatus("삭제했습니다.");
            })
            .catch(function (err) {
                setStatus(err.message || "삭제에 실패했습니다.", true);
            });
    }

    listEl.addEventListener("click", function (e) {
        var t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.classList.contains("pr-btn-edit")) loadIntoForm(t.getAttribute("data-id"));
        else if (t.classList.contains("pr-btn-del")) deleteById(t.getAttribute("data-id"));
    });

    photoInput.addEventListener("change", function () {
        var f = photoInput.files && photoInput.files[0];
        if (!f) {
            updatePhotoPreview(editIdInput.value ? pendingImageData : "");
            return;
        }
        readFileAsDataURL(f)
            .then(function (dataUrl) {
                pendingImageData = dataUrl;
                updatePhotoPreview(dataUrl);
            })
            .catch(function (err) {
                setStatus(err.message || "이미지 오류", true);
                photoInput.value = "";
                updatePhotoPreview(editIdInput.value ? pendingImageData : "");
            });
    });

    cancelBtn.addEventListener("click", function () {
        resetForm();
        setStatus("편집을 취소했습니다.");
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var pd_name = nameInput.value.trim();
        var pd_explain = explainInput.value.trim();
        var pd_size = sizeInput ? sizeInput.value.trim() : "";
        var pd_price = parseInt(priceInput.value.trim(), 10);
        var file = photoInput.files && photoInput.files[0];
        var editingId = editIdInput.value.trim();

        if (!pd_name) {
            setStatus("상품 명칭을 입력해 주세요.", true);
            nameInput.focus();
            return;
        }
        if (!pd_explain) {
            setStatus("상품 설명을 입력해 주세요.", true);
            explainInput.focus();
            return;
        }
        if (!isFinite(pd_price) || pd_price < 0) {
            setStatus("상품 가격을 올바르게 입력해 주세요.", true);
            priceInput.focus();
            return;
        }

        function saveWithImage(imageData) {
            if (!editingId && !imageData) {
                setStatus("신규 등록 시 상품 사진을 선택해 주세요.", true);
                photoInput.focus();
                return;
            }
            var body = {
                pd_name: pd_name,
                pd_explain: pd_explain,
                pd_size: pd_size,
                pd_price: pd_price,
                pd_image: imageData || "",
                per_name: perNameInput ? perNameInput.value.trim() : "",
                "per-number": perNumberInput ? perNumberInput.value.trim() : "",
                "per-email": perEmailInput ? perEmailInput.value.trim() : ""
            };
            submitBtn.disabled = true;
            var p = editingId ? api.updateProduct(editingId, body) : api.createProduct(body);
            p.then(function () {
                resetForm();
                return loadList();
            })
                .then(function () {
                    setStatus(editingId ? "수정했습니다." : "저장했습니다.");
                })
                .catch(function (err) {
                    setStatus(err.message || "저장에 실패했습니다.", true);
                })
                .finally(function () {
                    submitBtn.disabled = false;
                });
        }

        if (file) {
            readFileAsDataURL(file).then(saveWithImage).catch(function (err) {
                setStatus(err.message || "이미지 오류", true);
            });
        } else {
            saveWithImage(editingId ? pendingImageData : "");
        }
    });

    loadList();
})();
