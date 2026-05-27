(function () {
  /**
   * 인사문 상단에 쓰이는 회사 표기 한 곳만 바꾸면 (은/는)이 맞춰집니다.
   * 예: 더존→은, …상사→는, 우일푸드→는(사이트 표기 통일; 받침 규칙 예외).
   */
  var COMPANY_GREETING_SUBJECT = "(주)더존";

  /** 이 문자열을 포함하면 조사를 무조건 '는'으로 (예: 우일푸드) */
  var SUBJECT_FORCE_NEUN = ["우일푸드"];

  /** 상호명 끝에 붙은 조사(은/는) 제거 */
  function stripTrailingTopicParticle(str) {
    if (!str || str.length === 0) return "";
    if (str.endsWith("은") || str.endsWith("는")) {
      return str.slice(0, -1);
    }
    return str;
  }

  /** 마지막 한글 글자의 받침 유무로 '은' / '는' (+ SUBJECT_FORCE_NEUN 예외) */
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

  function run() {
    var name = stripTrailingTopicParticle(COMPANY_GREETING_SUBJECT);
    var eu = josaEunNeun(name);

    var p2 = document.getElementById("companyGreetingPara2");
    var p3 = document.getElementById("companyGreetingPara3");
    var p4 = document.getElementById("companyGreetingPara4");
    var p5 = document.getElementById("companyGreetingPara5");
    if (p2) {
      p2.textContent =
        name +
        eu +
        " 전국 장례식장 식자재 공급 전문기업으로, 변화하는 장례식장 음식문화에 맞춰 더욱 전문적이고 체계적인 공급시스템을 구축해 운영하고 있는 중견기업입니다.";
    }
    if (p3) {
      p3.textContent =
        name +
        eu +
        " 정육/건어물, 냉동수산물/공산품, 냉동식품/음료수 등 각 품목별 소사장 책임운영 체계를 도입하여, 보다 전문적이고 신속한 공급이 가능하도록 운영하고 있습니다.";
    }
    if (p4) {
      p4.textContent =
        "각 분야 담당자가 직접 품질과 납품을 책임지는 시스템을 통해 안정적인 물류와 높은 상품 경쟁력을 제공해 드리고 있는 것이 " +
        name +
        "만의 차별화된 운영 시스템입니다.";
    }
    if (p5) {
      p5.textContent =
        "따라서 " +
        name +
        eu +
        " 철저한 품질관리와 책임 있는 운영, 그리고 적극적인 현장 대응으로 장례식장의 든든한 파트너가 되는 것이 " +
        name +
        '의 "사명"입니다.';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
