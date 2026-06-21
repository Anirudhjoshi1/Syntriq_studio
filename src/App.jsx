import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Menu, Loader2 } from "lucide-react";
import Background from "./components/Background";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Settings from "./components/Settings";
import { InstallButton, UpdateToast } from "./components/Pwa";
import { tools } from "./data/tools";
import { themes, DEFAULT_THEME, THEME_KEY } from "./data/themes";
import "./styles/app.css";

const validTheme = (id) =>
  themes.some((t) => t.id === id) ? id : DEFAULT_THEME;

// Tools are code-split: jsPDF / mammoth only download when a tool is opened.
const ImageToPdf = lazy(() => import("./tools/ImageToPdf"));
const WordToPdf = lazy(() => import("./tools/WordToPdf"));
const ImageCompressor = lazy(() => import("./tools/ImageCompressor"));
const PdfCompressor = lazy(() => import("./tools/PdfCompressor"));

const toolComponents = {
  "image-to-pdf": ImageToPdf,
  "word-to-pdf": WordToPdf,
  "image-compressor": ImageCompressor,
  "pdf-compressor": PdfCompressor,
};

export default function App() {
  const [view, setView] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof localStorage === "undefined") return DEFAULT_THEME;
    return validTheme(localStorage.getItem(THEME_KEY));
  });

  // apply + persist the theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [theme]);

  const navigate = (id) => {
    setView(id);
    setMenuOpen(false);
  };

  const activeTool = tools.find((t) => t.id === view);
  const ToolComponent = toolComponents[view];
  const crumbLabel =
    view === "dashboard"
      ? "Overview"
      : view === "settings"
      ? "Settings"
      : activeTool?.name;

  return (
    <div className="app">
      <Background />
      <Sidebar
        active={view}
        onNavigate={navigate}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn menu-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            {view !== "dashboard" && (
              <button className="back-btn" onClick={() => navigate("dashboard")}>
                <ArrowLeft size={16} /> Dashboard
              </button>
            )}
            <div className="crumb">
              <span className="crumb-dim">Syntriq</span>
              <span className="crumb-sep">/</span>
              <span>{crumbLabel}</span>
            </div>
          </div>
          <div className="topbar-right">
            <InstallButton />
            <div className="avatar" title="You">
              S
            </div>
          </div>
        </header>

        <div className="content">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="view"
            >
              {view === "dashboard" ? (
                <Dashboard onOpen={navigate} />
              ) : view === "settings" ? (
                <Settings theme={theme} onThemeChange={setTheme} />
              ) : ToolComponent ? (
                <div className="tool-shell">
                  <div className="tool-header">
                    <h1 className="tool-title">{activeTool?.name}</h1>
                    <p className="tool-desc">{activeTool?.tagline}</p>
                  </div>
                  <Suspense
                    fallback={
                      <div className="tool-loading">
                        <Loader2 size={24} className="spin" />
                        <span>Loading tool…</span>
                      </div>
                    }
                  >
                    <ToolComponent />
                  </Suspense>
                </div>
              ) : (
                <div className="placeholder">Coming soon.</div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <UpdateToast />
    </div>
  );
}
