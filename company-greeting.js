(function (global) {
  /**
   * 회사소개 인사말 — 반드시 로그인 후 이용 (게스트·업체·관리자·슈퍼바이저)
   * - 게스트: 더존(thejohn) staff DB — GET /api/auth/public-footer-staff (소스 하드코딩 없음)
   * - 관리자·슈퍼바이저: 본인 staff DB (st_company_greeting)
   * - 업체: 등록 담당 관리자 staff DB (nav.js → GET /api/auth/staff-profile)
   *
   * 인사문 상단 회사 표기 — (은/는) 조사: 더존→은, …상사→는, 우일푸드→는
   */
  var COMPANY_GREETING_SUBJECT = "(주)더존";
  var guestIntroLoadPending = false;

  /** 이 문자열을 포함하면 조사를 무조건 '는'으로 (예: 우일푸드) */
  var SUBJECT_FORCE_NEUN = ["우일푸드"];

  function stripTrailingTopicParticle(str) {
    if (!str || str.length === 0) return "";
    if (str.endsWith("은") || str.endsWith("는")) {
      return str.slice(0, -1);
    }
    return str;
  }

  function josaEunNeun(str) {
    if (!str || str.length === 0) return "는";
    for (var f = 0; f < SUBJECT_FORCE_NEUN.length; f++) {
      if (str.indexOf(SUBJECT_FORCE_NEUN[f]) !== -1) return "는";
    }
    var ch = str.charAt(str.length - 1);
    var code = ch.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return "는";
    var jong = (code - 0xac00) % 28;
    return jong === 0 ? "는" : "은";
  }

  function matchesWooilFood(company) {
    return String(company || "").indexOf("우일푸드") !== -1;
  }

  var AEK_LOGIN_ID = "ak20140516";

  function normalizeCompanyKey(company) {
    return String(company || "")
      .replace(/\s+/g, "")
      .replace(/\(주\)/gi, "")
      .toLowerCase();
  }

  function staffCompanyName(st) {
    if (!st) return "";
    return String(st.st_company || st.companyName || "").trim();
  }

  function matchesAkSangsaByLoginId(loginId) {
    return (
      String(loginId || "")
        .trim()
        .toLowerCase() === AEK_LOGIN_ID
    );
  }

  function matchesAkSangsaByCompany(company) {
    var c = normalizeCompanyKey(company);
    if (!c) return false;
    return c.indexOf("에이케이") !== -1 || c.indexOf("에이메이") !== -1;
  }

  /** (주)에이케이상사 — 회사명 또는 AK20140516 등 관리자 로그인 */
  function matchesAkSangsa(stOrCompany, loginId) {
    if (stOrCompany && typeof stOrCompany === "object") {
      if (matchesAkSangsaByCompany(staffCompanyName(stOrCompany))) return true;
      if (matchesAkSangsaByLoginId(stOrCompany.loginId || stOrCompany.id)) return true;
      return false;
    }
    if (matchesAkSangsaByCompany(stOrCompany)) return true;
    return matchesAkSangsaByLoginId(loginId);
  }

  var AEK_GALLERY_COUNT = 12;
  var AEK_GALLERY_BASE = "img/company-intro/aek/";

  function introImagesFromStaff(st) {
    if (!st || !Array.isArray(st.st_company_intro_images)) return [];
    var out = [];
    for (var i = 0; i < st.st_company_intro_images.length; i++) {
      var src = String(st.st_company_intro_images[i] || "").trim();
      if (src) out.push(src);
    }
    return out;
  }

  function greetingFromStaff(st) {
    return st ? String(st.st_company_greeting || "").trim() : "";
  }

  function akGallerySection() {
    return document.getElementById("companyIntroGalleryAek");
  }

  function dbGallerySection() {
    return document.getElementById("companyIntroGalleryDb");
  }

  function bindIntroGalleryScroll(track, pageEl, total) {
    if (!track || track.dataset.scrollBound) return;
    track.dataset.scrollBound = "1";
    function updatePage() {
      if (!pageEl) return;
      var w = track.clientWidth || 1;
      var idx = Math.round(track.scrollLeft / w) + 1;
      if (idx < 1) idx = 1;
      if (idx > total) idx = total;
      pageEl.textContent = idx + " / " + total;
    }
    track.addEventListener("scroll", updatePage, { passive: true });
    updatePage();
  }

  function setIntroGalleryLayout(section, stack) {
    if (!section) return;
    section.classList.toggle("company-intro-gallery--stack", !!stack);
    var pageEl = section.querySelector(".company-intro-gallery-page");
    if (pageEl) pageEl.hidden = !!stack;
  }

  function buildIntroGalleryTrack(track, images, pageEl, section, stack) {
    if (!track || !images || !images.length) return 0;
    var count = images.length;
    var useStack = stack !== false;
    track.dataset.built = "1";
    track.dataset.count = String(count);
    track.dataset.layout = useStack ? "stack" : "slide";
    var html = "";
    for (var n = 0; n < count; n++) {
      html +=
        '<figure class="company-intro-gallery__slide" role="listitem">' +
        '<img src="' +
        images[n] +
        '" alt="회사소개 ' +
        (n + 1) +
        '번" width="800" loading="' +
        (n === 0 ? "eager" : "lazy") +
        '">' +
        "</figure>";
    }
    track.innerHTML = html;
    if (section) setIntroGalleryLayout(section, useStack);
    if (useStack) {
      if (pageEl) pageEl.textContent = "";
    } else {
      bindIntroGalleryScroll(track, pageEl, count);
      track.scrollLeft = 0;
      if (pageEl) pageEl.textContent = "1 / " + count;
    }
    if (section) section.hidden = false;
    return count;
  }

  function buildAkGallery() {
    var section = akGallerySection();
    var track = document.getElementById("companyIntroGalleryAekTrack");
    if (!section || !track || track.dataset.built) return;
    var images = [];
    for (var n = 1; n <= AEK_GALLERY_COUNT; n++) {
      images.push(AEK_GALLERY_BASE + n + ".png");
    }
    buildIntroGalleryTrack(
      track,
      images,
      document.getElementById("companyIntroGalleryAekPage"),
      section,
      true
    );
  }

  function buildDbIntroGallery(images) {
    var section = dbGallerySection();
    var track = document.getElementById("companyIntroGalleryDbTrack");
    if (!section || !track || !images || !images.length) return;
    track.dataset.built = "";
    buildIntroGalleryTrack(
      track,
      images,
      document.getElementById("companyIntroGalleryDbPage"),
      section,
      true
    );
  }

  function setAkGalleryVisible(show) {
    var section = akGallerySection();
    if (!section) return;
    if (!show) {
      section.hidden = true;
      return;
    }
    buildAkGallery();
    section.hidden = false;
    var track = document.getElementById("companyIntroGalleryAekTrack");
    if (track) {
      track.scrollLeft = 0;
      var pageEl = document.getElementById("companyIntroGalleryAekPage");
      if (pageEl) pageEl.textContent = "1 / " + AEK_GALLERY_COUNT;
    }
  }

  function setDbIntroGalleryVisible(show) {
    var section = dbGallerySection();
    if (!section) return;
    section.hidden = !show;
  }

  function greetingBodyEl() {
    return document.querySelector(".company-greeting-body");
  }

  function splitGreetingChunks(greetingText) {
    return String(greetingText || "")
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function renderGreetingChunks(chunks) {
    var body = greetingBodyEl();
    if (!body) return;
    var list = chunks || [];
    body.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var chunk = String(list[i] || "").trim();
      if (!chunk) continue;
      var p = document.createElement("p");
      if (chunk.indexOf("<") !== -1) {
        p.innerHTML = chunk;
      } else {
        p.textContent = chunk;
      }
      body.appendChild(p);
    }
  }

  function philosophySection() {
    return document.getElementById("companyPhilosophyWooil");
  }

  function setWooilPhilosophyVisible(show, company) {
    var section = philosophySection();
    if (!section) return;
    if (!show) {
      section.hidden = true;
      return;
    }
    var name = String(company || "(주)우일푸드").trim();
    var ga = section.querySelector("[data-co-ga]");
    var neun = section.querySelector("[data-co-neun]");
    var wa = section.querySelector("[data-co-wa]");
    if (ga) ga.textContent = name + "가";
    if (neun) neun.textContent = name + "는";
    if (wa) wa.textContent = name + "와";
    section.hidden = false;
  }

  function applyGreetingFromDb(greetingText) {
    renderGreetingChunks(splitGreetingChunks(greetingText));
  }

  function applyDefaultGreeting(subject) {
    var name = stripTrailingTopicParticle(subject || COMPANY_GREETING_SUBJECT);
    var eu = josaEunNeun(name);
    renderGreetingChunks([
      "안녕하십니까.",
      name +
        eu +
        " 전국 장례식장 식자재 공급 전문기업으로, 변화하는 장례식장 음식문화에 맞춰 더욱 전문적이고 체계적인 공급시스템을 구축해 운영하고 있는 중견기업입니다.",
      name +
        eu +
        " 정육, 건어물, 냉동식품, 냉동수산물, 공산품, 음료수 등 각 품목별 소사장 책임운영 체계를 도입하여, 보다 전문적이고 신속한 공급이 가능하도록 운영하고 있습니다.",
      "각 분야 담당자가 직접 품질과 납품을 책임지는 시스템을 통해 안정적인 물류와 높은 상품 경쟁력을 제공해 드리고 있는 것이 " +
        name +
        "만의 차별화된 운영 시스템입니다.",
      "따라서 " +
        name +
        eu +
        " 철저한 품질관리와 책임 있는 운영, 그리고 적극적인 현장 대응으로 장례식장의 든든한 파트너가 되는 것이 " +
        name +
        '의 "사명"입니다.',
      '앞으로 고객의 입장에서 먼저 고민하며 함께 성장하는 기업으로 &quot;최선&quot;을 다하겠습니다.<br>감사합니다.'
    ]);
  }

  function applyWooilFoodGreetingText(company) {
    var name = String(company || "(주)우일푸드").trim();
    renderGreetingChunks([
      "반갑습니다.",
      name + "에 오신 것을 환영합니다.",
      name +
        "는 성실과 노력으로 성장하는 기틀을 두고 있는 식자재 전문 납품기업입니다. " +
        name +
        "는 동북아시아의 중심 인천에 자리잡고 있으며 신선한 식자재 전문 납품기업으로 설립하여 기업의 경영이익이 이윤을 찾기보다는 신선하고 품질 좋은 식재료로서 최선을 다하는 자세로 임하겠습니다.",
      "본사는 위와 같은 설립취지의 마음으로 향후 국내 최고의 식자재 전문 유통기업으로서 책임과 의무를 다하겠습니다."
    ]);
  }

  function applyWooilFoodGreeting(company) {
    setAkGalleryVisible(false);
    setDbIntroGalleryVisible(false);
    applyWooilFoodGreetingText(company);
    setWooilPhilosophyVisible(true, company);
  }

  function applyAkSangsaIntro(company) {
    var name = String(company || "(주)에이케이상사").trim() || "(주)에이케이상사";
    setWooilPhilosophyVisible(false);
    setDbIntroGalleryVisible(false);
    setAkGalleryVisible(true);
    applyDefaultGreeting(name);
  }

  function applyForStaff(st) {
    if (!st) return false;
    var company = staffCompanyName(st);
    var greetingDb = greetingFromStaff(st);
    var introImages = introImagesFromStaff(st);

    setWooilPhilosophyVisible(false);
    setAkGalleryVisible(false);
    setDbIntroGalleryVisible(false);

    if (greetingDb) {
      applyGreetingFromDb(greetingDb);
    } else if (matchesWooilFood(company)) {
      applyWooilFoodGreetingText(company);
    } else if (matchesAkSangsa(st)) {
      applyDefaultGreeting(company || "(주)에이케이상사");
    } else if (!company) {
      return false;
    } else {
      applyDefaultGreeting(company);
    }

    if (matchesWooilFood(company)) {
      if (introImages.length) {
        buildDbIntroGallery(introImages);
        setDbIntroGalleryVisible(true);
      } else {
        setWooilPhilosophyVisible(true, company);
      }
    } else if (introImages.length) {
      buildDbIntroGallery(introImages);
      setDbIntroGalleryVisible(true);
    } else if (matchesAkSangsa(st)) {
      setAkGalleryVisible(true);
    }

    return true;
  }

  function getGreetingRole() {
    var Auth = global.THEJHON_AUTH;
    if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn()) return "";
    return String(Auth.getRole ? Auth.getRole() : "").trim();
  }

  /** 관리자·슈퍼바이저·업체 — staff DB 인사말 (게스트 제외) */
  function usesStaffDbGreeting(role) {
    return role === "admin" || role === "supervisor" || role === "vendor";
  }

  /** 게스트 — 더존(thejohn) staff DB만 사용, 소스 인사말 없음 */
  function applyForGuestStaff(st) {
    if (!st) return false;
    setWooilPhilosophyVisible(false);
    setAkGalleryVisible(false);
    setDbIntroGalleryVisible(false);
    var greetingDb = greetingFromStaff(st);
    if (!greetingDb) return false;
    applyGreetingFromDb(greetingDb);
    var introImages = introImagesFromStaff(st);
    if (introImages.length) {
      buildDbIntroGallery(introImages);
      setDbIntroGalleryVisible(true);
    }
    var sign = document.querySelector(".company-greeting-sign");
    if (sign && st.st_ceo) {
      sign.textContent = "대표 " + st.st_ceo;
    }
    var orgRoot = document.querySelector(".company-org-root");
    if (orgRoot && st.st_company) {
      orgRoot.textContent = st.st_company;
    }
    return true;
  }

  function loadGuestCompanyIntroFromDb() {
    var Api = global.THEJHON_API;
    if (!Api || !Api.getPublicFooterStaff) return;
    if (guestIntroLoadPending) return;
    guestIntroLoadPending = true;
    Api.getPublicFooterStaff()
      .then(function (st) {
        guestIntroLoadPending = false;
        applyForGuestStaff(st);
      })
      .catch(function () {
        guestIntroLoadPending = false;
      });
  }

  function run() {
    var role = getGreetingRole();
    if (usesStaffDbGreeting(role)) return;
    loadGuestCompanyIntroFromDb();
  }

  global.THEJHON_COMPANY_GREETING = {
    applyForStaff: applyForStaff,
    applyForGuestStaff: applyForGuestStaff,
    loadGuestCompanyIntroFromDb: loadGuestCompanyIntroFromDb,
    applyDefaultGreeting: applyDefaultGreeting,
    applyWooilFoodGreeting: applyWooilFoodGreeting,
    applyAkSangsaIntro: applyAkSangsaIntro,
    matchesWooilFood: matchesWooilFood,
    matchesAkSangsa: matchesAkSangsa,
    setWooilPhilosophyVisible: setWooilPhilosophyVisible,
    setAkGalleryVisible: setAkGalleryVisible,
    setDbIntroGalleryVisible: setDbIntroGalleryVisible,
    buildDbIntroGallery: buildDbIntroGallery,
    applyGreetingFromDb: applyGreetingFromDb
  };

  global.__thejhonRefreshCompanyGreeting = function (st) {
    var role = getGreetingRole();
    if (usesStaffDbGreeting(role)) {
      if (st && applyForStaff(st)) return;
      return;
    }
    if (st) {
      applyForGuestStaff(st);
      return;
    }
    loadGuestCompanyIntroFromDb();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})(typeof window !== "undefined" ? window : this);
