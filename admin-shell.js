/**
 * 관리 페이지 공통 레이아웃 — 좌측 탐색기 + 본문
 */
(function () {
    "use strict";

    var mounted = false;

    function pageFile() {
        var path = (location.pathname || "").replace(/\\/g, "/");
        return (path.split("/").pop() || "").split("?")[0].toLowerCase();
    }

    function hrefFile(href) {
        if (!href) return "";
        var seg = String(href).split("?")[0].split("#")[0];
        return seg.split("/").pop().toLowerCase();
    }

    function closeMobileSidebar() {
        document.body.classList.remove("wh-sidebar-open");
        var toggle = document.getElementById("whMenuToggle");
        var backdrop = document.getElementById("whSidebarBackdrop");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
        if (backdrop) backdrop.hidden = true;
    }

    function openMobileSidebar() {
        document.body.classList.add("wh-sidebar-open");
        var toggle = document.getElementById("whMenuToggle");
        var backdrop = document.getElementById("whSidebarBackdrop");
        if (toggle) toggle.setAttribute("aria-expanded", "true");
        if (backdrop) backdrop.hidden = false;
    }

    function bindSidebarChrome() {
        var toggle = document.getElementById("whMenuToggle");
        var backdrop = document.getElementById("whSidebarBackdrop");
        if (toggle && !toggle._whBound) {
            toggle._whBound = true;
            toggle.addEventListener("click", function () {
                if (document.body.classList.contains("wh-sidebar-open")) closeMobileSidebar();
                else openMobileSidebar();
            });
        }
        if (backdrop && !backdrop._whBound) {
            backdrop._whBound = true;
            backdrop.addEventListener("click", closeMobileSidebar);
        }
    }

    function markCurrentNav(menuEl) {
        if (!menuEl) return;
        var cur = pageFile();
        var links = menuEl.querySelectorAll("a.wh-child, a.wh-leaf");
        for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var file = hrefFile(a.getAttribute("href"));
            var on = file === cur;
            if (!on && cur === "product-edit.html" && file === "product-register.html") on = true;
            if (!on && cur === "vendor-edit.html" && file === "vendor-register.html") on = true;
            if (!on && cur === "product-new-register.html" && file === "product-register.html") on = true;
            if (!on && cur === "vendor-new-register.html" && file === "vendor-register.html") on = true;
            if (!on && cur.indexOf("sales-ledger-") === 0 && file === "sales-ledger-by-vendor.html") on = true;
            if (!on && (cur === "transaction-manual-register.html" || cur === "transaction-manual-list.html") && file === "transaction-list.html") on = true;
            if (
                !on &&
                (cur === "supervisor-order-pdf.html" ||
                    cur === "supervisor-transaction-pdf.html" ||
                    cur === "supervisor-transaction-list.html") &&
                file === "supervisor-order-list.html"
            )
                on = true;
            if (on) {
                a.classList.add("is-current");
                var parentBtn = a.closest(".wh-item");
                if (parentBtn) {
                    var btn = parentBtn.querySelector(".wh-parent");
                    if (btn) {
                        btn.classList.add("is-open");
                        btn.setAttribute("aria-expanded", "true");
                    }
                }
            }
        }
    }

    function renderMenu(menuEl, role) {
        if (!menuEl || !window.THEJHON_WORK_HUB_TREE) return;
        var tree = window.THEJHON_WORK_HUB_TREE.treeForRole(role);
        menuEl.innerHTML = "";
        tree.forEach(function (section) {
            var sec = document.createElement("div");
            sec.className = "wh-section";
            var title = document.createElement("p");
            title.className = "wh-section-title";
            title.textContent = section.title;
            sec.appendChild(title);

            section.items.forEach(function (item) {
                var wrap = document.createElement("div");
                wrap.className = "wh-item";
                if (item.children && item.children.length) {
                    var btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "wh-parent";
                    btn.setAttribute("aria-expanded", "false");
                    var label = document.createElement("span");
                    label.textContent = item.label;
                    var chevron = document.createElement("span");
                    chevron.className = "wh-chevron";
                    chevron.setAttribute("aria-hidden", "true");
                    btn.appendChild(label);
                    btn.appendChild(chevron);
                    btn.addEventListener("click", function () {
                        var open = !btn.classList.contains("is-open");
                        btn.classList.toggle("is-open", open);
                        btn.setAttribute("aria-expanded", open ? "true" : "false");
                    });
                    wrap.appendChild(btn);
                    var kids = document.createElement("div");
                    kids.className = "wh-children";
                    item.children.forEach(function (ch) {
                        var link = document.createElement("a");
                        link.className = "wh-child";
                        link.href = ch.href;
                        link.textContent = ch.label;
                        kids.appendChild(link);
                    });
                    wrap.appendChild(kids);
                } else {
                    var leaf = document.createElement("a");
                    leaf.className = "wh-leaf";
                    leaf.href = item.href;
                    leaf.textContent = item.label;
                    wrap.appendChild(leaf);
                }
                sec.appendChild(wrap);
            });
            menuEl.appendChild(sec);
        });
        markCurrentNav(menuEl);
        return tree;
    }

    function ensureMenuToggle(header) {
        if (!header || header.querySelector("#whMenuToggle")) return;
        var brand =
            header.querySelector(".site-header-brand") ||
            header.querySelector(".site-header-start") ||
            header;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wh-menu-toggle";
        btn.id = "whMenuToggle";
        btn.setAttribute("aria-label", "메뉴 열기");
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-controls", "whSidebar");
        btn.innerHTML = "<span></span><span></span><span></span>";
        brand.insertBefore(btn, brand.firstChild);
    }

    function wrapPageContent() {
        if (document.querySelector(".wh-shell")) return document.getElementById("whMenu");

        var header = document.querySelector(".site-header");
        if (header) ensureMenuToggle(header);

        var nodes = [];
        var node = header ? header.nextElementSibling : document.body.firstElementChild;
        while (node) {
            var next = node.nextElementSibling;
            if (node.classList && node.classList.contains("wh-shell")) {
                node = next;
                continue;
            }
            nodes.push(node);
            node = next;
        }
        if (!nodes.length) return null;

        var shell = document.createElement("div");
        shell.className = "wh-shell";

        var backdrop = document.createElement("div");
        backdrop.className = "wh-sidebar-backdrop";
        backdrop.id = "whSidebarBackdrop";
        backdrop.hidden = true;

        var aside = document.createElement("aside");
        aside.className = "wh-sidebar";
        aside.id = "whSidebar";
        aside.setAttribute("aria-label", "관리 메뉴");
        var nav = document.createElement("nav");
        nav.className = "wh-nav";
        nav.id = "whMenu";
        aside.appendChild(nav);

        var bodyWrap = document.createElement("div");
        bodyWrap.className = "wh-body";

        nodes.forEach(function (el) {
            bodyWrap.appendChild(el);
        });

        shell.appendChild(backdrop);
        shell.appendChild(aside);
        shell.appendChild(bodyWrap);

        if (header && header.parentNode) {
            header.parentNode.insertBefore(shell, header.nextSibling);
        } else {
            document.body.appendChild(shell);
        }
        return nav;
    }

    function init() {
        if (mounted) return;
        var Auth = window.THEJHON_AUTH;
        if (!Auth || !Auth.isAdminShellPage || !Auth.isAdminShellPage()) return;
        if (!Auth.isStaffRole || !Auth.isStaffRole(Auth.getRole())) return;
        if (!window.THEJHON_WORK_HUB_TREE) return;

        document.body.classList.add("page-admin-shell");

        var menuEl = document.getElementById("whMenu");
        if (!menuEl) menuEl = wrapPageContent();
        if (!menuEl) return;

        var role = Auth.getRole ? Auth.getRole() : "";
        renderMenu(menuEl, role);
        bindSidebarChrome();
        mounted = true;

        window.addEventListener("thejhon-auth-permissions-updated", function () {
            if (Auth.getRole) renderMenu(menuEl, Auth.getRole());
        });
    }

    window.THEJHON_ADMIN_SHELL = { init: init, renderMenu: renderMenu, pageFile: pageFile };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
