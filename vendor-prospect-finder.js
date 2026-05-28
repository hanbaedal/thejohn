(function () {
    var api = window.THEJHON_API;
    var MAP = window.THEJHON_EXCEL_IMPORT_MAP;
    var statusEl = document.getElementById("vpf-status");
    var cityInput = document.getElementById("vpf-city");
    var searchBtn = document.getElementById("vpf-search-btn");
    var clearBtn = document.getElementById("vpf-clear-btn");
    var previewWrap = document.getElementById("vpf-preview-wrap");
    var previewHead = document.getElementById("vpf-preview-head");
    var previewBody = document.getElementById("vpf-preview-body");
    var previewCount = document.getElementById("vpf-preview-count");
    var importBtn = document.getElementById("vpf-import-btn");
    var resultEl = document.getElementById("vpf-result");

    var parsedRows = [];
    var PREVIEW_FIELDS = [
        "vn_company",
        "vn_phone",
        "vn_addr",
        "vn_room_count",
        "vn_ceo",
        "vn_ceo_tel",
        "vn_web",
        "vn_email"
    ];
    var FIELD_SPECS = {
        vn_company: { maxLength: 20, widthCh: 20 },
        vn_phone: { maxLength: 13, widthCh: 13 },
        vn_addr: { maxLength: 20, widthCh: 20 },
        vn_room_count: { maxLength: 4, widthCh: 4 },
        vn_ceo: { maxLength: 6, widthCh: 6 },
        vn_ceo_tel: { maxLength: 13, widthCh: 13 },
        vn_web: { maxLength: 50, widthCh: 50 },
        vn_email: { maxLength: 20, widthCh: 20 }
    };
    var LABELS = {
        vn_company: "장례식장명",
        vn_phone: "전화번호",
        vn_addr: "주소",
        vn_room_count: "빈소 수",
        vn_ceo: "대표자",
        vn_ceo_tel: "대표자연락처",
        vn_web: "홈페이지",
        vn_email: "이메일"
    };
    var DIFF_FIELDS = ["vn_ceo", "vn_ceo_tel", "vn_web", "vn_email", "vn_phone", "vn_addr"];

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "vei-status";
        if (kind === "error") statusEl.classList.add("vei-status--error");
        if (kind === "ok") statusEl.classList.add("vei-status--ok");
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, "&#39;");
    }

    function normalizeRow(row) {
        return MAP && MAP.normalizeImportRow ? MAP.normalizeImportRow(row || {}) : row || {};
    }

    function reset() {
        parsedRows = [];
        if (previewWrap) previewWrap.hidden = true;
        if (previewCount) previewCount.textContent = "";
        if (importBtn) importBtn.disabled = true;
        if (resultEl) {
            resultEl.hidden = true;
            resultEl.innerHTML = "";
        }
    }

    function syncRowFromTr(tr, idx) {
        if (!parsedRows[idx] || !tr) return;
        var sel = tr.querySelector('input[type="checkbox"][data-row-select]');
        if (sel) parsedRows[idx].__selected = !!sel.checked;
        PREVIEW_FIELDS.forEach(function (f) {
            var inp = tr.querySelector('input[data-field="' + f + '"]');
            if (inp) parsedRows[idx][f] = String(inp.value || "").trim();
        });
        parsedRows[idx] = normalizeRow(parsedRows[idx]);
    }

    function syncAllRows() {
        if (!previewBody) return;
        var trs = previewBody.querySelectorAll("tr");
        for (var i = 0; i < trs.length; i++) syncRowFromTr(trs[i], i);
    }

    function render(rows) {
        parsedRows = rows || [];
        if (!parsedRows.length) {
            if (previewWrap) previewWrap.hidden = true;
            if (previewCount) previewCount.textContent = "";
            if (enrichBtn) enrichBtn.disabled = true;
            if (importBtn) importBtn.disabled = true;
            return;
        }
        previewWrap.hidden = false;
        previewHead.innerHTML =
            "<tr>" +
            "<th>선택</th><th>삭제</th>" +
            PREVIEW_FIELDS.map(function (f) {
                return "<th>" + escapeHtml(LABELS[f] || f) + "</th>";
            }).join("") +
            "</tr>";
        previewBody.innerHTML = parsedRows
            .map(function (row, i) {
                return (
                    "<tr data-row-index=\"" +
                    i +
                    "\">" +
                    '<td><input type="checkbox" data-row-select="1" ' +
                    (row.__selected === false ? "" : "checked") +
                    '></td>' +
                    '<td><button type="button" class="btn btn-secondary vpf-row-del" data-row-del="' +
                    i +
                    '">삭제</button></td>' +
                    PREVIEW_FIELDS.map(function (f) {
                        var v = row[f] || "";
                        var spec = FIELD_SPECS[f] || {};
                        var maxLen = spec.maxLength ? ' maxlength="' + String(spec.maxLength) + '"' : "";
                        var widthStyle = spec.widthCh
                            ? ' style="width:' + String(spec.widthCh) + 'ch;min-width:' + String(spec.widthCh) + 'ch"'
                            : "";
                        var mode = f.indexOf("phone") >= 0 || f === "vn_room_count" ? ' inputmode="numeric"' : "";
                        return (
                            '<td><input type="text" class="vei-cell-input" data-field="' +
                            escapeAttr(f) +
                            '" value="' +
                            escapeAttr(v) +
                            '"' +
                            maxLen +
                            mode +
                            widthStyle +
                            '></td>'
                        );
                    }).join("") +
                    "</tr>"
                );
            })
            .join("");
        previewBody.querySelectorAll(".vei-cell-input").forEach(function (inp) {
            inp.addEventListener("change", function () {
                var tr = inp.closest("tr");
                var idx = tr ? parseInt(tr.getAttribute("data-row-index"), 10) : -1;
                if (idx >= 0) syncRowFromTr(tr, idx);
            });
        });
        previewBody.querySelectorAll(".vpf-row-del").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var idx = parseInt(btn.getAttribute("data-row-del") || "-1", 10);
                if (idx < 0 || idx >= parsedRows.length) return;
                parsedRows.splice(idx, 1);
                render(parsedRows);
            });
        });
        previewCount.textContent = "총 " + parsedRows.length + "건";
        importBtn.disabled = false;
    }

    function renderDiffs(diffs) {
        var list = Array.isArray(diffs) ? diffs : [];
        resultEl.hidden = false;
        if (!list.length) {
            resultEl.innerHTML = "<strong>조회 비교</strong> 변경된 항목이 없습니다.";
            return;
        }
        var html =
            "<strong>조회 비교</strong> " +
            list.length +
            "건 업데이트<ul class=\"vei-enrich-diff-list\">" +
            list
                .map(function (d) {
                    var changes = (d.changes || [])
                        .map(function (c) {
                            return (
                                (LABELS[c.field] || c.field) +
                                ": " +
                                (c.before || "(빈값)") +
                                " → " +
                                (c.after || "(빈값)")
                            );
                        })
                        .join(" · ");
                    return (
                        "<li><strong>" +
                        escapeHtml((d.row || "?") + "행 " + (d.company || "")) +
                        "</strong><br>" +
                        escapeHtml(changes) +
                        "</li>"
                    );
                })
                .join("") +
            "</ul>";
        resultEl.innerHTML = html;
    }

    function dedupByCompany(rows) {
        var out = [];
        var seen = {};
        (rows || []).forEach(function (r) {
            var name = String((r && r.vn_company) || "").trim();
            if (!name) return;
            var k = name.replace(/\s+/g, " ").toLowerCase();
            if (seen[k]) return;
            seen[k] = true;
            out.push(r);
        });
        return out;
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", function () {
            var city = String((cityInput && cityInput.value) || "").trim();
            if (!city) {
                setStatus("도시명을 입력해 주세요.", "error");
                return;
            }
            setStatus("조회 중…");
            reset();
            api.searchFuneralHalls(city)
                .then(function (items) {
                    var rows = dedupByCompany(items || []).map(function (r) {
                        var row = normalizeRow(r);
                        row.__selected = true;
                        return row;
                    });
                    render(rows);
                    setStatus(city + " 조회 완료: " + rows.length + "건", "ok");
                })
                .catch(function (err) {
                    setStatus(err.message || "장례식장 조회에 실패했습니다.", "error");
                });
        });
    }

    if (importBtn) {
        importBtn.addEventListener("click", function () {
            syncAllRows();
            var selected = (parsedRows || []).filter(function (r) {
                return !!(r && r.__selected);
            });
            var payload = dedupByCompany(selected);
            if (!payload.length) {
                setStatus("선택된 행이 없습니다. 저장할 항목을 체크해 주세요.", "error");
                return;
            }
            importBtn.disabled = true;
            setStatus("예비거래처 DB 저장 중…");
            api.importVendorProspects(payload)
                .then(function (res) {
                    var inserted = (res && res.inserted) || 0;
                    var skipped = (res && res.skipped) || 0;
                    var failed = (res && res.failed) || 0;
                    setStatus("저장 완료: " + inserted + "건 (중복 제외 " + skipped + "건)", "ok");
                    resultEl.hidden = false;
                    resultEl.innerHTML =
                        "<strong>결과</strong> 저장 " +
                        inserted +
                        "건, 중복·건너뜀 " +
                        skipped +
                        "건, 오류 " +
                        failed +
                        "건";
                })
                .catch(function (err) {
                    setStatus(err.message || "저장에 실패했습니다.", "error");
                })
                .finally(function () {
                    importBtn.disabled = !parsedRows.length;
                });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", function () {
            if (cityInput) cityInput.value = "";
            reset();
            setStatus("");
        });
    }

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getProspectFinderAccess
            ? THEJHON_AUTH.getProspectFinderAccess()
            : { allowed: false, reason: "권한 확인 불가" };
    if (!access.allowed) {
        setStatus(access.reason, "error");
        if (cityInput) cityInput.disabled = true;
        if (searchBtn) searchBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;
        if (importBtn) importBtn.disabled = true;
    }
})();

