"use client";

import Image from "next/image";
import { useEffect, useRef, type PointerEvent } from "react";

/*
 * An ID card hanging from a lanyard. Drag it sideways or tap it and it swings like a real pendulum,
 * then settles. The physics is adapted from the Hanging Id Card component in Lightswind UI
 * (MIT licence, Copyright (c) 2025 Muhilan, https://github.com/codewithMUHILAN/Lightswind-UI-Library).
 */

const GRAVITY = 3000;
const DAMPING = 0.9; // light air resistance, so it swings a few times before it stops
const ROPE = 118; // lanyard length in px
const ARM = ROPE + 110; // distance from the pin to the card's centre of mass
const MAX_ANGLE = 1.2; // radians

// The barcode. Heights are whole numbers so the server and every browser write exactly the same value.
const BARS = Array.from({ length: 30 }, (_, i) => ({
  width: i % 3 === 0 ? "3px" : "1.5px",
  height: `${Math.round(50 + Math.sin(i * 1.3) * 38)}%`,
}));

/** The pendulum itself, kept outside React: it only ever changes one element's rotation. */
function createPendulum(draw: (angle: number) => void) {
  const s = { angle: 0, velocity: 0, dragging: false, moved: false, startX: 0, startAngle: 0, lastAngle: 0, lastTime: 0, frame: 0 };

  const tick = (now: number) => {
    const dt = Math.min((now - (s.lastTime || now)) / 1000, 0.05);
    s.lastTime = now;
    if (s.dragging) {
      // Track how fast the card is being moved, so letting go "throws" it.
      if (dt > 0) s.velocity = (s.angle - s.lastAngle) / dt;
      s.lastAngle = s.angle;
    } else {
      s.velocity += (-(GRAVITY / ARM) * Math.sin(s.angle) - DAMPING * s.velocity) * dt;
      s.angle += s.velocity * dt;
      if (Math.abs(s.angle) < 0.001 && Math.abs(s.velocity) < 0.001) {
        s.angle = 0;
        s.velocity = 0;
        s.frame = 0;
        draw(0);
        return; // settled: stop the loop until the next push
      }
    }
    draw(s.angle);
    s.frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (s.frame) return;
    s.lastTime = 0;
    s.frame = requestAnimationFrame(tick);
  };

  return {
    push(velocity: number) {
      s.velocity = velocity;
      start();
    },
    grab(x: number) {
      s.dragging = true;
      s.moved = false;
      s.startX = x;
      s.startAngle = s.angle;
      s.lastAngle = s.angle;
      start();
    },
    drag(x: number) {
      if (!s.dragging) return;
      const dx = x - s.startX;
      if (Math.abs(dx) > 4) s.moved = true;
      // The card hangs below its pin, so dragging right turns it anticlockwise.
      s.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, s.startAngle - dx / ARM));
    },
    release() {
      if (!s.dragging) return;
      s.dragging = false;
      if (!s.moved) s.velocity = 4; // a tap gives it a push
      start();
    },
    stop() {
      cancelAnimationFrame(s.frame);
      s.frame = 0;
    },
  };
}

export default function IdCard({ photo, name, role, id }: { photo: string; name: string; role: string; id: string }) {
  const root = useRef<HTMLDivElement>(null);
  const swing = useRef<HTMLDivElement>(null);
  const pendulum = useRef<ReturnType<typeof createPendulum> | null>(null);

  useEffect(() => {
    const el = root.current;
    const card = swing.current;
    if (!el || !card) return;
    const p = createPendulum((angle) => {
      card.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
    });
    pendulum.current = p;

    // A gentle swing the first time the card scrolls into view.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) p.push(2.4);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      p.stop();
      pendulum.current = null;
    };
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pendulum.current?.grab(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => pendulum.current?.drag(e.clientX);
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    pendulum.current?.release();
  };

  return (
    <div className="badge" ref={root}>
      <span className="badge-pin" />
      <div
        className="badge-swing"
        ref={swing}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className="badge-rope" width="30" height={ROPE} viewBox={`0 0 30 ${ROPE}`} aria-hidden="true">
          <path d={`M13 0 L10 ${ROPE}`} strokeWidth="6" />
          <path d={`M17 0 L20 ${ROPE}`} strokeWidth="6" />
          <rect className="badge-clip" x="9" y={ROPE - 8} width="12" height="10" rx="3" />
        </svg>
        <div className="badge-card">
          <div className="badge-photo">
            <span className="badge-slot" />
            <Image src={photo} alt={`Portrait of ${name}`} fill sizes="240px" draggable={false} />
          </div>
          <div className="badge-body">
            <b>{name}</b>
            <span>{role}</span>
            <div className="badge-bars" aria-hidden="true">
              {BARS.map((bar, i) => (
                <i key={i} style={bar} />
              ))}
            </div>
            <em>{id}</em>
          </div>
        </div>
      </div>
      <p className="badge-hint">Drag or tap the card</p>
    </div>
  );
}
