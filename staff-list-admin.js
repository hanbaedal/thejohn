/**
 * 슈퍼바이저 — 관리자(staff) 리스트·모달 수정
 */
(function () {
    var api = window.THEJHON_API;
    var statusEl = document.getElementById("sm-status");
    var listEl = document.getElementById("sm-list");
    var modal = document.getElementById("sm-edit-modal");
    var editForm = document.getElementById("sm-edit-form");
    var editMsg = document.getElementById("sm-edit-msg");
    var editDeleteBtn = document.getElementById("sm-edit-delete");
    var staffByKey = {};
    var editLoadedFromServer = false;
    var pendingEditLogo = null;
    var editLogoTouched = false;
    var pendingEditSeal = null;
    var editSealTouched = false;
    var PF = window.THEJHON_PRODUCT_FORM;
    var AF = window.THEJHON_ADDRESS_FIELDS;

    var editAddrPicker =
        AF && AF.mount
            ? AF.mount(document.getElementById("sm-edit-address-mount"), {
                  idPrefix: "sm-edit-",
                  label: "사업장소재지"
              })
            : null;
    var STAFF_LOGO_PROCESS_OPTIONS =
        PF && PF.STAFF_LOGO_PROCESS_OPTIONS
            ? PF.STAFF_LOGO_PROCESS_OPTIONS
            : { maxDimension: 512, fixedDimension: true, fit: "contain", maxBytes: 1024 * 1024 };
    var STAFF_SEAL_PIXEL_SIZE = PF && PF.STAFF_SEAL_PIXEL_SIZE ? PF.STAFF_SEAL_PIXEL_SIZE : 160;
    var STAFF_SEAL_PROCESS_OPTIONS =
        PF && PF.STAFF_SEAL_PROCESS_OPTIONS
            ? PF.STAFF_SEAL_PROCESS_OPTIONS
            : {
                  maxDimension: STAFF_SEAL_PIXEL_SIZE,
                  fixedDimension: true,
                  fit: "contain",
                  maxBytes: 1024 * 1024
              };

    function updateLogoPreview(imgEl, clearBtn, src) {
        if (PF && PF.showImagePreview) {
            PF.showImagePreview(imgEl, src);
        } else if (imgEl) {
            if (src) {
                imgEl.src = src;
                imgEl.removeAttribute("hidden");
            } else {
                imgEl.removeAttribute("src");
                imgEl.setAttribute("hidden", "");
            }
        }
        if (clearBtn) clearBtn.hidden = !src;
    }

    function initImagePicker(opts) {
        if (!PF || !PF.initProductPhotoPicker) return null;
        return PF.initProductPhotoPicker({
            galleryInput: opts.galleryInput,
            cameraInput: opts.cameraInput,
            btnGallery: opts.btnGallery,
            btnCamera: opts.btnCamera,
            onSelect: opts.onSelect,
            onError: opts.onError,
            processOptions: opts.processOptions || STAFF_LOGO_PROCESS_OPTIONS
        });
    }

    function initLogoPicker(opts) {
        opts.processOptions = STAFF_LOGO_PROCESS_OPTIONS;
        return initImagePicker(opts);
    }

    var editLogoPicker = initLogoPicker({
        galleryInput: document.getElementById("sm-edit-logo-gallery"),
        cameraInput: document.getElementById("sm-edit-logo-camera"),
        btnGallery: document.getElementById("sm-edit-logo-gallery-btn"),
        btnCamera: document.getElementById("sm-edit-logo-camera-btn"),
        onSelect: function (dataUrl) {
            editLogoTouched = true;
            pendingEditLogo = dataUrl || "";
            updateLogoPreview(
                document.getElementById("sm-edit-logo-preview"),
                document.getElementById("sm-edit-logo-clear"),
                pendingEditLogo
            );
        },
        onError: function (err) {
            setEditMsg((err && err.message) || "로고 오류", "err");
        }
    });

    var editLogoClear = document.getElementById("sm-edit-logo-clear");
    if (editLogoClear) {
        editLogoClear.addEventListener("click", function () {
            editLogoTouched = true;
            pendingEditLogo = "";
            if (editLogoPicker && editLogoPicker.clear) editLogoPicker.clear();
            updateLogoPreview(
                document.getElementById("sm-edit-logo-preview"),
                editLogoClear,
                ""
            );
        });
    }

    var editSealPicker = initImagePicker({
        galleryInput: document.getElementById("sm-edit-seal-gallery"),
        cameraInput: document.getElementById("sm-edit-seal-camera"),
        btnGallery: document.getElementById("sm-edit-seal-gallery-btn"),
        btnCamera: document.getElementById("sm-edit-seal-camera-btn"),
        processOptions: STAFF_SEAL_PROCESS_OPTIONS,
        onSelect: function (dataUrl) {
            editSealTouched = true;
            pendingEditSeal = dataUrl || "";
            updateLogoPreview(
                document.getElementById("sm-edit-seal-preview"),
                document.getElementById("sm-edit-seal-clear"),
                pendingEditSeal
            );
        },
        onError: function (err) {
            setEditMsg((err && err.message) || "도장 오류", "err");
        }
    });

    var editSealClear = document.getElementById("sm-edit-seal-clear");
    if (editSealClear) {
        editSealClear.addEventListener("click", function () {
            editSealTouched = true;
            pendingEditSeal = "";
            if (editSealPicker && editSealPicker.clear) editSealPicker.clear();
            updateLogoPreview(
                document.getElementById("sm-edit-seal-preview"),
                editSealClear,
                ""
            );
        });
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "sm-status" + (kind === "err" ? " sm-status--err" : kind === "ok" ? " sm-status--ok" : "");
    }

    function setEditMsg(msg, kind) {
        if (!editMsg) return;
        if (!msg) {
            editMsg.hidden = true;
            editMsg.textContent = "";
            return;
        }
        editMsg.hidden = false;
        editMsg.textContent = msg;
        editMsg.className = "sm-status" + (kind === "err" ? " sm-status--err" : " sm-status--ok");
    }

    function roleLabel(role) {
        if (role === "supervisor") return "슈퍼바이저";
        if (role === "admin") return "관리자";
        return role || "";
    }

    function roleClass(role) {
        return role === "supervisor" ? "sm-role sm-role--supervisor" : "sm-role";
    }

    function readForm(form, addrPicker) {
        var fd = new FormData(form);
        var body = {
            loginId: String(fd.get("loginId") || "").trim(),
            password: String(fd.get("password") || ""),
            st_company: String(fd.get("st_company") || "").trim(),
            st_phone: String(fd.get("st_phone") || "").trim(),
            st_fax: String(fd.get("st_fax") || "").trim(),
            st_email: String(fd.get("st_email") || "").trim(),
            st_web: String(fd.get("st_web") || "").trim(),
            st_ceo: String(fd.get("st_ceo") || "").trim(),
            st_ceo_tel: String(fd.get("st_ceo_tel") || "").trim(),
            st_biz_no: String(fd.get("st_biz_no") || "").trim(),
            st_biz_type: String(fd.get("st_biz_type") || "").trim(),
            st_biz_item: String(fd.get("st_biz_item") || "").trim(),
            st_facebook: String(fd.get("st_facebook") || "").trim(),
            st_instagram: String(fd.get("st_instagram") || "").trim(),
            st_naver_cafe: String(fd.get("st_naver_cafe") || "").trim(),
            st_youtube: String(fd.get("st_youtube") || "").trim(),
            st_kakao: String(fd.get("st_kakao") || "").trim()
        };
        var orderEl = form.querySelector('[name="orderEnabled"]');
        if (orderEl) {
            body.orderEnabled = orderEl.checked === true;
        }
        if (addrPicker) {
            var addrErr = addrPicker.validate();
            if (addrErr) return { error: addrErr };
            addrPicker.applyToBody(body);
            body.st_address = addrPicker.getValues().formatted;
        }
        if (!body.password) delete body.password;
        return body;
    }

    function staffToUpdateBody(st, overrides) {
        var body = {
            st_company: st.st_company || "",
            st_phone: st.st_phone || "",
            st_fax: st.st_fax || "",
            st_email: st.st_email || "",
            st_web: st.st_web || "",
            st_ceo: st.st_ceo || "",
            st_ceo_tel: st.st_ceo_tel || "",
            st_biz_no: st.st_biz_no || "",
            st_biz_type: st.st_biz_type || "",
            st_biz_item: st.st_biz_item || "",
            st_zip: st.st_zip || "",
            st_addr: st.st_addr || "",
            st_addr_detail: st.st_addr_detail || "",
            st_address: st.st_address || "",
            st_facebook: st.st_facebook || "",
            st_instagram: st.st_instagram || "",
            st_naver_cafe: st.st_naver_cafe || "",
            st_youtube: st.st_youtube || "",
            st_kakao: st.st_kakao || "",
            st_logo: st.st_logo || "",
            st_seal: st.st_seal || "",
            loginEnabled: st.loginEnabled !== false,
            orderEnabled: st.orderEnabled === true
        };
        if (overrides) {
            Object.keys(overrides).forEach(function (k) {
                body[k] = overrides[k];
            });
        }
        return body;
    }

    function staffKey(it) {
        return String((it && (it.id || it.loginId)) || "").trim();
    }

    function fillEditForm(st) {
        if (!st) return;
        document.getElementById("sm-edit-id").value = st.id || st.loginId || "";
        var loginInput = document.getElementById("sm-edit-loginId");
        loginInput.value = st.loginId || "";
        loginInput.dataset.originalLoginId = st.loginId || "";
        document.getElementById("sm-edit-password").value =
            st.password != null ? String(st.password) : "";
        document.getElementById("sm-edit-st_company").value = st.st_company || "";
        document.getElementById("sm-edit-st_phone").value = st.st_phone || "";
        document.getElementById("sm-edit-st_fax").value = st.st_fax || "";
        document.getElementById("sm-edit-st_ceo").value = st.st_ceo || "";
        document.getElementById("sm-edit-st_email").value = st.st_email || "";
        document.getElementById("sm-edit-st_web").value = st.st_web || "";
        document.getElementById("sm-edit-st_ceo_tel").value = st.st_ceo_tel || "";
        document.getElementById("sm-edit-st_biz_no").value = st.st_biz_no || "";
        document.getElementById("sm-edit-st_biz_type").value = st.st_biz_type || "";
        document.getElementById("sm-edit-st_biz_item").value = st.st_biz_item || "";
        if (editAddrPicker) {
            editAddrPicker.setValues({
                zip: st.st_zip,
                addr: st.st_addr || st.st_address || "",
                detail: st.st_addr_detail || ""
            });
        }
        document.getElementById("sm-edit-st_facebook").value = st.st_facebook || "";
        document.getElementById("sm-edit-st_instagram").value = st.st_instagram || "";
        document.getElementById("sm-edit-st_naver_cafe").value = st.st_naver_cafe || "";
        document.getElementById("sm-edit-st_youtube").value = st.st_youtube || "";
        document.getElementById("sm-edit-st_kakao").value = st.st_kakao || "";
        pendingEditLogo = null;
        editLogoTouched = false;
        pendingEditSeal = null;
        editSealTouched = false;
        updateLogoPreview(
            document.getElementById("sm-edit-logo-preview"),
            document.getElementById("sm-edit-logo-clear"),
            st.st_logo || ""
        );
        updateLogoPreview(
            document.getElementById("sm-edit-seal-preview"),
            document.getElementById("sm-edit-seal-clear"),
            st.st_seal || ""
        );
        if (editLogoPicker && editLogoPicker.clear) editLogoPicker.clear();
        if (editSealPicker && editSealPicker.clear) editSealPicker.clear();
        var title = document.getElementById("sm-edit-title");
        if (title) {
            title.textContent =
                (st.role === "supervisor" ? "슈퍼바이저" : "관리자") + " 수정 — " + (st.loginId || "");
        }
        if (editDeleteBtn) {
            var canDelete = st.role === "admin";
            editDeleteBtn.hidden = false;
            editDeleteBtn.disabled = !canDelete;
            editDeleteBtn.title = canDelete
                ? "이 관리자 계정을 삭제합니다"
                : "슈퍼바이저·기본 계정은 삭제할 수 없습니다";
        }
    }

    function showEditModal() {
        if (modal) {
            modal.hidden = false;
            document.body.style.overflow = "hidden";
        }
    }

    function renderList(items) {
        if (!listEl) return;
        staffByKey = {};
        (items || []).forEach(function (it) {
            var key = staffKey(it);
            if (key) staffByKey[key] = it;
        });
        var rows = (items || []).slice().sort(function (a, b) {
            var ra = a.role === "supervisor" ? 0 : 1;
            var rb = b.role === "supervisor" ? 0 : 1;
            if (ra !== rb) return ra - rb;
            return String(a.loginId || "").localeCompare(String(b.loginId || ""), "ko");
        });
        if (!rows.length) {
            listEl.innerHTML = '<p class="am-list-empty">등록된 계정이 없습니다.</p>';
            return;
        }
        listEl.innerHTML =
            '<ul class="sm-list">' +
            rows
                .map(function (it) {
                    var meta = [
                        it.loginId ? "아이디: " + it.loginId : "",
                        it.st_ceo ? "대표: " + it.st_ceo : "",
                        it.st_biz_no ? "사업자: " + it.st_biz_no : ""
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    var key = staffKey(it);
                    var enabled = it.loginEnabled !== false;
                    var orderOn = it.orderEnabled === true;
                    var accessHtml =
                        it.role === "admin"
                            ? '<div class="sm-list-access" role="group" aria-label="접속">' +
                              '<button type="button" class="sm-access-btn sm-access-btn--on' +
                              (enabled ? " is-active" : "") +
                              '" data-staff-id="' +
                              escapeHtml(key) +
                              '" data-login-enabled="true">활성</button>' +
                              '<button type="button" class="sm-access-btn sm-access-btn--off' +
                              (!enabled ? " is-active" : "") +
                              '" data-staff-id="' +
                              escapeHtml(key) +
                              '" data-login-enabled="false">비활성</button></div>'
                            : "";
                    var orderHtml =
                        it.role === "admin"
                            ? '<div class="sm-list-access" role="group" aria-label="주문">' +
                              '<button type="button" class="sm-access-btn sm-access-btn--order-on' +
                              (orderOn ? " is-active" : "") +
                              '" data-staff-id="' +
                              escapeHtml(key) +
                              '" data-order-enabled="true">주문</button>' +
                              '<button type="button" class="sm-access-btn sm-access-btn--order-off' +
                              (!orderOn ? " is-active" : "") +
                              '" data-staff-id="' +
                              escapeHtml(key) +
                              '" data-order-enabled="false">비주문</button></div>'
                            : "";
                    return (
                        '<li class="sm-list-row"><button type="button" class="sm-list-item" data-staff-id="' +
                        escapeHtml(key) +
                        '"><span class="sm-list-name">' +
                        escapeHtml(it.st_company || it.loginId || "(이름 없음)") +
                        '<span class="' +
                        roleClass(it.role) +
                        '">' +
                        escapeHtml(roleLabel(it.role)) +
                        "</span>" +
                        (it.role === "admin" && !enabled
                            ? '<span class="sm-role sm-role--disabled">접속비활성</span>'
                            : "") +
                        (it.role === "admin" && orderOn
                            ? '<span class="sm-role sm-role--order">주문권한</span>'
                            : "") +
                        "</span>" +
                        (meta ? '<span class="sm-list-meta">' + escapeHtml(meta) + "</span>" : "") +
                        "</button>" +
                        '<div class="sm-list-controls">' +
                        accessHtml +
                        orderHtml +
                        "</div></li>"
                    );
                })
                .join("") +
            "</ul>";

        listEl.querySelectorAll(".sm-list-item").forEach(function (btn) {
            btn.addEventListener("click", function () {
                openEdit(btn.getAttribute("data-staff-id"));
            });
        });
        listEl.querySelectorAll(".sm-access-btn[data-login-enabled]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                setLoginEnabledFromList(btn);
            });
        });
        listEl.querySelectorAll(".sm-access-btn[data-order-enabled]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                setOrderEnabledFromList(btn);
            });
        });
    }

    function setOrderEnabledFromList(btn) {
        if (!btn || !api.updateStaff) return;
        var key = String(btn.getAttribute("data-staff-id") || "").trim();
        var wantOrder = btn.getAttribute("data-order-enabled") === "true";
        var st = staffByKey[key];
        if (!st || st.role !== "admin") return;
        var currentOrder = st.orderEnabled === true;
        if (currentOrder === wantOrder) return;
        var label = st.loginId || st.st_company || "관리자";
        if (
            !window.confirm(
                label +
                    " 관리자의 주문 권한을 " +
                    (wantOrder ? "「주문」" : "「비주문」") +
                    "으로 변경할까요?" +
                    (wantOrder
                        ? "\n\n이 관리자가 등록한 업체는 주문·장바구니를 사용할 수 있습니다."
                        : "\n\n이 관리자가 등록한 업체는 주문 기능을 사용할 수 없습니다.")
            )
        ) {
            return;
        }
        btn.disabled = true;
        var row = btn.closest(".sm-list-row");
        if (row) {
            row.querySelectorAll(".sm-access-btn").forEach(function (b) {
                b.disabled = true;
            });
        }
        setStatus(wantOrder ? "주문 권한 설정 중…" : "비주문 설정 중…");
        api
            .updateStaff(st.id || key, staffToUpdateBody(st, { orderEnabled: wantOrder }))
            .then(function () {
                setStatus(
                    (st.st_company || label) +
                        " — 주문 권한 " +
                        (wantOrder ? "「주문」" : "「비주문」") +
                        "으로 변경했습니다.",
                    "ok"
                );
                loadList();
            })
            .catch(function (err) {
                setStatus((err && err.message) || "주문 권한 변경에 실패했습니다.", "err");
                if (row) {
                    row.querySelectorAll(".sm-access-btn").forEach(function (b) {
                        b.disabled = false;
                    });
                }
            });
    }

    function setLoginEnabledFromList(btn) {
        if (!btn || !api.updateStaff) return;
        var key = String(btn.getAttribute("data-staff-id") || "").trim();
        var wantEnabled = btn.getAttribute("data-login-enabled") === "true";
        var st = staffByKey[key];
        if (!st || st.role !== "admin") return;
        var currentEnabled = st.loginEnabled !== false;
        if (currentEnabled === wantEnabled) return;
        var label = st.loginId || st.st_company || "관리자";
        if (wantEnabled) {
            if (!window.confirm(label + " 계정 접속을 활성화할까요?")) return;
        } else if (
            !window.confirm(
                label +
                    " 계정 접속을 비활성화할까요?\n\n로그인이 차단되고 접속 중인 세션이 종료됩니다."
            )
        ) {
            return;
        }
        btn.disabled = true;
        var row = btn.closest(".sm-list-row");
        if (row) {
            row.querySelectorAll(".sm-access-btn").forEach(function (b) {
                b.disabled = true;
            });
        }
        setStatus(wantEnabled ? "접속 활성화 중…" : "접속 비활성화 중…");
        api
            .updateStaff(st.id || key, staffToUpdateBody(st, { loginEnabled: wantEnabled }))
            .then(function () {
                setStatus(
                    (st.st_company || label) + " — 접속 " + (wantEnabled ? "활성" : "비활성") + "으로 변경했습니다.",
                    "ok"
                );
                loadList();
            })
            .catch(function (err) {
                setStatus((err && err.message) || "접속 상태 변경에 실패했습니다.", "err");
                if (row) {
                    row.querySelectorAll(".sm-access-btn").forEach(function (b) {
                        b.disabled = false;
                    });
                }
            });
    }

    function loadList() {
        if (!api || !api.listStaff) {
            setStatus("API를 불러오지 못했습니다.", "err");
            return Promise.resolve();
        }
        setStatus("목록 불러오는 중…");
        return api
            .listStaff()
            .then(function (items) {
                renderList(items);
                setStatus((items || []).length + "건");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "목록을 불러오지 못했습니다.", "err");
            });
    }

    function openEdit(id) {
        var key = String(id || "").trim();
        if (!key || !api.getStaff) return;
        setEditMsg("");
        editLoadedFromServer = false;
        var cached = staffByKey[key];
        if (cached) {
            fillEditForm(cached);
            showEditModal();
        }
        api
            .getStaff(key)
            .then(function (st) {
                if (!st) {
                    if (cached) return;
                    throw new Error("계정을 찾을 수 없습니다.");
                }
                var cacheKey = staffKey(st);
                if (cacheKey) staffByKey[cacheKey] = st;
                fillEditForm(st);
                editLoadedFromServer = true;
                setEditMsg("");
                showEditModal();
            })
            .catch(function (err) {
                if (cached) {
                    setEditMsg("서버에서 최신 정보를 불러오지 못했습니다. 저장은 할 수 없습니다.", "err");
                    editLoadedFromServer = false;
                    return;
                }
                setEditMsg((err && err.message) || "불러오기 실패", "err");
            });
    }

    function closeEdit() {
        if (modal) modal.hidden = true;
        document.body.style.overflow = "";
        editLoadedFromServer = false;
        setEditMsg("");
        if (editDeleteBtn) {
            editDeleteBtn.hidden = true;
            editDeleteBtn.disabled = false;
        }
    }

    if (editForm) {
        editForm.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!editLoadedFromServer) {
                setEditMsg("계정 정보를 서버에서 불러온 뒤에 저장해 주세요.", "err");
                return;
            }
            var id = document.getElementById("sm-edit-id").value;
            var loginInput = document.getElementById("sm-edit-loginId");
            var body = readForm(editForm, editAddrPicker);
            if (body.error) {
                setEditMsg(body.error, "err");
                return;
            }
            if (!body.loginId) {
                setEditMsg("아이디를 입력해 주세요.", "err");
                return;
            }
            if (!body.st_company) {
                setEditMsg("회사명을 입력해 주세요.", "err");
                return;
            }
            var origLoginId = (loginInput && loginInput.dataset.originalLoginId) || "";
            var loginChanged = origLoginId && body.loginId !== origLoginId;

            function saveUpdate() {
                if (editLogoTouched) body.st_logo = pendingEditLogo || "";
                if (editSealTouched) body.st_seal = pendingEditSeal || "";
                var st = staffByKey[id] || staffByKey[origLoginId];
                var payload = st ? staffToUpdateBody(st, body) : body;
                setEditMsg("저장 중…");
                api
                    .updateStaff(id, payload)
                    .then(function (result) {
                        var msg = "저장했습니다.";
                        if (result && result.loginIdChanged) {
                            msg +=
                                " 아이디가 변경되었습니다. 해당 관리자는 새 아이디로 다시 로그인해야 합니다.";
                            var mig = result.loginIdMigration;
                            if (mig && typeof mig === "object") {
                                var parts = [];
                                Object.keys(mig).forEach(function (col) {
                                    if (mig[col]) parts.push(col + " " + mig[col] + "건");
                                });
                                if (parts.length) {
                                    msg += " (연동 갱신: " + parts.join(", ") + ")";
                                }
                            }
                        }
                        setEditMsg(msg, "ok");
                        if (PF && PF.speakKorean) PF.speakKorean("저장되었습니다");
                        loadList();
                        setTimeout(closeEdit, 900);
                    })
                    .catch(function (err) {
                        setEditMsg((err && err.message) || "저장에 실패했습니다.", "err");
                    });
            }

            if (loginChanged) {
                if (
                    !window.confirm(
                        "아이디를 「" +
                            origLoginId +
                            "」에서 「" +
                            body.loginId +
                            "」(으)로 변경합니다.\n\n등록 업체·상품·주문 등 담당 정보가 함께 갱신되며, 해당 관리자는 새 아이디로 다시 로그인해야 합니다.\n\n계속할까요?"
                    )
                ) {
                    return;
                }
                if (!api.checkStaffLoginId) {
                    saveUpdate();
                    return;
                }
                setEditMsg("아이디 확인 중…");
                api
                    .checkStaffLoginId(body.loginId, id)
                    .then(function (check) {
                        if (check && (check.duplicate || check.invalid)) {
                            setEditMsg((check && check.error) || "사용할 수 없는 아이디입니다.", "err");
                            return;
                        }
                        saveUpdate();
                    })
                    .catch(function (err) {
                        setEditMsg((err && err.message) || "아이디 확인에 실패했습니다.", "err");
                    });
                return;
            }
            saveUpdate();
        });
    }

    if (editDeleteBtn) {
        editDeleteBtn.addEventListener("click", function () {
            var id = document.getElementById("sm-edit-id").value;
            var loginId = document.getElementById("sm-edit-loginId").value || "";
            if (!id || !api.deleteStaff) return;
            if (editDeleteBtn.disabled) return;
            var label = loginId ? "아이디 " + loginId : "이 관리자";
            if (
                !window.confirm(
                    label +
                        " 계정을 삭제할까요?\n\n로그인이 차단되며 목록에서 사라집니다. (DB에는 비활성 기록으로 남습니다.)"
                )
            ) {
                return;
            }
            setEditMsg("삭제 중…");
            api
                .deleteStaff(id)
                .then(function () {
                    closeEdit();
                    setStatus("관리자 계정을 삭제했습니다.", "ok");
                    loadList();
                })
                .catch(function (err) {
                    setEditMsg((err && err.message) || "삭제에 실패했습니다.", "err");
                });
        });
    }

    var editCloseBtn = document.getElementById("sm-edit-close");
    var editCancelBtn = document.getElementById("sm-edit-cancel");
    if (editCloseBtn) editCloseBtn.addEventListener("click", closeEdit);
    if (editCancelBtn) editCancelBtn.addEventListener("click", closeEdit);
    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeEdit();
        });
    }

    if (!window.THEJHON_AUTH || !THEJHON_AUTH.getStaffManageAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (THEJHON_AUTH.normalizeLegacySession) THEJHON_AUTH.normalizeLegacySession();
    var access = THEJHON_AUTH.getStaffManageAccess();
    if (!access.allowed) {
        setStatus(access.reason, "err");
        return;
    }

    loadList();
})();
