(function (global) {
  /**
   * 인사문 상단에 쓰이는 회사 표기 한 곳만 바꾸면 (은/는)이 맞춰집니다.
   * 예: 더존→은, …상사→는, 우일푸드 포함 상호→는(사이트 표기 통일 예외).
   */
  var COMPANY_GREETING_SUBJECT = "(주)더존";

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

  function akGallerySection() {
    return document.getElementById("companyIntroGalleryAek");
  }

  function bindAkGalleryScroll(track, pageEl) {
    if (!track || track.dataset.scrollBound) return;
    track.dataset.scrollBound = "1";
    function updatePage() {
      if (!pageEl) return;
      var w = track.clientWidth || 1;
      var idx = Math.round(track.scrollLeft / w) + 1;
      if (idx < 1) idx = 1;
      if (idx > AEK_GALLERY_COUNT) idx = AEK_GALLERY_COUNT;
      pageEl.textContent = idx + " / " + AEK_GALLERY_COUNT;
    }
    track.addEventListener("scroll", updatePage, { passive: true });
    updatePage();
  }

  function buildAkGallery() {
    var section = akGallerySection();
    var track = document.getElementById("companyIntroGalleryAekTrack");
    if (!section || !track || track.dataset.built) return;
    track.dataset.built = "1";
    var html = "";
    for (var n = 1; n <= AEK_GALLERY_COUNT; n++) {
      html +=
        '<figure class="company-intro-gallery__slide" role="listitem">' +
        '<img src="' +
        AEK_GALLERY_BASE +
        n +
        '.png" alt="회사소개 ' +
        n +
        '번" width="800" height="600" loading="' +
        (n === 1 ? "eager" : "lazy") +
        '">' +
        "</figure>";
    }
    track.innerHTML = html;
    bindAkGalleryScroll(track, document.getElementById("companyIntroGalleryAekPage"));
    track.scrollLeft = 0;
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

  function greetingParas() {
    var body = document.querySelector(".company-greeting-body");
    if (!body) return null;
    return body.querySelectorAll("p");
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

  function fillDefaultGreetingContent(subject) {
    var name = stripTrailingTopicParticle(subject || COMPANY_GREETING_SUBJECT);
    var eu = josaEunNeun(name);
    var paras = greetingParas();
    if (!paras || paras.length < 6) return;

    paras[0].textContent = "안녕하십니까.";
    paras[1].textContent =
      name +
      eu +
      " 전국 장례식장 식자재 공급 전문기업으로, 변화하는 장례식장 음식문화에 맞춰 더욱 전문적이고 체계적인 공급시스템을 구축해 운영하고 있는 중견기업입니다.";
    paras[2].textContent =
      name +
      eu +
      " 정육, 건어물, 냉동식품, 냉동수산물, 공산품, 음료수 등 각 품목별 소사장 책임운영 체계를 도입하여, 보다 전문적이고 신속한 공급이 가능하도록 운영하고 있습니다.";
    paras[3].textContent =
      "각 분야 담당자가 직접 품질과 납품을 책임지는 시스템을 통해 안정적인 물류와 높은 상품 경쟁력을 제공해 드리고 있는 것이 " +
      name +
      "만의 차별화된 운영 시스템입니다.";
    paras[4].textContent =
      "따라서 " +
      name +
      eu +
      " 철저한 품질관리와 책임 있는 운영, 그리고 적극적인 현장 대응으로 장례식장의 든든한 파트너가 되는 것이 " +
      name +
      '의 "사명"입니다.';
    paras[5].hidden = false;
    paras[5].innerHTML =
      '앞으로 고객의 입장에서 먼저 고민하며 함께 성장하는 기업으로 &quot;최선&quot;을 다하겠습니다.<br>감사합니다.';
    for (var i = 0; i < paras.length; i++) {
      delete paras[i].dataset.companyGreetingTpl;
    }
  }

  function applyDefaultGreeting(subject) {
    setWooilPhilosophyVisible(false);
    setAkGalleryVisible(false);
    fillDefaultGreetingContent(subject);
  }

  function applyWooilFoodGreeting(company) {
    var name = String(company || "(주)우일푸드").trim();
    setAkGalleryVisible(false);
    setWooilPhilosophyVisible(true, name);
    var paras = greetingParas();
    if (!paras || paras.length < 6) return;

    paras[0].textContent = "반갑습니다.";
    paras[1].textContent = name + "에 오신 것을 환영합니다.";
    paras[2].textContent =
      name +
      "는 성실과 노력으로 성장하는 기틀을 두고 있는 식자재 전문 납품기업입니다. " +
      name +
      "는 동북아시아의 중심 인천에 자리잡고 있으며 신선한 식자재 전문 납품기업으로 설립하여 기업의 경영이익이 이윤을 찾기보다는 신선하고 품질 좋은 식재료로서 최선을 다하는 자세로 임하겠습니다.";
    paras[3].textContent =
      "본사는 위와 같은 설립취지의 마음으로 향후 국내 최고의 식자재 전문 유통기업으로서 책임과 의무를 다하겠습니다.";
    paras[4].textContent = "";
    paras[4].hidden = true;
    paras[5].hidden = true;
    for (var i = 0; i < paras.length; i++) {
      delete paras[i].dataset.companyGreetingTpl;
    }
  }

  function applyAkSangsaIntro(company) {
    var name = String(company || "(주)에이케이상사").trim() || "(주)에이케이상사";
    setWooilPhilosophyVisible(false);
    fillDefaultGreetingContent(name);
    setAkGalleryVisible(true);
  }

  function applyForStaff(st) {
    if (!st) return false;
    var company = staffCompanyName(st);
    var loginId = st.loginId || st.id || "";
    if (matchesWooilFood(company)) {
      applyWooilFoodGreeting(company);
      return true;
    }
    if (matchesAkSangsa(st)) {
      applyAkSangsaIntro(company || "(주)에이케이상사");
      return true;
    }
    if (!company) return false;
    applyDefaultGreeting(company);
    return true;
  }

  function run() {
    var Auth = global.THEJHON_AUTH;
    if (Auth && Auth.isLoggedIn && Auth.isLoggedIn()) {
      var userId = Auth.getUserId && Auth.getUserId();
      var cached =
        Auth.getLoggedInCompanyDisplayName && Auth.getLoggedInCompanyDisplayName();
      if (cached && matchesWooilFood(cached)) {
        applyWooilFoodGreeting(cached);
        return;
      }
      if (matchesAkSangsa(cached, userId)) {
        applyAkSangsaIntro(
          matchesAkSangsaByCompany(cached) ? cached : "(주)에이케이상사"
        );
        return;
      }
    }
    setWooilPhilosophyVisible(false);
    setAkGalleryVisible(false);
    applyDefaultGreeting(COMPANY_GREETING_SUBJECT);
  }

  global.THEJHON_COMPANY_GREETING = {
    applyForStaff: applyForStaff,
    applyDefaultGreeting: applyDefaultGreeting,
    applyWooilFoodGreeting: applyWooilFoodGreeting,
    applyAkSangsaIntro: applyAkSangsaIntro,
    matchesWooilFood: matchesWooilFood,
    matchesAkSangsa: matchesAkSangsa,
    setWooilPhilosophyVisible: setWooilPhilosophyVisible,
    setAkGalleryVisible: setAkGalleryVisible
  };

  global.__thejhonRefreshCompanyGreeting = function (st) {
    if (st && applyForStaff(st)) return;
    run();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})(typeof window !== "undefined" ? window : this);
