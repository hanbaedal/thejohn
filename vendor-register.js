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
    var ceoPhoneInput = document.getElementById("vr-ceo-phone");
    var bizNoInput = document.getElementById("vr-biz-no");
    var managerInput = document.getElementById("vr-manager");
    var managerPhoneInput = document.getElementById("vr-manager-phone");
    var websiteInput = document.getElementById("vr-website");
    var emailInput = document.getElementById("vr-email");
    var addressInput = document.getElementById("vr-address");
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
                var w = it.website && String(it.website).trim();
                var em = it.email && String(it.email).trim();
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
                var emailLine = "";
                if (em) {
                    emailLine =
                        '이메일: <a href="mailto:' + escapeHtml(em) + '">' + escapeHtml(em) + "</a>";
                }
                var noteBlock = it.note && String(it.note).trim()
                    ? '<p class="vr-card-note">' + escapeHtml(String(it.note).trim()) + "</p>"
                    : "";
                var addrBlock = "";
                if (it.address && String(it.address).trim()) {
                    addrBlock =
                        '업체주소: <span class="vr-card-addr">' +
                        escapeMultiline(String(it.address).trim()) +
                        "</span><br>";
                }
                var bizLine =
                    "대표: " +
                    escapeHtml(it.ceo || "—") +
                    " · 대표전화: " +
                    escapeHtml(it.ceoPhone || "—") +
                    " · 사업자등록번호: " +
                    escapeHtml(it.bizNo || "—") +
                    "<br>";
                return (
                    '<article class="vr-card" data-id="' +
                    escapeHtml(it.id) +
                    '"><div class="vr-card-head">' +
                    thumbBlock(it.logo, "로고") +
                    '<div class="vr-card-main"><h3 class="vr-card-title">' +
                    escapeHtml(it.companyName || "") +
                    '</h3><p class="vr-card-meta">아이디: ' +
                    escapeHtml(it.loginId || "—") +
                    "<br>" +
                    addrBlock +
                    bizLine +
                    "담당자: " +
                    escapeHtml(it.manager || "—") +
                    " · 담당자연락처: " +
                    escapeHtml(it.managerPhone || "—") +
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
        companyInput.value = it.companyName || "";
        ceoInput.value = it.ceo || "";
        ceoPhoneInput.value = it.ceoPhone || "";
        bizNoInput.value = it.bizNo || "";
        managerInput.value = it.manager || "";
        managerPhoneInput.value = it.managerPhone || "";
        websiteInput.value = it.website || "";
        emailInput.value = it.email || "";
        addressInput.value = it.address || "";
        noteInput.value = it.note || "";
        logoInput.value = "";
        pendingLogoData = it.logo || "";
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
        var companyName = companyInput.value.trim();
        var editingId = editIdInput.value.trim();
        var pwdIn = passwordInput.value.trim();

        if (!loginId) {
            setStatus("아이디를 입력해 주세요.", true);
            loginIdInput.focus();
            return;
        }
        if (!companyName) {
            setStatus("업체명을 입력해 주세요.", true);
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
                companyName: companyName,
                ceo: ceoInput.value.trim(),
                ceoPhone: ceoPhoneInput.value.trim(),
                bizNo: bizNoInput.value.trim(),
                manager: managerInput.value.trim(),
                managerPhone: managerPhoneInput.value.trim(),
                website: websiteInput.value.trim(),
                email: emailInput.value.trim(),
                address: addressInput.value.trim(),
                logo: logoData || "",
                note: noteInput.value.trim()
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

    loadList();
})();
