/**
 * 거래명세서 수기 작성 — 주문서 관리
 */
(function () {
    var api = window.THEJHON_API;
    var OU = window.THEJHON_ORDER_UI;
    var Auth = window.THEJHON_AUTH;
    var QS = window.THEJHON_QTY_STEPPER;
    var statusEl = document.getElementById("tmr-status");
    var form = document.getElementById("tmr-form");
    var itemsBody = document.getElementById("tmr-items-body");
    var issuerSelect = document.getElementById("tmr-issuer");
    var savedListEl = document.getElementById("tmr-saved-list");
    var totalLabel = document.getElementById("tmr-total-label");
    var btnPdf = document.getElementById("tmr-btn-pdf");
    var btnDelete = document.getElementById("tmr-btn-delete");
    var vendorCompanyEl = document.getElementById("tmr-vendor-company");
    var vendorModal = document.getElementById("tmr-vendor-modal");
    var vendorModalCloseBtn = document.getElementById("tmr-vendor-modal-close");
    var vendorSearchEl = document.getElementById("tmr-vendor-search");
    var vendorListEl = document.getElementById("tmr-vendor-list");
    var btnVendorPick = document.getElementById("tmr-btn-vendor-pick");
    var AF = window.THEJHON_ADDRESS_FIELDS;
    var productModal = document.getElementById("tmr-product-modal");
    var productModalCloseBtn = document.getElementById("tmr-product-modal-close");
    var productSearchEl = document.getElementById("tmr-product-search");
    var productListEl = document.getElementById("tmr-product-list");
    var issueYearEl = document.getElementById("tmr-issue-y");
    var issueMonthEl = document.getElementById("tmr-issue-m");
    var issueDayEl = document.getElementById("tmr-issue-d");
    var issuerWrap = document.getElementById("tmr-issuer-wrap");
    var issuerNoteEl = document.getElementById("tmr-issuer-note");
    var itemsHintEl = document.getElementById("tmr-items-hint");
    var isSupervisor = false;
    var adminIssuerName = "";
    var allVendors = [];
    var allProducts = [];
    var productsLoadedForIssuer = "";
    var vendorsLoadedForIssuer = "";
    var selectedVendorDetail = null;
    var activeProductRow = null;
    var currentId = "";

    var MAX_ROWS = 10;
    var MIN_ROWS = 1;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatWon(n) {
        if (OU && OU.formatWon) return OU.formatWon(n);
        var num = Number(n);
        if (!isFinite(num)) return "0원";
        return num.toLocaleString("ko-KR") + "원";
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "tmr-status" + (kind === "err" ? " tmr-status--err" : kind === "ok" ? " tmr-status--ok" : "");
    }

    var ISSUE_YEAR_START = 2018;

    function daysInMonth(year, month) {
        var y = parseInt(year, 10);
        var m = parseInt(month, 10);
        if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) return 31;
        return new Date(y, m, 0).getDate();
    }

    function issueDateToMs(val) {
        if (!val) return Date.now();
        var t = new Date(val + "T12:00:00").getTime();
        return isFinite(t) ? t : Date.now();
    }

    function msToDateParts(ms) {
        var d = new Date(ms || Date.now());
        return {
            y: String(d.getFullYear()),
            m: String(d.getMonth() + 1),
            d: String(d.getDate())
        };
    }

    function readIssueDateYmd() {
        var y = String(issueYearEl?.value || "").trim();
        var m = String(issueMonthEl?.value || "").trim();
        var d = String(issueDayEl?.value || "").trim();
        if (!y || !m || !d) return "";
        var mm = String(m).padStart(2, "0");
        var dd = String(d).padStart(2, "0");
        return y + "-" + mm + "-" + dd;
    }

    function readIssueDateMs() {
        return issueDateToMs(readIssueDateYmd());
    }

    function fillDayOptions(year, month, selectedDay) {
        if (!issueDayEl) return;
        var max = daysInMonth(year, month);
        var sel = parseInt(selectedDay, 10);
        if (!isFinite(sel) || sel < 1) sel = 1;
        if (sel > max) sel = max;
        var html = "";
        for (var day = 1; day <= max; day++) {
            html +=
                '<option value="' +
                day +
                '"' +
                (day === sel ? " selected" : "") +
                ">" +
                day +
                "일</option>";
        }
        issueDayEl.innerHTML = html;
        issueDayEl.value = String(sel);
    }

    function setIssueDateParts(y, m, d) {
        if (!issueYearEl || !issueMonthEl || !issueDayEl) return;
        var yi = parseInt(y, 10);
        var mi = parseInt(m, 10);
        var di = parseInt(d, 10);
        if (!isFinite(yi)) yi = new Date().getFullYear();
        if (!isFinite(mi) || mi < 1 || mi > 12) mi = 1;
        if (!isFinite(di) || di < 1) di = 1;
        if (issueYearEl.querySelector('option[value="' + yi + '"]')) {
            issueYearEl.value = String(yi);
        }
        issueMonthEl.value = String(mi);
        fillDayOptions(issueYearEl.value, mi, di);
    }

    function setIssueDateToToday() {
        var t = msToDateParts(Date.now());
        setIssueDateParts(t.y, t.m, t.d);
    }

    function initIssueDatePickers() {
        if (!issueYearEl || !issueMonthEl || !issueDayEl) return;
        var nowY = new Date().getFullYear();
        var endY = nowY + 1;
        var yHtml = "";
        for (var y = endY; y >= ISSUE_YEAR_START; y--) {
            yHtml += '<option value="' + y + '">' + y + "년</option>";
        }
        issueYearEl.innerHTML = yHtml;
        var mHtml = "";
        for (var m = 1; m <= 12; m++) {
            mHtml += '<option value="' + m + '">' + m + "월</option>";
        }
        issueMonthEl.innerHTML = mHtml;
        function onYmChange() {
            var year = issueYearEl.value;
            var month = issueMonthEl.value;
            var day = issueDayEl.value;
            fillDayOptions(year, month, day);
        }
        issueYearEl.addEventListener("change", onYmChange);
        issueMonthEl.addEventListener("change", onYmChange);
        setIssueDateToToday();
    }

    function parseNum(v) {
        var n = parseInt(String(v || "").replace(/[^\d-]/g, ""), 10);
        return isFinite(n) ? n : 0;
    }

    function qtyInputInRow(tr) {
        if (!tr) return null;
        return tr.querySelector(".qty-stepper__input") || tr.querySelector('[data-f="qty"]');
    }

    function readRow(tr) {
        if (!tr) return null;
        return {
            pd_code: String(tr.querySelector('[data-f="code"]')?.value || "").trim(),
            productName: String(tr.querySelector('[data-f="name"]')?.value || "").trim(),
            pd_size: String(tr.querySelector('[data-f="size"]')?.value || "").trim(),
            quantity: parseNum(qtyInputInRow(tr)?.value),
            unitPrice: parseNum(tr.querySelector('[data-f="price"]')?.value),
            lineTotal: parseNum(tr.querySelector('[data-f="line"]')?.value)
        };
    }

    function syncLineTotal(tr) {
        var qty = parseNum(qtyInputInRow(tr)?.value);
        var price = parseNum(tr.querySelector('[data-f="price"]')?.value);
        var lineEl = tr.querySelector('[data-f="line"]');
        if (lineEl && qty && price) {
            lineEl.value = String(qty * price);
        }
        updateTotal();
    }

    function updateTotal() {
        var sum = 0;
        if (itemsBody) {
            itemsBody.querySelectorAll("tr").forEach(function (tr) {
                var it = readRow(tr);
                if (it) sum += it.lineTotal || (it.quantity && it.unitPrice ? it.quantity * it.unitPrice : 0);
            });
        }
        if (totalLabel) totalLabel.textContent = "합계 " + formatWon(sum);
        return sum;
    }

    function qtyStepperHtml(quantity) {
        var q = parseInt(quantity, 10);
        if (!isFinite(q) || q < 0) q = 0;
        if (QS && QS.html) {
            return QS.html(q, { min: 0, className: "tmr-qty-stepper" });
        }
        return (
            '<input type="text" data-f="qty" inputmode="numeric" value="' +
            escapeHtml(q ? String(q) : "") +
            '">'
        );
    }

    function bindQtyStepper(tr) {
        if (!QS || !QS.bind || !tr) return;
        var root = tr.querySelector(".tmr-qty-stepper");
        if (!root) return;
        QS.bind(root, {
            min: 0,
            onChange: function () {
                syncLineTotal(tr);
            },
            onInput: function () {
                syncLineTotal(tr);
            }
        });
    }

    function setRowQty(tr, n) {
        var inp = qtyInputInRow(tr);
        if (!inp) return;
        var v = Math.max(0, parseInt(n, 10) || 0);
        inp.value = String(v);
    }

    function clearRowFields(tr) {
        if (!tr) return;
        tr.querySelectorAll("input").forEach(function (inp) {
            if (!inp.closest(".qty-stepper")) inp.value = "";
        });
        setRowQty(tr, 0);
    }

    function createRow(data) {
        data = data || {};
        var tr = document.createElement("tr");
        tr.innerHTML =
            '<td><input type="text" data-f="code" maxlength="16" value="' +
            escapeHtml(data.pd_code || "") +
            '"></td>' +
            '<td><input type="text" data-f="name" maxlength="120" value="' +
            escapeHtml(data.productName || "") +
            '"></td>' +
            '<td><input type="text" data-f="size" maxlength="80" value="' +
            escapeHtml(data.pd_size || "") +
            '"></td>' +
            "<td>" +
            qtyStepperHtml(data.quantity) +
            "</td>" +
            '<td><input type="text" data-f="price" inputmode="numeric" value="' +
            escapeHtml(data.unitPrice ? String(data.unitPrice) : "") +
            '"></td>' +
            '<td><input type="text" data-f="line" inputmode="numeric" value="' +
            escapeHtml(data.lineTotal ? String(data.lineTotal) : "") +
            '"></td>' +
            '<td><button type="button" class="btn btn-secondary tmr-row-del" title="행 삭제">×</button></td>';
        tr.querySelectorAll("input").forEach(function (inp) {
            if (inp.closest(".qty-stepper")) return;
            inp.addEventListener("input", function () {
                if (inp.getAttribute("data-f") === "price") {
                    syncLineTotal(tr);
                } else if (inp.getAttribute("data-f") === "line") {
                    updateTotal();
                }
            });
        });
        bindQtyStepper(tr);
        bindProductPickers(tr);
        var delBtn = tr.querySelector(".tmr-row-del");
        if (delBtn) {
            delBtn.addEventListener("click", function () {
                if (itemsBody.querySelectorAll("tr").length <= MIN_ROWS) {
                    clearRowFields(tr);
                    updateTotal();
                    return;
                }
                tr.remove();
                updateTotal();
            });
        }
        return tr;
    }

    function ensureRows(count) {
        if (!itemsBody) return;
        var n = Math.max(MIN_ROWS, Math.min(MAX_ROWS, count || MIN_ROWS));
        itemsBody.innerHTML = "";
        for (var i = 0; i < n; i++) {
            itemsBody.appendChild(createRow());
        }
        updateTotal();
    }

    function fillRows(items) {
        if (!itemsBody) return;
        itemsBody.innerHTML = "";
        var list = Array.isArray(items) && items.length ? items : [{}];
        var n = Math.min(MAX_ROWS, Math.max(MIN_ROWS, list.length));
        for (var i = 0; i < n; i++) {
            itemsBody.appendChild(createRow(list[i]));
        }
        updateTotal();
    }

    function getIssuerLoginId() {
        if (!isSupervisor) {
            return Auth && Auth.getUserId ? String(Auth.getUserId() || "").trim() : "";
        }
        return String(issuerSelect?.value || "").trim();
    }

    function getIssuerStaffName() {
        if (!isSupervisor) {
            return adminIssuerName || getIssuerLoginId();
        }
        var opt = issuerSelect && issuerSelect.selectedOptions[0];
        return opt ? String(opt.textContent || "").trim() : "";
    }

    function productListOpts() {
        var issuer = getIssuerLoginId();
        if (isSupervisor && issuer) {
            return { registeredBy: issuer };
        }
        return {};
    }

    function productMatchesIssuer(p, issuerId) {
        if (!p || !issuerId) return false;
        return staffIdsEqual(p.pd_registered_by, issuerId);
    }

    function vendorMatchesIssuer(v, issuerId) {
        if (!v || !issuerId) return false;
        return staffIdsEqual(v.registeredBy, issuerId);
    }

    function vendorsForPicker() {
        var issuer = getIssuerLoginId();
        if (!isSupervisor || !issuer) return allVendors;
        return allVendors.filter(function (v) {
            return vendorMatchesIssuer(v, issuer);
        });
    }

    function invalidateProductCache() {
        allProducts = [];
        productsLoadedForIssuer = "";
    }

    function invalidateVendorCache() {
        allVendors = [];
        vendorsLoadedForIssuer = "";
        selectedVendorDetail = null;
    }

    function readBody() {
        var items = [];
        if (itemsBody) {
            itemsBody.querySelectorAll("tr").forEach(function (tr) {
                var it = readRow(tr);
                if (!it) return;
                if (!it.productName && !it.lineTotal) return;
                if (!it.lineTotal && it.quantity && it.unitPrice) {
                    it.lineTotal = it.quantity * it.unitPrice;
                }
                items.push(it);
            });
        }
        var total = updateTotal();
        return {
            title: String(document.getElementById("tmr-title")?.value || "").trim(),
            issueDate: readIssueDateMs(),
            issuerStaffLoginId: getIssuerLoginId(),
            issuerStaffName: getIssuerStaffName(),
            vendorCompany: String(document.getElementById("tmr-vendor-company")?.value || "").trim(),
            vendorCeo: String(document.getElementById("tmr-vendor-ceo")?.value || "").trim(),
            vendorAddr: String(document.getElementById("tmr-vendor-addr")?.value || "").trim(),
            vendorPhone: String(document.getElementById("tmr-vendor-phone")?.value || "").trim(),
            items: items,
            totalAmount: total,
            note: String(document.getElementById("tmr-note")?.value || "").trim()
        };
    }

    function formatVendorAddr(it) {
        if (!it) return "";
        if (AF && AF.formatFullAddress) {
            return (
                AF.formatFullAddress(it.vn_zip, it.vn_addr, it.vn_addr_detail) ||
                String(it.vn_addr || "").trim()
            );
        }
        var parts = [it.vn_zip, it.vn_addr, it.vn_addr_detail].filter(function (p) {
            return String(p || "").trim();
        });
        return parts.join(" ").trim();
    }

    function mapVendorFromApi(it) {
        if (!it) return null;
        var company = String(it.vn_company || "").trim();
        if (!company) return null;
        return {
            id: String(it.id || it.loginId || company).trim(),
            companyName: company,
            ceo: String(it.vn_ceo || "").trim(),
            phone: String(it.vn_phone || "").trim(),
            addr: formatVendorAddr(it),
            grade: String(it.vn_grade != null ? it.vn_grade : "1").trim(),
            registeredBy: String(it.vn_registered_by || "").trim()
        };
    }

    function applyVendor(v) {
        if (!v) return;
        selectedVendorDetail = v;
        if (vendorCompanyEl) vendorCompanyEl.value = v.companyName || "";
        document.getElementById("tmr-vendor-ceo").value = v.ceo || "";
        document.getElementById("tmr-vendor-addr").value = v.addr || "";
        document.getElementById("tmr-vendor-phone").value = v.phone || "";
    }

    function isCatalogProduct(it) {
        return (
            String((it && it.pd_record_type) || "catalog")
                .trim()
                .toLowerCase() !== "new"
        );
    }

    function mapProductFromApi(it) {
        if (!it || !isCatalogProduct(it)) return null;
        var name = String(it.pd_name || "").trim();
        if (!name) return null;
        return {
            id: String(it.id || "").trim(),
            pd_code: String(it.pd_code || "").trim(),
            pd_name: name,
            pd_size: String(it.pd_size || "").trim(),
            pd_price1: Number(it.pd_price1) || 0,
            pd_price2: Number(it.pd_price2) || 0,
            pd_price3: Number(it.pd_price3) || 0,
            pd_price4: Number(it.pd_price4) || 0,
            pd_registered_by: String(it.pd_registered_by || "").trim()
        };
    }

    function parseVendorGrade(grade) {
        var n = parseInt(grade, 10);
        if (n === 4) n = 3;
        if (n >= 1 && n <= 3) return String(n);
        return "1";
    }

    function isLegacyRegistrar(id) {
        var s = String(id || "")
            .trim()
            .toLowerCase();
        return !s || s === "legacy";
    }

    function staffIdsEqual(a, b) {
        var x = String(a || "")
            .trim()
            .toLowerCase();
        var y = String(b || "")
            .trim()
            .toLowerCase();
        return !!x && x === y;
    }

    function resolveProductUnitPrice(product) {
        if (!product) return 0;
        var v = selectedVendorDetail;
        var vReg = v ? v.registeredBy : "";
        var pReg = product.pd_registered_by || "";
        var issuer = getIssuerLoginId();
        if (
            issuer &&
            staffIdsEqual(pReg, issuer) &&
            v &&
            !isLegacyRegistrar(vReg) &&
            staffIdsEqual(vReg, issuer)
        ) {
            var g = parseVendorGrade(v.grade);
            if (g === "2") return product.pd_price2 || 0;
            if (g === "3") return product.pd_price3 || 0;
            return product.pd_price1 || 0;
        }
        return product.pd_price1 || 0;
    }

    function applyProductToRow(tr, product) {
        if (!tr || !product) return;
        var codeEl = tr.querySelector('[data-f="code"]');
        var nameEl = tr.querySelector('[data-f="name"]');
        var sizeEl = tr.querySelector('[data-f="size"]');
        var priceEl = tr.querySelector('[data-f="price"]');
        var unit = resolveProductUnitPrice(product);
        if (codeEl) codeEl.value = product.pd_code || "";
        if (nameEl) nameEl.value = product.pd_name || "";
        if (sizeEl) sizeEl.value = product.pd_size || "";
        if (priceEl && unit) priceEl.value = String(unit);
        if (!parseNum(qtyInputInRow(tr)?.value)) setRowQty(tr, 1);
        syncLineTotal(tr);
    }

    function bindProductPickers(tr) {
        ["code", "name"].forEach(function (field) {
            var inp = tr.querySelector('[data-f="' + field + '"]');
            if (!inp) return;
            inp.classList.add("tmr-item-pick");
            inp.setAttribute(
                "placeholder",
                field === "code" ? "코드·선택" : "품명·선택"
            );
            inp.setAttribute("autocomplete", "off");
            inp.addEventListener("click", function () {
                openProductModal(tr, field);
            });
            inp.addEventListener("focus", function () {
                openProductModal(tr, field);
            });
        });
    }

    function closeProductModal() {
        if (productModal) productModal.hidden = true;
        activeProductRow = null;
    }

    function bindProductPickerButtons() {
        if (!productListEl) return;
        productListEl.querySelectorAll("[data-product-id]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = String(btn.getAttribute("data-product-id") || "").trim();
                var picked = allProducts.find(function (p) {
                    return p.id === id;
                });
                if (picked && activeProductRow) applyProductToRow(activeProductRow, picked);
                closeProductModal();
            });
        });
    }

    function loadProductsForIssuer() {
        var issuer = getIssuerLoginId();
        if (isSupervisor && !issuer) {
            return Promise.reject(new Error("먼저 공급자(발행 관리자)를 선택해 주세요."));
        }
        var cacheKey = issuer || "__self__";
        if (allProducts.length && productsLoadedForIssuer === cacheKey) {
            return Promise.resolve();
        }
        return api.listProducts(productListOpts()).then(function (items) {
            var list = (items || []).map(mapProductFromApi).filter(Boolean);
            if (isSupervisor && issuer) {
                list = list.filter(function (p) {
                    return productMatchesIssuer(p, issuer);
                });
            }
            allProducts = list.sort(function (a, b) {
                var ac = String(a.pd_code || "");
                var bc = String(b.pd_code || "");
                if (ac !== bc) return ac.localeCompare(bc, "ko");
                return String(a.pd_name || "").localeCompare(String(b.pd_name || ""), "ko");
            });
            productsLoadedForIssuer = cacheKey;
        });
    }

    function renderProductList(query) {
        if (!productListEl) return;
        var q = String(query || "")
            .trim()
            .toLowerCase();
        var items = allProducts.filter(function (p) {
            if (!q) return true;
            var code = String(p.pd_code || "").toLowerCase();
            var name = String(p.pd_name || "").toLowerCase();
            return code.indexOf(q) >= 0 || name.indexOf(q) >= 0;
        });
        if (!items.length) {
            productListEl.innerHTML =
                '<li><p class="tmr-picker-empty">' +
                escapeHtml(
                    isSupervisor && !getIssuerLoginId()
                        ? "먼저 공급자(발행 관리자)를 선택해 주세요."
                        : "표시할 등록 상품이 없습니다. 해당 관리자가 등록한 상품이 없습니다."
                ) +
                "</p></li>";
            return;
        }
        productListEl.innerHTML = items
            .map(function (p) {
                var unit = resolveProductUnitPrice(p);
                var meta = [];
                if (p.pd_size) meta.push(p.pd_size);
                if (unit) meta.push(formatWon(unit));
                var title =
                    (p.pd_code ? "[" + p.pd_code + "] " : "") + (p.pd_name || "");
                return (
                    '<li><button type="button" class="tmr-picker-item-btn" data-product-id="' +
                    escapeHtml(p.id) +
                    '">' +
                    escapeHtml(title) +
                    (meta.length
                        ? '<span class="tmr-picker-item-meta">' + escapeHtml(meta.join(" · ")) + "</span>"
                        : "") +
                    "</button></li>"
                );
            })
            .join("");
        bindProductPickerButtons();
    }

    function openProductModal(tr, field) {
        if (!api || !api.listProducts || !productModal || !tr) return;
        if (isSupervisor && !getIssuerLoginId()) {
            setStatus("먼저 공급자(발행 관리자)를 선택해 주세요.", "err");
            return;
        }
        activeProductRow = tr;
        var inp = tr.querySelector('[data-f="' + (field === "code" ? "code" : "name") + '"]');
        var seed = inp ? String(inp.value || "").trim() : "";
        productModal.hidden = false;
        function showList() {
            renderProductList(seed);
            if (productSearchEl) {
                productSearchEl.focus();
                try {
                    productSearchEl.select();
                } catch (e) {}
            }
        }
        if (productSearchEl) productSearchEl.value = seed;
        if (allProducts.length && productsLoadedForIssuer) {
            showList();
            return;
        }
        setStatus("상품 목록 불러오는 중…");
        loadProductsForIssuer()
            .then(function () {
                showList();
                setStatus("");
            })
            .catch(function (e) {
                allProducts = [];
                productsLoadedForIssuer = "";
                renderProductList(seed);
                setStatus((e && e.message) || "상품 목록을 불러오지 못했습니다.", "err");
            });
    }

    function closeVendorModal() {
        if (vendorModal) vendorModal.hidden = true;
    }

    function bindVendorPickerButtons() {
        if (!vendorListEl) return;
        vendorListEl.querySelectorAll("[data-vendor-id]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = String(btn.getAttribute("data-vendor-id") || "").trim();
                var picked = allVendors.find(function (v) {
                    return v.id === id;
                });
                if (picked) applyVendor(picked);
                closeVendorModal();
            });
        });
    }

    function loadVendorsForIssuer() {
        var issuer = getIssuerLoginId();
        var cacheKey = isSupervisor ? issuer || "" : "__self__";
        if (allVendors.length && vendorsLoadedForIssuer === cacheKey) {
            return Promise.resolve();
        }
        return api.listVendors().then(function (items) {
            var list = (items || []).map(mapVendorFromApi).filter(Boolean);
            if (isSupervisor && issuer) {
                list = list.filter(function (v) {
                    return vendorMatchesIssuer(v, issuer);
                });
            }
            allVendors = list.sort(function (a, b) {
                return a.companyName.localeCompare(b.companyName, "ko");
            });
            vendorsLoadedForIssuer = cacheKey;
        });
    }

    function renderVendorList(query) {
        if (!vendorListEl) return;
        var q = String(query || "").trim().toLowerCase();
        var items = vendorsForPicker().filter(function (v) {
            var name = String((v && v.companyName) || "").toLowerCase();
            return !q || name.indexOf(q) >= 0;
        });
        if (!items.length) {
            vendorListEl.innerHTML =
                '<li><p class="tmr-picker-empty">' +
                escapeHtml(
                    isSupervisor && !getIssuerLoginId()
                        ? "먼저 공급자(발행 관리자)를 선택해 주세요."
                        : "표시할 등록 업체가 없습니다. 해당 관리자가 등록한 업체가 없습니다."
                ) +
                "</p></li>";
            return;
        }
        vendorListEl.innerHTML = items
            .map(function (v) {
                var meta = [v.ceo, v.phone].filter(Boolean).join(" · ");
                return (
                    '<li><button type="button" class="tmr-picker-item-btn" data-vendor-id="' +
                    escapeHtml(v.id) +
                    '">' +
                    escapeHtml(v.companyName) +
                    (meta
                        ? '<span class="tmr-picker-item-meta">' + escapeHtml(meta) + "</span>"
                        : "") +
                    "</button></li>"
                );
            })
            .join("");
        bindVendorPickerButtons();
    }

    function openVendorModal() {
        if (!api || !api.listVendors || !vendorModal) return;
        if (isSupervisor && !getIssuerLoginId()) {
            setStatus("먼저 공급자(발행 관리자)를 선택해 주세요.", "err");
            return;
        }
        vendorModal.hidden = false;
        if (vendorSearchEl) {
            vendorSearchEl.value = "";
            vendorSearchEl.focus();
        }
        if (allVendors.length && vendorsLoadedForIssuer) {
            renderVendorList("");
            return;
        }
        setStatus("업체 목록 불러오는 중…");
        loadVendorsForIssuer()
            .then(function () {
                renderVendorList("");
                setStatus("");
            })
            .catch(function (e) {
                allVendors = [];
                vendorsLoadedForIssuer = "";
                renderVendorList("");
                setStatus((e && e.message) || "업체 목록을 불러오지 못했습니다.", "err");
            });
    }

    function validate(body) {
        if (!body.issuerStaffLoginId) {
            return isSupervisor
                ? "공급자(발행 관리자)를 선택해 주세요."
                : "로그인 정보를 확인할 수 없습니다.";
        }
        if (!readIssueDateYmd()) return "발행일자(년·월·일)를 선택해 주세요.";
        if (!body.vendorCompany) return "거래처(업체명)을 선택해 주세요.";
        if (!body.items.length) return "품목을 1개 이상 입력해 주세요.";
        return "";
    }

    function setEditMode(id) {
        currentId = id || "";
        if (btnPdf) btnPdf.hidden = !currentId;
        if (btnDelete) btnDelete.hidden = !currentId;
    }

    function resetForm() {
        setEditMode("");
        invalidateProductCache();
        invalidateVendorCache();
        closeProductModal();
        if (form) form.reset();
        setIssueDateToToday();
        ensureRows(MIN_ROWS);
        setStatus("");
    }

    function fillForm(item) {
        if (!item) return;
        setEditMode(item.id);
        document.getElementById("tmr-title").value = item.title || "";
        var dp = msToDateParts(item.issueDate);
        setIssueDateParts(dp.y, dp.m, dp.d);
        if (issuerSelect) issuerSelect.value = item.issuerStaffLoginId || "";
        document.getElementById("tmr-vendor-company").value = item.vendorCompany || "";
        document.getElementById("tmr-vendor-ceo").value = item.vendorCeo || "";
        document.getElementById("tmr-vendor-addr").value = item.vendorAddr || "";
        document.getElementById("tmr-vendor-phone").value = item.vendorPhone || "";
        document.getElementById("tmr-note").value = item.note || "";
        fillRows(item.items);
        setStatus("불러왔습니다. 수정 후 저장하세요.", "ok");
    }

    function loadStaffOptions() {
        if (!api || !api.listStaff || !issuerSelect) return Promise.resolve();
        return api.listStaff().then(function (items) {
            var html = '<option value="">관리자 선택</option>';
            (items || []).forEach(function (st) {
                if (!st || st.role !== "admin") return;
                var id = String(st.loginId || "").trim();
                if (!id) return;
                var label = (st.st_company || id) + " (" + id + ")";
                html +=
                    '<option value="' +
                    escapeHtml(id) +
                    '">' +
                    escapeHtml(label) +
                    "</option>";
            });
            issuerSelect.innerHTML = html;
        });
    }

    function loadAdminIssuerProfile() {
        var me = Auth && Auth.getUserId ? String(Auth.getUserId() || "").trim() : "";
        adminIssuerName = me;
        if (!me || !api || !api.getStaffProfile) return Promise.resolve();
        return api.getStaffProfile().then(function (p) {
            if (p) {
                adminIssuerName = String(p.st_company || p.loginId || me).trim() || me;
            }
        }).catch(function () {
            adminIssuerName = me;
        });
    }

    function setupIssuerUi() {
        isSupervisor = !!(Auth && Auth.isSupervisorStaff && Auth.isSupervisorStaff());
        if (issuerWrap) issuerWrap.hidden = !isSupervisor;
        if (issuerSelect) {
            if (isSupervisor) {
                issuerSelect.hidden = false;
                issuerSelect.setAttribute("required", "required");
            } else {
                issuerSelect.hidden = true;
                issuerSelect.removeAttribute("required");
            }
        }
        if (issuerNoteEl) issuerNoteEl.hidden = !isSupervisor;
        if (itemsHintEl) {
            itemsHintEl.textContent = isSupervisor
                ? "공급자(관리자)를 선택한 뒤, 품목코드·품명 입력란을 누르면 해당 관리자가 등록한 상품만 표시됩니다."
                : "품목코드·품명 입력란을 누르면 본인이 등록한 상품만 표시됩니다.";
        }
        if (isSupervisor) {
            return loadStaffOptions();
        }
        return loadAdminIssuerProfile();
    }

    function onIssuerChanged() {
        invalidateProductCache();
        invalidateVendorCache();
        if (vendorCompanyEl) vendorCompanyEl.value = "";
        document.getElementById("tmr-vendor-ceo").value = "";
        document.getElementById("tmr-vendor-addr").value = "";
        document.getElementById("tmr-vendor-phone").value = "";
    }

    function renderSavedList(items) {
        if (!savedListEl) return;
        if (!items || !items.length) {
            savedListEl.innerHTML = '<li class="tmr-saved-meta">저장된 문서가 없습니다.</li>';
            return;
        }
        savedListEl.innerHTML = items
            .map(function (it) {
                var dp = msToDateParts(it.issueDate);
                var date = dp.y + "-" + String(dp.m).padStart(2, "0") + "-" + String(dp.d).padStart(2, "0");
                return (
                    '<li class="tmr-saved-item" data-id="' +
                    escapeHtml(it.id) +
                    '" tabindex="0">' +
                    '<div class="tmr-saved-main">' +
                    '<span class="tmr-saved-name">' +
                    escapeHtml(it.vendorCompany || it.title || "거래명세서") +
                    "</span>" +
                    '<span class="tmr-saved-meta">' +
                    escapeHtml(date) +
                    " · " +
                    escapeHtml(it.issuerStaffName || it.issuerStaffLoginId || "") +
                    " · " +
                    formatWon(it.totalAmount) +
                    "</span>" +
                    "</div></li>"
                );
            })
            .join("");
        savedListEl.querySelectorAll(".tmr-saved-item").forEach(function (el) {
            function open() {
                var id = el.getAttribute("data-id");
                if (!id) return;
                setStatus("불러오는 중…");
                api
                    .getTransactionManual(id)
                    .then(fillForm)
                    .catch(function (err) {
                        setStatus((err && err.message) || "불러오기 실패", "err");
                    });
            }
            el.addEventListener("click", open);
            el.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                }
            });
        });
    }

    function refreshSavedList() {
        if (!api || !api.listTransactionManual) return Promise.resolve();
        return api.listTransactionManual().then(renderSavedList);
    }

    function previewPdf() {
        var body = readBody();
        var err = validate(body);
        if (err) {
            setStatus(err, "err");
            return;
        }
        setStatus("PDF 생성 중…");
        api
            .fetchTransactionManualPreviewPdf(body)
            .then(function (blob) {
                if (OU && OU.openPdfBlobInModal) {
                    return OU.openPdfBlobInModal(blob, "거래명세서.pdf");
                }
                setStatus("PDF를 열었습니다.", "ok");
            })
            .catch(function (e) {
                setStatus((e && e.message) || "PDF 생성 실패", "err");
            });
    }

    function saveDoc() {
        var body = readBody();
        var err = validate(body);
        if (err) {
            setStatus(err, "err");
            return;
        }
        setStatus("저장 중…");
        var task = currentId
            ? api.updateTransactionManual(currentId, body)
            : api.createTransactionManual(body);
        task.then(function (item) {
            if (item && item.id) setEditMode(item.id);
            setStatus("저장했습니다.", "ok");
            return refreshSavedList();
        }).catch(function (e) {
            setStatus((e && e.message) || "저장 실패", "err");
        });
    }

    function downloadPdf() {
        if (!currentId) {
            previewPdf();
            return;
        }
        setStatus("PDF 생성 중…");
        api
            .fetchTransactionManualPdf(currentId, { download: true })
            .then(function (blob) {
                var body = readBody();
                var company = body.vendorCompany || "거래명세서";
                var name =
                    "거래명세서_" +
                    company.replace(/[<>:"/\\|?*]/g, "_") +
                    "_" +
                    readIssueDateYmd().replace(/-/g, "") +
                    ".pdf";
                if (OU && OU.triggerPdfDownload) {
                    OU.triggerPdfDownload(blob, name);
                }
                setStatus("PDF를 저장했습니다.", "ok");
            })
            .catch(function (e) {
                setStatus((e && e.message) || "PDF 실패", "err");
            });
    }

    document.getElementById("tmr-add-row")?.addEventListener("click", function () {
        if (!itemsBody || itemsBody.querySelectorAll("tr").length >= MAX_ROWS) {
            setStatus("품목은 최대 " + MAX_ROWS + "행입니다.", "err");
            return;
        }
        itemsBody.appendChild(createRow());
    });
    document.getElementById("tmr-btn-new")?.addEventListener("click", resetForm);
    document.getElementById("tmr-btn-preview")?.addEventListener("click", previewPdf);
    document.getElementById("tmr-btn-save")?.addEventListener("click", saveDoc);
    document.getElementById("tmr-btn-pdf")?.addEventListener("click", downloadPdf);
    if (vendorCompanyEl) vendorCompanyEl.addEventListener("click", openVendorModal);
    if (btnVendorPick) btnVendorPick.addEventListener("click", openVendorModal);
    if (vendorModalCloseBtn) vendorModalCloseBtn.addEventListener("click", closeVendorModal);
    if (vendorModal) {
        vendorModal.addEventListener("click", function (e) {
            if (e.target === vendorModal) closeVendorModal();
        });
    }
    if (vendorSearchEl) {
        vendorSearchEl.addEventListener("input", function () {
            renderVendorList(vendorSearchEl.value);
        });
    }
    if (issuerSelect) {
        issuerSelect.addEventListener("change", onIssuerChanged);
    }
    if (productModalCloseBtn) productModalCloseBtn.addEventListener("click", closeProductModal);
    if (productModal) {
        productModal.addEventListener("click", function (e) {
            if (e.target === productModal) closeProductModal();
        });
    }
    if (productSearchEl) {
        productSearchEl.addEventListener("input", function () {
            renderProductList(productSearchEl.value);
        });
    }

    document.getElementById("tmr-btn-delete")?.addEventListener("click", function () {
        if (!currentId) return;
        if (!window.confirm("이 수기 거래명세서를 삭제할까요?")) return;
        api
            .deleteTransactionManual(currentId)
            .then(function () {
                resetForm();
                setStatus("삭제했습니다.", "ok");
                return refreshSavedList();
            })
            .catch(function (e) {
                setStatus((e && e.message) || "삭제 실패", "err");
            });
    });

    if (!Auth || !Auth.getOrderManageHubAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();
    var access = Auth.getOrderManageHubAccess();
    if (!access.allowed) {
        setStatus(access.reason || "이용할 수 없습니다.", "err");
        return;
    }
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    initIssueDatePickers();
    resetForm();
    setupIssuerUi()
        .then(refreshSavedList)
        .then(function () {
            var params = new URLSearchParams(window.location.search);
            var id = params.get("id");
            if (id) {
                return api.getTransactionManual(id).then(fillForm);
            }
        })
        .catch(function (e) {
            setStatus((e && e.message) || "초기화 실패", "err");
        });
})();
