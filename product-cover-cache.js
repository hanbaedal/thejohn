/**
 * 상품 사진 data URL → blob URL 캐시 (목록 재렌더 시 이미지 재디코딩·깜빡임 방지)
 */
(function (global) {
    var byProductId = Object.create(null);
    var byDataUrl = Object.create(null);

    function dataUrlToBlobUrl(dataUrl) {
        if (!dataUrl) return "";
        if (byDataUrl[dataUrl]) return byDataUrl[dataUrl];
        try {
            var m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
            if (!m) return dataUrl;
            var bin = atob(m[2]);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            var blob = new Blob([bytes], { type: m[1] });
            var url = URL.createObjectURL(blob);
            byDataUrl[dataUrl] = url;
            return url;
        } catch (e) {
            return dataUrl;
        }
    }

    function getCoverSrc(productId, dataUrl) {
        var id = String(productId || "").trim();
        if (id && byProductId[id]) return byProductId[id];
        var raw = String(dataUrl || "").trim();
        if (!raw) return "";
        var out = /^data:/i.test(raw) ? dataUrlToBlobUrl(raw) : raw;
        if (id) byProductId[id] = out;
        return out;
    }

    global.THEJHON_PRODUCT_COVER = {
        getCoverSrc: getCoverSrc
    };
})(typeof window !== "undefined" ? window : this);
