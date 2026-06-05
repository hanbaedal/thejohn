/**
 * 업체 등록·수정 폼 공통
 */
(function (global) {
    var LOGIN_ID_MIN = 6;
    var LOGIN_ID_MAX = 12;
    var PASSWORD_MIN = 8;
    var PASSWORD_MAX = 16;
    var RESERVED_VENDOR_LOGIN_IDS = ["thejohn", "thejhon"];
    var PARTNER_DEPT_IDS = ["jeongyuk", "driedfish", "frozen", "seafood", "grocery", "drink"];
    var DEPT_ALERT_MSG = "사업부문을 한개이상 선택하세요!";

    function isReservedVendorLoginId(loginId) {
        var id = String(loginId || "")
            .trim()
            .toLowerCase();
        return RESERVED_VENDOR_LOGIN_IDS.indexOf(id) >= 0;
    }

    /** 상품 validateProductFields 와 동일 패턴 */
    function normalizePartnerDeptId(id) {
        var n = String(id || "").trim().toLowerCase();
        if (n === "livestock") return "jeongyuk";
        if (n === "meals") return "frozen";
        if (n === "banchan") return "grocery";
        return n;
    }

    function filterPartnerDepts(depts) {
        var list = depts || [];
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var id = normalizePartnerDeptId(list[i]);
            if (PARTNER_DEPT_IDS.indexOf(id) < 0) continue;
            if (out.indexOf(id) < 0) out.push(id);
        }
        return out;
    }

    function validatePartnerDeptsSelection(depts) {
        if (!filterPartnerDepts(depts).length) return DEPT_ALERT_MSG;
        return "";
    }

    var DEPT_LABEL_FALLBACK = {
        jeongyuk: "정육",
        driedfish: "건어물",
        frozen: "냉동식품",
        seafood: "냉동수산물",
        grocery: "공산품",
        drink: "음료수",
        uncontracted: "미계약"
    };

    function deptDisplayLabel(catalog, deptId) {
        var id = String(deptId || "").trim().toLowerCase();
        if (id === "uncontracted") return DEPT_LABEL_FALLBACK.uncontracted;
        if (catalog && catalog.getDept) {
            var d = catalog.getDept(id);
            if (d) return (d.icon ? d.icon + " " : "") + d.label;
        }
        return DEPT_LABEL_FALLBACK[id] || id;
    }

    function uncheckUncontractedDept(rootOrPicker) {
        if (!rootOrPicker) return;
        if (typeof rootOrPicker.uncheckDept === "function") {
            rootOrPicker.uncheckDept("uncontracted");
            return;
        }
        var box = rootOrPicker.querySelector('input[type="checkbox"][data-dept="uncontracted"]');
        if (box) box.checked = false;
    }

    function validateVendorFields(data, options) {
        options = options || {};
        var requirePassword = options.requirePassword !== false;
        var idErr = validateLoginIdFormat(data.loginId);
        if (idErr) return idErr;
        if (isReservedVendorLoginId(data.loginId)) {
            return "사용할 수 없는 아이디입니다.";
        }
        var pwErr = validatePasswordFormat(data.password, requirePassword);
        if (pwErr) return pwErr;
        if (!data.vn_company) return "업체이름을 입력해 주세요.";
        if (!data.vn_depts || !data.vn_depts.length) {
            return "사업부문을 하나 이상 선택해 주세요.";
        }
        return "";
    }

    function validateLoginIdFormat(loginId) {
        var id = String(loginId || "").trim();
        if (!id) return "아이디를 입력해 주세요.";
        if (id.length < LOGIN_ID_MIN || id.length > LOGIN_ID_MAX) {
            return "아이디는 " + LOGIN_ID_MIN + "~" + LOGIN_ID_MAX + "자리로 입력해 주세요.";
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return "아이디는 영문, 숫자, _(밑줄), -(하이픈)만 사용할 수 있습니다.";
        }
        return "";
    }

    function validatePasswordFormat(password, required) {
        var pw = String(password || "");
        if (!pw) {
            return required ? "비밀번호를 입력해 주세요." : "";
        }
        if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX) {
            return "비밀번호는 " + PASSWORD_MIN + "~" + PASSWORD_MAX + "자리로 입력해 주세요.";
        }
        return "";
    }

    var PW_TOGGLE_ICON_CLOSED =
        '<svg class="vr-pw-icon vr-pw-icon--closed" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';
    var PW_TOGGLE_ICON_OPEN =
        '<svg class="vr-pw-icon vr-pw-icon--open" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" hidden>' +
        '<path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';

    function initPasswordToggle(input, btn) {
        if (!input || !btn) return;
        if (!btn.querySelector(".vr-pw-icon--closed")) {
            btn.innerHTML = PW_TOGGLE_ICON_CLOSED + PW_TOGGLE_ICON_OPEN;
            btn.classList.add("vr-pw-toggle--icon");
        }
        var iconClosed = btn.querySelector(".vr-pw-icon--closed");
        var iconOpen = btn.querySelector(".vr-pw-icon--open");

        function setVisible(visible) {
            input.type = visible ? "text" : "password";
            btn.setAttribute("aria-pressed", visible ? "true" : "false");
            btn.setAttribute("aria-label", visible ? "비밀번호 숨기기" : "비밀번호 보기");
            btn.title = visible ? "비밀번호 숨기기" : "비밀번호 보기";
            if (iconClosed) iconClosed.hidden = visible;
            if (iconOpen) iconOpen.hidden = !visible;
        }

        setVisible(input.type !== "password");
        btn.addEventListener("click", function () {
            setVisible(input.type === "password");
        });
        return { sync: function () { setVisible(input.type !== "password"); } };
    }

    function syncPasswordToggle(input, btn) {
        if (!input || !btn) return;
        var visible = input.type !== "password";
        btn.setAttribute("aria-pressed", visible ? "true" : "false");
        btn.setAttribute("aria-label", visible ? "비밀번호 숨기기" : "비밀번호 보기");
        btn.title = visible ? "비밀번호 숨기기" : "비밀번호 보기";
        var iconClosed = btn.querySelector(".vr-pw-icon--closed");
        var iconOpen = btn.querySelector(".vr-pw-icon--open");
        if (iconClosed) iconClosed.hidden = visible;
        if (iconOpen) iconOpen.hidden = !visible;
    }

    function initPasswordConfirm(options) {
        var pwInput = options.passwordInput;
        var pw2Input = options.confirmInput;
        var hintEl = options.hintEl;
        if (!pwInput || !pw2Input) {
            return {
                isMatch: function () {
                    return true;
                },
                validate: function () {
                    return "";
                }
            };
        }

        function setHint(mode, text) {
            if (!hintEl) return;
            hintEl.textContent = text || "";
            hintEl.hidden = !text;
            hintEl.className = "vr-pw-match-hint vr-pw-match-hint--" + (mode || "idle");
            if (mode === "bad") {
                pw2Input.setAttribute("aria-invalid", "true");
                pw2Input.classList.add("vr-input--bad");
            } else {
                pw2Input.removeAttribute("aria-invalid");
                pw2Input.classList.remove("vr-input--bad");
            }
        }

        function check() {
            var pw = String(pwInput.value || "");
            var pw2 = String(pw2Input.value || "");
            if (!pw2) {
                setHint("idle", pw ? "비밀번호 확인을 입력해 주세요." : "");
                return false;
            }
            if (pw === pw2) {
                setHint("ok", "비밀번호가 일치합니다.");
                return true;
            }
            setHint("bad", "비밀번호가 일치하지 않습니다.");
            return false;
        }

        pwInput.addEventListener("input", check);
        pw2Input.addEventListener("input", check);
        pw2Input.addEventListener("blur", check);

        return {
            isMatch: check,
            validate: function (requirePassword) {
                var err = validatePasswordFormat(pwInput.value, requirePassword);
                if (err) return err;
                if (requirePassword || String(pw2Input.value || "").length) {
                    if (!check()) return "비밀번호 확인이 일치하지 않습니다.";
                }
                return "";
            }
        };
    }

    function initLoginIdDuplicateCheck(options) {
        var input = options.loginIdInput;
        var hintEl = options.hintEl;
        var checkDuplicate = options.checkDuplicate;
        var isReserved = options.isReserved || function () {
            return false;
        };
        var getExcludeId = options.getExcludeId || function () {
            return "";
        };
        var debounceMs = options.debounceMs || 450;
        var state = { duplicate: false, checking: false, lastChecked: "" };
        var timer = null;
        var seq = 0;

        if (!input || !checkDuplicate) {
            return {
                checkNow: function () {
                    return Promise.resolve({ duplicate: false });
                },
                isDuplicate: function () {
                    return false;
                },
                isChecking: function () {
                    return false;
                },
                reset: function () {}
            };
        }

        function setHint(mode, text) {
            if (!hintEl) return;
            hintEl.textContent = text || "";
            hintEl.hidden = !text;
            hintEl.className = "vr-id-dup-hint vr-id-dup-hint--" + (mode || "idle");
            if (mode === "dup" || mode === "bad") {
                input.setAttribute("aria-invalid", "true");
                input.classList.add("vr-input--bad");
            } else {
                input.removeAttribute("aria-invalid");
                input.classList.remove("vr-input--bad");
            }
        }

        function runCheck() {
            var id = String(input.value || "").trim();
            var fmt = validateLoginIdFormat(id);
            if (!id) {
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "");
                return Promise.resolve({ duplicate: false });
            }
            if (fmt) {
                state.duplicate = false;
                state.checking = false;
                setHint("bad", fmt);
                return Promise.resolve({ duplicate: false, invalid: true });
            }
            if (isReserved(id)) {
                state.duplicate = true;
                state.checking = false;
                state.lastChecked = id;
                setHint("dup", "사용할 수 없는 아이디입니다. 다른 아이디를 사용해 주세요.");
                return Promise.resolve({ duplicate: true, reserved: true });
            }
            var mySeq = ++seq;
            state.checking = true;
            setHint("checking", "아이디 중복 확인 중…");
            return checkDuplicate(id, getExcludeId())
                .then(function (res) {
                    if (mySeq !== seq) return res;
                    state.checking = false;
                    state.lastChecked = id;
                    state.duplicate = !!(res && res.duplicate);
                    if (state.duplicate) {
                        setHint("dup", (res && res.error) || "이미 사용 중인 아이디입니다.");
                    } else {
                        setHint("ok", "사용 가능한 아이디입니다.");
                    }
                    return res;
                })
                .catch(function () {
                    if (mySeq !== seq) return { duplicate: false };
                    state.checking = false;
                    setHint("err", "아이디 확인에 실패했습니다. 다시 시도해 주세요.");
                    return { duplicate: false, error: true };
                });
        }

        input.addEventListener("input", function () {
            var id = String(input.value || "").trim();
            if (id !== state.lastChecked) state.duplicate = false;
            if (timer) clearTimeout(timer);
            timer = setTimeout(runCheck, debounceMs);
        });
        input.addEventListener("blur", function () {
            if (timer) clearTimeout(timer);
            runCheck();
        });

        return {
            checkNow: runCheck,
            isDuplicate: function () {
                return state.duplicate;
            },
            isChecking: function () {
                return state.checking;
            },
            reset: function () {
                if (timer) clearTimeout(timer);
                seq++;
                state.duplicate = false;
                state.checking = false;
                state.lastChecked = "";
                setHint("idle", "");
            }
        };
    }

    function readMultiSelectValues(selectEl) {
        if (!selectEl) return [];
        var out = [];
        for (var i = 0; i < selectEl.options.length; i++) {
            if (selectEl.options[i].selected) out.push(selectEl.options[i].value);
        }
        return out;
    }

    function writeMultiSelectValues(selectEl, ids) {
        if (!selectEl) return;
        var set = {};
        (ids || []).forEach(function (id) {
            set[String(id)] = true;
        });
        for (var i = 0; i < selectEl.options.length; i++) {
            selectEl.options[i].selected = !!set[selectEl.options[i].value];
        }
    }

    function clearMultiSelect(selectEl) {
        if (!selectEl) return;
        for (var i = 0; i < selectEl.options.length; i++) {
            selectEl.options[i].selected = false;
        }
    }

    function readDeptCheckboxValues(root) {
        if (!root) return [];
        var out = [];
        var boxes = root.querySelectorAll('input[type="checkbox"][data-dept]');
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].checked) out.push(boxes[i].getAttribute("data-dept") || boxes[i].value);
        }
        return out;
    }

    function writeDeptCheckboxValues(root, ids) {
        if (!root) return;
        var set = {};
        (ids || []).forEach(function (id) {
            set[String(id)] = true;
        });
        var boxes = root.querySelectorAll('input[type="checkbox"][data-dept]');
        for (var i = 0; i < boxes.length; i++) {
            var key = boxes[i].getAttribute("data-dept") || boxes[i].value;
            boxes[i].checked = !!set[key];
        }
    }

    function clearDeptCheckboxValues(root) {
        if (!root) return;
        var boxes = root.querySelectorAll('input[type="checkbox"][data-dept]');
        for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
    }

    function initVendorDeptModalPicker(options) {
        var catalog = options.catalog || global.THEJHON_PRODUCT_CATALOG;
        var openBtn = options.openBtn;
        var summaryEl = options.summaryEl;
        var modal = options.modal;
        var optionsRoot = options.optionsRoot;
        var okBtn = options.okBtn;
        var closeBtn = options.closeBtn;
        var extraDepts = options.extraDepts || [];

        if (!openBtn || !summaryEl || !modal || !optionsRoot) return null;

        var selected = {};
        var pending = {};

        function buildDeptList() {
            var list = [];
            var seen = {};
            if (catalog && catalog.DEPARTMENTS) {
                catalog.DEPARTMENTS.forEach(function (d) {
                    list.push({ id: d.id, label: deptDisplayLabel(catalog, d.id) });
                    seen[d.id] = true;
                });
            } else {
                for (var i = 0; i < PARTNER_DEPT_IDS.length; i++) {
                    var pid = PARTNER_DEPT_IDS[i];
                    list.push({ id: pid, label: deptDisplayLabel(null, pid) });
                    seen[pid] = true;
                }
            }
            for (var j = 0; j < extraDepts.length; j++) {
                var ex = extraDepts[j];
                if (!ex || !ex.id || seen[ex.id]) continue;
                list.push({
                    id: ex.id,
                    label: ex.label || deptDisplayLabel(null, ex.id)
                });
                seen[ex.id] = true;
            }
            return list;
        }

        function getValues() {
            return Object.keys(selected).filter(function (k) {
                return selected[k];
            });
        }

        function renderSummary() {
            var ids = getValues();
            if (!ids.length) {
                summaryEl.textContent = "";
                summaryEl.classList.add("vr-dept-summary--empty");
                return;
            }
            summaryEl.classList.remove("vr-dept-summary--empty");
            summaryEl.textContent = ids
                .map(function (id) {
                    return deptDisplayLabel(catalog, id);
                })
                .join(", ");
        }

        function renderModalOptions(fromMap) {
            optionsRoot.innerHTML = "";
            buildDeptList().forEach(function (d) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "vr-dept-modal-opt";
                btn.setAttribute("data-dept", d.id);
                btn.setAttribute("aria-pressed", fromMap[d.id] ? "true" : "false");
                btn.textContent = d.label;
                if (fromMap[d.id]) btn.classList.add("is-selected");
                btn.addEventListener("click", function () {
                    if (fromMap[d.id]) delete fromMap[d.id];
                    else fromMap[d.id] = true;
                    var on = !!fromMap[d.id];
                    btn.classList.toggle("is-selected", on);
                    btn.setAttribute("aria-pressed", on ? "true" : "false");
                });
                optionsRoot.appendChild(btn);
            });
        }

        function openModal() {
            pending = {};
            Object.keys(selected).forEach(function (k) {
                if (selected[k]) pending[k] = true;
            });
            renderModalOptions(pending);
            modal.hidden = false;
            openBtn.setAttribute("aria-expanded", "true");
        }

        function closeModal() {
            modal.hidden = true;
            openBtn.setAttribute("aria-expanded", "false");
        }

        function applyModal() {
            selected = {};
            Object.keys(pending).forEach(function (k) {
                if (pending[k]) selected[k] = true;
            });
            closeModal();
            renderSummary();
        }

        openBtn.setAttribute("aria-haspopup", "dialog");
        openBtn.setAttribute("aria-expanded", "false");
        openBtn.addEventListener("click", openModal);
        if (okBtn) okBtn.addEventListener("click", applyModal);
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && modal && !modal.hidden) closeModal();
        });

        renderSummary();

        return {
            getValues: getValues,
            setValues: function (ids) {
                selected = {};
                (ids || []).forEach(function (id) {
                    var raw = String(id || "").trim().toLowerCase();
                    if (raw === "uncontracted") {
                        selected.uncontracted = true;
                        return;
                    }
                    var norm =
                        catalog && catalog.normalizeDept
                            ? catalog.normalizeDept(id)
                            : normalizePartnerDeptId(id);
                    if (norm && PARTNER_DEPT_IDS.indexOf(norm) >= 0) selected[norm] = true;
                });
                renderSummary();
            },
            clear: function () {
                selected = {};
                renderSummary();
            },
            uncheckDept: function (deptId) {
                delete selected[String(deptId || "").trim().toLowerCase()];
                renderSummary();
            },
            setExtraDepts: function (extras) {
                extraDepts = extras || [];
            },
            open: openModal,
            close: closeModal
        };
    }

    function initVendorDeptMultiPicker(options) {
        var catalog = options.catalog || global.THEJHON_PRODUCT_CATALOG;
        var root = options.root;
        var hiddenInput = options.hiddenInput;
        if (!root || !catalog || !hiddenInput) return null;

        root.innerHTML = "";
        root.setAttribute("role", "group");
        root.setAttribute("aria-label", "사업부문 선택 (복수 선택 가능)");

        var selected = {};

        function syncHidden() {
            var ids = Object.keys(selected).filter(function (k) {
                return selected[k];
            });
            ids.sort();
            hiddenInput.value = ids.join(",");
        }

        function toggleDept(deptId, on) {
            var norm = catalog.normalizeDept(deptId);
            if (!norm) return;
            if (on === undefined) {
                selected[norm] = !selected[norm];
            } else {
                selected[norm] = !!on;
            }
            if (!selected[norm]) delete selected[norm];
            var btn = root.querySelector('.am-dept-btn[data-dept="' + norm + '"]');
            if (btn) {
                var isOn = !!selected[norm];
                btn.classList.toggle("is-selected", isOn);
                btn.setAttribute("aria-pressed", isOn ? "true" : "false");
            }
            syncHidden();
        }

        catalog.DEPARTMENTS.forEach(function (d) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "am-dept-btn";
            btn.setAttribute("data-dept", d.id);
            btn.textContent = d.label;
            btn.setAttribute("aria-pressed", "false");
            btn.addEventListener("click", function () {
                toggleDept(d.id);
            });
            root.appendChild(btn);
        });

        return {
            getValues: function () {
                return hiddenInput.value
                    ? hiddenInput.value.split(",").filter(Boolean)
                    : [];
            },
            setValues: function (ids) {
                selected = {};
                (ids || []).forEach(function (id) {
                    toggleDept(id, true);
                });
                syncHidden();
            },
            clear: function () {
                selected = {};
                var btns = root.querySelectorAll(".am-dept-btn");
                for (var i = 0; i < btns.length; i++) {
                    btns[i].classList.remove("is-selected");
                    btns[i].setAttribute("aria-pressed", "false");
                }
                syncHidden();
            }
        };
    }

    global.THEJHON_VENDOR_FORM = {
        LOGIN_ID_MIN: LOGIN_ID_MIN,
        LOGIN_ID_MAX: LOGIN_ID_MAX,
        PASSWORD_MIN: PASSWORD_MIN,
        PASSWORD_MAX: PASSWORD_MAX,
        RESERVED_VENDOR_LOGIN_IDS: RESERVED_VENDOR_LOGIN_IDS,
        PARTNER_DEPT_IDS: PARTNER_DEPT_IDS,
        DEPT_ALERT_MSG: DEPT_ALERT_MSG,
        isReservedVendorLoginId: isReservedVendorLoginId,
        filterPartnerDepts: filterPartnerDepts,
        validatePartnerDeptsSelection: validatePartnerDeptsSelection,
        uncheckUncontractedDept: uncheckUncontractedDept,
        validateVendorFields: validateVendorFields,
        validateLoginIdFormat: validateLoginIdFormat,
        validatePasswordFormat: validatePasswordFormat,
        initPasswordToggle: initPasswordToggle,
        syncPasswordToggle: syncPasswordToggle,
        initPasswordConfirm: initPasswordConfirm,
        initLoginIdDuplicateCheck: initLoginIdDuplicateCheck,
        initVendorDeptModalPicker: initVendorDeptModalPicker,
        initVendorDeptMultiPicker: initVendorDeptMultiPicker,
        readMultiSelectValues: readMultiSelectValues,
        writeMultiSelectValues: writeMultiSelectValues,
        clearMultiSelect: clearMultiSelect,
        readDeptCheckboxValues: readDeptCheckboxValues,
        writeDeptCheckboxValues: writeDeptCheckboxValues,
        clearDeptCheckboxValues: clearDeptCheckboxValues
    };
})(typeof window !== "undefined" ? window : global);
