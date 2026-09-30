"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * Five 3D objects, drawn live with React Three Fiber. Each one has a place to be for every part of the
 * page and glides there as the visitor scrolls: around the headline in the hero, at the edges beside the
 * statement, one at a time on the project slides, and gathered around the email at Contact.
 */

const YELLOW = "#FFB400";
const ORANGE = "#FF5A1F";
const PINK = "#FF4D73";
const BLUE = "#1E96FF";

/** Glossy toy-plastic surface shared by every object. */
function Plastic({ color, roughness = 0.38, clearcoat = 0.55 }: { color: string; roughness?: number; clearcoat?: number }) {
  return <meshPhysicalMaterial color={color} roughness={roughness} clearcoat={clearcoat} clearcoatRoughness={0.3} />;
}

function Key() {
  const teeth = useMemo(() => [new RoundedBoxGeometry(0.28, 0.52, 0.3, 4, 0.08), new RoundedBoxGeometry(0.28, 0.4, 0.3, 4, 0.08)], []);
  return (
    <>
      <mesh position={[-0.95, 0, 0]}>
        <torusGeometry args={[0.62, 0.23, 28, 72]} />
        <Plastic color={YELLOW} />
      </mesh>
      <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.17, 1.7, 8, 24]} />
        <Plastic color={YELLOW} />
      </mesh>
      <mesh geometry={teeth[0]} position={[0.9, -0.33, 0]}>
        <Plastic color={YELLOW} />
      </mesh>
      <mesh geometry={teeth[1]} position={[1.28, -0.28, 0]}>
        <Plastic color={YELLOW} />
      </mesh>
    </>
  );
}

/** A flat outline given thickness and rounded edges. */
function plate(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 5 });
}

/** Two wings folded up from a centre keel. The nose points along +x. */
function PaperPlane() {
  const [wing, keel] = useMemo(
    () => [plate([[1.7, 0.04], [-1, 0.16], [-1, 1.3]]), plate([[1.7, 0], [-1, 0], [-1, -0.62]])],
    [],
  );
  return (
    <>
      <mesh geometry={wing} rotation={[-Math.PI / 2 + 0.42, 0, 0]}>
        <Plastic color={ORANGE} />
      </mesh>
      <mesh geometry={wing} rotation={[Math.PI / 2 - 0.42, 0, 0]}>
        <Plastic color={ORANGE} />
      </mesh>
      <mesh geometry={keel} position={[0, 0, -0.05]}>
        <Plastic color="#E23C0A" />
      </mesh>
    </>
  );
}

function ChatBubble() {
  const body = useMemo(() => new RoundedBoxGeometry(2.3, 1.6, 0.8, 8, 0.5), []);
  return (
    <>
      <mesh geometry={body}>
        <Plastic color={PINK} />
      </mesh>
      <mesh position={[-0.6, -0.96, 0]} rotation={[0, 0, Math.PI * 0.9]}>
        <coneGeometry args={[0.42, 0.8, 32]} />
        <Plastic color={PINK} />
      </mesh>
      {[-0.55, 0, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.02, 0.4]}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <Plastic color="#FFFFFF" roughness={0.22} />
        </mesh>
      ))}
    </>
  );
}

function Rings() {
  return (
    <>
      <mesh position={[-0.48, 0, 0]} rotation={[0, 0.35, 0]}>
        <torusGeometry args={[0.66, 0.2, 28, 72]} />
        <Plastic color="#9BDD00" />
      </mesh>
      <mesh position={[0.48, 0, 0]} rotation={[Math.PI / 2, -0.2, 0]}>
        <torusGeometry args={[0.66, 0.2, 28, 72]} />
        <Plastic color="#0B8A45" />
      </mesh>
    </>
  );
}

function Database() {
  return (
    <>
      {[-0.56, 0, 0.56].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.86, 0.86, 0.4, 64]} />
          <Plastic color={BLUE} />
        </mesh>
      ))}
    </>
  );
}

type Pair = [number, number];
// Position as screen fractions from the centre. px is the size: how wide the key would be drawn, in pixels.
type Spot = { x: number; y: number; px: number };

// The key's width in 3D units. Sizing every object against the key keeps them in proportion to each other.
const KEY_WIDTH = 3.2;

/*
 * project: which slide the object belongs to (-1 = decoration). hero: its size around the headline.
 * focus: its size on its own slide. tilt: its resting angle. sway rocks it, spin turns it round.
 */
