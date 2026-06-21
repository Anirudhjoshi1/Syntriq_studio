import { motion } from "framer-motion";
import { Check, Palette, Monitor, Info } from "lucide-react";
import { themes } from "../data/themes";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function Settings({ theme, onThemeChange }) {
  return (
    <div className="settings">
      <div className="settings-head">
        <h1 className="tool-title">Settings</h1>
        <p className="tool-desc">Make Syntriq Studio feel like yours.</p>
      </div>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-ic">
            <Palette size={17} />
          </span>
          <div>
            <h2 className="settings-section-title">Appearance</h2>
            <p className="settings-section-sub">
              Pick a theme — it applies instantly and is remembered next time.
            </p>
          </div>
        </div>

        <motion.div
          className="theme-grid"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {themes.map((t) => {
            const active = theme === t.id;
            return (
              <motion.button
                key={t.id}
                variants={item}
                className={`theme-card glass ${active ? "active" : ""}`}
                onClick={() => onThemeChange(t.id)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  className="theme-swatch"
                  style={{ background: t.preview.bg }}
                >
                  <span
                    className="swatch-blob b1"
                    style={{ background: t.preview.c1 }}
                  />
                  <span
                    className="swatch-blob b2"
                    style={{ background: t.preview.c2 }}
                  />
                  <span
                    className="swatch-blob b3"
                    style={{ background: t.preview.c3 }}
                  />
                  <span className="swatch-glass" />
                  {active && (
                    <motion.span
                      layoutId="theme-check"
                      className="theme-check"
                    >
                      <Check size={14} strokeWidth={3} />
                    </motion.span>
                  )}
                </div>
                <div className="theme-meta">
                  <div className="theme-name-row">
                    <span className="theme-name">{t.name}</span>
                    <span className="theme-mode">{t.mode}</span>
                  </div>
                  <span className="theme-desc">{t.desc}</span>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-ic">
            <Monitor size={17} />
          </span>
          <div>
            <h2 className="settings-section-title">About</h2>
            <p className="settings-section-sub">Your private, on-device study toolkit.</p>
          </div>
        </div>
        <div className="about-note glass">
          <Info size={16} />
          <span>
            Syntriq Studio runs entirely in your browser — nothing you open or create
            ever leaves your device. More tools &amp; settings are on the way.
          </span>
        </div>
      </section>
    </div>
  );
}
