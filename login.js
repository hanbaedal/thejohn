/**
 * login.html — 폼 로그인 · 게스트(홈) · 로그인 후 이동
 */
(function (global) {
    var params = new URLSearchParams(global.location.search);

    function $(id) {
        return document.getElementById(id);
    }

    function initHeaderDate() {
        var todayEl = $("headerToday");
        if (!todayEl) return;
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, "0");
        var d = String(now.getDate()).padStart(2, "0");
        todayEl.dateTime = y + "-" + m + "-" + d;
        todayEl.textContent = now.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long"
        });
    }

    function initLogout() {
        var logoutBtn = $("btnLogout");
        if (!logoutBtn) return;
        logoutBtn.addEventListener("click", function () {
            if (global.THEJHON_AUTH) THEJHON_AUTH.clearSession();
            global.location.reload();
        });
    }

    function speakWarning(text) {
        if (!global.speechSynthesis || !text) return;
        try {
            global.speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(text);
            u.lang = "ko-KR";
            u.rate = 0.95;
            global.speechSynthesis.speak(u);
        } catch (e) {}
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
            speakWarning(text);
            var left = 5;
            if (timerEl) timerEl.textContent = left + "초 후 닫힙니다.";
            var iv = setInterval(function () {
                left -= 1;
                if (left <= 0) {
                    clearInterval(iv);
                    modal.hidden = true;
                    if (global.speechSynthesis) global.speechSynthesis.cancel();
                    resolve();
                    return;
                }
                if (timerEl) timerEl.textContent = left + "초 후 닫힙니다.";
            }, 1000);
        });
    }

    function goAfterLogin(ok) {
        var Auth = global.THEJHON_AUTH;
        var next = Auth.safeNextPath(params.get("next"));
        var role = ok && ok.role;

        function navigate() {
            global.location.href = next;
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
        if (THEJHON_AUTH.applyNavRegisterVisibility) {
            THEJHON_AUTH.applyNavRegisterVisibility();
        }
    }

    function initLoginForm() {
        var Auth = global.THEJHON_AUTH;
        if (!Auth) return;

        if (Auth.isLoggedIn && Auth.isLoggedIn()) {
            global.location.replace(Auth.safeNextPath(params.get("next")));
            return;
        }

        var form = $("loginForm");
        if (!form) return;

        var userIdInput = $("userId");
        if (userIdInput && Auth.getSavedLoginIdHint) {
            var savedId = Auth.getSavedLoginIdHint();
            if (savedId) userIdInput.value = savedId;
        }

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
                    alert(
                        (err && err.message) ||
                            "아이디 또는 비밀번호가 올바르지 않습니다. 업체등록 시 입력한 비밀번호(8~16자)를 확인해 주세요."
                    );
                });
        });
    }

    function boot() {
        initHeaderDate();
        initLogout();
        initLoginForm();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})(typeof window !== "undefined" ? window : this);
