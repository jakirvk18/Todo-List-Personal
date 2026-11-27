/* ============================================================
   FOCUS. — visual effects layer
   Purely cosmetic: it only reads the DOM that script.js builds.
   ============================================================ */

(function () {
    "use strict";

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const $ = id => document.getElementById(id);

    /* ---------- cursor spotlight + per-card glow ---------- */

    const spot = $("spot");
    const CARD = ".hero,.stat,.progress-card,.task,.custom-panel,.streak-panel,.empty";

    let px = -9999, py = -9999;   // pointer (canvas uses these)
    let target = null;
    let pending = false;

    function applyPointer() {
        pending = false;

        if (spot) {
            spot.style.setProperty("--mx", px + "px");
            spot.style.setProperty("--my", py + "px");
        }

        const card = target && target.closest ? target.closest(CARD) : null;

        if (card) {
            const r = card.getBoundingClientRect();
            card.style.setProperty("--x", (px - r.left) + "px");
            card.style.setProperty("--y", (py - r.top) + "px");
        }
    }

    window.addEventListener("pointermove", e => {
        px = e.clientX;
        py = e.clientY;
        target = e.target;

        if (!pending) {
            pending = true;
            requestAnimationFrame(applyPointer);
        }
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
        px = -9999;
        py = -9999;
    });

    /* ---------- progress ring sync ---------- */

    const pct = $("percentage");
    const ring = $("ring");
    const ringNum = $("ringNum");

    let lastPct = -1;
    let celebrated = false;
    let firstSync = true;

    function syncRing() {
        if (!pct || !ring) return;

        const n = Math.max(0, Math.min(100, parseInt(pct.textContent, 10) || 0));

        if (n === lastPct) return;
        lastPct = n;

        ring.style.setProperty("--p", n);
        if (ringNum) ringNum.textContent = n;

        if (firstSync) {
            celebrated = n >= 100;      // no confetti just for reloading a finished day
            firstSync = false;
            return;
        }

        if (n >= 100 && !celebrated) {
            celebrated = true;
            burst();
        } else if (n < 100) {
            celebrated = false;
        }
    }

    if (pct) {
        new MutationObserver(syncRing).observe(pct, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    syncRing();

    /* ---------- per-task progress line ---------- */

    const taskList = $("taskList");

    function updateTasks() {
        document.querySelectorAll(".task").forEach(card => {
            const t = card.querySelector(".timer");
            const d = card.querySelector(".task-duration");
            if (!t || !d) return;

            const m = d.textContent.match(/(\d+)\s*MIN/i);
            if (!m) return;

            const total = Number(m[1]) * 60;
            const p = t.textContent.split(":").map(Number);
            if (p.length !== 3 || p.some(isNaN) || !total) return;

            const remaining = p[0] * 3600 + p[1] * 60 + p[2];
            const frac = Math.min(1, Math.max(0, 1 - remaining / total));

            card.style.setProperty("--tp", frac.toFixed(4));
        });
    }

    if (taskList) {
        new MutationObserver(updateTasks).observe(taskList, { childList: true });
    }

    setInterval(updateTasks, 500);
    updateTasks();

    /* ---------- canvas: particle network + confetti ---------- */

    const canvas = document.createElement("canvas");
    canvas.id = "fx";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);

    const ctx = canvas.getContext("2d");

    const COLORS = ["255,93,115", "255,77,154", "168,85,255", "62,230,196"];
    const LINK = 130;

    let W = 0, H = 0, dpr = 1;
    let dots = [];
    let confetti = [];
    let rafId = 0;

    function rand(a, b) { return a + Math.random() * (b - a); }

    function makeDot() {
        return {
            x: rand(0, W),
            y: rand(0, H),
            vx: rand(-.22, .22),
            vy: rand(-.22, .22),
            r: rand(.8, 2.1),
            a: rand(.25, .7),
            c: COLORS[(Math.random() * COLORS.length) | 0]
        };
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const want = Math.max(28, Math.min(85, Math.round(W * H / 24000)));

        while (dots.length < want) dots.push(makeDot());
        dots.length = want;
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        /* particles */
        for (let i = 0; i < dots.length; i++) {
            const d = dots[i];

            d.x += d.vx;
            d.y += d.vy;

            if (d.x < -10) d.x = W + 10;
            if (d.x > W + 10) d.x = -10;
            if (d.y < -10) d.y = H + 10;
            if (d.y > H + 10) d.y = -10;

            /* gentle pull toward the pointer */
            const mdx = px - d.x;
            const mdy = py - d.y;
            const md = Math.hypot(mdx, mdy);

            if (md < 170 && md > 1) {
                d.x += mdx / md * .35;
                d.y += mdy / md * .35;
            }

            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(" + d.c + "," + d.a + ")";
            ctx.shadowColor = "rgba(" + d.c + ",.8)";
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;

            for (let j = i + 1; j < dots.length; j++) {
                const o = dots[j];
                const dist = Math.hypot(d.x - o.x, d.y - o.y);

                if (dist < LINK) {
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(o.x, o.y);
                    ctx.strokeStyle = "rgba(" + d.c + "," + ((1 - dist / LINK) * .18) + ")";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            /* link to pointer */
            if (md < 190) {
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(px, py);
                ctx.strokeStyle = "rgba(" + d.c + "," + ((1 - md / 190) * .35) + ")";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        /* confetti */
        for (let i = confetti.length - 1; i >= 0; i--) {
            const p = confetti[i];

            p.vy += .12;
            p.vx *= .992;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            p.life -= 1;

            if (p.life <= 0 || p.y > H + 30) {
                confetti.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.min(1, p.life / 40);
            ctx.fillStyle = "rgb(" + p.c + ")";
            ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }

    function loop() {
        draw();
        rafId = requestAnimationFrame(loop);
    }

    function start() {
        if (!rafId && !reduce) rafId = requestAnimationFrame(loop);
    }

    function stop() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
    }

    function burst() {
        if (reduce) return;

        const r = ring ? ring.getBoundingClientRect() : null;
        const ox = r ? r.left + r.width / 2 : W / 2;
        const oy = r ? r.top + r.height / 2 : H / 3;

        for (let i = 0; i < 110; i++) {
            const ang = rand(0, Math.PI * 2);
            const sp = rand(3, 11);

            confetti.push({
                x: ox,
                y: oy,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp - 3,
                s: rand(6, 12),
                rot: rand(0, Math.PI),
                vr: rand(-.3, .3),
                c: COLORS[(Math.random() * COLORS.length) | 0],
                life: rand(70, 150)
            });
        }

        start();
    }

    let resizeTimer = 0;

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize();
            if (reduce) draw();
        }, 120);
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
        else start();
    });

    resize();

    if (reduce) {
        draw();            // single static frame
    } else {
        start();
    }
})();
