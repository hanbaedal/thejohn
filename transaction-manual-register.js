/**
 * 거래명세서 수기 작성 — 주문서 관리
 */
(function () {
    var api = window.THEJHON_API;
    var OU = window.THEJHON_ORDER_UI;
    var Auth = window.THEJHON_AUTH;
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
    var allVendors = [];
    var allProducts = [];
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

    function todayDateInput() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
    }

    function issueDateToMs(val) {
        if (!val) return Date.now();
        var t = new Date(val + "T12:00:00").getTime();
        return isFinite(t) ? t : Date.now();
    }

    function msToDateInput(ms) {
        var d = new Date(ms || Date.now());
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
    }

    function parseNum(v) {
        var n = parseInt(String(v || "").replace(/[^\d-]/g, ""), 10);
        return isFinite(n) ? n : 0;
    }

    function readRow(tr) {
        if (!tr) return null;
        return {
            pd_code: String(tr.querySelector('[data-f="code"]')?.value || "").trim(),
            productName: String(tr.querySelector('[data-f="name"]')?.value || "").trim(),
            pd_size: String(tr.querySelector('[data-f="size"]')?.value || "").trim(),
            quantity: parseNum(tr.querySelector('[data-f="qty"]')?.value),
            unitPrice: parseNum(tr.querySelector('[data-f="price"]')?.value),
            lineTotal: parseNum(tr.querySelector('[data-f="line"]')?.value)
        };
    }

    function syncLineTotal(tr) {
        var qty = parseNum(tr.querySelector('[data-f="qty"]')?.value);
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
            '<td><input type="text" data-f="qty" inputmode="numeric" value="' +
            escapeHtml(data.quantity ? String(data.quantity) : "") +
            '"></td>' +
            '<td><input type="text" data-f="price" inputmode="numeric" value="' +
            escapeHtml(data.unitPrice ? String(data.unitPrice) : "") +
            '"></td>' +
            '<td><input type="text" data-f="line" inputmode="numeric" value="' +
            escapeHtml(data.lineTotal ? String(data.lineTotal) : "") +
            '"></td>' +
            '<td><button type="button" class="btn btn-secondary tmr-row-del" title="행 삭제">×</button></td>';
        tr.querySelectorAll("input").forEach(function (inp) {
            inp.addEventListener("input", function () {
                if (inp.getAttribute("data-f") === "qty" || inp.getAttribute("data-f") === "price") {
                    syncLineTotal(tr);
                } else if (inp.getAttribute("data-f") === "line") {
                    updateTotal();
                }
            });
        });
        bindProductPickers(tr);
        var delBtn = tr.querySelector(".tmr-row-del");
        if (delBtn) {
            delBtn.addEventListener("click", function () {
                if (itemsBody.querySelectorAll("tr").length <= MIN_ROWS) {
                    tr.querySelectorAll("input").forEach(function (inp) {
                        inp.value = "";
                    });
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

    function readBody() {
        var issuerOpt = issuerSelect && issuerSelect.selectedOptions[0];
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
            issueDate: issueDateToMs(document.getElementById("tmr-issue-date")?.value),
            issuerStaffLoginId: String(issuerSelect?.value || "").trim(),
            issuerStaffName: issuerOpt ? String(issuerOpt.textContent || "").trim() : "",
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
        if (
            v &&
            !isLegacyRegistrar(vReg) &&
            !isLegacyRegistrar(pReg) &&
            staffIdsEqual(vReg, pReg)
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
                '<li><p class="tmr-picker-empty">표시할 등록 상품이 없습니다. 상품 등록 메뉴에서 먼저 등록해 주세요.</p></li>';
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
        if (allProducts.length) {
            showList();
            return;
        }
        setStatus("상품 목록 불러오는 중…");
        api
            .listProducts()
            .then(function (items) {
                allProducts = (items || [])
                    .map(mapProductFromApi)
                    .filter(Boolean)
                    .sort(function (a, b) {
                        var ac = String(a.pd_code || "");
                        var bc = String(b.pd_code || "");
                        if (ac !== bc) return ac.localeCompare(bc, "ko");
                        return String(a.pd_name || "").localeCompare(String(b.pd_name || ""), "ko");
                    });
                showList();
                setStatus("");
            })
            .catch(function (e) {
                allProducts = [];
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

    function renderVendorList(query) {
        if (!vendorListEl) return;
        var q = String(query || "").trim().toLowerCase();
        var items = allVendors.filter(function (v) {
            var name = String((v && v.companyName) || "").toLowerCase();
            return !q || name.indexOf(q) >= 0;
        });
        if (!items.length) {
            vendorListEl.innerHTML =
                '<li><p class="tmr-picker-empty">표시할 등록 업체가 없습니다. 업체 등록 메뉴에서 먼저 등록해 주세요.</p></li>';
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
        vendorModal.hidden = false;
        if (vendorSearchEl) {
            vendorSearchEl.value = "";
            vendorSearchEl.focus();
        }
        if (allVendors.length) {
            renderVendorList("");
            return;
        }
        setStatus("업체 목록 불러오는 중…");
        api
            .listVendors()
            .then(function (items) {
                allVendors = (items || [])
                    .map(mapVendorFromApi)
                    .filter(Boolean)
                    .sort(function (a, b) {
                        return a.companyName.localeCompare(b.companyName, "ko");
                    });
                renderVendorList("");
                setStatus("");
            })
            .catch(function (e) {
                allVendors = [];
                renderVendorList("");
                setStatus((e && e.message) || "업체 목록을 불러오지 못했습니다.", "err");
            });
    }

    function validate(body) {
        if (!body.issuerStaffLoginId) return "공급자(발행 관리자)를 선택해 주세요.";
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
        selectedVendorDetail = null;
        closeProductModal();
        if (form) form.reset();
        var dateEl = document.getElementById("tmr-issue-date");
        if (dateEl) dateEl.value = todayDateInput();
        ensureRows(MIN_ROWS);
        setStatus("");
    }

    function fillForm(item) {
        if (!item) return;
        setEditMode(item.id);
        document.getElementById("tmr-title").value = item.title || "";
        document.getElementById("tmr-issue-date").value = msToDateInput(item.issueDate);
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
            var html = '<option value="">선택</option>';
            (items || []).forEach(function (st) {
                if (!st || st.role === "vendor") return;
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
            if (Auth && Auth.getUserId) {
                var me = Auth.getUserId();
                if (me) issuerSelect.value = me;
            }
        });
    }

    function renderSavedList(items) {
        if (!savedListEl) return;
        if (!items || !items.length) {
            savedListEl.innerHTML = '<li class="tmr-saved-meta">저장된 문서가 없습니다.</li>';
            return;
        }
        savedListEl.innerHTML = items
            .map(function (it) {
                var date = msToDateInput(it.issueDate);
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
                if (OU && OU.openPdfBlobInTab) {
                    return OU.openPdfBlobInTab(blob, "거래명세서.pdf");
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
            .fetchTransactionManualPdf(currentId)
            .then(function (blob) {
                var body = readBody();
                var company = body.vendorCompany || "거래명세서";
                var name =
                    "거래명세서_" +
                    company.replace(/[<>:"/\\|?*]/g, "_") +
                    "_" +
                    (document.getElementById("tmr-issue-date")?.value || "").replace(/-/g, "") +
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

    resetForm();
    loadStaffOptions()
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
