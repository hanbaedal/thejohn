(function () {
    var MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    var api = window.THEJHON_API;

    var form = document.getElementById("pr-form");
    var statusEl = document.getElementById("pr-status");
    var editIdInput = document.getElementById("pr-edit-id");
    var titleInput = document.getElementById("pr-title");
    var photoInput = document.getElementById("pr-photo");
    var photoPreview = document.getElementById("pr-photo-preview");
    var contentInput = document.getElementById("pr-content");
    var priceInput = document.getElementById("pr-price");
    var specInput = document.getElementById("pr-spec");
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
                var imgBlock = it.image
                    ? "<img class=\"pr-card-img\" src=" + JSON.stringify(it.image) + ' alt="">'
                    : '<div class="pr-card-img pr-card-img--empty" role="img" aria-label="사진 없음">사진<br>없음</div>';
                var specHtml = "";
                if (it.spec && String(it.spec).trim()) {
                    specHtml =
                        '<span class="pr-card-spec">규격: ' + escapeHtml(String(it.spec).trim()) + "</span>";
                }
                return (
                    '<article class="pr-card" data-id="' +
                    escapeHtml(it.id) +
                    '"><div class="pr-card-head">' +
                    imgBlock +
                    '<div class="pr-card-body"><h3 class="pr-card-title">' +
                    escapeHtml(it.title) +
                    '</h3><p class="pr-card-price"><span>' +
                    escapeHtml(formatWon(it.price)) +
                    "</span>" +
                    specHtml +
                    '</p><p class="pr-card-content">' +
                    escapeHtml(it.content) +
                    '</p><div class="pr-card-actions"><button type="button" class="pr-btn-edit" data-id="' +
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
        titleInput.value = it.title;
        contentInput.value = it.content;
        priceInput.value = String(it.price);
        if (specInput) specInput.value = it.spec != null ? String(it.spec) : "";
        photoInput.value = "";
        pendingImageData = it.image || "";
        updatePhotoPreview(pendingImageData || "");
        cancelBtn.hidden = false;
        submitBtn.textContent = "수정 저장";
        setStatus("수정 중입니다. 저장하면 반영됩니다.");
        titleInput.focus();
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
        var title = titleInput.value.trim();
        var content = contentInput.value.trim();
        var spec = specInput ? specInput.value.trim() : "";
        var price = parseInt(priceInput.value.trim(), 10);
        var file = photoInput.files && photoInput.files[0];
        var editingId = editIdInput.value.trim();

        if (!title) {
            setStatus("제목을 입력해 주세요.", true);
            titleInput.focus();
            return;
        }
        if (!content) {
            setStatus("내용을 입력해 주세요.", true);
            contentInput.focus();
            return;
        }
        if (!isFinite(price) || price < 0) {
            setStatus("가격을 올바르게 입력해 주세요.", true);
            priceInput.focus();
            return;
        }

        function saveWithImage(imageData) {
            if (!editingId && !imageData) {
                setStatus("신규 등록 시 사진을 선택해 주세요.", true);
                photoInput.focus();
                return;
            }
            var body = { title: title, content: content, spec: spec, price: price, image: imageData || "" };
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
