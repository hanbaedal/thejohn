/**
 * login.html — 아이디·비밀번호 로그인 / 게스트 로그인(접속 통계)
 */
(function (global) {
    var params = new URLSearchParams(global.location.search);

    function $(id) {
        return document.getElementById(id);
    }

    function goNext() {
        var Auth = global.THEJHON_AUTH;
        var next =
            Auth && Auth.safeNextPath
                ? Auth.safeNextPath(params.get("next"))
                : "index.html";
        global.location.href = next || "index.html";
    }

    function initGuest() {
        var guestBtn = document.querySelector(".login-guest");
        if (!guestBtn) return;
        guestBtn.addEventListener("click", function (e) {
            e.preventDefault();
            var Auth = global.THEJHON_AUTH;
            if (!Auth || !Auth.enterGuestSessionAsync) {
                goNext();
                return;
            }
            guestBtn.setAttribute("aria-busy", "true");
            guestBtn.classList.add("login-guest--busy");
            Auth.enterGuestSessionAsync()
                .then(function () {
                    goNext();
                })
                .catch(function () {
                    goNext();
                });
        });
    }

    function showBusyModal(message) {
        return new Promise(function (resolve) {
            var modal = $("loginBusyModal");
            var msgEl = $("loginBusyMsg");
            var timerEl = $("loginBusyTimer");
            var text = message || "다른곳에서 로그인해서 사용중입니다!";
            if (!modal) {
                resolve();
                return;
            }
            if (msgEl) msgEl.textContent = text;
            modal.hidden = false;
            var left = 5;
            if (timerEl) timerEl.textContent = left + "초 후 닫힙니다.";
            var iv = setInterval(function () {
                left -= 1;
                if (left <= 0) {
                    clearInterval(iv);
                    modal.hidden = true;
                    resolve();
                    return;
                }
                if (timerEl) timerEl.textContent = left + "초 후 닫힙니다.";
            }, 1000);
        });
    }

    function goAfterLogin(ok) {
        var Auth = global.THEJHON_AUTH;
        var role = ok && ok.role;

        function navigate() {
            goNext();
        }

        if (
            (role === "admin" || role === "supervisor") &&
            Auth.refreshBrandFromStaffProfileAsync
        ) {
            Auth.refreshBrandFromStaffProfileAsync().finally(navigate);
            return;
        }
        navigate();
    }

    function applySession(ok) {
        THEJHON_AUTH.setFormSession(
            ok.userId,
            ok.role,
            ok.token,
            ok.companyName,
            ok.displayName,
            ok.vendorGrade,
            ok.vendorRegisteredBy,
            ok.vendorOrderEnabled,
            ok.vendorMgrName,
            ok.vendorMgrTel,
            ok.vendorMgrEmail,
            ok.staffOrderEnabled,
            ok.stLogo,
            ok.brandCompanyName || ok.vendorRegisteredByName
        );
    }

    function initPasswordToggle() {
        var pwEl = $("password");
        var toggleBtn = $("passwordToggle");
        if (!pwEl || !toggleBtn) return;

        var iconClosed = toggleBtn.querySelector(".login-password-icon--closed");
        var iconOpen = toggleBtn.querySelector(".login-password-icon--open");

        function setVisible(visible) {
            pwEl.type = visible ? "text" : "password";
            toggleBtn.setAttribute("aria-pressed", visible ? "true" : "false");
            toggleBtn.setAttribute("aria-label", visible ? "비밀번호 숨기기" : "비밀번호 표시");
            toggleBtn.title = visible ? "비밀번호 숨기기" : "비밀번호 표시";
            if (iconClosed) iconClosed.hidden = visible;
            if (iconOpen) iconOpen.hidden = !visible;
        }

        toggleBtn.addEventListener("click", function () {
            setVisible(pwEl.type === "password");
        });
    }

    function initLoginForm() {
        var Auth = global.THEJHON_AUTH;
        if (!Auth) return;

        var role = Auth.getRole ? Auth.getRole() : "";
        if (
            Auth.isLoggedIn &&
            Auth.isLoggedIn() &&
            (role === "admin" || role === "supervisor" || role === "vendor")
        ) {
            global.location.replace(Auth.safeNextPath(params.get("next")));
            return;
        }

        var form = $("loginForm");
        if (!form) return;

        var userIdInput = $("userId");

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var id = userIdInput ? userIdInput.value.trim() : "";
            var pwEl = $("password");
            var pw = pwEl ? String(pwEl.value || "").trim() : "";
            if (!id || !pw) {
                alert("아이디와 비밀번호를 입력해 주세요.");
                return;
            }

            var submitBtn = form.querySelector(".login-submit");
            if (submitBtn) submitBtn.disabled = true;

            Auth.verifyFormCredentialsAsync(id, pw)
                .then(function (ok) {
                    if (!ok) {
                        if (submitBtn) submitBtn.disabled = false;
                        alert("아이디 또는 비밀번호가 올바르지 않습니다.");
                        return;
                    }
                    applySession(ok);
                    goAfterLogin(ok);
                })
                .catch(function (err) {
                    if (submitBtn) submitBtn.disabled = false;
                    if (err && err.code === "NOT_REGISTERED") {
                        alert(
                            (err && err.message) ||
                                "등록되지 않은 아이디입니다. 업체등록 후 로그인해 주세요."
                        );
                        return;
                    }
                    if (err && err.code === "ALREADY_LOGGED_IN") {
                        showBusyModal(
                            err.message || "다른곳에서 로그인해서 사용중입니다!"
                        );
                        return;
                    }
                    if (err && err.code === "LOGIN_DISABLED") {
                        alert(err.message || "접속이 비활성화된 관리자 계정입니다.");
                        return;
                    }
                    if (err && err.code === "VENDOR_NO_PASSWORD") {
                        alert(
                            err.message ||
                                "비밀번호가 설정되지 않은 업체입니다. 관리자에게 비밀번호 재설정을 요청해 주세요."
                        );
                        return;
                    }
                    alert(
                        (err && err.message) ||
                            "아이디 또는 비밀번호가 올바르지 않습니다. 업체등록 시 입력한 비밀번호(8~16자)를 확인해 주세요."
                    );
                });
        });
    }

    function boot() {
        initGuest();
        initPasswordToggle();
        initLoginForm();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})(typeof window !== "undefined" ? window : this);
