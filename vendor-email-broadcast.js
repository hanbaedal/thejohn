(function () {
    var api = window.THEJHON_API;
    var statusEl = document.getElementById("veb-status");
    var includeVendorsEl = document.getElementById("veb-include-vendors");
    var includeVendorNewEl = document.getElementById("veb-include-vendor-new");
    var onlyMineEl = document.getElementById("veb-only-mine");
    var recipientCompanyEl = document.getElementById("veb-recipient-company");
    var recipientManagerEl = document.getElementById("veb-recipient-manager");
    var subjectEl = document.getElementById("veb-subject");
    var greetingEl = document.getElementById("veb-greeting");
    var filesEl = document.getElementById("veb-files");
    var testEmailEl = document.getElementById("veb-test-email");
    var testBtn = document.getElementById("veb-test-btn");
    var sendBtn = document.getElementById("veb-send-btn");
    var historyFromEl = document.getElementById("veb-history-date-from");
    var historyToEl = document.getElementById("veb-history-date-to");
    var historyListEl = document.getElementById("veb-history-list");
    var failedWrap = document.getElementById("veb-failed-wrap");
    var failedListEl = document.getElementById("veb-failed-list");
    var ALLOWED_EXTS = [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
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
            window.THEJHON_AUTH && THEJHON_AUTH.getRegisterAccess
                ? THEJHON_AUTH.getRegisterAccess()
                : { allowed: false, reason: "관리자 로그인이 필요합니다." };
        if (!access.allowed) {
            setStatus(access.reason, true);
            if (sendBtn) sendBtn.disabled = true;
            return false;
        }
        return true;
    }

    function getPayload() {
        var senderName = "";
        if (
            window.THEJHON_AUTH &&
            typeof THEJHON_AUTH.getLoggedInCompanyDisplayName === "function"
        ) {
            senderName = String(THEJHON_AUTH.getLoggedInCompanyDisplayName() || "").trim();
        }
        return {
            subject: String((subjectEl && subjectEl.value) || "").trim(),
            greeting: String((greetingEl && greetingEl.value) || "").trim(),
            includeVendors: !!(includeVendorsEl && includeVendorsEl.checked),
            includeVendorNew: !!(includeVendorNewEl && includeVendorNewEl.checked),
            onlyMine: !!(onlyMineEl && onlyMineEl.checked),
            recipientMode: recipientManagerEl && recipientManagerEl.checked ? "manager" : "company",
            senderName: senderName
        };
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
                return "<li>" + email + " · " + reason + "</li>";
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
                return (
                    "<li>" +
                    "<strong>" +
                    String(it.subject || "(제목 없음)") +
                    "</strong><br>" +
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

    if (!validateAccess()) return;
    loadHistory();

    if (sendBtn) {
        sendBtn.addEventListener("click", async function () {
            try {
                var payload = getPayload();
                var subject = payload.subject;
                var greeting = payload.greeting;
                if (!subject) return setStatus("제목을 입력해 주세요.", true);
                if (!greeting) return setStatus("인사말/본문을 입력해 주세요.", true);
                if (!payload.includeVendors && !payload.includeVendorNew) {
                    return setStatus("발송 대상을 최소 1개 선택해 주세요.", true);
                }

                sendBtn.disabled = true;
                setStatus("메일 발송 중…");
                var attachments = await buildAttachments();
                var result = await api.sendVendorBroadcastEmail({
                    subject: payload.subject,
                    greeting: payload.greeting,
                    includeVendors: payload.includeVendors,
                    includeVendorNew: payload.includeVendorNew,
                    onlyMine: payload.onlyMine,
                    recipientMode: payload.recipientMode,
                    senderName: payload.senderName,
                    attachments: attachments
                });
                renderFailed(result.failedItems || []);
                applyHistoryRange();
                setStatus(
                    "발송 완료: " +
                        (result.sent || 0) +
                        "명" +
                        (result.failed ? " / 실패 " + result.failed + "건" : ""),
                    false
                );
                window.alert(
                    "메일 발송이 완료되었습니다. 성공 " +
                        (result.sent || 0) +
                        "건" +
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
                var payload = getPayload();
                if (!payload.subject) return setStatus("제목을 입력해 주세요.", true);
                if (!payload.greeting) return setStatus("인사말/본문을 입력해 주세요.", true);
                var testEmail = String((testEmailEl && testEmailEl.value) || "").trim();
                if (!testEmail) return setStatus("테스트 수신 이메일을 입력해 주세요.", true);
                var attachments = await buildAttachments();
                testBtn.disabled = true;
                setStatus("테스트 메일 발송 중…");
                await api.sendVendorBroadcastTestEmail({
                    subject: payload.subject,
                    greeting: payload.greeting,
                    testEmail: testEmail,
                    recipientMode: payload.recipientMode,
                    senderName: payload.senderName,
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

    if (historyFromEl) {
        historyFromEl.addEventListener("change", applyHistoryRange);
    }
    if (historyToEl) {
        historyToEl.addEventListener("change", applyHistoryRange);
    }
})();
