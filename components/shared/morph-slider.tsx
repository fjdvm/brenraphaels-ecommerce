"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";

import { CarouselArrow } from "@/components/shared/carousel-arrow";
import { EditorialRow } from "@/components/shared/editorial-row";

export type MorphItem = {
  key: string;
  image: string;
  alt: string;
  /** Shown beside the slider while this slide is showing. */
  text: ReactNode;
  /** Replaces the slide once "Watch the video" is pressed. */
  player?: ReactNode;
};

const DURATION_MS = 1100;

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** The current image melts into the next along a moving noise field. */
const fragmentShader = `
precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tNext;
uniform vec2 uResolution;
uniform vec2 uCurrentSize;
uniform vec2 uNextSize;
uniform float uProgress;
uniform float uTime;

varying vec2 vUv;

const float PI = 3.14159265359;
const float SCALE = 2.5;
const float INTENSITY = 0.9;
const float ABERRATION = 0.6;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec2 coverUV(vec2 uv, vec2 res, vec2 img) {
  float ratio = (res.x / max(res.y, 1.0)) / max(img.x / max(img.y, 1.0), 0.0001);
  vec2 s = ratio > 1.0 ? vec2(1.0, 1.0 / ratio) : vec2(ratio, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  float p = uProgress;
  float env = sin(p * PI);
  vec2 uv = vUv;

  float nn = fbm(uv * SCALE + uTime * 0.03);
  float warp = fbm(uv * SCALE * 1.7 - uTime * 0.02);
  vec2 g = vec2(nn, warp) - 0.5;
  vec2 uvC = uv + g * INTENSITY * 0.5 * p;
  vec2 uvN = uv - g * INTENSITY * 0.5 * (1.0 - p);
  // Runs from just below 0 to just above 1 so both ends are a clean image.
  float m = smoothstep(nn - 0.15, nn + 0.15, p * 1.3 - 0.15);

  vec2 sC = coverUV(uvC, uResolution, uCurrentSize);
  vec2 sN = coverUV(uvN, uResolution, uNextSize);
  float ca = ABERRATION * env * 0.03;

  vec3 colC = vec3(
    texture2D(tCurrent, sC + vec2(ca, 0.0)).r,
    texture2D(tCurrent, sC).g,
    texture2D(tCurrent, sC - vec2(ca, 0.0)).b
  );
  vec3 colN = vec3(
    texture2D(tNext, sN + vec2(ca, 0.0)).r,
    texture2D(tNext, sN).g,
    texture2D(tNext, sN - vec2(ca, 0.0)).b
  );

  gl_FragColor = vec4(mix(colC, colN, m), 1.0);
}
`;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

type Morph = { goTo: (index: number) => void; destroy: () => void };

