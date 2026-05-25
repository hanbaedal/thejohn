/**
 * 수량 입력 — 상품 상세·주문 모달 공통 (− / 숫자 / +)
 */
(function (global) {
    function escapeAttr(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
    }

    function html(value, opts) {
        opts = opts || {};
        var min = opts.min != null ? opts.min : 1;
        var v = Math.max(min, parseInt(value, 10) || min);
        var extraClass = opts.className ? " " + opts.className : "";
        var inputId = opts.inputId ? ' id="' + escapeAttr(opts.inputId) + '"' : "";
        var aria = opts.ariaLabel
            ? ' aria-label="' + escapeAttr(opts.ariaLabel) + '"'
            : ' aria-label="수량"';
        return (
            '<div class="qty-stepper' +
            extraClass +
            '" data-qty-min="' +
            min +
            '">' +
            '<button type="button" class="qty-stepper__btn" data-qty-act="dec" aria-label="수량 줄이기">−</button>' +
            '<input type="number" class="qty-stepper__input"' +
            inputId +
            ' min="' +
            min +
            '" step="1" inputmode="numeric" value="' +
            v +
            '"' +
            aria +
            ">" +
            '<button type="button" class="qty-stepper__btn" data-qty-act="inc" aria-label="수량 늘리기">+</button>' +
            "</div>"
        );
    }

    function bind(root, options) {
        if (!root) return;
        options = options || {};
        var inp = root.querySelector(".qty-stepper__input");
        if (!inp) return;
        var min = Number(root.getAttribute("data-qty-min"));
        if (!isFinite(min) || min < 1) min = options.min || 1;

        function read() {
            return Math.max(min, parseInt(inp.value, 10) || min);
        }

        function write(n, fireChange) {
            var next = Math.max(min, n);
            inp.value = String(next);
            if (fireChange !== false && options.onChange) options.onChange(next);
        }

        root.querySelectorAll(".qty-stepper__btn").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var v = read();
                if (btn.getAttribute("data-qty-act") === "inc") write(v + 1);
                else write(v - 1);
            });
        });

        inp.addEventListener("change", function () {
            write(read());
        });
        inp.addEventListener("blur", function () {
            write(read());
        });

        if (options.onInput) {
            inp.addEventListener("input", function () {
                options.onInput(read());
            });
        }

        return { read: read, write: write, input: inp };
    }

    global.THEJHON_QTY_STEPPER = {
        html: html,
        bind: bind
    };
})(typeof window !== "undefined" ? window : this);
