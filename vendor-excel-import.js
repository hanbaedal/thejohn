/**
 * 슈퍼바이저 — 엑셀 → vendor_prospects 일괄 등록
 */
(function () {
    var api = window.THEJHON_API;
    var fileInput = document.getElementById("vei-file");
    var statusEl = document.getElementById("vei-status");
    var previewWrap = document.getElementById("vei-preview-wrap");
    var previewHead = document.getElementById("vei-preview-head");
    var previewBody = document.getElementById("vei-preview-body");
    var previewCount = document.getElementById("vei-preview-count");
    var importBtn = document.getElementById("vei-import-btn");
    var clearBtn = document.getElementById("vei-clear-btn");
    var resultEl = document.getElementById("vei-result");

    var parsedRows = [];

    var COL_LABELS = {
        vn_company: "업체명",
        vn_ceo: "대표자",
        vn_ceo_tel: "대표자연락처",
        vn_web: "홈페이지",
        vn_email: "이메일",
        vn_phone: "회사전화",
        vn_addr: "회사주소",
        vn_mgr_name: "담당자",
        vn_mgr_tel: "담당자연락처",
        vn_mgr_email: "담당자이메일",
        vn_note: "비고",
        vn_grade: "등급",
        vn_depts: "사업부문"
    };

    var PREVIEW_FIELDS = [
        "vn_company",
        "vn_ceo",
        "vn_ceo_tel",
        "vn_web",
        "vn_email",
        "vn_phone",
        "vn_addr",
        "vn_mgr_name",
        "vn_mgr_tel",
        "vn_mgr_email"
    ];

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "vei-status";
        if (kind === "error") statusEl.classList.add("vei-status--error");
        if (kind === "ok") statusEl.classList.add("vei-status--ok");
    }

    function clearResult() {
        if (resultEl) resultEl.hidden = true;
        if (resultEl) resultEl.innerHTML = "";
    }

    function normalizeHeaderLabel(h) {
        return String(h || "")
            .trim()
            .replace(/\s+/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9가-힣_]/g, "");
    }

    var HEADER_ALIASES = [
        { field: "vn_company", keys: ["업체명", "업체이름", "업체명칭", "상호", "회사명", "company"] },
        { field: "vn_ceo", keys: ["대표자", "대표자명", "대표", "ceo"] },
        { field: "vn_ceo_tel", keys: ["대표자연락처", "대표연락처", "대표자전화", "대표전화"] },
        { field: "vn_web", keys: ["홈페이지", "웹사이트", "website", "web"] },
        { field: "vn_email", keys: ["이메일", "회사이메일", "email"] },
        { field: "vn_phone", keys: ["회사전화", "전화", "전화번호", "phone"] },
        { field: "vn_addr", keys: ["회사주소", "주소", "address"] },
        { field: "vn_mgr_name", keys: ["담당자", "담당자명", "manager"] },
        { field: "vn_mgr_tel", keys: ["담당자연락처", "담당자전화"] },
        { field: "vn_mgr_email", keys: ["담당자이메일", "담당자메일"] },
        { field: "vn_note", keys: ["회사상황", "비고", "메모", "note"] },
        { field: "vn_grade", keys: ["업체등급", "등급", "grade"] },
        { field: "vn_depts", keys: ["사업부문", "부문"] }
    ];

    function matchHeaderToField(label) {
        var norm = normalizeHeaderLabel(label);
        if (!norm) return "";
        for (var i = 0; i < HEADER_ALIASES.length; i++) {
            var entry = HEADER_ALIASES[i];
            for (var j = 0; j < entry.keys.length; j++) {
                var keyNorm = normalizeHeaderLabel(entry.keys[j]);
                if (norm === keyNorm || norm.indexOf(keyNorm) >= 0 || keyNorm.indexOf(norm) >= 0) {
                    return entry.field;
                }
            }
        }
        return "";
    }

    function cellStr(v) {
        if (v == null) return "";
        if (typeof v === "number" && isFinite(v)) return String(v);
        return String(v).trim();
    }

    function parseDeptsCell(raw) {
        var s = cellStr(raw);
        if (!s) return [];
        return s.split(/[,，、/|]/).map(function (p) {
            return p.trim();
        }).filter(Boolean);
    }

    function matrixToRows(matrix) {
        if (!matrix || !matrix.length) {
            return { rows: [], error: "시트에 데이터가 없습니다." };
        }
        var headerRow = matrix[0] || [];
        var colMap = {};
        for (var c = 0; c < headerRow.length; c++) {
            var field = matchHeaderToField(headerRow[c]);
            if (field) colMap[c] = field;
        }
        var hasCompany = false;
        for (var k in colMap) {
            if (colMap[k] === "vn_company") hasCompany = true;
        }
        if (!hasCompany) {
            return {
                rows: [],
                error: "「업체명」 또는 「업체이름」 열을 찾을 수 없습니다. 첫 줄에 헤더를 넣어 주세요."
            };
        }

        var rows = [];
        for (var r = 1; r < matrix.length; r++) {
            var line = matrix[r];
            if (!line || !line.length) continue;
            var obj = { vn_record_type: "new" };
            var any = false;
            for (var idx in colMap) {
                if (!Object.prototype.hasOwnProperty.call(colMap, idx)) continue;
                var field = colMap[idx];
                var val = line[Number(idx)];
                if (field === "vn_depts") {
                    obj.vn_depts = parseDeptsCell(val);
                } else {
                    var s = cellStr(val);
                    if (s) {
                        obj[field] = s;
                        any = true;
                    }
                }
            }
            if (any && obj.vn_company) rows.push(obj);
        }
        if (!rows.length) {
            return { rows: [], error: "저장할 업체 행이 없습니다. 업체명이 비어 있지 않은지 확인해 주세요." };
        }
        if (rows.length > 500) {
            return { rows: [], error: "한 번에 최대 500건까지 불러올 수 있습니다." };
        }
        return { rows: rows, error: "" };
    }

    function renderPreview(rows) {
        if (!previewWrap || !previewHead || !previewBody) return;
        if (!rows.length) {
            previewWrap.hidden = true;
            if (previewCount) previewCount.textContent = "";
            return;
        }
        previewWrap.hidden = false;
        previewHead.innerHTML =
            "<tr>" +
            PREVIEW_FIELDS.map(function (f) {
                return "<th>" + (COL_LABELS[f] || f) + "</th>";
            }).join("") +
            "</tr>";
        var show = rows.slice(0, 30);
        previewBody.innerHTML = show
            .map(function (row, i) {
                return (
                    "<tr>" +
                    PREVIEW_FIELDS.map(function (f) {
                        var v = row[f];
                        if (f === "vn_depts" && Array.isArray(v)) v = v.join(", ");
                        return "<td>" + escapeHtml(v || "") + "</td>";
                    }).join("") +
                    "</tr>"
                );
            })
            .join("");
        if (previewCount) {
            previewCount.textContent =
                "총 " +
                rows.length +
                "건" +
                (rows.length > 30 ? " (앞 30건만 미리보기)" : "") +
                " — 저장 시 vendor_prospects(신규업체)에 등록됩니다.";
        }
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function resetPreview() {
        parsedRows = [];
        if (importBtn) importBtn.disabled = true;
        if (previewWrap) previewWrap.hidden = true;
        if (previewCount) previewCount.textContent = "";
        if (fileInput) fileInput.value = "";
        clearResult();
    }

    function readExcelFile(file) {
        if (!window.XLSX) {
            setStatus("엑셀 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.", "error");
            return;
        }
        setStatus("파일을 읽는 중…");
        clearResult();
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                var wb = XLSX.read(data, { type: "array" });
                var sheetName = wb.SheetNames[0];
                if (!sheetName) {
                    setStatus("시트가 없습니다.", "error");
                    return;
                }
                var matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
                    header: 1,
                    defval: "",
                    raw: false
                });
                var parsed = matrixToRows(matrix);
                if (parsed.error) {
                    parsedRows = [];
                    renderPreview([]);
                    setStatus(parsed.error, "error");
                    if (importBtn) importBtn.disabled = true;
                    return;
                }
                parsedRows = parsed.rows;
                renderPreview(parsedRows);
                if (importBtn) importBtn.disabled = false;
                setStatus("파일을 읽었습니다. 내용을 확인한 뒤 저장을 눌러 주세요.", "ok");
            } catch (err) {
                parsedRows = [];
                renderPreview([]);
                setStatus((err && err.message) || "엑셀 파일을 읽지 못했습니다.", "error");
                if (importBtn) importBtn.disabled = true;
            }
        };
        reader.onerror = function () {
            setStatus("파일을 열 수 없습니다.", "error");
        };
        reader.readAsArrayBuffer(file);
    }

    if (fileInput) {
        fileInput.addEventListener("change", function () {
            var file = fileInput.files && fileInput.files[0];
            if (!file) {
                resetPreview();
                setStatus("");
                return;
            }
            var name = String(file.name || "").toLowerCase();
            if (!/\.(xlsx|xls|csv)$/.test(name)) {
                setStatus(".xlsx, .xls, .csv 파일만 선택할 수 있습니다.", "error");
                fileInput.value = "";
                return;
            }
            readExcelFile(file);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", function () {
            resetPreview();
            setStatus("");
        });
    }

    if (importBtn) {
        importBtn.addEventListener("click", function () {
            if (!parsedRows.length) {
                setStatus("먼저 엑셀 파일을 선택해 주세요.", "error");
                return;
            }
            if (!api || !api.importVendorProspects) {
                setStatus("API를 사용할 수 없습니다.", "error");
                return;
            }
            importBtn.disabled = true;
            setStatus("저장 중… (" + parsedRows.length + "건)");
            clearResult();
            api.importVendorProspects(parsedRows)
                .then(function (res) {
                    var inserted = (res && res.inserted) || 0;
                    var failed = (res && res.failed) || 0;
                    setStatus(inserted + "건을 vendor_prospects에 저장했습니다.", "ok");
                    if (resultEl) {
                        resultEl.hidden = false;
                        var html =
                            "<strong>결과</strong> 저장 " +
                            inserted +
                            "건" +
                            (failed ? ", 건너뜀 " + failed + "건" : "") +
                            '. <a href="vendor-new-list.html">신규업체 리스트</a>에서 확인할 수 있습니다.';
                        if (res.errors && res.errors.length) {
                            html +=
                                "<ul>" +
                                res.errors
                                    .map(function (e) {
                                        return (
                                            "<li>" +
                                            escapeHtml((e.row || "?") + "행: " + (e.error || "")) +
                                            "</li>"
                                        );
                                    })
                                    .join("") +
                                "</ul>";
                        }
                        resultEl.innerHTML = html;
                    }
                    if (inserted > 0) {
                        parsedRows = [];
                        if (fileInput) fileInput.value = "";
                        renderPreview([]);
                    }
                })
                .catch(function (err) {
                    setStatus(err.message || "저장에 실패했습니다.", "error");
                })
                .finally(function () {
                    importBtn.disabled = !parsedRows.length;
                });
        });
    }

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getSupervisorExcelImportAccess
            ? THEJHON_AUTH.getSupervisorExcelImportAccess()
            : { allowed: false, reason: "권한을 확인할 수 없습니다." };
    if (!access.allowed) {
        setStatus(access.reason, "error");
        if (fileInput) fileInput.disabled = true;
        if (importBtn) importBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;
    }
})();