/** Draws `urls` into `container`, morphing between them; null when WebGL is unavailable. */
function createMorph(container: HTMLElement, urls: string[]): Morph | null {
  let renderer: Renderer;
  try {
    renderer = new Renderer({
      alpha: false,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
  } catch {
    return null;
  }
  const gl = renderer.gl;
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.className = "absolute inset-0 size-full";
  // Hidden until the first image has loaded, so the poster shows meanwhile.
  canvas.style.opacity = "0";
  container.appendChild(canvas);

  const blank = new Texture(gl, {
    image: new Uint8Array([24, 24, 28, 255]),
    width: 1,
    height: 1,
    generateMipmaps: false,
  });
  const textures = urls.map(() => blank);
  const sizes = urls.map(() => [1, 1]);
  let current = 0;
  let target = 0;
  let animating = false;
  let destroyed = false;
  let frame = 0;

  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      tCurrent: { value: blank },
      tNext: { value: blank },
      uResolution: { value: [1, 1] },
      uCurrentSize: { value: sizes[0] },
      uNextSize: { value: sizes[0] },
      uProgress: { value: 0 },
      uTime: { value: 0 },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  // Draws only when something changed, so a resting slider costs nothing.
  const render = () => renderer.render({ scene: mesh });

  function showCurrent() {
    program.uniforms.tCurrent.value = textures[current];
    program.uniforms.uCurrentSize.value = sizes[current];
    program.uniforms.tNext.value = textures[target];
    program.uniforms.uNextSize.value = sizes[target];
  }

  urls.forEach((url, index) => {
    const image = new window.Image();
    image.onload = () => {
      if (destroyed) return;
      const texture = new Texture(gl, { generateMipmaps: false });
      texture.image = image;
      textures[index] = texture;
      sizes[index] = [image.naturalWidth || 1, image.naturalHeight || 1];
      showCurrent();
      if (index === current) canvas.style.opacity = "1";
      render();
    };
    image.src = url;
  });

  const observer = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(Math.max(width, 1), Math.max(height, 1));
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
    render();
  });
  observer.observe(container);

  function commit() {
    current = target;
    animating = false;
    program.uniforms.uProgress.value = 0;
    showCurrent();
    render();
  }

  return {
    goTo(index) {
      if (animating) {
        cancelAnimationFrame(frame);
        commit();
      }
      if (index === current) return;
      target = index;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        commit();
        return;
      }
      showCurrent();
      animating = true;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        program.uniforms.uProgress.value = easeInOutCubic(t);
        program.uniforms.uTime.value = now / 1000;
        render();
        if (t < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          commit();
        }
      };
      frame = requestAnimationFrame(tick);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/**
 * Slides of images that melt into one another, with each slide's text beside
 * it. A slide with a `player` gets a play button that swaps the image for it.
 */
export function MorphSlider({
  label,
  items,
  intro,
  mediaSide,
}: {
  label: string;
  items: MorphItem[];
  /** Static text above the active slide's text. */
  intro?: ReactNode;
  mediaSide: "left" | "right";
}) {
  const count = items.length;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const morph = useRef<Morph | null>(null);
  const imageKey = items.map((item) => item.image).join("|");

  useEffect(() => {
    if (!stage.current) return;
    const created = createMorph(stage.current, imageKey.split("|"));
    morph.current = created;
    return () => {
      created?.destroy();
      morph.current = null;
    };
  }, [imageKey]);

  function goTo(index: number) {
    const next = ((index % count) + count) % count;
    if (next === active) return;
    setPlaying(false);
    setActive(next);
    morph.current?.goTo(next);
  }

  const { player, image, alt } = items[active];

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") goTo(active - 1);
        if (event.key === "ArrowRight") goTo(active + 1);
      }}
    >
      <EditorialRow
        mediaSide={mediaSide}
        media={
          <div className="flex items-center gap-2 sm:gap-4">
            <CarouselArrow
              direction="previous"
              onClick={() => goTo(active - 1)}
            />
            <div
              ref={stage}
              className="relative aspect-video min-w-0 flex-1 overflow-hidden bg-black"
            >
              {/* The poster: shown until WebGL has drawn, and if it never does. */}
              <Image
                src={image}
                alt={alt}
                fill
                sizes="(min-width: 768px) 600px, 100vw"
                className="object-cover"
              />
              {player && !playing ? (
                <button
                  type="button"
                  aria-label="Play video"
                  onClick={() => setPlaying(true)}
                  className="absolute inset-0 z-10 grid place-items-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
                >
                  <span className="grid size-16 place-items-center bg-primary text-white shadow-lg transition hover:bg-primary-container">
                    <Play aria-hidden className="size-7 fill-current" />
                  </span>
                </button>
              ) : null}
              {player && playing ? (
                <div className="absolute inset-0 z-20 bg-black">{player}</div>
              ) : null}
            </div>
            <CarouselArrow direction="next" onClick={() => goTo(active + 1)} />
          </div>
        }
        text={
          <>
            {intro}
            <div
              key={active}
              aria-live="polite"
              className="editorial-swap mt-8"
            >
              {items[active].text}
              {player && !playing ? (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="mt-8 inline-flex bg-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Watch the video
                </button>
              ) : null}
            </div>
            <p className="mt-8 font-serif text-sm tracking-widest text-secondary">
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(count).padStart(2, "0")}
            </p>
          </>
        }
      />
    </div>
  );
}
