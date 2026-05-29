(function (g) {
    var MAX_BODY = 256;
    var MAX_PHOTOS = 3;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeMultiline(s) {
        return String(s)
            .split("\n")
            .map(function (line) {
                return escapeHtml(line);
            })
            .join("<br>");
    }

    function formatDateKo(ts) {
        if (!ts) return "";
        try {
            return new Date(ts).toLocaleString("ko-KR", {
                dateStyle: "medium",
                timeStyle: "short"
            });
        } catch (e) {
            return "";
        }
    }

    function deptLabel(deptId) {
        var cat = g.THEJHON_PRODUCT_CATALOG;
        if (!cat || !deptId) return "사업부문 미선택";
        var d = cat.getDept(deptId);
        return d ? d.label : String(deptId);
    }

    function initDeptModalPicker(options) {
        var catalog = options.catalog || g.THEJHON_PRODUCT_CATALOG;
        var displayInput = options.displayInput;
        var hiddenInput = options.hiddenInput;
        var modal = options.modal;
        var modalBtns = options.modalBtns;
        var includeAll = !!options.includeAll;
        var openOnHover = options.openOnHover !== false;
        var onSelect = options.onSelect;

        if (!catalog || !displayInput || !hiddenInput || !modal || !modalBtns) {
            return { getValue: function () { return ""; }, setValue: function () {} };
        }

        function setDisplayText(text) {
            if (displayInput.tagName === "BUTTON") {
                displayInput.textContent = text;
            } else {
                displayInput.value = text;
            }
        }

        function closeModal() {
            modal.hidden = true;
        }

        function openModal() {
            modal.hidden = false;
            var current = catalog.normalizeDept(hiddenInput.value || "");
            modalBtns.querySelectorAll(".sn-dept-opt").forEach(function (btn) {
                var dept = btn.getAttribute("data-dept") || "";
                btn.classList.toggle("is-selected", dept === current);
            });
        }

        function setDept(deptId) {
            var norm = catalog.normalizeDept(deptId || "");
            hiddenInput.value = norm;
            setDisplayText(norm ? deptLabel(norm) : includeAll ? "전체" : "");
            closeModal();
            if (typeof onSelect === "function") onSelect(norm);
        }

        modalBtns.innerHTML = "";
        if (includeAll) {
            var allBtn = document.createElement("button");
            allBtn.type = "button";
            allBtn.className = "sn-dept-opt";
            allBtn.setAttribute("data-dept", "");
            allBtn.textContent = "전체";
            allBtn.addEventListener("click", function () {
                setDept("");
            });
            modalBtns.appendChild(allBtn);
        }
        catalog.DEPARTMENTS.forEach(function (d) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sn-dept-opt";
            btn.setAttribute("data-dept", d.id);
            btn.textContent = d.icon ? d.icon + " " + d.label : d.label;
            btn.addEventListener("click", function () {
                setDept(d.id);
            });
            modalBtns.appendChild(btn);
        });

        displayInput.addEventListener("focus", openModal);
        if (openOnHover) {
            displayInput.addEventListener("mouseenter", openModal);
        }
        displayInput.addEventListener("click", openModal);
        displayInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openModal();
            }
        });

        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
        var closeBtn = modal.querySelector(".sn-dept-modal__close");
        if (closeBtn) {
            closeBtn.addEventListener("click", closeModal);
        }
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !modal.hidden) closeModal();
        });

        return {
            getValue: function () {
                return catalog.normalizeDept(hiddenInput.value || "");
            },
            setValue: function (deptId) {
                setDept(deptId || "");
            },
            open: openModal,
            close: closeModal
        };
    }

    function initPhotoManager(options) {
        var slotsEl = options.slotsEl;
        var galleryInput = options.galleryInput;
        var cameraInput = options.cameraInput;
        var btnGallery = options.btnGallery;
        var btnCamera = options.btnCamera;
        var onChange = options.onChange;
        var formApi = g.THEJHON_PRODUCT_FORM;
        var photos = [];

        if (!slotsEl || !formApi) {
            return {
                getPhotos: function () { return []; },
                setPhotos: function () {},
                clear: function () {}
            };
        }

        function notify() {
            if (typeof onChange === "function") onChange(photos.slice());
        }

        function renderSlots() {
            var html = "";
            var i;
            for (i = 0; i < MAX_PHOTOS; i++) {
                var src = photos[i] || "";
                html +=
                    '<div class="sn-photo-slot' +
                    (src ? " sn-photo-slot--filled" : "") +
                    '">' +
                    (src
                        ? '<img src="' +
                          escapeHtml(src) +
                          '" alt=""><button type="button" class="sn-photo-remove" data-index="' +
                          i +
                          '" aria-label="사진 ' +
                          (i + 1) +
                          ' 삭제">×</button>'
                        : '<span class="sn-photo-slot__empty">' +
                          (i + 1) +
                          "</span>") +
                    "</div>";
            }
            slotsEl.innerHTML = html;
            if (btnGallery) btnGallery.disabled = photos.length >= MAX_PHOTOS;
            if (btnCamera) btnCamera.disabled = photos.length >= MAX_PHOTOS;
        }

        function addPhoto(dataUrl) {
            if (!dataUrl || photos.length >= MAX_PHOTOS) return;
            photos.push(dataUrl);
            renderSlots();
            notify();
        }

        function removeAt(index) {
            if (index < 0 || index >= photos.length) return;
            photos.splice(index, 1);
            renderSlots();
            notify();
        }

        slotsEl.addEventListener("click", function (e) {
            var btn = e.target.closest(".sn-photo-remove");
            if (!btn) return;
            removeAt(parseInt(btn.getAttribute("data-index"), 10));
        });

        function bindInput(input) {
            if (!input) return;
            input.addEventListener("change", function () {
                var f = input.files && input.files[0];
                input.value = "";
                if (!f || photos.length >= MAX_PHOTOS) return;
                formApi
                    .processImageFileToSquareDataURL(f)
                    .then(function (dataUrl) {
                        addPhoto(dataUrl);
                    })
                    .catch(function (err) {
                        alert((err && err.message) || "사진을 처리하지 못했습니다.");
                    });
            });
        }

        if (btnGallery && galleryInput) {
            btnGallery.addEventListener("click", function () {
                if (photos.length < MAX_PHOTOS) galleryInput.click();
            });
        }
        if (btnCamera && cameraInput) {
            btnCamera.addEventListener("click", function () {
                if (photos.length < MAX_PHOTOS) cameraInput.click();
            });
        }
        bindInput(galleryInput);
        bindInput(cameraInput);
        renderSlots();

        return {
            getPhotos: function () {
                return photos.slice();
            },
            setPhotos: function (list) {
                photos = (list || []).slice(0, MAX_PHOTOS);
                renderSlots();
                notify();
            },
            clear: function () {
                photos = [];
                renderSlots();
                notify();
            }
        };
    }

    function imagesHtml(images) {
        var list = (images || []).filter(Boolean);
        if (!list.length) return "";
        return (
            '<div class="sn-detail-images">' +
            list
                .map(function (src) {
                    return '<img class="sn-detail-img" src="' + escapeHtml(src) + '" alt="">';
                })
                .join("") +
            "</div>"
        );
    }

    function telHref(tel) {
        var d = String(tel || "").replace(/\D/g, "");
        if (!d) return "";
        if (d.indexOf("82") === 0) return "tel:+" + d;
        if (d.charAt(0) === "0") return "tel:+82" + d.slice(1);
        return "tel:+" + d;
    }

    function authorContactHtml(it) {
        var name = String(it.sn_created_by_name || "").trim();
        var tel = String(it.sn_created_by_tel || "").trim();
        if (!name && !tel) return "";
        var nameDd = name ? escapeHtml(name) : '<span class="sn-contact-empty">—</span>';
        var telDd;
        if (tel) {
            telDd =
                '<a class="sn-detail-tel" href="' +
                escapeHtml(telHref(tel)) +
                '">' +
                escapeHtml(tel) +
                "</a>";
        } else {
            telDd = '<span class="sn-contact-empty">—</span>';
        }
        return (
            '<dl class="sn-detail-contact">' +
            "<dt>등록 관리자</dt><dd>" +
            nameDd +
            "</dd>" +
            "<dt>연락처</dt><dd>" +
            telDd +
            "</dd></dl>"
        );
    }

    function groupComments(comments) {
        var roots = [];
        var repliesByParent = Object.create(null);
        (comments || []).forEach(function (c) {
            if (!c || !c.id) return;
            var parentId = String(c.snc_parent_id || "").trim();
            if (parentId) {
                if (!repliesByParent[parentId]) repliesByParent[parentId] = [];
                repliesByParent[parentId].push(c);
            } else {
                roots.push(c);
            }
        });
        return { roots: roots, repliesByParent: repliesByParent };
    }

    function commentActionsHtml(c, options) {
        var canDelete = options.canDeleteComment && options.canDeleteComment(c);
        var canReply = options.canReply && !String(c.snc_parent_id || "").trim();
        if (!canDelete && !canReply) return "";
        var html = '<div class="sn-comment__actions">';
        if (canReply) {
            html +=
                '<button type="button" class="sn-comment__btn sn-comment-reply" data-id="' +
                escapeHtml(c.id) +
                '">답글</button>';
        }
        if (canDelete) {
            html +=
                '<button type="button" class="sn-comment__btn sn-comment__btn--danger sn-comment-del" data-id="' +
                escapeHtml(c.id) +
                '">삭제</button>';
        }
        html += "</div>";
        return html;
    }

    function commentItemHtml(c, options, isReply) {
        var cls = isReply ? "sn-comment sn-comment--reply" : "sn-comment";
        var replySlot = isReply
            ? ""
            : '<div class="sn-reply-slot" data-reply-for="' + escapeHtml(c.id) + '"></div>';
        return (
            '<li class="' +
            cls +
            '" data-comment-id="' +
            escapeHtml(c.id) +
            '">' +
            '<p class="sn-comment__meta">' +
            '<strong>' +
            escapeHtml(String(c.snc_author_name || "작성자")) +
            "</strong> · " +
            escapeHtml(formatDateKo(c.createdAt)) +
            "</p>" +
            '<p class="sn-comment__body">' +
            escapeMultiline(String(c.snc_body || "")) +
            "</p>" +
            commentActionsHtml(c, options) +
            replySlot +
            "</li>"
        );
    }

    function commentThreadHtml(c, replies, options) {
        var repliesHtml = replies.length
            ? '<ul class="sn-comments__replies">' +
              replies
                  .map(function (r) {
                      return commentItemHtml(r, options, true);
                  })
                  .join("") +
              "</ul>"
            : "";
        var cls = "sn-comment";
        return (
            '<li class="' +
            cls +
            '" data-comment-id="' +
            escapeHtml(c.id) +
            '">' +
            '<p class="sn-comment__meta">' +
            '<strong>' +
            escapeHtml(String(c.snc_author_name || "작성자")) +
            "</strong> · " +
            escapeHtml(formatDateKo(c.createdAt)) +
            "</p>" +
            '<p class="sn-comment__body">' +
            escapeMultiline(String(c.snc_body || "")) +
            "</p>" +
            commentActionsHtml(c, options) +
            '<div class="sn-reply-slot" data-reply-for="' +
            escapeHtml(c.id) +
            '"></div>' +
            repliesHtml +
            "</li>"
        );
    }

    function commentsListHtml(comments, options) {
        var grouped = groupComments(comments);
        if (!grouped.roots.length) return "";
        return grouped.roots
            .map(function (c) {
                return commentThreadHtml(c, grouped.repliesByParent[c.id] || [], options);
            })
            .join("");
    }

    function replyFormHtml(parentId) {
        return (
            '<form class="sn-reply-form" data-parent-id="' +
            escapeHtml(parentId) +
            '" novalidate>' +
            '<textarea maxlength="' +
            MAX_BODY +
            '" rows="2" placeholder="답글을 입력하세요 (최대 ' +
            MAX_BODY +
            '자)"></textarea>' +
            '<div class="sn-reply-form__actions">' +
            '<button type="button" class="sp-btn sp-btn--secondary sn-reply-cancel">취소</button>' +
            '<button type="submit" class="sp-btn sp-btn--primary">답글 등록</button>' +
            "</div></form>"
        );
    }

    function commentsSectionHtml(comments, options) {
        options = options || {};
        var list = comments || [];
        var html =
            '<section class="sn-comments" id="sn-comments-root">' +
            '<h3 class="sn-comments__title">댓글 <span class="sn-comments__count">' +
            list.length +
            "</span></h3>";
        if (!list.length) {
            html += '<p class="sn-comments__empty">아직 댓글이 없습니다.</p>';
        } else {
            html += '<ul class="sn-comments__list">' + commentsListHtml(list, options) + "</ul>";
        }
        if (options.canComment) {
            html +=
                '<form class="sn-comment-form" id="sn-comment-form" novalidate>' +
                '<label for="sn-comment-body" class="sn-comment-form__label">댓글 작성</label>' +
                '<textarea id="sn-comment-body" maxlength="' +
                MAX_BODY +
                '" rows="3" placeholder="댓글을 입력하세요 (최대 ' +
                MAX_BODY +
                '자)"></textarea>' +
                '<p class="sn-char-count" id="sn-comment-char">0 / ' +
                MAX_BODY +
                "</p>" +
                '<button type="submit" class="sp-btn sp-btn--primary">댓글 등록</button>' +
                "</form>";
        } else if (options.loginHint) {
            html += '<p class="sn-comments__hint">' + escapeHtml(options.loginHint) + "</p>";
        }
        html += "</section>";
        return html;
    }

    function bindCommentsUi(root, options) {
        if (!root || !options || !options.api || !options.newsId) return;
        var api = options.api;
        var newsId = options.newsId;
        var onRefresh = options.onRefresh || function () {};

        function syncMainChar() {
            var textarea = root.querySelector("#sn-comment-body");
            var charEl = root.querySelector("#sn-comment-char");
            if (!textarea || !charEl) return;
            charEl.textContent = textarea.value.length + " / " + MAX_BODY;
            charEl.classList.toggle("is-limit", textarea.value.length >= MAX_BODY);
        }

        var mainForm = root.querySelector("#sn-comment-form");
        if (mainForm) {
            var mainText = root.querySelector("#sn-comment-body");
            if (mainText) mainText.addEventListener("input", syncMainChar);
            syncMainChar();
            mainForm.addEventListener("submit", function (e) {
                e.preventDefault();
                var body = mainText ? mainText.value.trim() : "";
                if (!body) {
                    alert("댓글 내용을 입력해 주세요.");
                    return;
                }
                var btn = mainForm.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;
                api.createSupportNewsComment(newsId, { snc_body: body })
                    .then(onRefresh)
                    .catch(function (err) {
                        alert((err && err.message) || "댓글 등록에 실패했습니다.");
                    })
                    .finally(function () {
                        if (btn) btn.disabled = false;
                    });
            });
        }

        root.addEventListener("click", function (e) {
            var t = e.target;
            if (!(t instanceof HTMLElement)) return;

            if (t.classList.contains("sn-comment-del")) {
                var delId = t.getAttribute("data-id");
                if (!delId || !confirm("이 댓글을 삭제할까요?")) return;
                t.disabled = true;
                api.deleteSupportNewsComment(newsId, delId)
                    .then(onRefresh)
                    .catch(function (err) {
                        alert((err && err.message) || "삭제에 실패했습니다.");
                    })
                    .finally(function () {
                        t.disabled = false;
                    });
                return;
            }

            if (t.classList.contains("sn-comment-reply")) {
                var parentId = t.getAttribute("data-id");
                if (!parentId) return;
                root.querySelectorAll(".sn-reply-form").forEach(function (f) {
                    f.remove();
                });
                var slot = root.querySelector('.sn-reply-slot[data-reply-for="' + parentId + '"]');
                if (!slot) return;
                slot.innerHTML = replyFormHtml(parentId);
                var ta = slot.querySelector("textarea");
                if (ta) ta.focus();
                return;
            }

            if (t.classList.contains("sn-reply-cancel")) {
                var form = t.closest(".sn-reply-form");
                if (form && form.parentElement) form.parentElement.innerHTML = "";
            }
        });

        root.addEventListener("submit", function (e) {
            var form = e.target;
            if (!(form instanceof HTMLFormElement) || !form.classList.contains("sn-reply-form")) return;
            e.preventDefault();
            var parentId = form.getAttribute("data-parent-id") || "";
            var textarea = form.querySelector("textarea");
            var body = textarea ? textarea.value.trim() : "";
            if (!body) {
                alert("답글 내용을 입력해 주세요.");
                return;
            }
            var btn = form.querySelector('button[type="submit"]');
            if (btn) btn.disabled = true;
            api.createSupportNewsComment(newsId, { snc_body: body, snc_parent_id: parentId })
                .then(onRefresh)
                .catch(function (err) {
                    alert((err && err.message) || "답글 등록에 실패했습니다.");
                })
                .finally(function () {
                    if (btn) btn.disabled = false;
                });
        });
    }

    g.THEJHON_SUPPORT_NEWS = {
        MAX_BODY: MAX_BODY,
        MAX_PHOTOS: MAX_PHOTOS,
        escapeHtml: escapeHtml,
        escapeMultiline: escapeMultiline,
        formatDateKo: formatDateKo,
        deptLabel: deptLabel,
        initDeptModalPicker: initDeptModalPicker,
        initPhotoManager: initPhotoManager,
        imagesHtml: imagesHtml,
        authorContactHtml: authorContactHtml,
        commentsSectionHtml: commentsSectionHtml,
        bindCommentsUi: bindCommentsUi,
        telHref: telHref
    };
})(typeof window !== "undefined" ? window : this);
