(function () {
    function syncSupportHeaderOffset() {
        var header = document.querySelector(".site-header");
        if (!header || !document.body.classList.contains("page-support")) return;
        document.documentElement.style.setProperty(
            "--support-header-h",
            header.offsetHeight + "px"
        );
    }

    function init() {
        if (!document.body.classList.contains("page-support")) return;
        syncSupportHeaderOffset();
        window.addEventListener("resize", syncSupportHeaderOffset);
        if (typeof ResizeObserver !== "undefined") {
            var header = document.querySelector(".site-header");
            if (header) {
                new ResizeObserver(syncSupportHeaderOffset).observe(header);
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.SUPPORT_LAYOUT = {
        syncSupportHeaderOffset: syncSupportHeaderOffset
    };
})();
