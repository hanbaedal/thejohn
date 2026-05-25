/**
 * 업체 관리 UI — 등록 담당(관리자) 표시·필터
 */
(function (global) {
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function registeredByMeta(it) {
        var id = String(
            (it && (it.vn_registered_by || it.pd_registered_by)) || ""
        ).trim();
        var name = String(
            (it && (it.vn_registered_by_name || it.pd_registered_by_name)) || ""
        ).trim();
        if (!id && !name) return "";
        if (id === "legacy") return "담당: 기존(미지정)";
        if (name) return "담당: " + name + (id ? " (" + id + ")" : "");
        return "담당: " + id;
    }

    function isSupervisorView() {
        return (
            global.THEJHON_AUTH &&
            THEJHON_AUTH.isSupervisorStaff &&
            THEJHON_AUTH.isSupervisorStaff()
        );
    }

    function initStaffFilter(options) {
        options = options || {};
        var wrap = options.wrapEl;
        var selectEl = options.selectEl;
        var onChange = options.onChange;
        if (!wrap || !selectEl || !isSupervisorView()) {
            if (wrap) wrap.hidden = true;
            return Promise.resolve();
        }
        wrap.hidden = false;
        if (!global.THEJHON_API || !THEJHON_API.listStaff) {
            selectEl.innerHTML = '<option value="all">전체 관리자</option>';
            return Promise.resolve();
        }
        return THEJHON_API.listStaff()
            .then(function (items) {
                var html = [
                    '<option value="all">전체 관리자</option>',
                    '<option value="legacy">기존(담당 미지정)</option>'
                ];
                (items || []).forEach(function (st) {
                    if (!st || !st.loginId) return;
                    var id = String(st.loginId).trim();
                    var label = (st.st_company || st.loginId) + " (" + id + ")";
                    html.push(
                        '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + "</option>"
                    );
                });
                selectEl.innerHTML = html.join("");
                selectEl.addEventListener("change", function () {
                    if (onChange) onChange(selectEl.value);
                });
            })
            .catch(function () {
                selectEl.innerHTML = '<option value="all">전체 관리자</option>';
            });
    }

    global.THEJHON_VENDOR_ADMIN = {
        escapeHtml: escapeHtml,
        registeredByMeta: registeredByMeta,
        isSupervisorView: isSupervisorView,
        initStaffFilter: initStaffFilter
    };
})(typeof window !== "undefined" ? window : this);
