(function () {
    var api = window.THEJHON_API;
    var CARDS = window.THEJHON_VENDOR_LIST_CARDS;
    var listEl = document.getElementById("vpl-list");
    var statusEl = document.getElementById("vpl-status");
    var cachedItems = [];

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function bindDeleteButtons() {
        if (!listEl || !api || !api.deleteVendorProspect) return;
        listEl.querySelectorAll("[data-vl-delete]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-vl-delete");
                var name = btn.getAttribute("data-vl-name") || "이 예비업체";
                if (!id) return;
                if (!window.confirm("「" + name + "」을(를) 삭제할까요?\n\n삭제 후에는 복구할 수 없습니다.")) {
                    return;
                }
                btn.disabled = true;
                api.deleteVendorProspect(id)
                    .then(function () {
                        cachedItems = cachedItems.filter(function (it) {
                            return it.id !== id;
                        });
                        renderList();
                        setStatus("전체 · " + cachedItems.length + "건");
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        window.alert((err && err.message) || "예비업체를 삭제하지 못했습니다.");
                    });
            });
        });
    }

    function renderList() {
        if (!CARDS || !listEl) return;
        CARDS.renderGrid(listEl, cachedItems, {
            emptyHtml:
                '<p class="vpr-loading">예비업체가 없습니다. <a href="vendor-prospect-finder.html">예비 업체 찾기</a>에서 추가해 주세요.</p>',
            cardOptions: function (it) {
                return {
                    mode: "prospect",
                    badge: "예비",
                    showActions: true,
                    canWrite: true,
                    deleteId: it.id
                };
            },
            onBind: bindDeleteButtons
        });
    }

    function loadList() {
        if (!api || !api.listVendorProspects) {
            setStatus("API를 사용할 수 없습니다.", true);
            return;
        }
        setStatus("불러오는 중…");
        api.listVendorProspects("")
            .then(function (items) {
                cachedItems = items || [];
                cachedItems.sort(function (a, b) {
                    return (b.updatedAt || 0) - (a.updatedAt || 0);
                });
                renderList();
                setStatus("전체 · " + cachedItems.length + "건");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "목록을 불러오지 못했습니다.", true);
            });
    }

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getRegisterAccess
            ? THEJHON_AUTH.getRegisterAccess()
            : { allowed: false, reason: "관리자 로그인이 필요합니다." };
    if (!access.allowed) {
        setStatus(access.reason, true);
        return;
    }

    loadList();
})();
