/**
 * CosmicBackground — light, modern cosmic ambient layer for MysticAI.
 *
 * Pure CSS + SVG. No canvas, no requestAnimationFrame loop. The previous
 * implementation ran a 560-star canvas paint loop; on mobile that hit
 * the GPU on every frame just to draw twinkles. This version is hardware-
 * accelerated CSS animations — the browser handles them on the compositor
 * thread, so the JS thread stays free and bundle / runtime cost is tiny.
 *
 * Visual: pastel celestial palette (lavender → rose → mint), three glowing
 * planets, a small constellation of twinkling stars, and shooting stars
 * that streak BETWEEN planets — making the planets feel like they're
 * exchanging light. Respects prefers-reduced-motion.
 */

const STARS = [
  { x: 12, y: 18, size: 2, delay: 0 },
  { x: 24, y: 8, size: 1, delay: 1.2 },
  { x: 38, y: 22, size: 1.5, delay: 2.4 },
  { x: 47, y: 6, size: 1, delay: 0.8 },
  { x: 58, y: 14, size: 2, delay: 3.1 },
  { x: 67, y: 28, size: 1, delay: 1.6 },
  { x: 78, y: 9, size: 1.5, delay: 2.0 },
  { x: 89, y: 18, size: 1, delay: 0.4 },
  { x: 8, y: 42, size: 1, delay: 2.8 },
  { x: 19, y: 56, size: 1.5, delay: 1.0 },
  { x: 31, y: 68, size: 1, delay: 3.4 },
  { x: 44, y: 78, size: 2, delay: 0.6 },
  { x: 56, y: 84, size: 1, delay: 2.2 },
  { x: 71, y: 64, size: 1.5, delay: 1.8 },
  { x: 82, y: 76, size: 1, delay: 3.0 },
  { x: 92, y: 52, size: 2, delay: 1.4 },
  { x: 28, y: 92, size: 1, delay: 0.2 },
  { x: 63, y: 48, size: 1, delay: 2.6 },
  { x: 5, y: 72, size: 1, delay: 1.1 },
  { x: 96, y: 36, size: 1.5, delay: 0.9 },
];

// Each shooting star streaks between two planet anchors. The CSS animation
// uses a different `delay` and `duration` per beam so the streaks feel
// organic rather than synchronized.
const BEAMS = [
  { from: 'saturn', to: 'neptune', delay: 0,   duration: 4.5 },
  { from: 'neptune', to: 'mars',    delay: 1.8, duration: 5.2 },
  { from: 'mars',    to: 'saturn',  delay: 3.6, duration: 4.8 },
  { from: 'saturn', to: 'mars',    delay: 5.4, duration: 5.0 },
  { from: 'neptune', to: 'saturn',  delay: 7.2, duration: 4.7 },
];

// Planet anchor coordinates as % of viewport (top-left origin).
const PLANETS = {
  saturn:  { x: 88, y: 22 },
  neptune: { x: 90, y: 78 },
  mars:    { x: 8,  y: 88 },
};

export function CosmicBackground() {
  return (
    <div
      aria-hidden
      className="cosmic-bg fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Layered gradient base — pastel celestial. Static, GPU-cheap. */}
      <div className="cosmic-base" />
      <div className="cosmic-aurora" />

      {/* Twinkling stars — CSS-animated opacity only, ~20 elements. */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="cosmic-star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Planets — SVG with soft glow filter. */}
      <svg className="cosmic-planet cosmic-saturn" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <radialGradient id="saturnBody" cx="40%" cy="38%">
            <stop offset="0%"  stopColor="#fff4d6" />
            <stop offset="55%" stopColor="#f3a55b" />
            <stop offset="100%" stopColor="#a3621e" />
          </radialGradient>
          <radialGradient id="saturnHalo">
            <stop offset="60%" stopColor="rgba(255, 215, 140, 0.0)" />
            <stop offset="100%" stopColor="rgba(255, 215, 140, 0.18)" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#saturnHalo)" />
        <ellipse cx="100" cy="105" rx="84" ry="14" fill="none" stroke="rgba(255,225,170,0.4)" strokeWidth="3" />
        <ellipse cx="100" cy="105" rx="92" ry="18" fill="none" stroke="rgba(255,225,170,0.18)" strokeWidth="2" />
        <circle cx="100" cy="100" r="58" fill="url(#saturnBody)" />
      </svg>

      <svg className="cosmic-planet cosmic-neptune" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <radialGradient id="neptuneBody" cx="38%" cy="40%">
            <stop offset="0%"  stopColor="#cde9ff" />
            <stop offset="60%" stopColor="#5d8ad1" />
            <stop offset="100%" stopColor="#1f3d70" />
          </radialGradient>
          <radialGradient id="neptuneHalo">
            <stop offset="65%" stopColor="rgba(120, 170, 240, 0)" />
            <stop offset="100%" stopColor="rgba(120, 170, 240, 0.16)" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#neptuneHalo)" />
        <circle cx="100" cy="100" r="52" fill="url(#neptuneBody)" />
      </svg>

      <svg className="cosmic-planet cosmic-mars" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <radialGradient id="marsBody" cx="40%" cy="38%">
            <stop offset="0%"  stopColor="#ffd6b5" />
            <stop offset="55%" stopColor="#d56a4a" />
            <stop offset="100%" stopColor="#7a2a14" />
          </radialGradient>
          <radialGradient id="marsHalo">
            <stop offset="65%" stopColor="rgba(240, 140, 100, 0)" />
            <stop offset="100%" stopColor="rgba(240, 140, 100, 0.18)" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#marsHalo)" />
        <circle cx="100" cy="100" r="40" fill="url(#marsBody)" />
      </svg>

      {/* Shooting-star beams between planets. Each beam is a tiny gradient
          strip rotated + translated via CSS variables. */}
      {BEAMS.map((b, i) => {
        const a = PLANETS[b.from as keyof typeof PLANETS];
        const c = PLANETS[b.to as keyof typeof PLANETS];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <span
            key={i}
            className="cosmic-beam"
            style={{
              ['--from-x' as string]: `${a.x}vw`,
              ['--from-y' as string]: `${a.y}vh`,
              ['--dx' as string]: `${dx}vw`,
              ['--dy' as string]: `${dy}vh`,
              ['--angle' as string]: `${angle}deg`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}
