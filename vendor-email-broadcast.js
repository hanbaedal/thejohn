(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var PF = window.THEJHON_PRODUCT_FORM;
    var VENDOR_MANAGE_PAGE = "vendor-manage.html";
    var MAX_ATTACH = 5;
    var GREETING_MAX = 400;
    var MAX_FILE_BYTES = 10 * 1024 * 1024;
    var TARGET_FILE_BYTES = Math.floor(9.5 * 1024 * 1024);
    var MAX_TOTAL_BYTES = MAX_FILE_BYTES * MAX_ATTACH;
    var ALLOWED_EXTS = [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];
    var PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    var PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    var JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    var pdfLibsPromise = null;

    var statusEl = document.getElementById("veb-status");
    var srcVendorsEl = document.getElementById("veb-src-vendors");
    var srcVendorNewEl = document.getElementById("veb-src-vendor-new");
    var subjectEl = document.getElementById("veb-subject");
    var greetingEl = document.getElementById("veb-greeting");
    var greetingCountEl = document.getElementById("veb-greeting-count");
    var filesGalleryEl = document.getElementById("veb-files-gallery");
    var filesCameraEl = document.getElementById("veb-files-camera");
    var fileGalleryBtn = document.getElementById("veb-file-gallery-btn");
    var fileCameraBtn = document.getElementById("veb-file-camera-btn");
    var attachListEl = document.getElementById("veb-attach-list");
    var sendBtn = document.getElementById("veb-send-btn");
    var pickBtn = document.getElementById("veb-pick-btn");
    var summaryEl = document.getElementById("veb-selected-summary");
    var failedWrap = document.getElementById("veb-failed-wrap");
    var failedListEl = document.getElementById("veb-failed-list");
    var pickerModal = document.getElementById("veb-picker-modal");
    var pickerBody = document.getElementById("veb-picker-body");
    var pickerEmpty = document.getElementById("veb-picker-empty");
    var pickerTitle = document.getElementById("veb-picker-title");
    var successModal = document.getElementById("veb-success-modal");
    var previewModal = document.getElementById("veb-preview-modal");
    var previewTitle = document.getElementById("veb-preview-title");
    var previewBody = document.getElementById("veb-preview-body");
    var previewCloseBtn = document.getElementById("veb-preview-close");

    var pickerRows = [];
    var previewObjectUrl = "";
    var appliedSelections = [];
    var appliedSourcesKey = "";
    var attachmentFiles = [];

    function greetingLength(text) {
        return Array.from(String(text || "")).length;
    }

    function trimGreetingToMax() {
        if (!greetingEl) return;
        var chars = Array.from(greetingEl.value);
        if (chars.length > GREETING_MAX) {
            greetingEl.value = chars.slice(0, GREETING_MAX).join("");
        }
    }

    function updateGreetingCount() {
        if (!greetingCountEl) return;
        trimGreetingToMax();
        var len = greetingEl ? greetingLength(greetingEl.value) : 0;
        greetingCountEl.textContent = len + " / " + GREETING_MAX + "자";
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function speak(text) {
        if (PF && PF.speakKorean) PF.speakKorean(text);
    }

    function getSelectedSources() {
        var out = [];
        if (srcVendorsEl && srcVendorsEl.checked) out.push("vendors");
        if (srcVendorNewEl && srcVendorNewEl.checked) out.push("vendor_new");
        return out;
    }

    function sourcesKey(sources) {
        return (sources || []).slice().sort().join(",");
    }

    function sourcesLabel(sources) {
        var parts = [];
        if (!sources || !sources.length) return "";
        if (sources.indexOf("vendors") >= 0) parts.push("등록업체");
        if (sources.indexOf("vendor_new") >= 0) parts.push("신규업체");
        return parts.join(" · ");
    }

    function sourceTypeLabel(source) {
        return source === "vendor_new" ? "신규" : "등록";
    }

    function myUserId() {
        return Auth && Auth.getUserId ? String(Auth.getUserId() || "").trim().toLowerCase() : "";
    }

    function filterOnlyMine(items) {
        var me = myUserId();
        if (!me) return [];
        return (items || []).filter(function (it) {
            return (
                String((it && it.vn_registered_by) || "")
                    .trim()
                    .toLowerCase() === me
            );
        });
    }

    function isPartnerVendor(it) {
        return (
            String((it && it.vn_record_type) || "partner")
                .trim()
                .toLowerCase() !== "new"
        );
    }

    function hasValidEmail(v) {
        var e = String(v || "").trim();
        return e.indexOf("@") > 0 && e.indexOf(".") > 2;
    }

    function normalizeRow(it, source) {
        return {
            id: String((it && it.id) || "").trim(),
            source: source,
            name: String((it && it.vn_company) || "").trim() || "(이름 없음)",
            companyEmail: String((it && it.vn_email) || "").trim(),
            managerEmail: String((it && it.vn_mgr_email) || "").trim(),
            sendCompany: false,
            sendManager: false
        };
    }

    function rowKey(row) {
        return String(row.source || "") + "\t" + String(row.id || "");
    }

    function countSelections(rows) {
        var company = 0;
        var manager = 0;
        var emails = {};
        (rows || []).forEach(function (row) {
            if (row.sendCompany && hasValidEmail(row.companyEmail)) {
                var c = row.companyEmail.toLowerCase();
                if (!emails[c]) {
                    emails[c] = true;
                    company++;
                }
            }
            if (row.sendManager && hasValidEmail(row.managerEmail)) {
                var m = row.managerEmail.toLowerCase();
                if (!emails[m]) {
                    emails[m] = true;
                    manager++;
                }
            }
        });
        return { company: company, manager: manager, total: company + manager };
    }

    function renderSummary() {
        if (!summaryEl) return;
        var key = sourcesKey(getSelectedSources());
        if (!appliedSelections.length || appliedSourcesKey !== key) {
            summaryEl.textContent = "수신자를 선택해 주세요.";
            return;
        }
        var c = countSelections(appliedSelections);
        if (!c.total) {
            summaryEl.textContent = sourcesLabel(getSelectedSources()) + " — 선택된 수신 이메일이 없습니다.";
            return;
        }
        summaryEl.textContent =
            sourcesLabel(getSelectedSources()) +
            " · 회사 " +
            c.company +
            "건 · 담당자 " +
            c.manager +
            "건 · 총 " +
            c.total +
            "통";
    }

    function renderPickerRows() {
        if (!pickerBody) return;
        if (!pickerRows.length) {
            pickerBody.innerHTML = "";
            if (pickerEmpty) pickerEmpty.hidden = false;
            return;
        }
        if (pickerEmpty) pickerEmpty.hidden = true;
        pickerBody.innerHTML = pickerRows
            .map(function (row, idx) {
                var companyOk = hasValidEmail(row.companyEmail);
                var managerOk = hasValidEmail(row.managerEmail);
                return (
                    "<tr data-veb-idx=\"" + idx + "\">" +
                    "<td class=\"veb-col-type\">" + escapeHtml(sourceTypeLabel(row.source)) + "</td>" +
                    "<td class=\"veb-col-name\">" + escapeHtml(row.name) + "</td>" +
                    "<td class=\"veb-col-check\"><label>" +
                    "<input type=\"checkbox\" class=\"veb-picker-check veb-check-company\" data-veb-idx=\"" + idx + "\"" +
                    (row.sendCompany ? " checked" : "") + (companyOk ? "" : " disabled") + "></label>" +
                    "<span class=\"veb-picker-email" + (companyOk ? "" : " veb-picker-email--empty") + "\">" +
                    escapeHtml(companyOk ? row.companyEmail : "(없음)") + "</span></td>" +
                    "<td class=\"veb-col-check\"><label>" +
                    "<input type=\"checkbox\" class=\"veb-picker-check veb-check-manager\" data-veb-idx=\"" + idx + "\"" +
                    (row.sendManager ? " checked" : "") + (managerOk ? "" : " disabled") + "></label>" +
                    "<span class=\"veb-picker-email" + (managerOk ? "" : " veb-picker-email--empty") + "\">" +
                    escapeHtml(managerOk ? row.managerEmail : "(없음)") + "</span></td>" +
                    "</tr>"
                );
            })
            .join("");

        pickerBody.querySelectorAll(".veb-picker-check").forEach(function (cb) {
            cb.addEventListener("change", function () {
                var i = parseInt(cb.getAttribute("data-veb-idx"), 10);
                if (!pickerRows[i]) return;
                if (cb.classList.contains("veb-check-company")) pickerRows[i].sendCompany = cb.checked;
                else pickerRows[i].sendManager = cb.checked;
            });
        });
    }

    function openPickerModal() {
        if (!pickerModal) return;
        if (pickerTitle) pickerTitle.textContent = "수신자 선택 — " + sourcesLabel(getSelectedSources());
        pickerModal.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closePickerModal() {
        if (!pickerModal) return;
        pickerModal.hidden = true;
        document.body.style.overflow = "";
    }

    function applyBulk(mode) {
        pickerRows.forEach(function (row) {
            if (mode === "clear") {
                row.sendCompany = false;
                row.sendManager = false;
                return;
            }
            if (mode === "company") {
                row.sendCompany = hasValidEmail(row.companyEmail);
                row.sendManager = false;
                return;
            }
            if (mode === "manager") {
                row.sendCompany = false;
                row.sendManager = hasValidEmail(row.managerEmail);
                return;
            }
            if (mode === "both") {
                row.sendCompany = hasValidEmail(row.companyEmail);
                row.sendManager = hasValidEmail(row.managerEmail);
            }
        });
        renderPickerRows();
    }

    async function loadPickerRows() {
        var sources = getSelectedSources();
        if (!sources.length) {
            return setStatus("발송 대상 업체 분류를 하나 이상 선택해 주세요.", true);
        }
        setStatus(sourcesLabel(sources) + " 목록 불러오는 중…");
        try {
            var rows = [];
            if (sources.indexOf("vendors") >= 0) {
                var vendors = await api.listVendors();
                vendors = filterOnlyMine((vendors || []).filter(isPartnerVendor));
                vendors.forEach(function (it) {
                    rows.push(normalizeRow(it, "vendors"));
                });
            }
            if (sources.indexOf("vendor_new") >= 0) {
                var news = filterOnlyMine(await api.listVendorNew());
                (news || []).forEach(function (it) {
                    rows.push(normalizeRow(it, "vendor_new"));
                });
            }
            rows.sort(function (a, b) {
                var c = String(a.name).localeCompare(String(b.name), "ko");
                if (c !== 0) return c;
                return String(a.source).localeCompare(String(b.source));
            });
            var prevMap = {};
            if (appliedSourcesKey === sourcesKey(sources)) {
                appliedSelections.forEach(function (row) {
                    prevMap[rowKey(row)] = row;
                });
            }
            rows.forEach(function (row) {
                var prev = prevMap[rowKey(row)];
                if (prev) {
                    row.sendCompany = !!prev.sendCompany && hasValidEmail(row.companyEmail);
                    row.sendManager = !!prev.sendManager && hasValidEmail(row.managerEmail);
                }
            });
            pickerRows = rows;
            renderPickerRows();
            setStatus(pickerRows.length ? "" : "표시할 업체가 없습니다.", !pickerRows.length);
            if (pickerRows.length) openPickerModal();
        } catch (e) {
            setStatus((e && e.message) || "업체 목록을 불러오지 못했습니다.", true);
        }
    }

    function applyPickerSelection() {
        appliedSourcesKey = sourcesKey(getSelectedSources());
        appliedSelections = pickerRows.map(function (row) {
            return {
                id: row.id,
                source: row.source,
                name: row.name,
                companyEmail: row.companyEmail,
                managerEmail: row.managerEmail,
                sendCompany: !!row.sendCompany && hasValidEmail(row.companyEmail),
                sendManager: !!row.sendManager && hasValidEmail(row.managerEmail)
            };
        });
        closePickerModal();
        renderSummary();
        var c = countSelections(appliedSelections);
        if (!c.total) setStatus("선택된 수신 이메일이 없습니다. 체크하지 않으면 발송되지 않습니다.", true);
        else setStatus("수신자 " + c.total + "통 선택됨", false);
    }

    function getSelectionsPayload() {
        return appliedSelections
            .filter(function (row) {
                return row.sendCompany || row.sendManager;
            })
            .map(function (row) {
                return {
                    id: row.id,
                    source: row.source,
                    sendCompany: !!row.sendCompany,
                    sendManager: !!row.sendManager
                };
            });
    }

    function getExt(name) {
        var s = String(name || "").toLowerCase();
        var idx = s.lastIndexOf(".");
        return idx >= 0 ? s.slice(idx) : "";
    }

    function extFromMime(type) {
        var map = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png"
        };
        return map[String(type || "").toLowerCase()] || "";
    }

    function normalizeAttachmentFile(file) {
        if (!file) return file;
        if (getExt(file.name)) return file;
        var ext = extFromMime(file.type);
        if (!ext) return file;
        try {
            return new File([file], "camera-" + Date.now() + ext, {
                type: file.type,
                lastModified: file.lastModified
            });
        } catch (e) {
            return file;
        }
    }

    function formatFileSize(bytes) {
        var n = Number(bytes) || 0;
        if (n < 1024) return n + "B";
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + "KB";
        return (n / (1024 * 1024)).toFixed(1) + "MB";
    }

    function maxFileSizeText() {
        return formatFileSize(MAX_FILE_BYTES);
    }

    function maxTotalSizeText() {
        return formatFileSize(MAX_TOTAL_BYTES);
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) {
                resolve();
                return;
            }
            var script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error("스크립트를 불러오지 못했습니다.")); };
            document.head.appendChild(script);
        });
    }

    function loadPdfLibs() {
        if (!pdfLibsPromise) {
            pdfLibsPromise = loadScript(PDF_JS_URL).then(function () {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
                }
                return loadScript(JSPDF_URL);
            });
        }
        return pdfLibsPromise;
    }

    function isImageFile(file) {
        if (!file) return false;
        var type = String(file.type || "").toLowerCase();
        if (type.indexOf("image/") === 0) return true;
        var ext = getExt(file.name);
        return ext === ".jpg" || ext === ".jpeg" || ext === ".png";
    }

    function isPdfFile(file) {
        if (!file) return false;
        return getExt(file.name) === ".pdf" || String(file.type || "").toLowerCase() === "application/pdf";
    }

    function validateFileType(file) {
        var ext = getExt(file.name);
        if (ALLOWED_EXTS.indexOf(ext) < 0) {
            ext = extFromMime(file.type);
            if (ALLOWED_EXTS.indexOf(ext) < 0) {
                throw new Error("허용되지 않는 첨부 형식입니다: " + (file.name || file.type || "파일"));
            }
        }
    }

    function loadImageFromFile(file) {
        return new Promise(function (resolve, reject) {
            if (!isImageFile(file)) {
                reject(new Error("이미지 파일이 아닙니다."));
                return;
            }
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                resolve({ img: img, revokeUrl: url });
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error("이미지를 읽을 수 없습니다."));
            };
            img.src = url;
        });
    }

    function drawImageJpeg(img, maxDim, quality) {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) throw new Error("이미지 크기를 확인할 수 없습니다.");
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("이미지 처리를 지원하지 않는 브라우저입니다.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        return canvas.toDataURL("image/jpeg", quality);
    }

    function dataUrlToFile(dataUrl, filename, mime) {
        var parts = String(dataUrl).split(",");
        var bin = atob(parts[1] || "");
        var len = bin.length;
        var arr = new Uint8Array(len);
        for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return new File([arr], filename, { type: mime || "application/octet-stream" });
    }

    function outputNameForImage(file) {
        var base = String(file.name || "image").replace(/\.[^.]+$/i, "") || "image";
        return base + ".jpg";
    }

    function compressImageAttachment(file) {
        return loadImageFromFile(file).then(function (payload) {
            var img = payload.img;
            var revokeUrl = payload.revokeUrl;
            var dim = 2400;
            var quality = 0.88;
            var outName = outputNameForImage(file);
            var dataUrl = "";
            var lastSize = Infinity;

            function finish(resultFile) {
                if (revokeUrl) URL.revokeObjectURL(revokeUrl);
                return resultFile;
            }

            for (var attempt = 0; attempt < 30; attempt++) {
                dataUrl = drawImageJpeg(img, dim, quality);
                var outFile = dataUrlToFile(dataUrl, outName, "image/jpeg");
                if (outFile.size <= TARGET_FILE_BYTES) return finish(outFile);
                if (quality > 0.55) {
                    quality = Math.max(0.55, quality - 0.06);
                } else if (dim > 900) {
                    dim = Math.max(900, Math.round(dim * 0.86));
                    quality = 0.82;
                } else if (outFile.size >= lastSize) {
                    break;
                } else {
                    quality = Math.max(0.42, quality - 0.05);
                }
                lastSize = outFile.size;
            }

            var finalFile = dataUrlToFile(dataUrl, outName, "image/jpeg");
            if (revokeUrl) URL.revokeObjectURL(revokeUrl);
            if (finalFile.size <= MAX_FILE_BYTES) return finalFile;
            throw new Error(
                file.name + " 이미지를 " + maxFileSizeText() + " 이하로 줄이지 못했습니다. 해상도를 낮춘 뒤 다시 선택해 주세요."
            );
        });
    }

    function renderPdfWithProfile(pdfDoc, profile) {
        var jsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDF) throw new Error("PDF 라이브러리를 불러오지 못했습니다.");
        var doc = null;
        var chain = Promise.resolve();
        for (var pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            (function (n) {
                chain = chain.then(function () {
                    return pdfDoc.getPage(n).then(function (page) {
                        var viewport = page.getViewport({ scale: profile.scale });
                        var canvas = document.createElement("canvas");
                        canvas.width = Math.floor(viewport.width);
                        canvas.height = Math.floor(viewport.height);
                        var ctx = canvas.getContext("2d");
                        if (!ctx) throw new Error("PDF 미리보기를 처리할 수 없습니다.");
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
                            var imgData = canvas.toDataURL("image/jpeg", profile.quality);
                            var w = canvas.width;
                            var h = canvas.height;
                            if (!doc) {
                                doc = new jsPDF({
                                    unit: "px",
                                    format: [w, h],
                                    compress: true,
                                    orientation: w >= h ? "l" : "p"
                                });
                            } else {
                                doc.addPage([w, h], w >= h ? "l" : "p");
                            }
                            doc.addImage(imgData, "JPEG", 0, 0, w, h, undefined, "FAST");
                        });
                    });
                });
            })(pageNum);
        }
        return chain.then(function () {
            if (!doc) throw new Error("PDF 페이지가 없습니다.");
            return doc.output("blob");
        });
    }

    function compressPdfAttachment(file) {
        return loadPdfLibs().then(function () {
            if (!window.pdfjsLib) throw new Error("PDF 라이브러리를 불러오지 못했습니다.");
            return file.arrayBuffer();
        }).then(function (buffer) {
            return window.pdfjsLib.getDocument({ data: buffer }).promise;
        }).then(function (pdfDoc) {
            var profiles = [
                { scale: 1.35, quality: 0.82 },
                { scale: 1.15, quality: 0.74 },
                { scale: 1.0, quality: 0.66 },
                { scale: 0.85, quality: 0.58 },
                { scale: 0.72, quality: 0.5 },
                { scale: 0.6, quality: 0.42 }
            ];
            var outName = String(file.name || "catalog.pdf").replace(/\.pdf$/i, "") + ".pdf";
            var chain = Promise.reject(new Error("start"));
            profiles.forEach(function (profile) {
                chain = chain.catch(function () {
                    return renderPdfWithProfile(pdfDoc, profile).then(function (blob) {
                        if (blob.size <= TARGET_FILE_BYTES) {
                            return new File([blob], outName, { type: "application/pdf" });
                        }
                        if (blob.size <= MAX_FILE_BYTES) {
                            return new File([blob], outName, { type: "application/pdf" });
                        }
                        throw new Error("too-large");
                    });
                });
            });
            return chain.catch(function () {
                throw new Error(
                    file.name + " PDF를 " + maxFileSizeText() + " 이하로 줄이지 못했습니다. 페이지 수를 줄이거나 이미지 해상도를 낮춘 뒤 다시 선택해 주세요."
                );
            });
        });
    }

    function prepareAttachmentFile(file) {
        var normalized = normalizeAttachmentFile(file);
        validateFileType(normalized);
        var originalSize = normalized.size;
        if (originalSize <= MAX_FILE_BYTES) {
            return Promise.resolve({ file: normalized, optimized: false, originalSize: originalSize });
        }
        if (isImageFile(normalized)) {
            return compressImageAttachment(normalized).then(function (out) {
                return { file: out, optimized: true, originalSize: originalSize };
            });
        }
        if (isPdfFile(normalized)) {
            return compressPdfAttachment(normalized).then(function (out) {
                return { file: out, optimized: true, originalSize: originalSize };
            });
        }
        return Promise.reject(
            new Error(
                normalized.name +
                    " 파일이 너무 큽니다(" +
                    formatFileSize(originalSize) +
                    "). HWP·DOC·XLS 등은 자동 조정이 어렵습니다. " + maxFileSizeText() + " 이하로 줄인 뒤 다시 선택해 주세요."
            )
        );
    }

    function canAddMoreAttachments() {
        return attachmentFiles.length < MAX_ATTACH;
    }

    function bindAttachmentInput(inputEl) {
        if (!inputEl) return;
        inputEl.addEventListener("change", function () {
            addAttachmentFiles(inputEl.files);
            inputEl.value = "";
        });
    }

    function renderAttachmentList() {
        if (!attachListEl) return;
        if (!attachmentFiles.length) {
            attachListEl.innerHTML = "";
            return;
        }
        attachListEl.innerHTML = attachmentFiles
            .map(function (file, idx) {
                var note = "";
                if (file._vebOptimized && file._vebOriginalSize) {
                    note =
                        "<span class=\"veb-attach-note\">용량 조정: " +
                        formatFileSize(file._vebOriginalSize) +
                        " → " +
                        formatFileSize(file.size) +
                        "</span>";
                }
                return (
                    "<li class=\"veb-attach-item\">" +
                    "<span class=\"veb-attach-num\">" + (idx + 1) + ".</span>" +
                    "<span class=\"veb-attach-name\">" + escapeHtml(file.name) + note + "</span>" +
                    "<span class=\"veb-attach-actions\">" +
                    "<button type=\"button\" class=\"btn\" data-veb-view=\"" + idx + "\">보기</button>" +
                    "<button type=\"button\" class=\"btn\" data-veb-del=\"" + idx + "\">삭제</button>" +
                    "</span></li>"
                );
            })
            .join("");
        attachListEl.querySelectorAll("[data-veb-del]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var i = parseInt(btn.getAttribute("data-veb-del"), 10);
                attachmentFiles.splice(i, 1);
                renderAttachmentList();
            });
        });
        attachListEl.querySelectorAll("[data-veb-view]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var i = parseInt(btn.getAttribute("data-veb-view"), 10);
                viewAttachment(i);
            });
        });
    }

    function closePreviewModal() {
        if (previewModal) previewModal.hidden = true;
        if (previewBody) previewBody.innerHTML = "";
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = "";
        }
        if (!pickerModal || pickerModal.hidden) {
            if (!successModal || successModal.hidden) {
                document.body.style.overflow = "";
            }
        }
    }

    function viewAttachment(idx) {
        var file = attachmentFiles[idx];
        if (!file || !previewModal || !previewBody) return;
        closePreviewModal();
        var url = URL.createObjectURL(file);
        previewObjectUrl = url;
        var type = String(file.type || "").toLowerCase();
        var ext = getExt(file.name);
        if (previewTitle) previewTitle.textContent = file.name || "첨부 미리보기";

        if (type.indexOf("image/") === 0) {
            previewBody.innerHTML =
                '<img src="' + url + '" alt="" class="veb-preview-img">';
        } else if (type === "application/pdf" || ext === ".pdf") {
            previewBody.innerHTML =
                '<iframe src="' + url + '" class="veb-preview-iframe" title="PDF 미리보기"></iframe>';
        } else {
            previewBody.innerHTML =
                '<p class="veb-preview-msg">이 형식은 화면 미리보기를 지원하지 않습니다. 아래에서 파일을 받을 수 있습니다.</p>' +
                '<p class="veb-preview-meta">' + escapeHtml(file.name) + "</p>" +
                '<a class="btn" href="' + url + '" download="' + escapeHtml(file.name) + '">파일 받기</a>';
        }

        previewModal.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function setAttachPickersDisabled(disabled) {
        if (fileGalleryBtn) fileGalleryBtn.disabled = !!disabled;
        if (fileCameraBtn) fileCameraBtn.disabled = !!disabled;
    }

    async function addAttachmentFiles(fileList) {
        var incoming = Array.from(fileList || []);
        if (!incoming.length) return;
        var optimizedNotes = [];
        try {
            setAttachPickersDisabled(true);
            setStatus("첨부 파일 준비 중…");
            for (var i = 0; i < incoming.length; i++) {
                if (attachmentFiles.length >= MAX_ATTACH) {
                    throw new Error("첨부는 최대 " + MAX_ATTACH + "개까지 가능합니다.");
                }
                var isLargePdf = isPdfFile(incoming[i]) && incoming[i].size > MAX_FILE_BYTES;
                if (isLargePdf) {
                    setStatus("PDF 용량 조정 중… 페이지가 많으면 시간이 걸릴 수 있습니다.");
                }
                var prepared = await prepareAttachmentFile(incoming[i]);
                var file = prepared.file;
                if (file.size > MAX_FILE_BYTES) {
                    throw new Error(file.name + " 파일을 " + maxFileSizeText() + " 이하로 줄이지 못했습니다.");
                }
                var total = attachmentFiles.reduce(function (s, f) { return s + f.size; }, 0) + file.size;
                if (total > MAX_TOTAL_BYTES) {
                    throw new Error("첨부 총 용량은 " + maxTotalSizeText() + " 이하로 제한됩니다.");
                }
                file._vebOriginalSize = prepared.originalSize;
                file._vebOptimized = prepared.optimized;
                attachmentFiles.push(file);
                if (prepared.optimized) {
                    optimizedNotes.push(
                        file.name + " (" + formatFileSize(prepared.originalSize) + " → " + formatFileSize(file.size) + ")"
                    );
                }
            }
            renderAttachmentList();
            if (optimizedNotes.length) {
                setStatus("용량을 조정해 첨부했습니다: " + optimizedNotes.join(", "), false);
            } else if (attachmentFiles.length) {
                setStatus("첨부 " + attachmentFiles.length + "개 준비됨", false);
            } else {
                setStatus("", false);
            }
        } catch (e) {
            setStatus((e && e.message) || "첨부 파일 오류", true);
        } finally {
            setAttachPickersDisabled(false);
        }
    }

    function fileToBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var raw = String(reader.result || "");
                var idx = raw.indexOf(",");
                resolve(idx >= 0 ? raw.slice(idx + 1) : raw);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function buildAttachments() {
        var out = [];
        for (var i = 0; i < attachmentFiles.length; i++) {
            out.push({
                filename: attachmentFiles[i].name,
                contentBase64: await fileToBase64(attachmentFiles[i])
            });
        }
        return out;
    }

    function validateAccess() {
        var access = Auth && Auth.getRegisterAccess ? Auth.getRegisterAccess() : { allowed: false, reason: "관리자 로그인이 필요합니다." };
        if (!access.allowed) {
            setStatus(access.reason, true);
            if (sendBtn) sendBtn.disabled = true;
            if (pickBtn) pickBtn.disabled = true;
            return false;
        }
        return true;
    }

    function senderName() {
        if (Auth && typeof Auth.getLoggedInCompanyDisplayName === "function") {
            return String(Auth.getLoggedInCompanyDisplayName() || "").trim();
        }
        return "";
    }

    function renderFailed(failedItems) {
        var list = Array.isArray(failedItems) ? failedItems : [];
        if (!failedWrap || !failedListEl) return;
        if (!list.length) {
            failedWrap.hidden = true;
            failedListEl.innerHTML = "";
            return;
        }
        failedWrap.hidden = false;
        failedListEl.innerHTML = list
            .map(function (it) {
                return "<li>" + escapeHtml(it.email || "") + " · " + escapeHtml(it.reason || "실패") + "</li>";
            })
            .join("");
    }

    function openSuccessModal() {
        if (!successModal) return;
        successModal.hidden = false;
        document.body.style.overflow = "hidden";
        speak("메일이 정상적으로 발송이 완료 되었습니다");
        var yesBtn = document.getElementById("veb-success-yes");
        if (yesBtn) yesBtn.focus();
    }

    function closeSuccessModal() {
        if (!successModal) return;
        successModal.hidden = true;
        document.body.style.overflow = "";
    }

    function invalidateSelection() {
        appliedSelections = [];
        appliedSourcesKey = "";
        renderSummary();
    }

    if (!validateAccess()) return;
    renderSummary();
    updateGreetingCount();

    if (greetingEl) {
        greetingEl.addEventListener("input", updateGreetingCount);
    }

    [srcVendorsEl, srcVendorNewEl].forEach(function (el) {
        if (el) el.addEventListener("change", invalidateSelection);
    });

    if (previewCloseBtn) previewCloseBtn.addEventListener("click", closePreviewModal);
    if (previewModal) {
        previewModal.addEventListener("click", function (e) {
            if (e.target === previewModal) closePreviewModal();
        });
    }

    if (pickBtn) pickBtn.addEventListener("click", loadPickerRows);
    ["veb-picker-close", "veb-picker-cancel"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", closePickerModal);
    });
    var applyBtn = document.getElementById("veb-picker-apply");
    if (applyBtn) applyBtn.addEventListener("click", applyPickerSelection);

    var bulkMap = [
        ["veb-bulk-company", "company"],
        ["veb-bulk-manager", "manager"],
        ["veb-bulk-both", "both"],
        ["veb-bulk-clear", "clear"]
    ];
    bulkMap.forEach(function (pair) {
        var btn = document.getElementById(pair[0]);
        if (btn) btn.addEventListener("click", function () { applyBulk(pair[1]); });
    });

    bindAttachmentInput(filesGalleryEl);
    bindAttachmentInput(filesCameraEl);

    if (fileGalleryBtn && filesGalleryEl) {
        fileGalleryBtn.addEventListener("click", function () {
            if (!canAddMoreAttachments()) {
                return setStatus("첨부는 최대 " + MAX_ATTACH + "개까지 가능합니다.", true);
            }
            filesGalleryEl.click();
        });
    }
    if (fileCameraBtn && filesCameraEl) {
        fileCameraBtn.addEventListener("click", function () {
            if (!canAddMoreAttachments()) {
                return setStatus("첨부는 최대 " + MAX_ATTACH + "개까지 가능합니다.", true);
            }
            filesCameraEl.click();
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener("click", async function () {
            try {
                var key = sourcesKey(getSelectedSources());
                if (!getSelectedSources().length) return setStatus("발송 대상 업체 분류를 하나 이상 선택해 주세요.", true);
                if (appliedSourcesKey !== key || !appliedSelections.length) return setStatus("먼저 수신자 선택을 완료해 주세요.", true);
                var selections = getSelectionsPayload();
                if (!selections.length) return setStatus("발송할 이메일을 하나 이상 선택해 주세요.", true);
                var subject = String((subjectEl && subjectEl.value) || "").trim();
                var greeting = String((greetingEl && greetingEl.value) || "").trim();
                if (!subject) return setStatus("제목을 입력해 주세요.", true);
                if (!greeting) return setStatus("내용을 입력해 주세요.", true);
                if (greetingLength(greeting) > GREETING_MAX) {
                    return setStatus("내용은 " + GREETING_MAX + "자 이하로 입력해 주세요.", true);
                }

                sendBtn.disabled = true;
                setStatus("메일 발송 중…");
                var result = await api.sendVendorBroadcastEmail({
                    subject: subject,
                    greeting: greeting,
                    onlyMine: true,
                    selections: selections,
                    senderName: senderName(),
                    attachments: await buildAttachments()
                });
                renderFailed(result.failedItems || []);
                if (result.failed && !result.sent) {
                    setStatus("발송에 실패했습니다. 실패 주소를 확인해 주세요.", true);
                    return;
                }
                setStatus("발송 완료: " + (result.sent || 0) + "통", false);
                openSuccessModal();
            } catch (e) {
                setStatus((e && e.message) || "메일 발송에 실패했습니다.", true);
            } finally {
                sendBtn.disabled = false;
            }
        });
    }

    var successYes = document.getElementById("veb-success-yes");
    var successNo = document.getElementById("veb-success-no");
    if (successYes) {
        successYes.addEventListener("click", function () {
            closeSuccessModal();
            setStatus("계속해서 메일을 보낼 수 있습니다.", false);
        });
    }
    if (successNo) {
        successNo.addEventListener("click", function () {
            closeSuccessModal();
            window.location.href = VENDOR_MANAGE_PAGE;
        });
    }
})();
