(function () {
    var MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    var api = window.THEJHON_API;

    var form = document.getElementById("vr-form");
    var statusEl = document.getElementById("vr-status");
    var editIdInput = document.getElementById("vr-edit-id");
    var loginIdInput = document.getElementById("vr-login-id");
    var passwordInput = document.getElementById("vr-login-pw");
    var companyInput = document.getElementById("vr-company");
    var ceoInput = document.getElementById("vr-ceo");
    var ceoTelInput = document.getElementById("vr-ceo-tel");
    var gradeInput = document.getElementById("vr-grade");
    var gradeBtns = document.querySelectorAll(".vr-grade-btn");
    var webInput = document.getElementById("vr-web");
    var emailInput = document.getElementById("vr-email");
    var phoneInput = document.getElementById("vr-phone");
    var addrInput = document.getElementById("vr-addr");
    var mgrNameInput = document.getElementById("vr-mgr-name");
    var mgrTelInput = document.getElementById("vr-mgr-tel");
    var mgrEmailInput = document.getElementById("vr-mgr-email");
    var logoInput = document.getElementById("vr-logo");
    var logoPreview = document.getElementById("vr-logo-preview");
    var noteInput = document.getElementById("vr-note");
    var cancelBtn = document.getElementById("vr-cancel-edit");
    var listEl = document.getElementById("vr-list");
    var submitBtn = document.getElementById("vr-submit");

    var pendingLogoData = "";
    var cachedItems = [];

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeMultiline(s) {
        return String(s)
            .split("\n")
            .map(function (line) {
                return escapeHtml(line);
            })
            .join("<br>");
    }

    function safeWebHref(s) {
        var t = String(s || "").trim();
        if (!t) return "";
        if (/^https?:\/\//i.test(t)) return t;
        return "https://" + t;
    }

    function setGrade(value) {
        var g = String(value || "1");
        if (g !== "1" && g !== "2" && g !== "3" && g !== "4") g = "1";
        if (gradeInput) gradeInput.value = g;
        gradeBtns.forEach(function (btn) {
            var on = btn.getAttribute("data-grade") === g;
            btn.classList.toggle("is-selected", on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }

    gradeBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            setGrade(btn.getAttribute("data-grade"));
        });
    });

    function readFileAsDataURL(file) {
        return new Promise(function (resolve, reject) {
            if (file.size > MAX_IMAGE_BYTES) {
                reject(new Error("이미지는 파일당 2MB 이하로 선택해 주세요."));
                return;
            }
            var r = new FileReader();
            r.onload = function () {
                resolve(r.result);
            };
            r.onerror = function () {
                reject(new Error("이미지를 읽을 수 없습니다."));
            };
            r.readAsDataURL(file);
        });
    }

    function setPreview(imgEl, src) {
        if (!imgEl) return;
        if (src) {
            imgEl.src = src;
            imgEl.hidden = false;
        } else {
            imgEl.removeAttribute("src");
            imgEl.hidden = true;
        }
    }

    function resetForm() {
        if (!form) return;
        form.reset();
        editIdInput.value = "";
        pendingLogoData = "";
        setPreview(logoPreview, "");
        setGrade("1");
        cancelBtn.hidden = true;
        submitBtn.textContent = "저장";
        submitBtn.disabled = false;
    }

    function thumbBlock(dataUrl, label) {
        if (dataUrl) {
            return "<img class=\"vr-thumb\" src=" + JSON.stringify(dataUrl) + ' alt="' + escapeHtml(label) + '">';
        }
        return (
            '<div class="vr-thumb vr-thumb--empty" role="img" aria-label="' +
            escapeHtml(label + " 없음") +
            '">' +
            escapeHtml(label) +
            "<br>없음</div>"
        );
    }

    function renderList() {
        var items = cachedItems.slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="vr-card-note">등록된 업체가 없습니다. 위 양식에서 저장해 보세요.</p>';
            return;
        }
        listEl.innerHTML = items
            .map(function (it) {
                var w = it.vn_web && String(it.vn_web).trim();
                var em = it.vn_email && String(it.vn_email).trim();
                var webLine = "";
                if (w) {
                    var href = safeWebHref(w);
                    webLine =
                        '홈페이지: <a href="' +
                        escapeHtml(href) +
                        '" target="_blank" rel="noopener noreferrer">' +
                        escapeHtml(w) +
                        "</a><br>";
                }
                var emailLine = em
                    ? '회사 이메일: <a href="mailto:' + escapeHtml(em) + '">' + escapeHtml(em) + "</a><br>"
                    : "";
                var noteBlock = it.vn_note && String(it.vn_note).trim()
                    ? '<p class="vr-card-note">' + escapeMultiline(String(it.vn_note).trim()) + "</p>"
                    : "";
                var addrBlock = "";
                if (it.vn_addr && String(it.vn_addr).trim()) {
                    addrBlock =
                        '주소: <span class="vr-card-addr">' +
                        escapeMultiline(String(it.vn_addr).trim()) +
                        "</span><br>";
                }
                var grade = it.vn_grade || "1";
                return (
                    '<article class="vr-card" data-id="' +
                    escapeHtml(it.id) +
                    '"><div class="vr-card-head">' +
                    thumbBlock(it.vn_logo, "로고") +
                    '<div class="vr-card-main"><h3 class="vr-card-title">' +
                    escapeHtml(it.vn_company || "") +
                    '<span class="vr-grade-badge">등급 ' +
                    escapeHtml(grade) +
                    "</span></h3><p class="vr-card-meta">아이디: " +
                    escapeHtml(it.loginId || "—") +
                    "<br>" +
                    addrBlock +
                    "대표: " +
                    escapeHtml(it.vn_ceo || "—") +
                    " · 대표 연락처: " +
                    escapeHtml(it.vn_ceo_tel || "—") +
                    " · 회사 전화: " +
                    escapeHtml(it.vn_phone || "—") +
                    "<br>" +
                    "담당: " +
                    escapeHtml(it.vn_mgr_name || "—") +
                    " · " +
                    escapeHtml(it.vn_mgr_tel || "—") +
                    " · " +
                    escapeHtml(it.vn_mgr_email || "—") +
                    "<br>" +
                    webLine +
                    emailLine +
                    '</p>' +
                    noteBlock +
                    '<div class="vr-card-actions"><button type="button" class="vr-btn-edit" data-id="' +
                    escapeHtml(it.id) +
                    '">수정</button><button type="button" class="vr-btn-del" data-id="' +
                    escapeHtml(it.id) +
                    '">삭제</button></div></div></div></article>'
                );
            })
            .join("");
    }

    function loadList() {
        if (!api) {
            setStatus("API를 불러오지 못했습니다.", true);
            return Promise.resolve();
        }
        setStatus("목록 불러오는 중…");
        return api
            .listVendors()
            .then(function (items) {
                cachedItems = items;
                renderList();
                setStatus("");
            })
            .catch(function (err) {
                setStatus(err.message || "목록을 불러오지 못했습니다.", true);
            });
    }

    function loadIntoForm(id) {
        var it = cachedItems.filter(function (x) {
            return x.id === id;
        })[0];
        if (!it) return;
        editIdInput.value = it.id;
        loginIdInput.value = it.loginId || "";
        passwordInput.value = "";
        companyInput.value = it.vn_company || "";
        ceoInput.value = it.vn_ceo || "";
        ceoTelInput.value = it.vn_ceo_tel || "";
        setGrade(it.vn_grade || "1");
        webInput.value = it.vn_web || "";
        emailInput.value = it.vn_email || "";
        phoneInput.value = it.vn_phone || "";
        addrInput.value = it.vn_addr || "";
        mgrNameInput.value = it.vn_mgr_name || "";
        mgrTelInput.value = it.vn_mgr_tel || "";
        mgrEmailInput.value = it.vn_mgr_email || "";
        noteInput.value = it.vn_note || "";
        logoInput.value = "";
        pendingLogoData = it.vn_logo || "";
        setPreview(logoPreview, pendingLogoData);
        cancelBtn.hidden = false;
        submitBtn.textContent = "수정 저장";
        setStatus("수정 중입니다. 저장하면 반영됩니다.");
        loginIdInput.focus();
    }

    function deleteById(id) {
        if (!confirm("이 업체 정보를 삭제할까요?")) return;
        api.deleteVendor(id)
            .then(function () {
                if (editIdInput.value === id) resetForm();
                return loadList();
            })
            .then(function () {
                setStatus("삭제했습니다.");
            })
            .catch(function (err) {
                setStatus(err.message || "삭제에 실패했습니다.", true);
            });
    }

    listEl.addEventListener("click", function (e) {
        var t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.classList.contains("vr-btn-edit")) loadIntoForm(t.getAttribute("data-id"));
        else if (t.classList.contains("vr-btn-del")) deleteById(t.getAttribute("data-id"));
    });

    logoInput.addEventListener("change", function () {
        var f = logoInput.files && logoInput.files[0];
        if (!f) {
            setPreview(logoPreview, editIdInput.value ? pendingLogoData : "");
            return;
        }
        readFileAsDataURL(f)
            .then(function (url) {
                pendingLogoData = url;
                setPreview(logoPreview, url);
            })
            .catch(function (err) {
                setStatus(err.message || "로고 오류", true);
                logoInput.value = "";
                setPreview(logoPreview, editIdInput.value ? pendingLogoData : "");
            });
    });

    cancelBtn.addEventListener("click", function () {
        resetForm();
        setStatus("편집을 취소했습니다.");
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var loginId = loginIdInput.value.trim();
        var vn_company = companyInput.value.trim();
        var editingId = editIdInput.value.trim();
        var pwdIn = passwordInput.value.trim();

        if (!loginId) {
            setStatus("아이디를 입력해 주세요.", true);
            loginIdInput.focus();
            return;
        }
        if (!vn_company) {
            setStatus("업체이름을 입력해 주세요.", true);
            companyInput.focus();
            return;
        }
        if (!editingId && (!pwdIn || pwdIn.length < 4)) {
            setStatus("비밀번호는 4자 이상으로 입력해 주세요.", true);
            passwordInput.focus();
            return;
        }
        if (pwdIn && pwdIn.length < 4) {
            setStatus("비밀번호는 4자 이상으로 입력해 주세요.", true);
            passwordInput.focus();
            return;
        }

        var fileLogo = logoInput.files && logoInput.files[0];

        function finish(logoData) {
            var body = {
                loginId: loginId,
                vn_company: vn_company,
                vn_ceo: ceoInput.value.trim(),
                vn_ceo_tel: ceoTelInput.value.trim(),
                vn_grade: gradeInput ? gradeInput.value : "1",
                vn_web: webInput.value.trim(),
                vn_email: emailInput.value.trim(),
                vn_phone: phoneInput.value.trim(),
                vn_addr: addrInput.value.trim(),
                vn_mgr_name: mgrNameInput.value.trim(),
                vn_mgr_tel: mgrTelInput.value.trim(),
                vn_mgr_email: mgrEmailInput.value.trim(),
                vn_logo: logoData || "",
                vn_note: noteInput.value.trim()
            };
            if (pwdIn) body.password = pwdIn;

            submitBtn.disabled = true;
            var p = editingId ? api.updateVendor(editingId, body) : api.createVendor(body);
            p.then(function () {
                resetForm();
                return loadList();
            })
                .then(function () {
                    setStatus(editingId ? "수정했습니다." : "저장했습니다.");
                })
                .catch(function (err) {
                    var msg = err.message || "저장에 실패했습니다.";
                    if (err.status === 409) msg = "이미 사용 중인 아이디입니다.";
                    setStatus(msg, true);
                })
                .finally(function () {
                    submitBtn.disabled = false;
                });
        }

        if (fileLogo) {
            readFileAsDataURL(fileLogo).then(finish).catch(function (err) {
                setStatus(err.message || "로고 오류", true);
            });
        } else {
            finish(editingId ? pendingLogoData : "");
        }
    });

    setGrade("1");
    loadList();
})();
