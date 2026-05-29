(function (g) {
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeMultiline(s) {
        return String(s)
            .split("\n")
            .map(function (line) {
                return escapeHtml(line);
            })
            .join("<br>");
    }

    function newId(prefix) {
        return (
            String(prefix || "id") +
            "_" +
            Date.now().toString(36) +
            "_" +
            Math.random().toString(36).slice(2, 10)
        );
    }

    function getArray(key) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return [];
            var data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    function setArray(key, arr) {
        localStorage.setItem(key, JSON.stringify(arr));
    }

    function formatDateKo(ts) {
        if (!ts) return "";
        try {
            return new Date(ts).toLocaleString("ko-KR", {
                dateStyle: "medium",
                timeStyle: "short"
            });
        } catch (e) {
            return "";
        }
    }

    g.THEJHON_SUPPORT_COMMON = {
        escapeHtml: escapeHtml,
        escapeMultiline: escapeMultiline,
        newId: newId,
        getArray: getArray,
        setArray: setArray,
        formatDateKo: formatDateKo,
        KEYS: {
            NEWS: "thejhon_support_news_v1",
            /** @deprecated MongoDB support_board — localStorage 마이그레이션 참고용 */
            BOARD: "thejhon_support_board_v1",
            /** @deprecated MongoDB support_inquiry — localStorage 마이그레이션 참고용 */
            INQUIRY: "thejhon_support_inquiry_v1"
        }
    };
})(typeof window !== "undefined" ? window : this);
