/**
 * 상품 등록·수정 폼 공통
 */
(function (global) {
    var MAX_IMAGE_BYTES = 1 * 1024 * 1024;

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

    function parsePriceInput(el) {
        if (!el) return 0;
        var n = parseInt(String(el.value || "").trim(), 10);
        return isFinite(n) && n >= 0 ? n : NaN;
    }

    function readFileAsDataURL(file) {
        return new Promise(function (resolve, reject) {
            if (file.size > MAX_IMAGE_BYTES) {
                reject(new Error("이미지는 1MB 이하로 선택해 주세요."));
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

    function deptLabel(catalog, deptId) {
        if (!catalog || !deptId) return "";
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
        if (!data.pd_name) return "상품 명칭을 입력해 주세요.";
        if (!data.pd_explain) return "상품 설명을 입력해 주세요.";
        var prices = [data.pd_price1, data.pd_price2, data.pd_price3, data.pd_price4];
        if (prices.some(function (p) {
            return !isFinite(p);
        })) {
            return "가격 1~4를 올바르게 입력해 주세요.";
        }
        if (!prices.some(function (p) {
            return p > 0;
        })) {
            return "가격 1~4 중 하나 이상 0원보다 크게 입력해 주세요.";
        }
        if (!data.pd_dept) return "사업부문을 선택해 주세요.";
        if (options.requireImage && !data.pd_image) {
            return "신규 등록 시 상품 사진을 선택해 주세요.";
        }
        return "";
    }

    global.THEJHON_PRODUCT_FORM = {
        MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
        escapeHtml: escapeHtml,
        formatWon: formatWon,
        parsePriceInput: parsePriceInput,
        readFileAsDataURL: readFileAsDataURL,
        deptLabel: deptLabel,
        initDeptPicker: initDeptPicker,
        validateProductFields: validateProductFields
    };
})(typeof window !== "undefined" ? window : global);
