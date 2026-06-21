import { motion } from "framer-motion";
import { LayoutGrid, Settings, Lock } from "lucide-react";
import { tools } from "../data/tools";

export default function Sidebar({ active, onNavigate, open, onClose }) {
  return (
    <>
      <div
        className={`sidebar-scrim ${open ? "show" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar glass ${open ? "open" : ""}`}>
        <div className="brand" onClick={() => onNavigate("dashboard")}>
          <div className="brand-mark">
            <svg viewBox="0 0 64 64" width="22" height="22">
              <path d="M22 40l7-9 5 6 4-5 6 8z" fill="white" />
              <circle cx="24" cy="24" r="4" fill="white" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Syntriq</span>
            <span className="brand-sub">Studio</span>
          </div>
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${active === "dashboard" ? "active" : ""}`}
            onClick={() => onNavigate("dashboard")}
          >
            <LayoutGrid size={18} />
            <span>Dashboard</span>
            {active === "dashboard" && (
              <motion.span layoutId="nav-pill" className="nav-pill" />
            )}
          </button>

          <p className="nav-label">Tools</p>

          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                className={`nav-item ${isActive ? "active" : ""} ${
                  t.ready ? "" : "locked"
                }`}
                onClick={() => t.ready && onNavigate(t.id)}
              >
                <Icon size={18} />
                <span>{t.name}</span>
                {!t.ready && <Lock size={13} className="nav-lock" />}
                {isActive && (
                  <motion.span layoutId="nav-pill" className="nav-pill" />
                )}
              </button>
            );
          })}
        </nav>

        <button
          className={`nav-item nav-foot ${active === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
        >
          <Settings size={18} />
          <span>Settings</span>
          {active === "settings" && (
            <motion.span layoutId="nav-pill" className="nav-pill" />
          )}
        </button>
      </aside>
    </>
  );
}
