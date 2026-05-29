(function (g) {
    var MAX_BODY = 256;
    var MAX_PHOTOS = 3;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeMultiline(s) {
        return String(s)
            .split("\n")
            .map(function (line) {
                return escapeHtml(line);
            })
            .join("<br>");
    }

    function formatDateKo(ts) {
        if (!ts) return "";
        try {
            return new Date(ts).toLocaleString("ko-KR", {
                dateStyle: "medium",
                timeStyle: "short"
            });
        } catch (e) {
            return "";
        }
    }

    function deptLabel(deptId) {
        var cat = g.THEJHON_PRODUCT_CATALOG;
        if (!cat || !deptId) return "사업부문 미선택";
        var d = cat.getDept(deptId);
        return d ? d.label : String(deptId);
    }

    function initDeptModalPicker(options) {
        var catalog = options.catalog || g.THEJHON_PRODUCT_CATALOG;
        var displayInput = options.displayInput;
        var hiddenInput = options.hiddenInput;
        var modal = options.modal;
        var modalBtns = options.modalBtns;
        var includeAll = !!options.includeAll;
        var openOnHover = options.openOnHover !== false;
        var onSelect = options.onSelect;

        if (!catalog || !displayInput || !hiddenInput || !modal || !modalBtns) {
            return { getValue: function () { return ""; }, setValue: function () {} };
        }

        function setDisplayText(text) {
            if (displayInput.tagName === "BUTTON") {
                displayInput.textContent = text;
            } else {
                displayInput.value = text;
            }
        }

        function closeModal() {
            modal.hidden = true;
        }

        function openModal() {
            modal.hidden = false;
            var current = catalog.normalizeDept(hiddenInput.value || "");
            modalBtns.querySelectorAll(".sn-dept-opt").forEach(function (btn) {
                var dept = btn.getAttribute("data-dept") || "";
                btn.classList.toggle("is-selected", dept === current);
            });
        }

        function setDept(deptId) {
            var norm = catalog.normalizeDept(deptId || "");
            hiddenInput.value = norm;
            setDisplayText(norm ? deptLabel(norm) : includeAll ? "전체" : "");
            closeModal();
            if (typeof onSelect === "function") onSelect(norm);
        }

        modalBtns.innerHTML = "";
        if (includeAll) {
            var allBtn = document.createElement("button");
            allBtn.type = "button";
            allBtn.className = "sn-dept-opt";
            allBtn.setAttribute("data-dept", "");
            allBtn.textContent = "전체";
            allBtn.addEventListener("click", function () {
                setDept("");
            });
            modalBtns.appendChild(allBtn);
        }
        catalog.DEPARTMENTS.forEach(function (d) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sn-dept-opt";
            btn.setAttribute("data-dept", d.id);
            btn.textContent = d.icon ? d.icon + " " + d.label : d.label;
            btn.addEventListener("click", function () {
                setDept(d.id);
            });
            modalBtns.appendChild(btn);
        });

        displayInput.addEventListener("focus", openModal);
        if (openOnHover) {
            displayInput.addEventListener("mouseenter", openModal);
        }
        displayInput.addEventListener("click", openModal);
        displayInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openModal();
            }
        });

        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
        var closeBtn = modal.querySelector(".sn-dept-modal__close");
        if (closeBtn) {
            closeBtn.addEventListener("click", closeModal);
        }
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !modal.hidden) closeModal();
        });

        return {
            getValue: function () {
                return catalog.normalizeDept(hiddenInput.value || "");
            },
            setValue: function (deptId) {
                setDept(deptId || "");
            },
            open: openModal,
            close: closeModal
        };
    }

    function initPhotoManager(options) {
        var slotsEl = options.slotsEl;
        var galleryInput = options.galleryInput;
        var cameraInput = options.cameraInput;
        var btnGallery = options.btnGallery;
        var btnCamera = options.btnCamera;
        var onChange = options.onChange;
        var formApi = g.THEJHON_PRODUCT_FORM;
        var photos = [];

        if (!slotsEl || !formApi) {
            return {
                getPhotos: function () { return []; },
                setPhotos: function () {},
                clear: function () {}
            };
        }

        function notify() {
            if (typeof onChange === "function") onChange(photos.slice());
        }

        function renderSlots() {
            var html = "";
            var i;
            for (i = 0; i < MAX_PHOTOS; i++) {
                var src = photos[i] || "";
                html +=
                    '<div class="sn-photo-slot' +
                    (src ? " sn-photo-slot--filled" : "") +
                    '">' +
                    (src
                        ? '<img src="' +
                          escapeHtml(src) +
                          '" alt=""><button type="button" class="sn-photo-remove" data-index="' +
                          i +
                          '" aria-label="사진 ' +
                          (i + 1) +
                          ' 삭제">×</button>'
                        : '<span class="sn-photo-slot__empty">' +
                          (i + 1) +
                          "</span>") +
                    "</div>";
            }
            slotsEl.innerHTML = html;
            if (btnGallery) btnGallery.disabled = photos.length >= MAX_PHOTOS;
            if (btnCamera) btnCamera.disabled = photos.length >= MAX_PHOTOS;
        }

        function addPhoto(dataUrl) {
            if (!dataUrl || photos.length >= MAX_PHOTOS) return;
            photos.push(dataUrl);
            renderSlots();
            notify();
        }

        function removeAt(index) {
            if (index < 0 || index >= photos.length) return;
            photos.splice(index, 1);
            renderSlots();
            notify();
        }

        slotsEl.addEventListener("click", function (e) {
            var btn = e.target.closest(".sn-photo-remove");
            if (!btn) return;
            removeAt(parseInt(btn.getAttribute("data-index"), 10));
        });

        function bindInput(input) {
            if (!input) return;
            input.addEventListener("change", function () {
                var f = input.files && input.files[0];
                input.value = "";
                if (!f || photos.length >= MAX_PHOTOS) return;
                formApi
                    .processImageFileToSquareDataURL(f)
                    .then(function (dataUrl) {
                        addPhoto(dataUrl);
                    })
                    .catch(function (err) {
                        alert((err && err.message) || "사진을 처리하지 못했습니다.");
                    });
            });
        }

        if (btnGallery && galleryInput) {
            btnGallery.addEventListener("click", function () {
                if (photos.length < MAX_PHOTOS) galleryInput.click();
            });
        }
        if (btnCamera && cameraInput) {
            btnCamera.addEventListener("click", function () {
                if (photos.length < MAX_PHOTOS) cameraInput.click();
            });
        }
        bindInput(galleryInput);
        bindInput(cameraInput);
        renderSlots();

        return {
            getPhotos: function () {
                return photos.slice();
            },
            setPhotos: function (list) {
                photos = (list || []).slice(0, MAX_PHOTOS);
                renderSlots();
                notify();
            },
            clear: function () {
                photos = [];
                renderSlots();
                notify();
            }
        };
    }

    function imagesHtml(images) {
        var list = (images || []).filter(Boolean);
        if (!list.length) return "";
        return (
            '<div class="sn-detail-images">' +
            list
                .map(function (src) {
                    return '<img class="sn-detail-img" src="' + escapeHtml(src) + '" alt="">';
                })
                .join("") +
            "</div>"
        );
    }

    g.THEJHON_SUPPORT_NEWS = {
        MAX_BODY: MAX_BODY,
        MAX_PHOTOS: MAX_PHOTOS,
        escapeHtml: escapeHtml,
        escapeMultiline: escapeMultiline,
        formatDateKo: formatDateKo,
        deptLabel: deptLabel,
        initDeptModalPicker: initDeptModalPicker,
        initPhotoManager: initPhotoManager,
        imagesHtml: imagesHtml
    };
})(typeof window !== "undefined" ? window : this);
