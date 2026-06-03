/**
 * 홈·그룹 마케팅 관리 허브 — 인트로 영상 자동재생 + 배경음악(영역 탭·토글)
 */
(function (global) {
    function initHomeIntroMedia(options) {
        options = options || {};
        var video = document.querySelector(options.videoSelector || ".home-intro-video");
        if (video) {
            video.muted = true;
            var playV = function () {
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
        var iconOn = bgmBtn.querySelector(".home-bgm-icon-on");
        var iconOff = bgmBtn.querySelector(".home-bgm-icon-off");
        var volume =
            typeof options.volume === "number" && isFinite(options.volume)
                ? options.volume
                : 0.28;

        function setBgmUi() {
            bgmBtn.setAttribute("aria-label", bgmOn ? "배경음악 끄기" : "배경음악 켜기");
            bgmBtn.title = bgmOn ? "배경음악 끄기" : "배경음악 켜기";
            if (iconOn) iconOn.hidden = !bgmOn;
            if (iconOff) iconOff.hidden = bgmOn;
            if (bgmHint) bgmHint.hidden = bgmOn || !bgmReady;
        }

        function markBgmReady() {
            bgmReady = true;
            bgmBtn.hidden = false;
            setBgmUi();
        }

        function playBgm() {
            if (!bgmReady) return;
            var p = bgm.play();
            if (p && p.then) {
                p.then(function () {
                    bgmOn = true;
                    setBgmUi();
                }).catch(function () {});
            } else {
                bgmOn = true;
                setBgmUi();
            }
        }

        function pauseBgm() {
            bgm.pause();
            bgmOn = false;
            setBgmUi();
        }

        bgm.volume = volume;

        bgm.addEventListener("loadeddata", markBgmReady);
        bgm.addEventListener("canplaythrough", markBgmReady);
        bgm.addEventListener("error", function () {
            bgmReady = false;
            bgmBtn.hidden = true;
            if (bgmHint) {
                bgmHint.textContent = "배경음악을 불러오지 못했습니다.";
                bgmHint.hidden = false;
            }
        });

        if (bgm.readyState >= 2) markBgmReady();

        function toggleBgm() {
            if (!bgmReady) return;
            if (bgmOn) pauseBgm();
            else playBgm();
        }

        bgmBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleBgm();
        });

        if (introRoot) {
            introRoot.addEventListener("click", function (e) {
                if (e.target.closest(".home-bgm-wrap")) return;
                if (!bgmReady || bgmOn) return;
                playBgm();
            });
        }

        setBgmUi();
    }

    global.THEJHON_HOME_INTRO_MEDIA = {
        init: initHomeIntroMedia
    };
})(typeof window !== "undefined" ? window : this);
