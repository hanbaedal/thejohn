(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("veb-status");
    var onlyMineEl = document.getElementById("veb-only-mine");
    var subjectEl = document.getElementById("veb-subject");
    var greetingEl = document.getElementById("veb-greeting");
    var filesEl = document.getElementById("veb-files");
    var testEmailEl = document.getElementById("veb-test-email");
    var testBtn = document.getElementById("veb-test-btn");
    var sendBtn = document.getElementById("veb-send-btn");
    var pickBtn = document.getElementById("veb-pick-btn");
    var summaryEl = document.getElementById("veb-selected-summary");
    var historyFromEl = document.getElementById("veb-history-date-from");
    var historyToEl = document.getElementById("veb-history-date-to");
    var historyListEl = document.getElementById("veb-history-list");
    var failedWrap = document.getElementById("veb-failed-wrap");
    var failedListEl = document.getElementById("veb-failed-list");
    var pickerModal = document.getElementById("veb-picker-modal");
    var pickerBody = document.getElementById("veb-picker-body");
    var pickerEmpty = document.getElementById("veb-picker-empty");
    var pickerTitle = document.getElementById("veb-picker-title");
    var ALLOWED_EXTS = [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];

    var pickerRows = [];
    var appliedSelections = [];
    var appliedSource = "";

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

    function getSource() {
        var el = document.querySelector('input[name="veb-source"]:checked');
        return el && el.value === "vendor_new" ? "vendor_new" : "vendors";
    }

    function sourceLabel(source) {
        return source === "vendor_new" ? "신규업체" : "등록업체";
    }

    function onlyMine() {
        return !!(onlyMineEl && onlyMineEl.checked);
    }

    function myUserId() {
        return Auth && Auth.getUserId ? String(Auth.getUserId() || "").trim().toLowerCase() : "";
    }

    function filterOnlyMine(items) {
        if (!onlyMine()) return items || [];
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

    function normalizeRow(it) {
        return {
            id: String((it && it.id) || "").trim(),
            name: String((it && it.vn_company) || "").trim() || "(이름 없음)",
            companyEmail: String((it && it.vn_email) || "").trim(),
            managerEmail: String((it && it.vn_mgr_email) || "").trim(),
            sendCompany: false,
            sendManager: false
        };
    }

    function hasValidEmail(v) {
        var e = String(v || "").trim();
        return e.indexOf("@") > 0 && e.indexOf(".") > 2;
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
        if (!appliedSelections.length || appliedSource !== getSource()) {
            summaryEl.textContent = "수신자를 선택해 주세요.";
            return;
        }
        var c = countSelections(appliedSelections);
        if (!c.total) {
            summaryEl.textContent = sourceLabel(appliedSource) + " — 선택된 수신 이메일이 없습니다.";
            return;
        }
        summaryEl.textContent =
            sourceLabel(appliedSource) +
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
                    "<tr data-veb-idx=\"" +
                    idx +
                    "\">" +
                    "<td class=\"veb-col-name\">" +
                    escapeHtml(row.name) +
                    "</td>" +
                    "<td class=\"veb-col-check\">" +
                    "<label>" +
                    "<input type=\"checkbox\" class=\"veb-picker-check veb-check-company\" data-veb-idx=\"" +
                    idx +
                    "\"" +
                    (row.sendCompany ? " checked" : "") +
                    (companyOk ? "" : " disabled") +
                    ">" +
                    "</label>" +
                    "<span class=\"veb-picker-email" +
                    (companyOk ? "" : " veb-picker-email--empty") +
                    "\">" +
                    escapeHtml(companyOk ? row.companyEmail : "(없음)") +
                    "</span>" +
                    "</td>" +
                    "<td class=\"veb-col-check\">" +
                    "<label>" +
                    "<input type=\"checkbox\" class=\"veb-picker-check veb-check-manager\" data-veb-idx=\"" +
                    idx +
                    "\"" +
                    (row.sendManager ? " checked" : "") +
                    (managerOk ? "" : " disabled") +
                    ">" +
                    "</label>" +
                    "<span class=\"veb-picker-email" +
                    (managerOk ? "" : " veb-picker-email--empty") +
                    "\">" +
                    escapeHtml(managerOk ? row.managerEmail : "(없음)") +
                    "</span>" +
                    "</td>" +
                    "</tr>"
                );
            })
            .join("");

        pickerBody.querySelectorAll(".veb-picker-check").forEach(function (cb) {
            cb.addEventListener("change", function () {
                var i = parseInt(cb.getAttribute("data-veb-idx"), 10);
                if (!pickerRows[i]) return;
                if (cb.classList.contains("veb-check-company")) {
                    pickerRows[i].sendCompany = cb.checked;
                } else {
                    pickerRows[i].sendManager = cb.checked;
                }
            });
        });
    }

    function openPickerModal() {
        if (!pickerModal) return;
        var source = getSource();
        if (pickerTitle) {
            pickerTitle.textContent = "수신자 선택 — " + sourceLabel(source);
        }
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
        var source = getSource();
        setStatus(sourceLabel(source) + " 목록 불러오는 중…");
        var items = [];
        try {
            if (source === "vendor_new") {
                items = await api.listVendorNew();
            } else {
                items = await api.listVendors();
                items = (items || []).filter(isPartnerVendor);
            }
            items = filterOnlyMine(items);
            items.sort(function (a, b) {
                return String(a.vn_company || "").localeCompare(String(b.vn_company || ""), "ko");
            });
            pickerRows = items.map(normalizeRow);
            var prevMap = {};
            appliedSelections.forEach(function (row) {
                if (row && row.id) prevMap[row.id] = row;
            });
            pickerRows.forEach(function (row) {
                var prev = prevMap[row.id];
                if (prev && appliedSource === source) {
                    row.sendCompany = !!prev.sendCompany && hasValidEmail(row.companyEmail);
                    row.sendManager = !!prev.sendManager && hasValidEmail(row.managerEmail);
                }
            });
            renderPickerRows();
            setStatus(pickerRows.length ? "" : "표시할 업체가 없습니다.", !pickerRows.length);
            openPickerModal();
        } catch (e) {
            setStatus((e && e.message) || "업체 목록을 불러오지 못했습니다.", true);
        }
    }

    function applyPickerSelection() {
        appliedSource = getSource();
        appliedSelections = pickerRows.map(function (row) {
            return {
                id: row.id,
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
        if (!c.total) {
            setStatus("선택된 수신 이메일이 없습니다. 체크한 항목이 없으면 메일이 발송되지 않습니다.", true);
        } else {
            setStatus("수신자 " + c.total + "통 선택됨", false);
        }
    }

    function getSelectionsPayload() {
        return appliedSelections
            .filter(function (row) {
                return row.sendCompany || row.sendManager;
            })
            .map(function (row) {
                return {
                    id: row.id,
                    sendCompany: !!row.sendCompany,
                    sendManager: !!row.sendManager
                };
            });
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

    function getExt(name) {
        var s = String(name || "").toLowerCase();
        var idx = s.lastIndexOf(".");
        return idx >= 0 ? s.slice(idx) : "";
    }

    async function buildAttachments() {
        var files = filesEl && filesEl.files ? Array.from(filesEl.files) : [];
        if (!files.length) return [];
        if (files.length > 5) throw new Error("첨부는 최대 5개까지 가능합니다.");
        var out = [];
        var total = 0;
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var ext = getExt(f.name);
            if (ALLOWED_EXTS.indexOf(ext) < 0) {
                throw new Error("허용되지 않는 첨부 형식입니다: " + f.name);
            }
            if (f.size > 4 * 1024 * 1024) throw new Error("파일당 4MB 이하만 첨부해 주세요.");
            total += f.size;
            if (total > 12 * 1024 * 1024) throw new Error("첨부 총 용량은 12MB 이하로 제한됩니다.");
            out.push({
                filename: f.name,
                contentBase64: await fileToBase64(f)
            });
        }
        return out;
    }

    function validateAccess() {
        var access =
            Auth && Auth.getRegisterAccess
                ? Auth.getRegisterAccess()
                : { allowed: false, reason: "관리자 로그인이 필요합니다." };
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
                var email = String((it && it.email) || "");
                var reason = String((it && it.reason) || "실패");
                return "<li>" + escapeHtml(email) + " · " + escapeHtml(reason) + "</li>";
            })
            .join("");
    }

    function ts(v) {
        var n = Number(v || 0);
        if (!n) return "-";
        return new Date(n).toLocaleString("ko-KR");
    }

    function renderHistory(items) {
        if (!historyListEl) return;
        var list = Array.isArray(items) ? items : [];
        if (!list.length) {
            historyListEl.innerHTML = "<li>발송 이력이 없습니다.</li>";
            return;
        }
        historyListEl.innerHTML = list
            .map(function (it) {
                var src =
                    it.source === "vendor_new"
                        ? "신규업체"
                        : it.includeVendorNew
                          ? "신규업체"
                          : it.includeVendors
                            ? "등록업체"
                            : it.source === "vendors"
                              ? "등록업체"
                              : "";
                return (
                    "<li>" +
                    "<strong>" +
                    escapeHtml(it.subject || "(제목 없음)") +
                    "</strong><br>" +
                    (src ? "대상: " + escapeHtml(src) + " · " : "") +
                    "발송시각: " +
                    ts(it.createdAt) +
                    " · 성공 " +
                    String(it.sentCount || 0) +
                    "건 · 실패 " +
                    String(it.failedCount || 0) +
                    "건" +
                    "</li>"
                );
            })
            .join("");
    }

    function loadHistory(fromText, toText) {
        if (!api || !api.listVendorEmailHistory) return;
        api.listVendorEmailHistory(20, fromText || "", toText || "")
            .then(renderHistory)
            .catch(function () {
                if (historyListEl) historyListEl.innerHTML = "<li>이력을 불러오지 못했습니다.</li>";
            });
    }

    function applyHistoryRange() {
        var fromText = String((historyFromEl && historyFromEl.value) || "").trim();
        var toText = String((historyToEl && historyToEl.value) || "").trim();
        if (fromText && toText && fromText > toText) {
            setStatus("기간 선택이 올바르지 않습니다. (시작일 <= 종료일)", true);
            return;
        }
        loadHistory(fromText, toText);
    }

    function invalidateSelectionOnSourceChange() {
        appliedSelections = [];
        appliedSource = "";
        renderSummary();
    }

    if (!validateAccess()) return;
    loadHistory();
    renderSummary();

    document.querySelectorAll('input[name="veb-source"]').forEach(function (el) {
        el.addEventListener("change", invalidateSelectionOnSourceChange);
    });
    if (onlyMineEl) {
        onlyMineEl.addEventListener("change", invalidateSelectionOnSourceChange);
    }

    if (pickBtn) {
        pickBtn.addEventListener("click", function () {
            loadPickerRows();
        });
    }

    ["veb-picker-close", "veb-picker-cancel"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", closePickerModal);
    });

    var applyBtn = document.getElementById("veb-picker-apply");
    if (applyBtn) applyBtn.addEventListener("click", applyPickerSelection);

    var bulkCompany = document.getElementById("veb-bulk-company");
    var bulkManager = document.getElementById("veb-bulk-manager");
    var bulkBoth = document.getElementById("veb-bulk-both");
    var bulkClear = document.getElementById("veb-bulk-clear");
    if (bulkCompany) bulkCompany.addEventListener("click", function () { applyBulk("company"); });
    if (bulkManager) bulkManager.addEventListener("click", function () { applyBulk("manager"); });
    if (bulkBoth) bulkBoth.addEventListener("click", function () { applyBulk("both"); });
    if (bulkClear) bulkClear.addEventListener("click", function () { applyBulk("clear"); });

    if (sendBtn) {
        sendBtn.addEventListener("click", async function () {
            try {
                var source = getSource();
                if (appliedSource !== source || !appliedSelections.length) {
                    return setStatus("먼저 수신자 선택을 완료해 주세요.", true);
                }
                var selections = getSelectionsPayload();
                if (!selections.length) {
                    return setStatus("발송할 이메일을 하나 이상 선택해 주세요.", true);
                }
                var subject = String((subjectEl && subjectEl.value) || "").trim();
                var greeting = String((greetingEl && greetingEl.value) || "").trim();
                if (!subject) return setStatus("제목을 입력해 주세요.", true);
                if (!greeting) return setStatus("인사말/본문을 입력해 주세요.", true);

                sendBtn.disabled = true;
                setStatus("메일 발송 중…");
                var attachments = await buildAttachments();
                var result = await api.sendVendorBroadcastEmail({
                    subject: subject,
                    greeting: greeting,
                    source: source,
                    onlyMine: onlyMine(),
                    selections: selections,
                    senderName: senderName(),
                    attachments: attachments
                });
                renderFailed(result.failedItems || []);
                applyHistoryRange();
                setStatus(
                    "발송 완료: " +
                        (result.sent || 0) +
                        "통" +
                        (result.failed ? " / 실패 " + result.failed + "건" : ""),
                    false
                );
                window.alert(
                    "메일 발송이 완료되었습니다. 성공 " +
                        (result.sent || 0) +
                        "통" +
                        (result.failed ? ", 실패 " + result.failed + "건" : "")
                );
            } catch (e) {
                setStatus((e && e.message) || "메일 발송에 실패했습니다.", true);
            } finally {
                sendBtn.disabled = false;
            }
        });
    }

    if (testBtn) {
        testBtn.addEventListener("click", async function () {
            try {
                var subject = String((subjectEl && subjectEl.value) || "").trim();
                var greeting = String((greetingEl && greetingEl.value) || "").trim();
                if (!subject) return setStatus("제목을 입력해 주세요.", true);
                if (!greeting) return setStatus("인사말/본문을 입력해 주세요.", true);
                var testEmail = String((testEmailEl && testEmailEl.value) || "").trim();
                if (!testEmail) return setStatus("테스트 수신 이메일을 입력해 주세요.", true);
                var attachments = await buildAttachments();
                testBtn.disabled = true;
                setStatus("테스트 메일 발송 중…");
                await api.sendVendorBroadcastTestEmail({
                    subject: subject,
                    greeting: greeting,
                    testEmail: testEmail,
                    recipientMode: "company",
                    senderName: senderName(),
                    attachments: attachments
                });
                setStatus("테스트 메일 발송 완료", false);
            } catch (e) {
                setStatus((e && e.message) || "테스트 메일 발송에 실패했습니다.", true);
            } finally {
                testBtn.disabled = false;
            }
        });
    }

    if (historyFromEl) historyFromEl.addEventListener("change", applyHistoryRange);
    if (historyToEl) historyToEl.addEventListener("change", applyHistoryRange);
})();
