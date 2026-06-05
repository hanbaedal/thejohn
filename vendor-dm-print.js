(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var AF = window.THEJHON_ADDRESS_FIELDS;
    var VENDOR_MANAGE_PAGE = "vendor-manage.html";

    var LABEL_SPECS = {
        large: {
            w: 119.3,
            h: 42.8,
            cols: 2,
            rows: 3,
            perPage: 6,
            pageClass: "vdm-label-page--large",
            gridClass: "vdm-label-grid--large",
            pairClass: "vdm-label-pair--large",
            pageOrient: "landscape",
            name: "대봉투 라벨 (119.3×42.8mm · A4 가로 2열×3행 6칸)"
        },
        small: {
            w: 99.1,
            h: 33.9,
            cols: 2,
            rows: 8,
            perPage: 16,
            pageClass: "vdm-label-page--small",
            gridClass: "vdm-label-grid--small",
            pairClass: "vdm-label-pair--small",
            pageOrient: "portrait",
            name: "소봉투 라벨 (99.1×33.9mm · A4 16칸)"
        }
    };

    var SENDER = {
        zip: "14548",
        lines: [
            "(주)더존",
            "대표 이상범",
            "경기도 부천시 원미구",
            "부천로 130번길 5, 삼도빌딩 1층",
            "032-666-5255"
        ]
    };

    var statusEl = document.getElementById("vdm-status");
    var srcVendorsEl = document.getElementById("vdm-src-vendors");
    var srcVendorNewEl = document.getElementById("vdm-src-vendor-new");
    var printBtn = document.getElementById("vdm-print-btn");
    var pickBtn = document.getElementById("vdm-pick-btn");
    var summaryEl = document.getElementById("vdm-selected-summary");
    var pickerModal = document.getElementById("vdm-picker-modal");
    var pickerBody = document.getElementById("vdm-picker-body");
    var pickerEmpty = document.getElementById("vdm-picker-empty");
    var pickerTitle = document.getElementById("vdm-picker-title");
    var printArea = document.getElementById("vdm-print-area");
    var envLargeEl = document.getElementById("vdm-env-large");
    var envSmallEl = document.getElementById("vdm-env-small");

    var previewModal = document.getElementById("vdm-preview-modal");
    var previewBody = document.getElementById("vdm-preview-body");
    var previewMeta = document.getElementById("vdm-preview-meta");
    var previewPrintBtn = document.getElementById("vdm-preview-print");
    var pendingPrintJobs = [];
    var pendingEnvelopeType = "large";
    var pickerRows = [];
    var appliedSelections = [];
    var appliedSourcesKey = "";

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

    function formatAddress(row) {
        if (AF && AF.formatFullAddress) {
            return AF.formatFullAddress(row.zip, row.addr, row.addrDetail);
        }
        return [row.zip, row.addr, row.addrDetail].filter(Boolean).join(" ");
    }

    function hasValidAddress(row) {
        return !!(String(row.addr || "").trim() || String(row.zip || "").trim());
    }

    function hasValidManager(row) {
        return hasValidAddress(row) && !!(String(row.mgrName || "").trim());
    }

    function normalizeRow(it, source) {
        return {
            id: String((it && it.id) || "").trim(),
            source: source,
            name: String((it && it.vn_company) || "").trim() || "(이름 없음)",
            zip: String((it && it.vn_zip) || "").trim(),
            addr: String((it && it.vn_addr) || "").trim(),
            addrDetail: String((it && it.vn_addr_detail) || "").trim(),
            mgrName: String((it && it.vn_mgr_name) || "").trim(),
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
        (rows || []).forEach(function (row) {
            if (row.sendCompany && hasValidAddress(row)) company++;
            if (row.sendManager && hasValidManager(row)) manager++;
        });
        return { company: company, manager: manager, total: company + manager };
    }

    function renderSummary() {
        if (!summaryEl) return;
        var key = sourcesKey(getSelectedSources());
        if (!appliedSelections.length || appliedSourcesKey !== key) {
            summaryEl.textContent = "발송업체를 선택해 주세요.";
            return;
        }
        var c = countSelections(appliedSelections);
        if (!c.total) {
            summaryEl.textContent = sourcesLabel(getSelectedSources()) + " — 선택된 출력 대상이 없습니다.";
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
                var companyOk = hasValidAddress(row);
                var managerOk = hasValidManager(row);
                var addrText = companyOk ? formatAddress(row) : "(주소 없음)";
                return (
                    "<tr data-vdm-idx=\"" + idx + "\">" +
                    "<td class=\"vdm-col-type\">" + escapeHtml(sourceTypeLabel(row.source)) + "</td>" +
                    "<td class=\"vdm-col-name\">" + escapeHtml(row.name) +
                    "<span class=\"vdm-picker-addr" + (companyOk ? "" : " vdm-picker-addr--empty") + "\">" +
                    escapeHtml(addrText) + "</span></td>" +
                    "<td class=\"vdm-col-check\"><label>" +
                    "<input type=\"checkbox\" class=\"vdm-picker-check vdm-check-company\" data-vdm-idx=\"" + idx + "\"" +
                    (row.sendCompany ? " checked" : "") + (companyOk ? "" : " disabled") + "></label></td>" +
                    "<td class=\"vdm-col-check\"><label>" +
                    "<input type=\"checkbox\" class=\"vdm-picker-check vdm-check-manager\" data-vdm-idx=\"" + idx + "\"" +
                    (row.sendManager ? " checked" : "") + (managerOk ? "" : " disabled") + "></label>" +
                    (managerOk ? "" : "<span class=\"vdm-picker-addr vdm-picker-addr--empty\">담당자 없음</span>") +
                    "</td>" +
                    "</tr>"
                );
            })
            .join("");

        pickerBody.querySelectorAll(".vdm-picker-check").forEach(function (cb) {
            cb.addEventListener("change", function () {
                var i = parseInt(cb.getAttribute("data-vdm-idx"), 10);
                if (!pickerRows[i]) return;
                if (cb.classList.contains("vdm-check-company")) pickerRows[i].sendCompany = cb.checked;
                else pickerRows[i].sendManager = cb.checked;
            });
        });
    }

    function openPickerModal() {
        if (!pickerModal) return;
        if (pickerTitle) pickerTitle.textContent = "발송 업체 선택 — " + sourcesLabel(getSelectedSources());
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
                row.sendCompany = hasValidAddress(row);
                row.sendManager = false;
                return;
            }
            if (mode === "manager") {
                row.sendCompany = false;
                row.sendManager = hasValidManager(row);
                return;
            }
            if (mode === "both") {
                row.sendCompany = hasValidAddress(row);
                row.sendManager = hasValidManager(row);
            }
        });
        renderPickerRows();
    }

    async function loadPickerRows() {
        var sources = getSelectedSources();
        if (!sources.length) {
            return setStatus("출력 대상 업체 분류를 하나 이상 선택해 주세요.", true);
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
                    row.sendCompany = !!prev.sendCompany && hasValidAddress(row);
                    row.sendManager = !!prev.sendManager && hasValidManager(row);
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
                zip: row.zip,
                addr: row.addr,
                addrDetail: row.addrDetail,
                mgrName: row.mgrName,
                sendCompany: !!row.sendCompany && hasValidAddress(row),
                sendManager: !!row.sendManager && hasValidManager(row)
            };
        });
        closePickerModal();
        renderSummary();
        var c = countSelections(appliedSelections);
        if (!c.total) setStatus("선택된 출력 대상이 없습니다. 주소가 있는 항목을 체크해 주세요.", true);
        else setStatus("출력 대상 " + c.total + "통 선택됨", false);
    }

    function getEnvelopeType() {
        if (envSmallEl && envSmallEl.checked) return "small";
        return "large";
    }

    function chunkJobs(jobs, size) {
        var pages = [];
        for (var i = 0; i < jobs.length; i += size) {
            pages.push(jobs.slice(i, i + size));
        }
        return pages;
    }

    function buildPrintJobs() {
        var jobs = [];
        appliedSelections.forEach(function (row) {
            var fullAddr = formatAddress(row);
            if (row.sendCompany && hasValidAddress(row)) {
                jobs.push({
                    zip: row.zip,
                    address: fullAddr,
                    recipient: row.name + " 귀하",
                    sub: ""
                });
            }
            if (row.sendManager && hasValidManager(row)) {
                jobs.push({
                    zip: row.zip,
                    address: fullAddr,
                    recipient: row.mgrName + " 담당자님",
                    sub: row.name
                });
            }
        });
        return jobs;
    }

    function renderLabelHalf(kind, zip, lines, names) {
        var zipHtml = zip
            ? '<p class="vdm-label__zip">' + escapeHtml(zip) + "</p>"
            : "";
        var bodyHtml = (lines || [])
            .map(function (line) {
                return '<p class="vdm-label__line">' + escapeHtml(line) + "</p>";
            })
            .join("");
        var nameHtml = (names || [])
            .filter(Boolean)
            .map(function (name) {
                return '<p class="vdm-label__line vdm-label__line--name">' + escapeHtml(name) + "</p>";
            })
            .join("");
        return (
            '<div class="vdm-label-half">' +
            '<p class="vdm-label__kind">' + escapeHtml(kind) + "</p>" +
            zipHtml +
            bodyHtml +
            nameHtml +
            "</div>"
        );
    }

    function recipientAddressLines(job) {
        var addrText = String(job.address || "").trim();
        var zip = String(job.zip || "").trim();
        if (zip && addrText.indexOf(zip) === 0) {
            addrText = addrText.slice(zip.length).trim();
        }
        return addrText ? [addrText] : [];
    }

    function renderLabelPairHtml(job, envelopeType) {
        var spec = getLabelSpec(envelopeType);
        var sender = senderContent();
        var recipientNames = [job.recipient];
        if (job.sub) recipientNames.push(job.sub);
        return (
            '<article class="vdm-label-pair ' + spec.pairClass + '">' +
            renderLabelHalf("발신", sender.zip, sender.lines, []) +
            renderLabelHalf("수신", job.zip, recipientAddressLines(job), recipientNames) +
            "</article>"
        );
    }

    function senderContent() {
        return SENDER;
    }

    function renderEmptyLabelPair(envelopeType) {
        var spec = getLabelSpec(envelopeType);
        return (
            '<article class="vdm-label-pair vdm-label-pair--empty ' +
            spec.pairClass +
            '" aria-hidden="true"><span class="vdm-label-empty-mark">빈 칸</span></article>'
        );
    }

    function renderPageHtml(pageJobs, envelopeType, showEmptySlots) {
        var spec = getLabelSpec(envelopeType);
        var html = pageJobs
            .map(function (job) {
                return renderLabelPairHtml(job, envelopeType);
            })
            .join("");
        if (showEmptySlots) {
            var emptyCount = spec.perPage - pageJobs.length;
            for (var i = 0; i < emptyCount; i++) {
                html += renderEmptyLabelPair(envelopeType);
            }
        }
        return (
            '<section class="vdm-label-page ' +
            spec.pageClass +
            '">' +
            '<div class="vdm-label-grid ' +
            spec.gridClass +
            '">' +
            html +
            "</div></section>"
        );
    }

    function renderAllLabelsHtml(jobs, envelopeType, showEmptySlots) {
        var spec = getLabelSpec(envelopeType);
        var pages = chunkJobs(jobs, spec.perPage);
        return pages
            .map(function (pageJobs) {
                return renderPageHtml(pageJobs, envelopeType, !!showEmptySlots);
            })
            .join("");
    }

    function fitPreviewScale() {
        if (!previewBody) return;
        var pages = previewBody.querySelectorAll(".vdm-label-page");
        if (!pages.length) return;
        var scroll = previewBody;
        var availW = scroll.clientWidth - 24;
        pages.forEach(function (page) {
            page.style.transform = "";
            page.style.marginBottom = "1.25rem";
            var pageW = page.offsetWidth;
            if (pageW > availW && availW > 0) {
                var scale = Math.max(0.45, availW / pageW);
                page.style.transform = "scale(" + scale + ")";
                page.style.transformOrigin = "top center";
                page.style.marginBottom = page.offsetHeight * scale * 0.15 + 12 + "px";
            }
        });
    }

    function openPreviewModal(html, envelopeType, jobCount) {
        if (!previewModal || !previewBody) return;
        pendingEnvelopeType = envelopeType;
        var spec = getLabelSpec(envelopeType);
        var pageCount = Math.ceil(jobCount / spec.perPage);
        previewBody.innerHTML = '<div class="vdm-preview-inner">' + html + "</div>";
        if (previewMeta) {
            previewMeta.textContent =
                spec.name +
                " · " +
                jobCount +
                "건 · A4 " +
                pageCount +
                "장 · 2열 배치 · 칸당 발신(왼쪽)·수신(오른쪽)";
        }
        previewModal.hidden = false;
        document.body.style.overflow = "hidden";
        requestAnimationFrame(fitPreviewScale);
    }

    function closePreviewModal() {
        if (!previewModal) return;
        previewModal.hidden = true;
        document.body.style.overflow = "";
        if (previewBody) previewBody.innerHTML = "";
        pendingPrintJobs = [];
    }

    function executePrint() {
        if (!printArea || !pendingPrintJobs.length) return;
        var envelopeType = pendingEnvelopeType;
        printArea.innerHTML = renderAllLabelsHtml(pendingPrintJobs, envelopeType, false);
        injectPrintPageSize(envelopeType);
        document.body.classList.add("vdm-printing");
        var cleanup = function () {
            document.body.classList.remove("vdm-printing");
            removePrintPageSize();
            window.removeEventListener("afterprint", cleanup);
        };
        window.addEventListener("afterprint", cleanup);
        window.print();
    }

    function showPreview() {
        var key = sourcesKey(getSelectedSources());
        if (!getSelectedSources().length) return setStatus("출력 대상 업체 분류를 하나 이상 선택해 주세요.", true);
        if (appliedSourcesKey !== key || !appliedSelections.length) {
            return setStatus("먼저 발송 업체 선택을 완료해 주세요.", true);
        }
        var jobs = buildPrintJobs();
        if (!jobs.length) return setStatus("출력할 라벨이 없습니다. 주소가 있는 항목을 선택해 주세요.", true);
        pendingPrintJobs = jobs;
        var envelopeType = getEnvelopeType();
        var html = renderAllLabelsHtml(jobs, envelopeType, true);
        openPreviewModal(html, envelopeType, jobs.length);
        setStatus("출력 양식을 확인한 뒤 「인쇄」를 눌러 주세요.", false);
    }

    function getLabelSpec(envelopeType) {
        return LABEL_SPECS[envelopeType] || LABEL_SPECS.large;
    }

    function validateAccess() {
        var access = Auth && Auth.getRegisterAccess ? Auth.getRegisterAccess() : { allowed: false, reason: "관리자 로그인이 필요합니다." };
        if (!access.allowed) {
            setStatus(access.reason, true);
            if (printBtn) printBtn.disabled = true;
            if (pickBtn) pickBtn.disabled = true;
            return false;
        }
        return true;
    }

    function injectPrintPageSize(envelopeType) {
        var id = "vdm-print-page-size";
        var old = document.getElementById(id);
        if (old) old.remove();
        var spec = getLabelSpec(envelopeType);
        var orient = spec.pageOrient === "landscape" ? "A4 landscape" : "A4 portrait";
        var style = document.createElement("style");
        style.id = id;
        style.textContent = "@media print { @page { size: " + orient + "; margin: 0; } }";
        document.head.appendChild(style);
    }

    function removePrintPageSize() {
        var old = document.getElementById("vdm-print-page-size");
        if (old) old.remove();
    }

    function invalidateSelection() {
        appliedSelections = [];
        appliedSourcesKey = "";
        pendingPrintJobs = [];
        renderSummary();
    }

    if (!validateAccess()) return;
    renderSummary();

    [srcVendorsEl, srcVendorNewEl].forEach(function (el) {
        if (el) el.addEventListener("change", invalidateSelection);
    });

    if (pickBtn) pickBtn.addEventListener("click", loadPickerRows);
    ["vdm-picker-close", "vdm-picker-cancel"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", closePickerModal);
    });
    var applyBtn = document.getElementById("vdm-picker-apply");
    if (applyBtn) applyBtn.addEventListener("click", applyPickerSelection);

    [
        ["vdm-bulk-company", "company"],
        ["vdm-bulk-manager", "manager"],
        ["vdm-bulk-both", "both"],
        ["vdm-bulk-clear", "clear"]
    ].forEach(function (pair) {
        var btn = document.getElementById(pair[0]);
        if (btn) btn.addEventListener("click", function () { applyBulk(pair[1]); });
    });

    if (printBtn) printBtn.addEventListener("click", showPreview);
    if (previewPrintBtn) previewPrintBtn.addEventListener("click", executePrint);
    ["vdm-preview-close", "vdm-preview-cancel"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", closePreviewModal);
    });
    if (previewModal) {
        previewModal.addEventListener("click", function (e) {
            if (e.target === previewModal) closePreviewModal();
        });
    }
    window.addEventListener("resize", function () {
        if (previewModal && !previewModal.hidden) fitPreviewScale();
    });

    if (pickerModal) {
        pickerModal.addEventListener("click", function (e) {
            if (e.target === pickerModal) closePickerModal();
        });
    }
})();
