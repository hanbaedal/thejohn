/**
 * 우편번호·주소·상세주소 — 다음(카카오) 우편번호 서비스 검색
 */
(function (global) {
    var DAUM_SCRIPT = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    var scriptPromise = null;

    function str(v) {
        return String(v ?? "").trim();
    }

    function formatFullAddress(zip, addr, detail) {
        var parts = [];
        var z = str(zip);
        var a = str(addr);
        var d = str(detail);
        if (z) parts.push(z);
        if (a) parts.push(a);
        if (d) parts.push(d);
        return parts.join(" ");
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function loadDaumPostcode() {
        if (global.daum && global.daum.Postcode) return Promise.resolve();
        if (scriptPromise) return scriptPromise;
        scriptPromise = new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = DAUM_SCRIPT;
            s.async = true;
            s.onload = function () {
                resolve();
            };
            s.onerror = function () {
                scriptPromise = null;
                reject(new Error("우편번호 검색 서비스를 불러오지 못했습니다."));
            };
            (document.head || document.documentElement).appendChild(s);
        });
        return scriptPromise;
    }

    function openPostcodeSearch(onComplete) {
        return loadDaumPostcode().then(function () {
            new global.daum.Postcode({
                oncomplete: function (data) {
                    var addr =
                        str(data.roadAddress) ||
                        str(data.jibunAddress) ||
                        str(data.autoRoadAddress) ||
                        str(data.autoJibunAddress) ||
                        str(data.address);
                    onComplete({
                        zip: str(data.zonecode),
                        addr: addr
                    });
                }
            }).open();
        });
    }

    /**
     * @param {HTMLElement} container
     * @param {{ idPrefix?: string, zipName?: string, addrName?: string, detailName?: string, label?: string }} opts
     */
    function mount(container, opts) {
        opts = opts || {};
        if (!container) return null;

        var idPrefix = opts.idPrefix || "";
        var zipName = opts.zipName || "st_zip";
        var addrName = opts.addrName || "st_addr";
        var detailName = opts.detailName || "st_addr_detail";
        var sectionLabel = opts.label || "주소";

        var zipId = idPrefix + "zip";
        var addrId = idPrefix + "addr";
        var detailId = idPrefix + "detail";
        var searchId = idPrefix + "addr-search";

        container.innerHTML =
            '<div class="tj-addr-fields" data-tj-addr-fields>' +
            (sectionLabel
                ? '<p class="sm-section-label tj-addr-section-label">' + escapeHtml(sectionLabel) + "</p>"
                : "") +
            '<div class="tj-addr-row tj-addr-row--zip">' +
            '<label for="' +
            escapeHtml(zipId) +
            '">우편번호</label>' +
            '<input type="text" class="tj-addr-zip" id="' +
            escapeHtml(zipId) +
            '" name="' +
            escapeHtml(zipName) +
            '" inputmode="numeric" maxlength="10" readonly autocomplete="postal-code" placeholder="00000">' +
            '<button type="button" class="btn btn-secondary tj-addr-search" id="' +
            escapeHtml(searchId) +
            '">주소 검색</button>' +
            "</div>" +
            '<div class="tj-addr-row">' +
            '<label for="' +
            escapeHtml(addrId) +
            '">주소</label>' +
            '<input type="text" class="tj-addr-road" id="' +
            escapeHtml(addrId) +
            '" name="' +
            escapeHtml(addrName) +
            '" maxlength="300" readonly autocomplete="street-address" placeholder="주소 검색으로 입력">' +
            "</div>" +
            '<div class="tj-addr-row">' +
            '<label for="' +
            escapeHtml(detailId) +
            '">상세주소</label>' +
            '<input type="text" class="tj-addr-detail" id="' +
            escapeHtml(detailId) +
            '" name="' +
            escapeHtml(detailName) +
            '" maxlength="200" autocomplete="address-line2" placeholder="동·호수, 층, 건물명 등">' +
            "</div>" +
            '<p class="tj-addr-hint">「주소 검색」으로 우편번호·주소를 입력한 뒤 상세주소를 직접 입력하세요. 우편 발송 스티커용으로 3칸이 분리 저장됩니다.</p>' +
            "</div>";

        var zipEl = container.querySelector(".tj-addr-zip");
        var addrEl = container.querySelector(".tj-addr-road");
        var detailEl = container.querySelector(".tj-addr-detail");
        var searchBtn = container.querySelector(".tj-addr-search");

        if (searchBtn) {
            searchBtn.addEventListener("click", function () {
                searchBtn.disabled = true;
                openPostcodeSearch(function (picked) {
                    if (zipEl) zipEl.value = picked.zip || "";
                    if (addrEl) addrEl.value = picked.addr || "";
                    if (detailEl) detailEl.focus();
                })
                    .catch(function (err) {
                        window.alert((err && err.message) || "주소 검색을 열 수 없습니다.");
                    })
                    .finally(function () {
                        searchBtn.disabled = false;
                    });
            });
        }

        return {
            getValues: function () {
                var zip = zipEl ? zipEl.value.trim() : "";
                var addr = addrEl ? addrEl.value.trim() : "";
                var detail = detailEl ? detailEl.value.trim() : "";
                return {
                    zip: zip,
                    addr: addr,
                    detail: detail,
                    zipName: zipName,
                    addrName: addrName,
                    detailName: detailName,
                    formatted: formatFullAddress(zip, addr, detail)
                };
            },
            setValues: function (v) {
                v = v || {};
                if (zipEl) zipEl.value = str(v.zip || v[zipName] || "");
                if (addrEl) addrEl.value = str(v.addr || v[addrName] || "");
                if (detailEl) detailEl.value = str(v.detail || v[detailName] || "");
            },
            clear: function () {
                if (zipEl) zipEl.value = "";
                if (addrEl) addrEl.value = "";
                if (detailEl) detailEl.value = "";
            },
            validate: function (options) {
                options = options || {};
                var v = this.getValues();
                if (!v.zip || !v.addr) {
                    return options.message || "「주소 검색」으로 우편번호와 주소를 입력해 주세요.";
                }
                return "";
            },
            applyToBody: function (body) {
                var v = this.getValues();
                body[zipName] = v.zip;
                body[addrName] = v.addr;
                body[detailName] = v.detail;
                return body;
            }
        };
    }

    global.THEJHON_ADDRESS_FIELDS = {
        mount: mount,
        formatFullAddress: formatFullAddress,
        openPostcodeSearch: openPostcodeSearch
    };
})(typeof window !== "undefined" ? window : this);
