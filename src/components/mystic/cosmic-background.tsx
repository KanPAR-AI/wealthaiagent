/**
 * CosmicBackground — starfield, shooting stars, drifting planets, nebula.
 *
 * Rendered as a fixed, full-viewport, pointer-events-none layer behind the
 * rest of the MysticAI UI. Canvas handles stars + shooting stars for
 * performance; planets are CSS-animated SVGs.
 *
 * Respects prefers-reduced-motion by freezing the canvas animation and
 * dampening planet drift.
 */

import { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  hue: number;
};

type ShootingStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
};

const STAR_COUNT_DESKTOP = 560;
const STAR_COUNT_MOBILE = 280;
const SHOOTING_STAR_INTERVAL_MS = 1100;

export function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    const starCount = isMobile ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Pre-generate stars. Size distribution is weighted so a small fraction
    // are noticeably bright "beacon" stars, which read well in screenshots
    // and in motion. Positions are biased toward a diagonal "Milky Way" band
    // for dramatic density.
    const stars: Star[] = Array.from({ length: starCount }, (_, i) => {
      // 30% of stars cluster in a diagonal band (top-left → bottom-right)
      const inBand = i % 10 < 3;
      let x: number;
      let y: number;
      if (inBand) {
        const t = Math.random();
        const bandCenterX = t * width;
        const bandCenterY = t * height * 1.1 - height * 0.05;
        const bandWidth = height * 0.28;
        x = bandCenterX + (Math.random() - 0.5) * bandWidth;
        y = bandCenterY + (Math.random() - 0.5) * bandWidth * 0.6;
      } else {
        x = Math.random() * width;
        y = Math.random() * height;
      }

      const sizeRoll = Math.random();
      const r =
        sizeRoll > 0.98 ? 2.6 + Math.random() * 1.0 // rare beacon
        : sizeRoll > 0.88 ? 1.6 + Math.random() * 0.8 // uncommon bright
        : 0.6 + Math.random() * 1.0; // normal
      return {
        x,
        y,
        r,
        baseAlpha: r > 1.5 ? 0.9 + Math.random() * 0.1 : 0.55 + Math.random() * 0.4,
        twinkleSpeed: Math.random() * 0.0018 + 0.0005,
        twinklePhase: Math.random() * Math.PI * 2,
        hue:
          Math.random() < 0.1 ? 40 + Math.random() * 30 // golden
          : Math.random() < 0.2 ? 260 + Math.random() * 40 // violet
          : 210 + Math.random() * 20, // mostly cool-white-blue
      };
    });

    const shootingStars: ShootingStar[] = [];
    let lastShootSpawn = 0;

    const spawnShootingStar = () => {
      const fromLeft = Math.random() < 0.5;
      const angle = (Math.PI / 6) + (Math.random() * Math.PI / 6); // 30–60°
      const speed = Math.random() * 0.9 + 1.1; // px per ms
      const vx = (fromLeft ? 1 : -1) * Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const startY = Math.random() * height * 0.6;
      shootingStars.push({
        x: fromLeft ? -50 : width + 50,
        y: startY,
        vx,
        vy,
        life: 0,
        maxLife: 1200 + Math.random() * 800,
        length: 80 + Math.random() * 80,
      });
    };

    let lastTime = performance.now();

    const render = (t: number) => {
      const dt = Math.min(t - lastTime, 64); // cap delta for tab-switch jumps
      lastTime = t;

      ctx.clearRect(0, 0, width, height);

      // Stars
      for (const s of stars) {
        const twinkle = reduceMotion
          ? s.baseAlpha
          : s.baseAlpha * (0.65 + 0.35 * Math.sin(s.twinklePhase + t * s.twinkleSpeed));
        const glow = `hsla(${s.hue}, 90%, 85%, ${twinkle})`;
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Soft halo on the brightest stars — the halo is what gives them
        // their "constellation" presence instead of a bare dot.
        if (s.r > 1.0) {
          const haloRadius = s.r * 8;
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, haloRadius);
          grad.addColorStop(0, `hsla(${s.hue}, 95%, 85%, ${twinkle * 0.55})`);
          grad.addColorStop(0.4, `hsla(${s.hue}, 95%, 85%, ${twinkle * 0.15})`);
          grad.addColorStop(1, `hsla(${s.hue}, 95%, 85%, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, haloRadius, 0, Math.PI * 2);
          ctx.fill();

          // Four-point starburst cross on the biggest beacons
          if (s.r > 1.8) {
            ctx.strokeStyle = `hsla(${s.hue}, 95%, 92%, ${twinkle * 0.45})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(s.x - s.r * 4, s.y);
            ctx.lineTo(s.x + s.r * 4, s.y);
            ctx.moveTo(s.x, s.y - s.r * 4);
            ctx.lineTo(s.x, s.y + s.r * 4);
            ctx.stroke();
          }
        }
      }

      // Shooting stars
      if (!reduceMotion && t - lastShootSpawn > SHOOTING_STAR_INTERVAL_MS + Math.random() * 2200) {
        spawnShootingStar();
        lastShootSpawn = t;
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.life += dt;
        s.x += s.vx * dt * 0.4;
        s.y += s.vy * dt * 0.4;

        const alpha = Math.max(0, 1 - s.life / s.maxLife);
        const tailX = s.x - s.vx * s.length * 0.4;
        const tailY = s.y - s.vy * s.length * 0.4;

        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,240,220,${alpha})`);
        grad.addColorStop(0.4, `rgba(200,170,255,${alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(200,170,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Bright head
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,250,240,${alpha})`;
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();

        if (s.life > s.maxLife || s.x < -200 || s.x > width + 200 || s.y > height + 200) {
          shootingStars.splice(i, 1);
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="mystic-cosmos" aria-hidden="true">
      {/* Base nebula gradient */}
      <div className="mystic-nebula" />
      {/* Canvas starfield + shooting stars */}
      <canvas ref={canvasRef} className="mystic-starfield" />
      {/* Planets drifting on CSS animations */}
      <div className="mystic-planets">
        <Planet
          className="mystic-planet mystic-planet--saturn"
          size={260}
          hue={36}
          ring
          style={{ top: '6%', right: '4%' }}
        />
        <Planet
          className="mystic-planet mystic-planet--mars"
          size={150}
          hue={18}
          style={{ top: '62%', left: '3%' }}
        />
        <Planet
          className="mystic-planet mystic-planet--neptune"
          size={190}
          hue={220}
          style={{ top: '74%', right: '12%' }}
        />
        <Planet
          className="mystic-planet mystic-planet--small"
          size={80}
          hue={280}
          style={{ top: '22%', left: '4%' }}
        />
      </div>
      {/* Vignette to focus chat content */}
      <div className="mystic-vignette" />
    </div>
  );
}

function Planet({
  size,
  hue,
  ring,
  className,
  style,
}: {
  size: number;
  hue: number;
  ring?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={style}
    >
      <defs>
        <radialGradient id={`planet-${hue}`} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor={`hsl(${hue}, 85%, 78%)`} />
          <stop offset="55%" stopColor={`hsl(${hue}, 70%, 48%)`} />
          <stop offset="100%" stopColor={`hsl(${hue + 15}, 60%, 14%)`} />
        </radialGradient>
        <radialGradient id={`planet-glow-${hue}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={`hsla(${hue}, 95%, 72%, 0.45)`} />
          <stop offset="100%" stopColor={`hsla(${hue}, 95%, 72%, 0)`} />
        </radialGradient>
      </defs>
      {/* Glow */}
      <circle cx="100" cy="100" r="96" fill={`url(#planet-glow-${hue})`} />
      {/* Planet body */}
      <circle cx="100" cy="100" r="68" fill={`url(#planet-${hue})`} />
      {/* Subtle surface band */}
      <ellipse
        cx="100"
        cy="108"
        rx="62"
        ry="9"
        fill={`hsla(${hue + 20}, 60%, 25%, 0.35)`}
      />
      {/* Optional ring (for Saturn) */}
      {ring && (
        <g>
          <ellipse
            cx="100"
            cy="100"
            rx="96"
            ry="18"
            fill="none"
            stroke={`hsla(${hue}, 70%, 70%, 0.45)`}
            strokeWidth="4"
            transform="rotate(-14 100 100)"
          />
          <ellipse
            cx="100"
            cy="100"
            rx="88"
            ry="14"
            fill="none"
            stroke={`hsla(${hue + 25}, 80%, 85%, 0.35)`}
            strokeWidth="2"
            transform="rotate(-14 100 100)"
          />
        </g>
      )}
    </svg>
  );
}
