(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var previewEl = document.getElementById("dm-preview");
    var resultEl = document.getElementById("dm-result");
    var statusEl = document.getElementById("dm-status");
    var runBtn = document.getElementById("dm-run");
    var refreshBtn = document.getElementById("dm-refresh");

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.classList.toggle("is-err", !!isError);
    }

    function showJson(el, data) {
        if (!el) return;
        el.hidden = false;
        el.textContent = JSON.stringify(data, null, 2);
    }

    function guard() {
        if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn()) {
            window.location.replace("index.html?denied=register");
            return false;
        }
        if (!Auth.isSupervisorStaff || !Auth.isSupervisorStaff()) {
            setStatus("총괄 관리자(thejohn)로 로그인한 뒤 이용해 주세요.", true);
            if (runBtn) runBtn.disabled = true;
            return false;
        }
        return true;
    }

    function loadPreview() {
        if (!guard() || !api || !api.migrateDatabasePreview) return;
        if (previewEl) previewEl.textContent = "불러오는 중…";
        api.migrateDatabasePreview()
            .then(function (data) {
                if (previewEl) showJson(previewEl, data);
            })
            .catch(function (err) {
                if (previewEl) {
                    previewEl.textContent =
                        (err && err.message) || "현황을 불러오지 못했습니다.";
                }
            });
    }

    function runMigrate() {
        if (!guard() || !api || !api.migrateDatabase) return;
        if (
            !window.confirm(
                "등록된 상품·업체 DB를 현재 프로그램 형식으로 변환합니다.\n계속할까요?"
            )
        ) {
            return;
        }
        setStatus("변환 중… (수십 초 걸릴 수 있습니다)");
        if (runBtn) runBtn.disabled = true;
        api.migrateDatabase()
            .then(function (data) {
                setStatus(data.message || "변환이 완료되었습니다.");
                showJson(resultEl, data);
                loadPreview();
            })
            .catch(function (err) {
                setStatus((err && err.message) || "변환에 실패했습니다.", true);
            })
            .finally(function () {
                if (runBtn) runBtn.disabled = false;
            });
    }

    if (runBtn) runBtn.addEventListener("click", runMigrate);
    if (refreshBtn) refreshBtn.addEventListener("click", loadPreview);

    loadPreview();
})();
