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

    var DEFAULT_BATCH_SIZE = 5;

    /**
     * 상품 cover API를 batchSize(기본 10)개씩 순차 호출
     * @param {object} api THEJHON_API
     * @param {string[]} ids
     * @param {object} opts { batchSize, onBatch(covers, chunkIds), isCancelled() }
     */
    function loadCoversBatched(api, ids, opts) {
        opts = opts || {};
        var batchSize = Math.max(1, Number(opts.batchSize) || DEFAULT_BATCH_SIZE);
        var list = (ids || []).filter(Boolean);
        if (!list.length || !api || !api.getProductCovers) {
            return Promise.resolve();
        }
        var idx = 0;
        function next() {
            if (opts.isCancelled && opts.isCancelled()) {
                return Promise.resolve();
            }
            if (idx >= list.length) {
                return Promise.resolve();
            }
            var chunk = list.slice(idx, idx + batchSize);
            idx += batchSize;
            return api
                .getProductCovers(chunk)
                .then(function (covers) {
                    if (opts.onBatch) opts.onBatch(covers || {}, chunk);
                    return next();
                })
                .catch(function () {
                    if (opts.onBatch) opts.onBatch({}, chunk);
                    return next();
                });
        }
        return next();
    }

    global.THEJHON_PRODUCT_COVER = {
        BATCH_SIZE: DEFAULT_BATCH_SIZE,
        getCoverSrc: getCoverSrc,
        loadCoversBatched: loadCoversBatched
    };
})(typeof window !== "undefined" ? window : this);
