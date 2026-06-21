import { motion } from "framer-motion";

/**
 * Slowly drifting gradient blobs behind a faint grid. Heavy blur + the glass
 * panels on top create the "liquid glass" depth.
 */
// Colors come from the active theme's accent variables, so the whole
// backdrop recolors instantly when the theme changes.
const blobs = [
  { c1: "var(--violet)", c2: "var(--blue)", size: 620, x: "-8%", y: "-12%", dur: 26 },
  { c1: "var(--teal)", c2: "var(--blue)", size: 520, x: "70%", y: "8%", dur: 32 },
  { c1: "var(--pink)", c2: "var(--violet)", size: 560, x: "55%", y: "62%", dur: 30 },
  { c1: "var(--blue)", c2: "var(--teal)", size: 460, x: "-6%", y: "60%", dur: 36 },
];

export default function Background() {
  return (
    <div className="bg-root" aria-hidden="true">
      <div className="bg-base" />
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="bg-blob"
          style={{
            width: b.size,
            height: b.size,
            left: b.x,
            top: b.y,
            background: `radial-gradient(circle at 30% 30%, ${b.c1}, ${b.c2} 55%, transparent 72%)`,
          }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -35, 25, 0],
            scale: [1, 1.12, 0.95, 1],
          }}
          transition={{
            duration: b.dur,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      <div className="bg-grid" />
      <div className="bg-noise" />
    </div>
  );
}
