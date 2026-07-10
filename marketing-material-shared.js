(function (global) {
    var MAX_FILES = 5;
    var MAX_FILE_BYTES = 10 * 1024 * 1024;
    var MAX_TOTAL_BYTES = MAX_FILE_BYTES * MAX_FILES;
    var RETENTION_DAYS = 7;
    var IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
    var VIDEO_EXTS = [".mp4"];
    var DOC_EXTS = [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx"];
    var ALLOWED_EXTS = IMAGE_EXTS.concat(VIDEO_EXTS, DOC_EXTS);

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function fileExt(name) {
        var n = String(name || "").trim().toLowerCase();
        var idx = n.lastIndexOf(".");
        return idx >= 0 ? n.slice(idx) : "";
    }

    function fileKind(ext) {
        if (IMAGE_EXTS.indexOf(ext) >= 0) return "image";
        if (VIDEO_EXTS.indexOf(ext) >= 0) return "video";
        if (DOC_EXTS.indexOf(ext) >= 0) return "document";
        return "other";
    }

    function kindLabel(kind) {
        if (kind === "image") return "이미지";
        if (kind === "video") return "동영상";
        if (kind === "document") return "문서";
        return "파일";
    }

    function formatBytes(n) {
        var size = Number(n) || 0;
        if (size < 1024) return size + " B";
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
        return (size / (1024 * 1024)).toFixed(1) + " MB";
    }

    function formatDateKo(ts) {
        if (!ts) return "";
        var d = new Date(Number(ts));
        if (isNaN(d.getTime())) return "";
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        var hh = String(d.getHours()).padStart(2, "0");
        var mm = String(d.getMinutes()).padStart(2, "0");
        return y + "." + m + "." + day + " " + hh + ":" + mm;
    }

    function formatExpireKo(ts) {
        if (!ts) return "";
        return formatDateKo(ts) + " 삭제 예정";
    }

    function fileToBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var result = String(reader.result || "");
                var comma = result.indexOf(",");
                resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.onerror = function () {
                reject(new Error("파일을 읽지 못했습니다."));
            };
            reader.readAsDataURL(file);
        });
    }

    function validateFile(file) {
        var ext = fileExt(file.name);
        if (ALLOWED_EXTS.indexOf(ext) < 0) {
            return "허용되지 않는 파일 형식입니다: " + file.name;
        }
        if (VIDEO_EXTS.indexOf(ext) >= 0 && ext !== ".mp4") {
            return "동영상은 mp4만 업로드할 수 있습니다.";
        }
        if (file.size > MAX_FILE_BYTES) {
            return "파일당 10MB 이하만 업로드할 수 있습니다: " + file.name;
        }
        return "";
    }

    function triggerDownload(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function isVisualKind(kind) {
        return kind === "image" || kind === "video";
    }

    function previewPlaceholderHtml(kind, label) {
        var text = escapeHtml(label || kindLabel(kind));
        return (
            '<div class="mm-preview-placeholder" aria-hidden="true">' +
            '<span class="mm-preview-placeholder__label">' +
            text +
            "</span></div>"
        );
    }

    function mountVisualPreview(container, kind, url, filename) {
        if (!container || !url) return null;
        container.innerHTML = "";
        var el;
        if (kind === "video") {
            el = document.createElement("video");
            el.className = "mm-file-preview mm-file-preview--video";
            el.controls = true;
            el.muted = true;
            el.playsInline = true;
            el.preload = "metadata";
        } else {
            el = document.createElement("img");
            el.className = "mm-file-preview";
            el.alt = filename || "미리보기";
        }
        el.src = url;
        el.title = filename || "";
        container.appendChild(el);
        return el;
    }

    function revokeObjectUrl(url) {
        if (url) {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {}
        }
    }

    function resolveFileKind(file) {
        if (!file) return "other";
        if (file.kind) return file.kind;
        return fileKind(fileExt(file.filename || file.name || ""));
    }

    function filePreviewDataUrl(file) {
        return new Promise(function (resolve) {
            if (!file || !isVisualKind(fileKind(fileExt(file.name || "")))) {
                resolve("");
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = function () {
                resolve("");
            };
            reader.readAsDataURL(file);
        });
    }

    function visualPreviewHtml(kind, url, filename, thumb, zoomable) {
        if (!url) return previewPlaceholderHtml(kind, "미리보기");
        var safeUrl = String(url).replace(/"/g, "&quot;");
        var safeName = escapeHtml(filename || "미리보기");
        var title = zoomable && kind === "image" ? "클릭하여 크게 보기" : safeName;
        var cls = "mm-file-preview" + (thumb ? " mm-preview-thumb" : "");
        if (kind === "video") {
            cls += " mm-file-preview--video" + (thumb ? " mm-preview-thumb--video" : "");
            return (
                '<video class="' +
                cls +
                '" src="' +
                safeUrl +
                '" controls muted playsinline preload="metadata" title="' +
                safeName +
                '"></video>'
            );
        }
        if (zoomable) {
            cls += " mm-preview-thumb--zoom mml-preview-image";
        }
        return (
            '<img class="' +
            cls +
            '" src="' +
            safeUrl +
            '" alt="' +
            safeName +
            '" title="' +
            escapeHtml(title) +
            '">'
        );
    }

    global.THEJHON_MARKETING_MATERIAL = {
        MAX_FILES: MAX_FILES,
        MAX_FILE_BYTES: MAX_FILE_BYTES,
        MAX_TOTAL_BYTES: MAX_TOTAL_BYTES,
        RETENTION_DAYS: RETENTION_DAYS,
        ALLOWED_EXTS: ALLOWED_EXTS,
        escapeHtml: escapeHtml,
        fileExt: fileExt,
        fileKind: fileKind,
        resolveFileKind: resolveFileKind,
        kindLabel: kindLabel,
        isVisualKind: isVisualKind,
        formatBytes: formatBytes,
        formatDateKo: formatDateKo,
        formatExpireKo: formatExpireKo,
        fileToBase64: fileToBase64,
        filePreviewDataUrl: filePreviewDataUrl,
        validateFile: validateFile,
        triggerDownload: triggerDownload,
        previewPlaceholderHtml: previewPlaceholderHtml,
        visualPreviewHtml: visualPreviewHtml,
        mountVisualPreview: mountVisualPreview,
        revokeObjectUrl: revokeObjectUrl
    };
})(typeof window !== "undefined" ? window : this);
