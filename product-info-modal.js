/**
 * 상품정보(식품 표시사항) 모달 — product_info API 연동
 */
(function (global) {
    var FIELD_DEFS = [
        { key: "productName", label: "제품명", multiline: false, max: 200 },
        { key: "foodType", label: "식품유형", multiline: false, max: 120 },
        { key: "producer", label: "생산자", multiline: false, max: 200 },
        { key: "manufactureDate", label: "제조월일", multiline: false, max: 120 },
        { key: "expirationDate", label: "소비기한", multiline: false, max: 200 },
        { key: "storageMethod", label: "보관방법", multiline: false, max: 200 },
        { key: "netWeight", label: "내용량", multiline: false, max: 80 },
        { key: "ingredients", label: "원재료명 및 함량", multiline: true, max: 8000 },
        { key: "customerCenter", label: "고객센터", multiline: false, max: 80 },
        { key: "notes", label: "확인사항", multiline: true, max: 4000 }
    ];

    function emptyValues() {
        var o = {};
        FIELD_DEFS.forEach(function (d) {
            o[d.key] = "";
        });
        return o;
    }

    function hasAnyValue(values) {
        if (!values) return false;
        return FIELD_DEFS.some(function (d) {
            return String(values[d.key] || "").trim().length > 0;
        });
    }

    function escapeAttr(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;");
    }

    var modalEl = null;
    var formEl = null;
    var statusEl = null;
    var openBtnRef = null;
    var state = {
        productId: "",
        api: null,
        values: emptyValues(),
        onLocalChange: null
    };

    function ensureModal() {
        if (modalEl) return modalEl;
        modalEl = document.createElement("div");
        modalEl.id = "pinfoModal";
        modalEl.className = "pinfo-modal";
        modalEl.hidden = true;
        modalEl.setAttribute("role", "dialog");
        modalEl.setAttribute("aria-modal", "true");
        modalEl.setAttribute("aria-labelledby", "pinfoModalTitle");

        var rowsHtml = FIELD_DEFS.map(function (d) {
            var id = "pinfo-field-" + d.key;
            var inner =
                d.multiline ?
                    '<textarea id="' +
                    id +
                    '" data-pinfo-key="' +
                    escapeAttr(d.key) +
                    '" maxlength="' +
                    d.max +
                    '" rows="4"></textarea>'
                :   '<input type="text" id="' +
                    id +
                    '" data-pinfo-key="' +
                    escapeAttr(d.key) +
                    '" maxlength="' +
                    d.max +
                    '">';
            return (
                '<div class="pinfo-row">' +
                '<p class="pinfo-row__label">' +
                escapeAttr(d.label) +
                "</p>" +
                '<div class="pinfo-row__input">' +
                inner +
                "</div></div>"
            );
        }).join("");

        modalEl.innerHTML =
            '<div class="pinfo-modal__panel">' +
            '<div class="pinfo-modal__head">' +
            '<h2 class="pinfo-modal__title" id="pinfoModalTitle">상품정보</h2>' +
            '<button type="button" class="pinfo-modal__close" id="pinfoModalClose" aria-label="닫기">&times;</button>' +
            "</div>" +
            '<div class="pinfo-modal__body">' +
            '<p class="pinfo-modal__hint">제목은 고정입니다. 내용을 입력한 뒤 「적용」을 누르세요. 상품 저장 시 함께 DB에 반영됩니다.</p>' +
            '<div class="pinfo-form" id="pinfoForm">' +
            rowsHtml +
            "</div>" +
            '<p id="pinfoModalStatus" class="pr-hint" role="status" style="margin-top:0.65rem"></p>' +
            "</div>" +
            '<div class="pinfo-modal__foot">' +
            '<button type="button" class="btn btn-secondary" id="pinfoModalCancel">취소</button>' +
            '<button type="button" class="btn btn-primary" id="pinfoModalApply">적용</button>' +
            "</div></div>";

        document.body.appendChild(modalEl);
        formEl = document.getElementById("pinfoForm");
        statusEl = document.getElementById("pinfoModalStatus");

        document.getElementById("pinfoModalClose").addEventListener("click", close);
        document.getElementById("pinfoModalCancel").addEventListener("click", close);
        document.getElementById("pinfoModalApply").addEventListener("click", applyFromForm);
        modalEl.addEventListener("click", function (e) {
            if (e.target === modalEl) close();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && modalEl && !modalEl.hidden) close();
        });
        return modalEl;
    }

    function setModalStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#5a6d7e";
    }

    function readFormValues() {
        var values = emptyValues();
        if (!formEl) return values;
        formEl.querySelectorAll("[data-pinfo-key]").forEach(function (el) {
            var key = el.getAttribute("data-pinfo-key");
            if (key) values[key] = el.value.trim();
        });
        return values;
    }

    function fillForm(values) {
        values = values || emptyValues();
        if (!formEl) return;
        formEl.querySelectorAll("[data-pinfo-key]").forEach(function (el) {
            var key = el.getAttribute("data-pinfo-key");
            el.value = values[key] != null ? values[key] : "";
        });
    }

    function updateOpenBtn() {
        if (!openBtnRef) return;
        if (hasAnyValue(state.values)) {
            openBtnRef.classList.add("has-data");
            openBtnRef.setAttribute("title", "상품정보 입력됨");
        } else {
            openBtnRef.classList.remove("has-data");
            openBtnRef.removeAttribute("title");
        }
    }

    function notifyLocal() {
        updateOpenBtn();
        if (typeof state.onLocalChange === "function") {
            state.onLocalChange(state.values, hasAnyValue(state.values));
        }
    }

    function applyFromForm() {
        state.values = readFormValues();
        if (state.productId && state.api && state.api.saveProductInfo) {
            setModalStatus("저장 중…");
            state.api
                .saveProductInfo(state.productId, state.values)
                .then(function () {
                    notifyLocal();
                    setModalStatus("");
                    close();
                })
                .catch(function (err) {
                    setModalStatus((err && err.message) || "저장 실패", true);
                });
            return;
        }
        notifyLocal();
        setModalStatus("적용했습니다. 상품 「저장」 시 서버에 기록됩니다.");
        close();
    }

    function setReadOnlyMode(on) {
        ensureModal();
        modalEl.classList.toggle("pinfo-modal--readonly", !!on);
        if (!formEl) return;
        formEl.querySelectorAll("input, textarea").forEach(function (el) {
            el.readOnly = !!on;
            el.tabIndex = on ? -1 : 0;
        });
    }

    function close() {
        if (!modalEl) return;
        modalEl.hidden = true;
        document.body.style.overflow = "";
        setModalStatus("");
        setReadOnlyMode(false);
    }

    /**
     * 상세·카탈로그 등 읽기 전용 — 서버 product_info 조회
     */
    function openReadOnly(api, productId) {
        productId = String(productId || "").trim();
        if (!productId) return;
        ensureModal();
        setReadOnlyMode(true);
        state.productId = productId;
        fillForm(emptyValues());
        setModalStatus("불러오는 중…");
        modalEl.hidden = false;
        document.body.style.overflow = "hidden";

        var loadP;
        if (api && api.getProductInfo) {
            loadP = api.getProductInfo(productId);
        } else if (api && api.get) {
            loadP = api.get("api/products/" + encodeURIComponent(productId) + "/info");
        } else {
            setModalStatus("상품정보를 불러올 수 없습니다.", true);
            return;
        }

        loadP
            .then(function (data) {
                var values =
                    data && data.item && data.item.values ? data.item.values : emptyValues();
                setValues(values);
                fillForm(state.values);
                if (!hasAnyValue(state.values)) {
                    setModalStatus("등록된 상품정보가 없습니다.");
                } else {
                    setModalStatus("");
                }
            })
            .catch(function (err) {
                setModalStatus((err && err.message) || "상품정보를 불러오지 못했습니다.", true);
            });
    }

    function open(opts) {
        opts = opts || {};
        ensureModal();
        setReadOnlyMode(false);
        if (opts.productName || opts.netWeight) {
            var merged = Object.assign({}, state.values, readFormValues());
            if (opts.productName && !String(merged.productName || "").trim()) {
                merged.productName = String(opts.productName).trim();
            }
            if (opts.netWeight && !String(merged.netWeight || "").trim()) {
                merged.netWeight = String(opts.netWeight).trim();
            }
            state.values = merged;
        }
        fillForm(state.values);
        setModalStatus(
            state.productId ?
                "저장된 상품입니다. 적용 후 상품 저장 시 서버에 반영됩니다."
            :   "신규 등록입니다. 상품 저장 후 상품정보가 DB에 저장됩니다."
        );
        modalEl.hidden = false;
        document.body.style.overflow = "hidden";
        var first = formEl && formEl.querySelector("input, textarea");
        if (first) first.focus();
    }

    function setValues(values) {
        state.values = Object.assign(emptyValues(), values || {});
        notifyLocal();
    }

    function getValues() {
        return Object.assign(emptyValues(), state.values);
    }

    function setProductId(id) {
        state.productId = String(id || "").trim();
    }

    function getProductId() {
        return state.productId;
    }

    /**
     * @param {object} opts
     * @param {HTMLElement} opts.openBtn
     * @param {function} [opts.onLocalChange]
     */
    function bindOpenButton(opts) {
        if (!opts || !opts.openBtn) return;
        openBtnRef = opts.openBtn;
        state.api = opts.api || null;
        state.onLocalChange = opts.onLocalChange || null;
        opts.openBtn.addEventListener("click", function (e) {
            e.preventDefault();
            open({
                productName: opts.getProductName ? opts.getProductName() : "",
                netWeight: opts.getNetWeight ? opts.getNetWeight() : ""
            });
        });
        updateOpenBtn();
    }

    function loadFromServer(api, productId) {
        if (!api || !api.getProductInfo || !productId) {
            return Promise.resolve();
        }
        return api.getProductInfo(productId).then(function (data) {
            if (data && data.item && data.item.values) {
                setValues(data.item.values);
            }
            if (data && data.fieldDefs && data.fieldDefs.length) {
                /* 서버 정의와 동기 — 현재 클라이언트 FIELD_DEFS 사용 */
            }
        });
    }

    function saveToServer(api, productId) {
        if (!api || !api.saveProductInfo || !productId) {
            return Promise.resolve();
        }
        if (!hasAnyValue(state.values)) {
            return api.deleteProductInfo ?
                api.deleteProductInfo(productId).catch(function () {})
            :   Promise.resolve();
        }
        return api.saveProductInfo(productId, state.values);
    }

    global.THEJHON_PRODUCT_INFO = {
        FIELD_DEFS: FIELD_DEFS,
        emptyValues: emptyValues,
        hasAnyValue: hasAnyValue,
        bindOpenButton: bindOpenButton,
        openReadOnly: openReadOnly,
        open: open,
        close: close,
        setValues: setValues,
        getValues: getValues,
        setProductId: setProductId,
        getProductId: getProductId,
        loadFromServer: loadFromServer,
        saveToServer: saveToServer
    };
})(typeof window !== "undefined" ? window : this);
