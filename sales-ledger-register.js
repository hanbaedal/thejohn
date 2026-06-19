(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("slr-status");
    var form = document.getElementById("slr-form");

    function setStatus(msg, err) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (err ? " shub-status--err" : msg ? " shub-status--ok" : "");
    }

    function getEditId() {
        try {
            return new URLSearchParams(window.location.search).get("id") || "";
        } catch (e) {
            return "";
        }
    }

    function fillForm(item) {
        document.getElementById("slr-vendor").value = item.vendorCompany || "";
        document.getElementById("slr-note").value = item.note || item.title || "";
        var line = (item.items && item.items[0]) || {};
        document.getElementById("slr-product").value = line.productName || "";
        document.getElementById("slr-qty").value = line.quantity || 1;
        document.getElementById("slr-price").value = line.unitPrice || 0;
    }

    function buildBody() {
        var qty = Number(document.getElementById("slr-qty").value) || 0;
        var unit = Number(document.getElementById("slr-price").value) || 0;
        return {
            vendorCompany: document.getElementById("slr-vendor").value.trim(),
            note: document.getElementById("slr-note").value.trim(),
            sourceType: "manual",
            items: [
                {
                    productName: document.getElementById("slr-product").value.trim(),
                    quantity: qty,
                    unitPrice: unit,
                    lineTotal: qty * unit
                }
            ],
            totalAmount: qty * unit
        };
    }

    function init() {
        if (!Auth || !Auth.getOrderManageHubAccess || !Auth.getOrderManageHubAccess().allowed) {
            setStatus("권한이 없습니다.", true);
            return;
        }
        var editId = getEditId();
        if (editId && api.getSalesLedger) {
            api.getSalesLedger(editId)
                .then(fillForm)
                .catch(function (err) {
                    setStatus((err && err.message) || "불러오기 실패", true);
                });
        }
        if (!form) return;
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var body = buildBody();
            if (!body.vendorCompany || !body.items[0].productName) {
                setStatus("거래처와 품명을 입력해 주세요.", true);
                return;
            }
            setStatus("저장 중…");
            var p = editId
                ? api.updateSalesLedger(editId, body)
                : api.createSalesLedger(body);
            p.then(function () {
                setStatus("저장했습니다.", false);
                window.location.href = "sales-ledger-list.html";
            }).catch(function (err) {
                setStatus((err && err.message) || "저장 실패", true);
            });
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