const OBJECTS: { name: string; node: ReactNode; project: number; hero: number; focus: number; tilt: [number, number, number]; sway: number; spin: number }[] = [
  { name: "key", node: <Key />, project: 0, hero: 0.8, focus: 1.5, tilt: [0.25, 0.1, 0.6], sway: 0.3, spin: 0 },
  { name: "plane", node: <PaperPlane />, project: 1, hero: 0.8, focus: 1.3, tilt: [0.75, -0.55, 0.35], sway: 0.3, spin: 0 },
  { name: "bubble", node: <ChatBubble />, project: 2, hero: 0.8, focus: 1.6, tilt: [0.08, 0.12, -0.08], sway: 0.2, spin: 0 },
  { name: "rings", node: <Rings />, project: 3, hero: 0.8, focus: 1.8, tilt: [0.5, 0.3, 0.2], sway: 0, spin: 0.3 },
  { name: "database", node: <Database />, project: -1, hero: 0.6, focus: 1, tilt: [0.45, 0, 0.2], sway: 0, spin: 0.2 },
];

// Where the objects sit. Every position is a fraction of the screen, measured from its centre.
const HERO: Pair[] = [[-0.37, 0.26], [0.345, 0.3], [-0.35, -0.25], [0.34, -0.25], [0.44, 0.07]];
const HERO_PHONE: (Pair | null)[] = [[-0.28, 0.37], [0.28, 0.37], [-0.28, -0.31], [0.28, -0.31], null];
const AWAY: Pair[] = [[-0.72, 0.3], [0.74, 0.34], [-0.74, -0.3], [0.74, -0.28], [0.8, 0.02]];
const MEET: Pair[] = [[-0.34, 0.22], [0.34, 0.26], [-0.31, -0.24], [0.33, -0.22], [0.02, 0.37]];

