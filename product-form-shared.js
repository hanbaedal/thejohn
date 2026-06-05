/**
 * 상품 등록·수정 폼 공통
 */
(function (global) {
    var MAX_IMAGE_BYTES = 1 * 1024 * 1024;
    /** 관리자 로고 — 저장 시 항상 이 크기(정사각)로 변환 */
    var STAFF_LOGO_PIXEL_SIZE = 512;
    /** 관리자 도장 — 거래명세서용 douzone-seal.png 와 동일 160×160 정사각 */
    var STAFF_SEAL_PIXEL_SIZE = 160;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function speakKorean(text) {
        if (!text || !global.speechSynthesis) return;
        try {
            global.speechSynthesis.cancel();
            var utter = new SpeechSynthesisUtterance(text);
            utter.lang = "ko-KR";
            utter.rate = 0.95;
            global.speechSynthesis.speak(utter);
        } catch (e) {}
    }

    function formatWon(n) {
        var num = Number(n);
        if (!isFinite(num)) return "0";
        return num.toLocaleString("ko-KR") + "원";
    }

    function parsePriceInput(el) {
        if (!el) return 0;
        var raw = String(el.value || "").trim();
        if (raw === "") return 0;
        var n = parseInt(raw, 10);
        return isFinite(n) && n >= 0 ? n : 0;
    }

    function dataUrlByteSize(dataUrl) {
        var base64 = String(dataUrl || "").split(",")[1] || "";
        return Math.ceil((base64.length * 3) / 4);
    }

    /** 앨범·카메라 공통 — type 없는 HEIC 등도 확장자로 허용 */
    function isImageFile(file) {
        if (!file) return false;
        var type = String(file.type || "").toLowerCase();
        if (type.indexOf("image/") === 0) return true;
        var name = String(file.name || "").toLowerCase();
        return /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(name);
    }

    function loadImageElement(src) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                resolve(img);
            };
            img.onerror = function () {
                reject(new Error("이미지를 디코딩할 수 없습니다."));
            };
            img.src = src;
        });
    }

    function loadImageFromFile(file) {
        return new Promise(function (resolve, reject) {
            if (!isImageFile(file)) {
                reject(new Error("이미지 파일만 선택할 수 있습니다."));
                return;
            }
            var url = URL.createObjectURL(file);
            loadImageElement(url)
                .then(function (img) {
                    resolve({ img: img, revokeUrl: url });
                })
                .catch(function () {
                    URL.revokeObjectURL(url);
                    var r = new FileReader();
                    r.onload = function () {
                        loadImageElement(r.result)
                            .then(function (img) {
                                resolve({ img: img, revokeUrl: null });
                            })
                            .catch(function () {
                                reject(
                                    new Error("이미지를 읽을 수 없습니다. JPG·PNG 사진을 선택해 주세요.")
                                );
                            });
                    };
                    r.onerror = function () {
                        reject(new Error("이미지를 읽을 수 없습니다."));
                    };
                    r.readAsDataURL(file);
                });
        });
    }

    function ensureImageDecoded(img) {
        if (img && typeof img.decode === "function") {
            return img.decode().then(function () {
                return img;
            });
        }
        return Promise.resolve(img);
    }

    function drawSquareJpeg(img, size, quality, fit) {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) throw new Error("이미지 크기를 확인할 수 없습니다.");
        var canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("이미지 처리를 지원하지 않는 브라우저입니다.");
        var mode = fit === "contain" ? "contain" : "cover";
        if (mode === "contain") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            var scale = Math.min(size / w, size / h);
            var dw = w * scale;
            var dh = h * scale;
            var dx = (size - dw) / 2;
            var dy = (size - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
        } else {
            var side = Math.min(w, h);
            var sx = (w - side) / 2;
            var sy = (h - side) / 2;
            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        }
        return canvas.toDataURL("image/jpeg", quality);
    }

    /** 도장용 — 투명 배경 PNG (JPEG 흰 배경 방지) */
    function drawSquarePng(img, size, fit) {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) throw new Error("이미지 크기를 확인할 수 없습니다.");
        var canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("이미지 처리를 지원하지 않는 브라우저입니다.");
        ctx.clearRect(0, 0, size, size);
        var mode = fit === "contain" ? "contain" : "cover";
        if (mode === "contain") {
            var scale = Math.min(size / w, size / h);
            var dw = w * scale;
            var dh = h * scale;
            var dx = (size - dw) / 2;
            var dy = (size - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
        } else {
            var side = Math.min(w, h);
            var sx = (w - side) / 2;
            var sy = (h - side) / 2;
            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        }
        return canvas.toDataURL("image/png");
    }

    function usesTransparentPngOutput(options) {
        return options.outputFormat === "png" || !!options.transparentBackground;
    }

    /**
     * 큰 이미지도 1:1 정사각형·1MB 이하 data URL로 변환 (로고 JPEG / 도장 PNG)
     */
    function processImageFileToSquareDataURL(file, options) {
        options = options || {};
        var maxBytes = options.maxBytes || MAX_IMAGE_BYTES;
        var maxDim = options.maxDimension || 1024;
        var fixedDimension = !!options.fixedDimension;
        var fit = options.fit === "contain" ? "contain" : "cover";
        var outputPng = usesTransparentPngOutput(options);
        var fileSize = file && file.size ? file.size : 0;

        if (!fixedDimension) {
            if (fileSize > maxBytes * 8) maxDim = Math.min(maxDim, 640);
            else if (fileSize > maxBytes * 4) maxDim = Math.min(maxDim, 800);
            else if (fileSize > maxBytes) maxDim = Math.min(maxDim, 1024);
        }

        return loadImageFromFile(file).then(function (payload) {
            var img = payload.img;
            var revokeUrl = payload.revokeUrl;

            function finish(dataUrl) {
                if (revokeUrl) URL.revokeObjectURL(revokeUrl);
                return dataUrl;
            }

            function fail(err) {
                if (revokeUrl) URL.revokeObjectURL(revokeUrl);
                throw err;
            }

            return ensureImageDecoded(img)
                .then(function (decoded) {
                    var dim = maxDim;
                    var quality = 0.9;
                    var dataUrl = "";
                    var lastBytes = Infinity;
                    var minDim = fixedDimension ? maxDim : 280;
                    var pngMinDim = fixedDimension ? Math.min(maxDim, 96) : 96;

                    for (var attempt = 0; attempt < 36; attempt++) {
                        dataUrl = outputPng
                            ? drawSquarePng(decoded, dim, fit)
                            : drawSquareJpeg(decoded, dim, quality, fit);
                        var bytes = dataUrlByteSize(dataUrl);
                        if (bytes <= maxBytes) return finish(dataUrl);

                        if (outputPng) {
                            if (dim > pngMinDim) {
                                dim = Math.max(pngMinDim, Math.round(dim * 0.88));
                            } else if (bytes >= lastBytes) {
                                break;
                            }
                        } else if (quality > 0.55) {
                            quality = Math.max(0.55, quality - 0.07);
                        } else if (!fixedDimension && dim > minDim) {
                            dim = Math.max(minDim, Math.round(dim * 0.82));
                            quality = 0.88;
                        } else if (fixedDimension && dim > 256) {
                            dim = Math.max(256, Math.round(dim * 0.85));
                            quality = 0.88;
                        } else {
                            if (bytes >= lastBytes) break;
                            quality = Math.max(0.45, quality - 0.05);
                        }
                        lastBytes = bytes;
                    }

                    if (dataUrlByteSize(dataUrl) <= maxBytes) return finish(dataUrl);
                    return fail(
                        new Error(
                            outputPng
                                ? "도장 이미지를 " +
                                      maxDim +
                                      "×" +
                                      maxDim +
                                      "·투명 PNG·1MB 이하로 줄이지 못했습니다. PNG 파일을 사용해 주세요."
                                : fixedDimension
                                  ? "이미지를 " +
                                        maxDim +
                                        "×" +
                                        maxDim +
                                        "·1MB 이하로 줄이지 못했습니다. 다른 사진을 선택해 주세요."
                                  : "이미지를 1MB 이하·1:1 비율로 줄이지 못했습니다. 다른 사진을 선택해 주세요."
                        )
                    );
                })
                .catch(function (err) {
                    return fail(err);
                });
        });
    }

    var STAFF_LOGO_PROCESS_OPTIONS = {
        maxDimension: STAFF_LOGO_PIXEL_SIZE,
        fixedDimension: true,
        fit: "contain",
        maxBytes: MAX_IMAGE_BYTES
    };

    var STAFF_SEAL_PROCESS_OPTIONS = {
        maxDimension: STAFF_SEAL_PIXEL_SIZE,
        fixedDimension: true,
        fit: "contain",
        maxBytes: MAX_IMAGE_BYTES,
        outputFormat: "png",
        transparentBackground: true
    };

    function processStaffSealFile(file) {
        return processImageFileToSquareDataURL(file, STAFF_SEAL_PROCESS_OPTIONS);
    }

    function processStaffLogoFile(file) {
        return processImageFileToSquareDataURL(file, STAFF_LOGO_PROCESS_OPTIONS);
    }

    /** 미리보기 img — hidden 속성·로드 타이밍 모두 처리 */
    function showImagePreview(imgEl, src) {
        if (!imgEl) return;
        if (!src) {
            imgEl.removeAttribute("src");
            imgEl.setAttribute("hidden", "");
            imgEl.classList.remove("tj-image-preview--visible");
            return;
        }
        function reveal() {
            imgEl.removeAttribute("hidden");
            imgEl.classList.add("tj-image-preview--visible");
        }
        imgEl.onload = function () {
            reveal();
        };
        imgEl.onerror = function () {
            imgEl.setAttribute("hidden", "");
            imgEl.classList.remove("tj-image-preview--visible");
        };
        imgEl.src = src;
        if (imgEl.complete && imgEl.naturalWidth > 0) {
            reveal();
        }
    }

    function readFileAsDataURL(file) {
        return processImageFileToSquareDataURL(file);
    }

    /**
     * 모바일: 앨범·파일 선택 / 카메라 촬영 (hidden file input 2개)
     * 앨범·카메라 모두 동일하게 1:1·1MB 이하로 변환 후 onSelect(dataUrl, file) 호출
     * options: { galleryInput, cameraInput, btnGallery, btnCamera, onSelect(dataUrl, file), onError(err) }
     */
    function initProductPhotoPicker(options) {
        var galleryInput = options.galleryInput;
        var cameraInput = options.cameraInput;
        var btnGallery = options.btnGallery;
        var btnCamera = options.btnCamera;
        var onSelect = options.onSelect;
        var onError = options.onError || function () {};
        var processOpts = options.processOptions || {};

        function bindInput(input) {
            if (!input) return;
            input.addEventListener("change", function () {
                var f = input.files && input.files[0];
                input.value = "";
                if (!f) return;
                var task = processImageFileToSquareDataURL(f, processOpts);
                task
                    .then(function (dataUrl) {
                        if (!dataUrl || dataUrlByteSize(dataUrl) < 200) {
                            throw new Error("이미지 처리 결과가 비어 있습니다. JPG·PNG 사진을 다시 선택해 주세요.");
                        }
                        if (!onSelect) return;
                        var ret = onSelect(dataUrl, f);
                        if (ret && typeof ret.catch === "function") {
                            ret.catch(function (err) {
                                onError(err);
                            });
                        }
                    })
                    .catch(function (err) {
                        onError(err);
                    });
            });
        }

        if (btnGallery && galleryInput) {
            btnGallery.addEventListener("click", function () {
                galleryInput.click();
            });
        }
        if (btnCamera && cameraInput) {
            btnCamera.addEventListener("click", function () {
                cameraInput.click();
            });
        }
        bindInput(galleryInput);
        bindInput(cameraInput);

        return {
            clear: function () {
                if (galleryInput) galleryInput.value = "";
                if (cameraInput) cameraInput.value = "";
            }
        };
    }

    var MAX_PRODUCT_PHOTOS = 5;

    function hasProductImages(data) {
        if (!data) return false;
        if (Array.isArray(data.pd_images)) {
            for (var i = 0; i < data.pd_images.length; i++) {
                if (data.pd_images[i]) return true;
            }
        }
        return !!data.pd_image;
    }

    /**
     * 상품 사진 최대 5장 — 슬롯 미리보기·삭제, 앨범/카메라로 추가
     * options: { slotsRoot, countEl, hintEl, btnGallery, btnCamera, galleryInput, cameraInput,
     *   maxPhotos?, onChange(images[]), onError(err), onStatus?(msg) }
     */
    function initProductPhotoGallery(options) {
        options = options || {};
        var maxPhotos = options.maxPhotos || MAX_PRODUCT_PHOTOS;
        var slotsRoot = options.slotsRoot;
        var countEl = options.countEl;
        var hintEl = options.hintEl;
        var onChange = options.onChange;
        var onStatus = options.onStatus || function () {};
        var images = [];

        function notify() {
            if (countEl) {
                countEl.textContent = images.length + " / " + maxPhotos + "장";
            }
            if (hintEl) {
                hintEl.textContent =
                    images.length >= maxPhotos
                        ? "최대 " + maxPhotos + "장까지 등록할 수 있습니다. 삭제 후 다시 추가할 수 있습니다."
                        : "앨범·카메라로 추가하면 1:1 정사각형·1MB 이하로 자동 맞춥니다. (최대 " +
                          maxPhotos +
                          "장)";
            }
            if (typeof onChange === "function") onChange(images.slice());
        }

        function updateButtons(disabled) {
            if (options.btnGallery) options.btnGallery.disabled = !!disabled;
            if (options.btnCamera) options.btnCamera.disabled = !!disabled;
        }

        function renderSlots() {
            if (!slotsRoot) return;
            slotsRoot.innerHTML = "";
            images.forEach(function (src, idx) {
                var slot = document.createElement("div");
                slot.className = "pr-photo-slot";
                var img = document.createElement("img");
                img.className = "pr-photo-slot-img tj-image-preview";
                img.alt = "상품 사진 " + (idx + 1);
                img.width = 96;
                img.height = 96;
                img.src = src;
                var del = document.createElement("button");
                del.type = "button";
                del.className = "pr-photo-slot-del";
                del.setAttribute("aria-label", "사진 " + (idx + 1) + " 삭제");
                del.textContent = "삭제";
                del.addEventListener("click", function () {
                    images.splice(idx, 1);
                    renderSlots();
                    notify();
                    onStatus("사진을 삭제했습니다.");
                });
                slot.appendChild(img);
                slot.appendChild(del);
                slotsRoot.appendChild(slot);
            });
            updateButtons(images.length >= maxPhotos);
            notify();
        }

        var picker = initProductPhotoPicker({
            galleryInput: options.galleryInput,
            cameraInput: options.cameraInput,
            btnGallery: options.btnGallery,
            btnCamera: options.btnCamera,
            onSelect: function (dataUrl) {
                if (images.length >= maxPhotos) {
                    var err = new Error("상품 사진은 최대 " + maxPhotos + "장까지 등록할 수 있습니다.");
                    if (options.onError) options.onError(err);
                    return;
                }
                images.push(dataUrl);
                renderSlots();
                onStatus("사진을 추가했습니다. (" + images.length + "/" + maxPhotos + ")");
            },
            onError: options.onError
        });

        renderSlots();

        return {
            getImages: function () {
                return images.slice();
            },
            setImages: function (arr) {
                images = (arr || []).slice(0, maxPhotos);
                renderSlots();
            },
            clear: function () {
                images = [];
                renderSlots();
                if (picker) picker.clear();
            },
            picker: picker
        };
    }

    function deptLabel(catalog, deptId) {
        if (!deptId) return "";
        var norm = String(deptId).trim().toLowerCase();
        if (norm === "uncontracted") return "미계약";
        if (!catalog) return deptId;
        var d = catalog.getDept(deptId);
        return d ? d.label : deptId;
    }

    function initDeptPicker(options) {
        var catalog = options.catalog || global.THEJHON_PRODUCT_CATALOG;
        var root = options.root;
        var hiddenInput = options.hiddenInput;
        var onSelect = options.onSelect;
        if (!root || !catalog || !hiddenInput) return;

        root.innerHTML = "";
        root.setAttribute("role", "group");
        root.setAttribute("aria-label", "사업부문 선택");

        if (options.showAll) {
            var allBtn = document.createElement("button");
            allBtn.type = "button";
            allBtn.className = "am-dept-btn";
            allBtn.setAttribute("data-dept", "");
            allBtn.textContent = "전체";
            allBtn.addEventListener("click", function () {
                setSelectedDept("");
            });
            root.appendChild(allBtn);
        }

        catalog.DEPARTMENTS.forEach(function (d) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "am-dept-btn";
            btn.setAttribute("data-dept", d.id);
            btn.textContent = d.label;
            btn.addEventListener("click", function () {
                setSelectedDept(d.id);
            });
            root.appendChild(btn);
        });

        function setSelectedDept(deptId) {
            var norm = catalog.normalizeDept(deptId);
            hiddenInput.value = norm;
            var btns = root.querySelectorAll(".am-dept-btn");
            for (var i = 0; i < btns.length; i++) {
                var on = btns[i].getAttribute("data-dept") === norm;
                btns[i].classList.toggle("is-selected", on);
                btns[i].setAttribute("aria-pressed", on ? "true" : "false");
            }
            if (typeof onSelect === "function") onSelect(norm);
        }

        return {
            setValue: function (deptId) {
                setSelectedDept(deptId || "");
            },
            getValue: function () {
                return catalog.normalizeDept(hiddenInput.value);
            },
            clear: function () {
                setSelectedDept("");
            }
        };
    }

    function validateProductFields(data, options) {
        options = options || {};
        if (data.pd_code && String(data.pd_code).trim().length > 16) {
            return "상품 코드는 16자 이내로 입력해 주세요.";
        }
        if (!data.pd_name) return "상품 명칭을 입력해 주세요.";
        if (!data.pd_explain) return "상품 설명을 입력해 주세요.";
        if (!data.pd_dept) return "사업부문을 선택해 주세요.";
        if (options.requireImage && !hasProductImages(data)) {
            return "신규 등록 시 상품 사진을 1장 이상 선택해 주세요.";
        }
        if (Array.isArray(data.pd_images) && data.pd_images.length > MAX_PRODUCT_PHOTOS) {
            return "상품 사진은 최대 " + MAX_PRODUCT_PHOTOS + "장까지 등록할 수 있습니다.";
        }
        return "";
    }

    /**
     * 상품 명칭 중복 확인 (입력·포커스 아웃 시 API 호출)
     * options: { nameInput, hintEl, checkDuplicate(name, excludeId, deptId)=>Promise, getExcludeId?, getDeptId? }
     */
    function initProductNameDuplicateCheck(options) {
        var nameInput = options.nameInput;
        var hintEl = options.hintEl;
        var checkDuplicate = options.checkDuplicate;
        var getExcludeId = options.getExcludeId || function () {
            return "";
        };
        var getDeptId = options.getDeptId || function () {
            return "";
        };
        var debounceMs = options.debounceMs || 450;
        var state = { duplicate: false, checking: false, lastChecked: "" };
        var timer = null;
        var seq = 0;

        if (!nameInput || !checkDuplicate) {
            return {
                checkNow: function () {
                    return Promise.resolve({ duplicate: false });
                },
                isDuplicate: function () {
                    return false;
                },
                isChecking: function () {
                    return false;
                },
                reset: function () {}
            };
        }

        function setHint(mode, text) {
            if (!hintEl) return;
            hintEl.textContent = text || "";
            hintEl.hidden = !text;
            hintEl.className = "pr-name-dup-hint pr-name-dup-hint--" + (mode || "idle");
            if (mode === "dup") {
                nameInput.setAttribute("aria-invalid", "true");
                nameInput.classList.add("pr-name-input--dup");
            } else {
                nameInput.removeAttribute("aria-invalid");
                nameInput.classList.remove("pr-name-input--dup");
            }
        }

        function runCheck() {
            var name = String(nameInput.value || "").trim();
            var dept = getDeptId ? String(getDeptId() || "").trim() : "";
            if (!name) {
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "");
                return Promise.resolve({ duplicate: false });
            }
            if (!dept) {
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "같은 사업부문 내에서만 명칭 중복을 확인합니다. 사업부문을 선택해 주세요.");
                return Promise.resolve({ duplicate: false });
            }
            var mySeq = ++seq;
            state.checking = true;
            setHint("checking", "같은 사업부문에서 명칭 중복 확인 중…");
            return checkDuplicate(name, getExcludeId(), dept)
                .then(function (res) {
                    if (mySeq !== seq) return res;
                    state.checking = false;
                    state.lastChecked = name;
                    state.duplicate = !!(res && res.duplicate);
                    if (state.duplicate) {
                        setHint("dup", "같은 사업부문에 이미 등록된 상품 명칭입니다.");
                    } else {
                        setHint("ok", "사용 가능한 상품 명칭입니다.");
                    }
                    return res;
                })
                .catch(function () {
                    if (mySeq !== seq) return { duplicate: false };
                    state.checking = false;
                    setHint("err", "중복 확인에 실패했습니다. 다시 시도해 주세요.");
                    return { duplicate: false, error: true };
                });
        }

        nameInput.addEventListener("input", function () {
            var name = String(nameInput.value || "").trim();
            if (name !== state.lastChecked) {
                state.duplicate = false;
                if (!name) setHint("idle", "");
            }
            if (timer) clearTimeout(timer);
            timer = setTimeout(runCheck, debounceMs);
        });
        nameInput.addEventListener("blur", function () {
            if (timer) clearTimeout(timer);
            runCheck();
        });

        return {
            checkNow: runCheck,
            isDuplicate: function () {
                return state.duplicate;
            },
            isChecking: function () {
                return state.checking;
            },
            reset: function () {
                if (timer) clearTimeout(timer);
                seq++;
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "");
            }
        };
    }

    /**
     * 상품 코드 중복 확인 (같은 사업부문, 코드 입력 시에만)
     */
    function initProductCodeDuplicateCheck(options) {
        var codeInput = options.codeInput;
        var hintEl = options.hintEl;
        var checkDuplicate = options.checkDuplicate;
        var getExcludeId = options.getExcludeId || function () {
            return "";
        };
        var getDeptId = options.getDeptId || function () {
            return "";
        };
        var debounceMs = options.debounceMs || 450;
        var state = { duplicate: false, checking: false, lastChecked: "" };
        var timer = null;
        var seq = 0;

        if (!codeInput || !checkDuplicate) {
            return {
                checkNow: function () {
                    return Promise.resolve({ duplicate: false });
                },
                isDuplicate: function () {
                    return false;
                },
                isChecking: function () {
                    return false;
                },
                reset: function () {}
            };
        }

        function setHint(mode, text) {
            if (!hintEl) return;
            hintEl.textContent = text || "";
            hintEl.hidden = !text;
            hintEl.className = "pr-name-dup-hint pr-name-dup-hint--" + (mode || "idle");
            if (mode === "dup") {
                codeInput.setAttribute("aria-invalid", "true");
                codeInput.classList.add("pr-code-input--dup");
            } else {
                codeInput.removeAttribute("aria-invalid");
                codeInput.classList.remove("pr-code-input--dup");
            }
        }

        function runCheck() {
            var code = String(codeInput.value || "").trim();
            var dept = getDeptId ? String(getDeptId() || "").trim() : "";
            if (!code) {
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "");
                return Promise.resolve({ duplicate: false });
            }
            if (!dept) {
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "사업부문을 선택하면 코드 중복을 확인합니다.");
                return Promise.resolve({ duplicate: false });
            }
            var mySeq = ++seq;
            state.checking = true;
            setHint("checking", "같은 사업부문에서 코드 중복 확인 중…");
            return checkDuplicate(code, getExcludeId(), dept)
                .then(function (res) {
                    if (mySeq !== seq) return res;
                    state.checking = false;
                    state.lastChecked = code;
                    state.duplicate = !!(res && res.duplicate);
                    if (state.duplicate) {
                        setHint("dup", "같은 사업부문에 이미 사용 중인 상품 코드입니다.");
                    } else {
                        setHint("ok", "사용 가능한 상품 코드입니다.");
                    }
                    return res;
                })
                .catch(function () {
                    if (mySeq !== seq) return { duplicate: false };
                    state.checking = false;
                    setHint("err", "중복 확인에 실패했습니다. 다시 시도해 주세요.");
                    return { duplicate: false, error: true };
                });
        }

        codeInput.addEventListener("input", function () {
            var code = String(codeInput.value || "").trim();
            if (code !== state.lastChecked) {
                state.duplicate = false;
                if (!code) setHint("idle", "");
            }
            if (timer) clearTimeout(timer);
            timer = setTimeout(runCheck, debounceMs);
        });
        codeInput.addEventListener("blur", function () {
            if (timer) clearTimeout(timer);
            runCheck();
        });

        return {
            checkNow: runCheck,
            isDuplicate: function () {
                return state.duplicate;
            },
            isChecking: function () {
                return state.checking;
            },
            reset: function () {
                if (timer) clearTimeout(timer);
                seq++;
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "");
            }
        };
    }

    /** 저장 전 명칭·코드 중복 확인 */
    function beforeProductSaveDuplicateCheck(options, onReady) {
        var nameDup = options.nameDupCheck;
        var codeDup = options.codeDupCheck;
        var onStatus = options.onStatus;
        var nameInput = options.nameInput;
        var codeInput = options.codeInput;

        function fail(msg, focusEl) {
            if (onStatus) onStatus(msg, true);
            if (focusEl) focusEl.focus();
        }

        function checkCode() {
            if (!codeDup) {
                onReady();
                return;
            }
            codeDup.checkNow().then(function (res) {
                if (res && res.duplicate) {
                    fail(
                        "같은 사업부문에 이미 사용 중인 상품 코드입니다. 다른 코드를 입력해 주세요.",
                        codeInput
                    );
                    return;
                }
                if (codeDup.isChecking()) {
                    fail("상품 코드 중복 확인 중입니다. 잠시 후 다시 시도해 주세요.", codeInput);
                    return;
                }
                onReady();
            });
        }

        function checkName() {
            if (!nameDup) {
                checkCode();
                return;
            }
            nameDup.checkNow().then(function (res) {
                if (res && res.duplicate) {
                    fail(
                        "같은 사업부문에 이미 등록된 상품 명칭입니다. 다른 명칭을 입력해 주세요.",
                        nameInput
                    );
                    return;
                }
                if (nameDup.isChecking()) {
                    fail("명칭 중복 확인 중입니다. 잠시 후 다시 시도해 주세요.", nameInput);
                    return;
                }
                checkCode();
            });
        }

        checkName();
    }

    global.THEJHON_PRODUCT_FORM = {
        MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
        STAFF_LOGO_PIXEL_SIZE: STAFF_LOGO_PIXEL_SIZE,
        STAFF_SEAL_PIXEL_SIZE: STAFF_SEAL_PIXEL_SIZE,
        STAFF_LOGO_PROCESS_OPTIONS: STAFF_LOGO_PROCESS_OPTIONS,
        STAFF_SEAL_PROCESS_OPTIONS: STAFF_SEAL_PROCESS_OPTIONS,
        escapeHtml: escapeHtml,
        speakKorean: speakKorean,
        formatWon: formatWon,
        parsePriceInput: parsePriceInput,
        isImageFile: isImageFile,
        processImageFileToSquareDataURL: processImageFileToSquareDataURL,
        processStaffLogoFile: processStaffLogoFile,
        processStaffSealFile: processStaffSealFile,
        showImagePreview: showImagePreview,
        readFileAsDataURL: readFileAsDataURL,
        initProductPhotoPicker: initProductPhotoPicker,
        initProductPhotoGallery: initProductPhotoGallery,
        MAX_PRODUCT_PHOTOS: MAX_PRODUCT_PHOTOS,
        hasProductImages: hasProductImages,
        deptLabel: deptLabel,
        initDeptPicker: initDeptPicker,
        initProductNameDuplicateCheck: initProductNameDuplicateCheck,
        initProductCodeDuplicateCheck: initProductCodeDuplicateCheck,
        beforeProductSaveDuplicateCheck: beforeProductSaveDuplicateCheck,
        validateProductFields: validateProductFields
    };
})(typeof window !== "undefined" ? window : global);
