(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");
    var videoEl = document.getElementById("whHubVideo");
    var musicEl = document.getElementById("whHubMusic");
    var musicBtn = document.getElementById("whMusicToggle");
    var musicLabel = document.getElementById("whMusicToggleLabel");
    var musicStarted = false;

    function initHubMedia() {
        if (videoEl) {
            videoEl.muted = true;
            var playVideo = function () {
                var p = videoEl.play();
                if (p && typeof p.catch === "function") p.catch(function () {});
            };
            if (videoEl.readyState >= 2) playVideo();
            else videoEl.addEventListener("loadeddata", playVideo, { once: true });
        }

        if (!musicEl || !musicBtn) return;

        function setMusicUi(playing) {
            musicBtn.setAttribute("aria-pressed", playing ? "true" : "false");
            musicBtn.setAttribute("aria-label", playing ? "배경음악 끄기" : "배경음악 켜기");
            if (musicLabel) {
                musicLabel.textContent = playing ? "배경음악 끄기" : "배경음악 켜기";
            }
        }

        function tryPlayMusic() {
            musicEl.volume = 0.45;
            return musicEl.play().then(function () {
                musicStarted = true;
                setMusicUi(true);
            });
        }

        function pauseMusic() {
            musicEl.pause();
            setMusicUi(false);
        }

        musicBtn.addEventListener("click", function () {
            if (musicEl.paused) {
                tryPlayMusic().catch(function () {
                    setMusicUi(false);
                });
            } else {
                pauseMusic();
            }
        });

        function startMusicOnce() {
            if (musicStarted || !musicEl.paused) return;
            tryPlayMusic().catch(function () {});
        }

        document.addEventListener(
            "pointerdown",
            function onFirstInteract() {
                startMusicOnce();
                document.removeEventListener("pointerdown", onFirstInteract);
            },
            { once: true, passive: true }
        );

        tryPlayMusic().catch(function () {
            setMusicUi(false);
        });
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    var NAV_MODE_BY_MENU = {
        "view-home": "public",
        "manage-home": "manage-home",
        "product-manage": "manage-home",
        "vendor-manage": "manage-home",
        "order-manage": "order",
        "work-manage": "work"
    };

    function applyMenus() {
        if (!Auth || !Auth.canAccessWorkHubMenu) return;
        var cards = document.querySelectorAll("[data-wh-menu]");
        cards.forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var allowed = Auth.canAccessWorkHubMenu(key);
            card.hidden = !allowed;
            if (!allowed) {
                card.setAttribute("aria-hidden", "true");
                card.setAttribute("tabindex", "-1");
                card.addEventListener("click", function (e) {
                    e.preventDefault();
                });
                return;
            }
            card.removeAttribute("aria-hidden");
            card.removeAttribute("tabindex");
            if (key === "order-manage" && Auth.getWorkHubOrderManageHref) {
                card.setAttribute("href", Auth.getWorkHubOrderManageHref());
            }
            var navMode = NAV_MODE_BY_MENU[key];
            if (navMode) {
                card.addEventListener("click", function () {
                    if (Auth.setStaffNavMode) Auth.setStaffNavMode(navMode);
                });
            }
        });
    }

    if (!Auth || !Auth.getWorkHubAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

    var access = Auth.getWorkHubAccess();
    if (!access.allowed) {
        setStatus(access.reason || "이용할 수 없습니다.", "err");
        return;
    }

    applyMenus();
    initHubMedia();
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("hub");

    if (Auth.refreshSessionPermissionsAsync) {
        Auth.refreshSessionPermissionsAsync().then(function () {
            applyMenus();
        });
    }

    try {
        window.addEventListener("thejhon-auth-permissions-updated", applyMenus);
    } catch (e) {}
})();