type Page = {
  vw: number;
  vh: number;
  scrollY: number;
  phone: boolean;
  unit: number; // full object size for this screen, in pixels
  slides: number;
  heroTop: number; // where the hero starts on the page, before any scrolling
  heroHeight: number;
  statement: DOMRect | null;
  work: DOMRect;
  contactTop: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Where object `i` should be, and how big, for the part of the page currently on screen. */
function placeFor(i: number, page: Page): Spot {
  const o = OBJECTS[i];
  const decoration = o.project < 0;
  const { vw, vh, phone, unit } = page;
  const hidden: Spot = { x: AWAY[i][0] * 1.15, y: AWAY[i][1], px: unit * 0.5 };

  if (page.contactTop < vh * 0.7) {
    // The objects arrive with the Contact section, so they never sit on top of the section above it.
    const rise = Math.max(0, page.contactTop) / vh;
    if (phone) return decoration ? hidden : { x: MEET[i][0] * 0.8, y: (MEET[i][1] > 0 ? 0.36 : -0.33) - rise, px: unit * 0.8 };
    return { x: MEET[i][0], y: MEET[i][1] - rise, px: unit * (decoration ? 0.6 : 0.85) };
  }
  if (page.work.top < vh * 0.45 && page.work.bottom > vh * 0.55) {
    const progress = clamp(-page.work.top / (page.work.height - vh), 0, 1);
    const active = Math.min(page.slides - 1, Math.floor(progress * page.slides));
    if (o.project !== active) return hidden;
    // The slide's object is the largest thing on screen. It fills the empty half of the 1320px column.
    return phone
      ? { x: 0, y: 0.29, px: Math.min(vh * 0.235, vw * 0.52) * o.focus }
      : { x: Math.min(0.24, 300 / vw), y: 0.02, px: Math.min(vw * 0.29, vh * 0.427, 400) * o.focus };
  }
  // Step aside to the screen edges while the statement is being read. Not at the very top of the page:
  // on a tall screen the statement is already in view there, and the objects belong around the headline.
  const atTop = page.scrollY < page.heroHeight * 0.2;
  if (!phone && !atTop && page.statement && page.statement.top < vh * 0.72 && page.statement.bottom > vh * 0.12) {
    return { x: Math.sign(AWAY[i][0]) * 0.525, y: AWAY[i][1] * 1.1, px: unit * 0.62 };
  }
  if (page.scrollY < page.heroHeight * 0.7) {
    const spot = phone ? HERO_PHONE[i] : HERO[i];
    if (!spot) return hidden;
    // Spread around the hero itself, not the whole screen, so a tall screen does not push them into the next section.
    const centre = (vh / 2 - (page.heroTop + page.heroHeight / 2)) / vh;
    const reach = Math.min(1, page.heroHeight / vh);
    const lift = page.scrollY / vh;
    return { x: spot[0] * (1 + lift * 0.35), y: centre + spot[1] * reach + lift * 0.45, px: unit * o.hero };
  }
  return hidden;
}

type Sections = { hero: HTMLElement; statement: HTMLElement | null; work: HTMLElement; contact: HTMLElement };

function findSections(): Sections | null {
  const hero = document.querySelector<HTMLElement>(".hero");
  const work = document.getElementById("work");
  const contact = document.getElementById("contact");
  if (!hero || !work || !contact) return null;
  return { hero, work, contact, statement: document.querySelector<HTMLElement>(".statement") };
}

function Objects({ slides }: { slides: number }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  // Start below the screen and tiny, so the objects fly in on load.
  const current = useRef<Spot[]>(OBJECTS.map((_, i) => ({ x: AWAY[i][0] * 0.5, y: -0.75, px: 1 })));
  const sections = useRef<Sections | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const still = useRef(false);

  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onMove = (e: PointerEvent) => {
      mouse.current.x = e.clientX / window.innerWidth - 0.5;
      mouse.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(({ clock, viewport }) => {
    sections.current ??= findSections();
    const el = sections.current;
    if (!el) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const phone = vw / vh < 0.85;
    const page: Page = {
      vw,
      vh,
      scrollY: window.scrollY,
      phone,
      // Sized from the screen, with a ceiling so the objects stop growing on very large monitors.
      unit: phone ? clamp(vh * 0.213, 140, 200) : Math.min(vw * 0.29, vh * 0.427, 480),
      slides,
      heroTop: el.hero.getBoundingClientRect().top + window.scrollY,
      heroHeight: el.hero.offsetHeight,
      statement: el.statement ? el.statement.getBoundingClientRect() : null,
      work: el.work.getBoundingClientRect(),
      contactTop: el.contact.getBoundingClientRect().top,
    };

    const pxPerUnit = vh / viewport.height; // the 3D world is measured in units; this converts pixels to them
    const t = clock.elapsedTime;
    const moving = !still.current;
    const ease = moving ? 0.07 : 1;
    const { x: mx, y: my } = mouse.current;

    OBJECTS.forEach((o, i) => {
      const group = groups.current[i];
      if (!group) return;
      const to = placeFor(i, page);
      const at = current.current[i];
      at.x += (to.x - at.x) * ease;
      at.y += (to.y - at.y) * ease;
      at.px += (to.px - at.px) * ease;

      const phase = i * 1.7;
      const bob = moving ? Math.sin(t * 0.9 + phase) * 0.12 : 0;
      group.position.set(at.x * viewport.width - mx * 0.5, at.y * viewport.height + bob + my * 0.35, 0);
      group.scale.setScalar(Math.max(at.px / (KEY_WIDTH * pxPerUnit), 0.001));
      group.rotation.set(
        o.tilt[0] + Math.sin(t * 0.5 + phase) * 0.18 + my * 0.3,
        o.tilt[1] + (moving ? t * o.spin + Math.sin(t * 0.4 + phase) * o.sway : 0) + Math.sin(page.scrollY * 0.0022) * 0.18 + mx * 0.25,
        o.tilt[2] + Math.cos(t * 0.4 + phase) * 0.1,
      );
    });
  });

  return (
    <>
      {OBJECTS.map((o, i) => (
        <group
          key={o.name}
          scale={0.001}
          ref={(group) => {
            groups.current[i] = group;
          }}
        >
          {o.node}
        </group>
      ))}
    </>
  );
}

/** Soft studio reflections: a small lit room the objects mirror. Built in code, so nothing is downloaded. */
function Studio() {
  const room = useMemo(() => new RoomEnvironment(), []);
  return (
    <Environment resolution={256} environmentIntensity={0.7}>
      <primitive object={room} />
    </Environment>
  );
}

/** Some browsers have 3D graphics switched off (no hardware acceleration, or a crashed graphics process). */
function canDraw3D() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // hand the test context straight back
    return Boolean(gl);
  } catch {
    return false;
  }
}

export default function Scene({ slides }: { slides: number }) {
  const [supported] = useState(canDraw3D);
  if (!supported) return null;

  return (
    <Canvas
      className="scene"
      aria-hidden
      camera={{ fov: 30, position: [0, 0, 14] }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.NeutralToneMapping }}
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      fallback={null}
    >
      <Studio />
      <directionalLight position={[-4, 7, 9]} intensity={2} />
      <Objects slides={slides} />
    </Canvas>
  );
}
