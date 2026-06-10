/**
 * 회사 소개 관리 — 인사말·소개 이미지 (최대 15장)
 */
(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var form = document.getElementById("sci-form");
    var statusEl = document.getElementById("sci-status");
    var greetingEl = document.getElementById("sci-greeting");
    var greetingCountEl = document.getElementById("sci-greeting-count");
    var wooilHintEl = document.getElementById("sci-greeting-wooil-hint");
    var wooilBlocksHintEl = document.getElementById("sci-wooil-blocks-hint");
    var introImages = [];
    var loadedStaff = null;
    var saveModal = document.getElementById("sci-save-modal");
    var SELF_EDIT_PAGE = "staff-self-edit.html";

    var MAX_GREETING = 540;
    var MAX_INTRO =
        PF && PF.MAX_COMPANY_INTRO_PHOTOS ? PF.MAX_COMPANY_INTRO_PHOTOS : 15;
    var INTRO_PROCESS =
        PF && PF.COMPANY_INTRO_IMAGE_PROCESS_OPTIONS
            ? PF.COMPANY_INTRO_IMAGE_PROCESS_OPTIONS
            : { maxDimension: 800, fit: "inside", maxBytes: 1024 * 1024 };

    var WOOIL_BLOCK_LABELS = ["비전", "경영 방침", "사훈", "경영 이념"];

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "sm-status" +
            (kind === "err" ? " sm-status--err" : kind === "ok" ? " sm-status--ok" : "");
    }

    function isWooilCompany(name) {
        return String(name || "").indexOf("우일푸드") !== -1;
    }

    function updateGreetingCount() {
        if (!greetingEl || !greetingCountEl) return;
        var len = String(greetingEl.value || "").length;
        greetingCountEl.textContent = String(len);
        greetingCountEl.classList.toggle("sci-greeting-count--over", len > MAX_GREETING);
    }

    function updateWooilHints() {
        var wooil = loadedStaff && isWooilCompany(loadedStaff.st_company);
        if (wooilHintEl) wooilHintEl.hidden = !wooil;
        if (wooilBlocksHintEl) wooilBlocksHintEl.hidden = !wooil;
    }

    function decorateIntroSlots() {
        if (!loadedStaff || !isWooilCompany(loadedStaff.st_company)) return;
        var slots = document.querySelectorAll("#sci-intro-slots .pr-photo-slot");
        for (var i = 0; i < slots.length && i < WOOIL_BLOCK_LABELS.length; i++) {
            var label = document.createElement("span");
            label.className = "sci-intro-slot-label";
            label.textContent = WOOIL_BLOCK_LABELS[i];
            slots[i].appendChild(label);
        }
    }

    var introHintLines = [
        "회사소개 페이지 인사말 아래에 표시할 이미지를 최대 " + MAX_INTRO + "장까지 등록할 수 있습니다.",
        "가로·세로 비율은 자유이며, 긴 변 기준 800px로 자동 맞춤 저장됩니다."
    ];

    function setIntroHintEl(el) {
        if (!el) return;
        el.innerHTML = introHintLines
            .map(function (line) {
                return '<span class="pr-photo-hint-line">' + line + "</span>";
            })
            .join("");
    }

    var introGallery =
        PF && PF.initProductPhotoGallery
            ? PF.initProductPhotoGallery({
                  slotsRoot: document.getElementById("sci-intro-slots"),
                  countEl: document.getElementById("sci-intro-count"),
                  btnGallery: document.getElementById("sci-intro-gallery-btn"),
                  btnCamera: document.getElementById("sci-intro-camera-btn"),
                  galleryInput: document.getElementById("sci-intro-gallery"),
                  cameraInput: document.getElementById("sci-intro-camera"),
                  maxPhotos: MAX_INTRO,
                  processOptions: INTRO_PROCESS,
                  onChange: function (images) {
                      introImages = images.slice();
                      decorateIntroSlots();
                      var hintEl = document.getElementById("sci-intro-hint");
                      if (hintEl && images.length >= MAX_INTRO) {
                          hintEl.textContent =
                              "등록된 사진을 삭제한 뒤 다시 선택할 수 있습니다.";
                      } else {
                          setIntroHintEl(hintEl);
                      }
                  },
                  onError: function (err) {
                      setStatus((err && err.message) || "이미지 오류", "err");
                  },
                  onStatus: function (msg) {
                      setStatus(msg, "err");
                  }
              })
            : null;

    setIntroHintEl(document.getElementById("sci-intro-hint"));

    if (greetingEl) {
        greetingEl.addEventListener("input", updateGreetingCount);
    }

    function fillForm(st) {
        loadedStaff = st || null;
        if (greetingEl) {
            greetingEl.value = String(st && st.st_company_greeting ? st.st_company_greeting : "");
        }
        updateGreetingCount();
        updateWooilHints();
        introImages = Array.isArray(st && st.st_company_intro_images)
            ? st.st_company_intro_images.slice()
            : [];
        if (introGallery && introGallery.setImages) {
            introGallery.setImages(introImages);
        }
        decorateIntroSlots();
    }

    function openSaveModal() {
        if (!saveModal) {
            window.location.href = SELF_EDIT_PAGE;
            return;
        }
        saveModal.hidden = false;
        document.body.style.overflow = "hidden";
        if (PF && PF.speakKorean) PF.speakKorean("저장되었습니다");
        var continueBtn = document.getElementById("sci-save-continue");
        if (continueBtn) continueBtn.focus();
    }

    function closeSaveModal() {
        if (!saveModal) return;
        saveModal.hidden = true;
        document.body.style.overflow = "";
    }

    var saveContinueBtn = document.getElementById("sci-save-continue");
    if (saveContinueBtn) {
        saveContinueBtn.addEventListener("click", function () {
            closeSaveModal();
        });
    }

    function loadProfile() {
        if (!api || !api.getStaffProfile) {
            setStatus("API를 불러오지 못했습니다.", "err");
            return;
        }
        setStatus("불러오는 중…");
        api.getStaffProfile()
            .then(function (item) {
                if (!item) {
                    setStatus("관리자 정보를 불러오지 못했습니다.", "err");
                    return;
                }
                fillForm(item);
                setStatus("");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "불러오기 실패", "err");
            });
    }

    if (form) {
        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            if (!api || !api.updateStaffProfile) {
                setStatus("API를 불러오지 못했습니다.", "err");
                return;
            }
            var greeting = greetingEl ? String(greetingEl.value || "").trim() : "";
            if (greeting.length > MAX_GREETING) {
                setStatus("인사말은 " + MAX_GREETING + "자 이하로 입력해 주세요.", "err");
                return;
            }
            setStatus("저장 중…");
            api
                .updateStaffProfile({
                    st_company_greeting: greeting,
                    st_company_intro_images: introImages.slice()
                })
                .then(function () {
                    setStatus("", "");
                    openSaveModal();
                })
                .catch(function (err) {
                    setStatus((err && err.message) || "저장 실패", "err");
                });
        });
    }

    loadProfile();
})();
