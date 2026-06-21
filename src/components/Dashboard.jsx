import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { tools } from "../data/tools";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function Dashboard({ onOpen }) {
  const readyCount = tools.filter((t) => t.ready).length;

  return (
    <div className="dash">
      <motion.div
        className="hero glass"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-glow" />
        <span className="hero-badge">
          <Sparkles size={14} /> Your personal study toolkit
        </span>
        <h1 className="hero-title">
          Everything you need to <span className="grad-text">study smarter</span>,
          in one place.
        </h1>
        <p className="hero-sub">
          A growing collection of fast, beautiful tools. Pick one below and get
          straight to work — no sign-ups, nothing leaves your device.
        </p>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-n">{readyCount}</span>
            <span className="stat-l">Live tool{readyCount > 1 ? "s" : ""}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-n">{tools.length - readyCount}</span>
            <span className="stat-l">In the works</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-n">100%</span>
            <span className="stat-l">Private</span>
          </div>
        </div>
      </motion.div>

      <div className="dash-head">
        <h2 className="section-title">All tools</h2>
        <span className="section-meta">{tools.length} total</span>
      </div>

      <motion.div
        className="tool-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <motion.button
              key={t.id}
              className={`tool-card glass ${t.ready ? "" : "soon"}`}
              variants={item}
              whileHover={t.ready ? { y: -6 } : {}}
              whileTap={t.ready ? { scale: 0.985 } : {}}
              onClick={() => t.ready && onOpen(t.id)}
              style={{
                "--a1": t.accent[0],
                "--a2": t.accent[1],
              }}
            >
              <div className="card-shine" />
              <div className="card-top">
                <div className="card-icon">
                  <Icon size={22} strokeWidth={2} />
                </div>
                {t.ready ? (
                  <span className="card-go">
                    <ArrowRight size={16} />
                  </span>
                ) : (
                  <span className="card-soon">Soon</span>
                )}
              </div>
              <h3 className="card-name">{t.name}</h3>
              <p className="card-tag">{t.tagline}</p>
              <span className="card-cat">{t.category}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
