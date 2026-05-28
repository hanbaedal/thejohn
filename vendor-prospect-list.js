(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var listEl = document.getElementById("vpl-list");
    var statusEl = document.getElementById("vpl-status");
    var cachedItems = [];

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function html(s) {
        if (PF && PF.escapeHtml) return PF.escapeHtml(s);
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function bindDeleteButtons() {
        if (!listEl || !api || !api.deleteVendorProspect) return;
        listEl.querySelectorAll("[data-vpl-delete]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-vpl-delete");
                var name = btn.getAttribute("data-vpl-name") || "이 예비업체";
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
        if (!listEl) return;
        if (!cachedItems.length) {
            listEl.innerHTML =
                '<p class="am-list-empty">예비업체가 없습니다. <a href="vendor-prospect-finder.html">예비 업체 찾기</a>에서 추가해 주세요.</p>';
            return;
        }
        listEl.innerHTML =
            '<ul class="vl-admin-list">' +
            cachedItems
                .map(function (it) {
                    var company = String(it.vn_company || "(업체명 없음)");
                    var phone = String(it.vn_phone || "전화번호 미입력");
                    var addr = String(it.vn_addr || "주소 미입력");
                    var roomTxt = it.vn_room_count ? String(it.vn_room_count) + "빈소" : "빈소 미입력";
                    return (
                        '<li class="vl-admin-row">' +
                        '<div class="vl-admin-row__main">' +
                        '<span class="vl-admin-name">' +
                        html(company) +
                        '</span><span class="vl-admin-meta">' +
                        html(phone) +
                        " · " +
                        html(addr) +
                        " · " +
                        html(roomTxt) +
                        "</span></div>" +
                        '<div class="vl-admin-row__actions">' +
                        '<button type="button" class="btn vl-admin-del" data-vpl-delete="' +
                        html(it.id) +
                        '" data-vpl-name="' +
                        html(company) +
                        '">삭제</button>' +
                        "</div></li>"
                    );
                })
                .join("") +
            "</ul>";
        bindDeleteButtons();
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
