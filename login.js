/**
 * login.html — 아이디·비밀번호 로그인 / 게스트 로그인(접속 통계)
 */
(function (global) {
    var params = new URLSearchParams(global.location.search);

    function $(id) {
        return document.getElementById(id);
    }

    function goNext(role) {
        var Auth = global.THEJHON_AUTH;
        var dest =
            Auth && Auth.getPostLoginLandingPath
                ? Auth.getPostLoginLandingPath(role, params.get("next"))
                : "index.html";
        global.location.replace(dest);
    }

    function apiBase() {
        var b = global.THEJHON_API_BASE_URL;
        return String(b || "").replace(/\/$/, "");
    }

    function setLoginServerStatus(text, busy) {
        var el = $("loginServerStatus");
        if (!el) return;
        if (!text) {
            el.hidden = true;
            el.textContent = "";
            el.classList.remove("login-server-status--busy");
            return;
        }
        el.hidden = false;
        el.textContent = text;
        el.classList.toggle("login-server-status--busy", !!busy);
    }

    /** Render 콜드스타트·DB 연결 대기 — 로그인 전 서버 깨우기 */
    function warmLoginServer() {
        var maxMs = 90000;
        var started = Date.now();

        function poll() {
            return fetch(apiBase() + "/api/health", {
                cache: "no-store",
                credentials: "same-origin"
            })
                .then(function (res) {
                    if (!res.ok) throw new Error("health");
                    return res.json();
                })
                .then(function (data) {
                    if (data && data.db) {
                        setLoginServerStatus("", false);
                        return;
                    }
                    setLoginServerStatus(
                        "서버 연결 중입니다. 잠시만 기다려 주세요.",
                        true
                    );
                    if (Date.now() - started > maxMs) {
                        setLoginServerStatus(
                            "서버 응답이 느립니다. 로그인을 다시 시도해 주세요.",
                            false
                        );
                        return;
                    }
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            poll().then(resolve);
                        }, 2000);
                    });
                })
                .catch(function () {
                    setLoginServerStatus("서버를 연결하는 중…", true);
                    if (Date.now() - started > maxMs) {
                        setLoginServerStatus(
                            "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
                            false
                        );
                        return;
                    }
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            poll().then(resolve);
                        }, 2500);
                    });
                });
        }

        poll();
    }

    function initGuest() {
        var guestBtn = document.querySelector(".login-guest");
        if (!guestBtn) return;
        guestBtn.addEventListener("click", function (e) {
            e.preventDefault();
            var Auth = global.THEJHON_AUTH;
            if (!Auth || !Auth.enterGuestSessionAsync) {
                goNext("guest");
                return;
            }
            guestBtn.setAttribute("aria-busy", "true");
            guestBtn.classList.add("login-guest--busy");
            Auth.enterGuestSessionAsync()
                .then(function () {
                    goNext("guest");
                })
                .catch(function () {
                    goNext("guest");
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
        if (Auth && Auth.refreshBrandFromStaffProfileAsync) {
            Auth.refreshBrandFromStaffProfileAsync();
        }
        goNext(role);
    }

    function applySession(ok) {
        if (THEJHON_AUTH.setFormSession) {
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
            return Promise.resolve();
        }
        var args = [
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
        ];
        if (THEJHON_AUTH.setFormSessionAsync) {
            return THEJHON_AUTH.setFormSessionAsync.apply(THEJHON_AUTH, args);
        }
        THEJHON_AUTH.setFormSession.apply(THEJHON_AUTH, args);
        return Promise.resolve();
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

        if (Auth.repairInconsistentAuthState) {
            Auth.repairInconsistentAuthState();
        }

        var role = Auth.getRole ? Auth.getRole() : "";
        var roleNorm = String(role || "")
            .trim()
            .toLowerCase();
        if (
            Auth.isLoggedIn &&
            Auth.isLoggedIn() &&
            (roleNorm === "guest" ||
                roleNorm === "vendor" ||
                roleNorm === "admin" ||
                roleNorm === "supervisor")
        ) {
            var dest =
                Auth.getPostLoginLandingPath
                    ? Auth.getPostLoginLandingPath(role, params.get("next"))
                    : "index.html";
            global.location.replace(dest);
            return;
        }

        var form = $("loginForm");
        if (!form) return;

        var userIdInput = $("userId");

        var loginSubmitting = false;

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (loginSubmitting) return;
            var id = userIdInput ? userIdInput.value.trim() : "";
            var pwEl = $("password");
            var pw = pwEl ? String(pwEl.value || "").trim() : "";
            if (!id || !pw) {
                alert("아이디와 비밀번호를 입력해 주세요.");
                return;
            }

            var submitBtn = form.querySelector(".login-submit");
            var submitLabel = submitBtn ? submitBtn.textContent : "";
            loginSubmitting = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "로그인 중…";
            }

            Auth.verifyFormCredentialsAsync(id, pw)
                .then(function (ok) {
                    if (!ok) {
                        alert("아이디 또는 비밀번호가 올바르지 않습니다.");
                        return;
                    }
                    return applySession(ok).then(function () {
                        goAfterLogin(ok);
                    });
                })
                .catch(function (err) {
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
                })
                .finally(function () {
                    loginSubmitting = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitLabel || "로그인";
                    }
                });
        });
    }

    function boot() {
        warmLoginServer();
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
