/**
 * 홈·그룹 마케팅 관리 허브 — 인트로 영상 자동재생 + 배경음악(탭·토글)
 */
(function (global) {
    function initHomeIntroMedia(options) {
        options = options || {};
        var video = document.querySelector(options.videoSelector || ".home-intro-video");
        if (video) {
            video.muted = true;
            var playbackRate =
                typeof options.videoPlaybackRate === "number" &&
                isFinite(options.videoPlaybackRate) &&
                options.videoPlaybackRate > 0
                    ? options.videoPlaybackRate
                    : 1;

            function applyVideoPlaybackRate() {
                try {
                    video.playbackRate = playbackRate;
                } catch (e) {}
            }

            applyVideoPlaybackRate();
            video.addEventListener("loadedmetadata", applyVideoPlaybackRate);

            var playV = function () {
                applyVideoPlaybackRate();
                var p = video.play();
                if (p && p.catch) p.catch(function () {});
            };
            playV();
            document.addEventListener("visibilitychange", function () {
                if (!document.hidden) playV();
            });
        }

        var bgm = document.getElementById(options.bgmId || "homeBgm");
        var bgmBtn = document.getElementById(options.bgmBtnId || "homeBgmToggle");
        var bgmHint = document.getElementById(options.bgmHintId || "homeBgmHint");
        var introRoot = document.querySelector(options.introSelector || ".home-intro");
        if (!bgm || !bgmBtn) return;

        var bgmReady = false;
        var bgmOn = false;
        var userWantsBgm = !!options.autoplayBgm;
        var unlockBound = false;
        var iconOn = bgmBtn.querySelector(".home-bgm-icon-on");
        var iconOff = bgmBtn.querySelector(".home-bgm-icon-off");
        var volume =
            typeof options.volume === "number" && isFinite(options.volume)
                ? options.volume
                : 0.28;
        var defaultHint =
            (bgmHint && bgmHint.textContent) ||
            "화면을 누르거나 아이콘으로 배경음악";

        function setBgmUi() {
            bgmBtn.hidden = false;
            bgmBtn.setAttribute("aria-label", bgmOn ? "배경음악 끄기" : "배경음악 켜기");
            bgmBtn.title = bgmOn ? "배경음악 끄기" : "배경음악 켜기";
            if (iconOn) iconOn.hidden = !bgmOn;
            if (iconOff) iconOff.hidden = bgmOn;
            if (bgmHint) {
                if (bgmOn) {
                    bgmHint.hidden = true;
                } else if (!bgmReady && options.prominentBgmHint) {
                    bgmHint.textContent = defaultHint;
                    bgmHint.hidden = false;
                } else {
                    bgmHint.hidden = !bgmReady;
                }
            }
        }

        function showBgmError(msg) {
            if (bgmHint) {
                bgmHint.textContent = msg || "배경음악을 불러오지 못했습니다.";
                bgmHint.hidden = false;
            }
            setBgmUi();
        }

        function markBgmReady() {
            if (bgmReady) return;
            bgmReady = true;
            setBgmUi();
            if (userWantsBgm && !bgmOn) {
                playBgm(true);
            }
        }

        function playBgm(force) {
            if (force) userWantsBgm = true;
            if (!bgmReady && !force) return;
            bgm.volume = volume;
            try {
                var p = bgm.play();
                if (p && typeof p.then === "function") {
                    return p
                        .then(function () {
                            bgmOn = true;
                            bgmReady = true;
                            setBgmUi();
                        })
                        .catch(function () {
                            setBgmUi();
                        });
                }
                bgmOn = !bgm.paused;
                setBgmUi();
            } catch (e) {
                showBgmError("배경음악을 재생할 수 없습니다.");
            }
        }

        function pauseBgm() {
            bgm.pause();
            bgmOn = false;
            userWantsBgm = false;
            setBgmUi();
        }

        function toggleBgm() {
            if (bgmOn) pauseBgm();
            else playBgm(true);
        }

        function tryLoadBgm() {
            try {
                bgm.load();
            } catch (e) {}
        }

        bgm.volume = volume;
        bgmBtn.hidden = false;

        bgm.addEventListener("loadeddata", markBgmReady);
        bgm.addEventListener("canplay", markBgmReady);
        bgm.addEventListener("canplaythrough", markBgmReady);
        bgm.addEventListener("error", function () {
            bgmReady = false;
            showBgmError("배경음악 파일을 불러오지 못했습니다.");
        });

        if (bgm.readyState >= 2) markBgmReady();
        else tryLoadBgm();

        bgmBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!bgmReady) tryLoadBgm();
            toggleBgm();
        });

        if (introRoot && !options.bgmButtonOnly) {
            introRoot.addEventListener(
                "click",
                function (e) {
                    if (e.target.closest(".home-bgm-wrap")) return;
                    if (e.target.closest("a.wh-hub-card, a.company-division-card")) return;
                    if (bgmOn) return;
                    playBgm(true);
                },
                true
            );
        }

        function bindUnlockOnce() {
            if (unlockBound) return;
            unlockBound = true;
            function onActivate() {
                if (!bgmOn) playBgm(true);
            }
            document.addEventListener("click", onActivate, { once: true, capture: true });
            document.addEventListener("touchstart", onActivate, {
                once: true,
                capture: true,
                passive: false
            });
        }

        if (options.unlockOnAnyClick === true) {
            bindUnlockOnce();
        }

        if (options.prominentBgmHint && bgmHint) {
            bgmHint.textContent = defaultHint;
            bgmHint.hidden = false;
        }

        setBgmUi();
    }

    global.THEJHON_HOME_INTRO_MEDIA = {
        init: initHomeIntroMedia
    };
})(typeof window !== "undefined" ? window : this);
