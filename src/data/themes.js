/**
 * Theme registry. `id` maps to the [data-theme="…"] blocks in index.css.
 * `preview` colors are only used to paint the little swatch in Settings.
 */
export const themes = [
  {
    id: "professional",
    name: "Professional",
    desc: "Clean, flat white — the classic dashboard look",
    mode: "Light",
    flat: true,
    preview: { bg: "linear-gradient(140deg,#ffffff,#eef1f6)", c1: "#2f6bff", c2: "#6d4bff", c3: "#0fb488" },
  },
  {
    id: "glass",
    name: "Liquid Glass",
    desc: "Frosted violet & teal on deep space",
    mode: "Dark",
    preview: { bg: "linear-gradient(140deg,#16163a,#070712)", c1: "#7c5cff", c2: "#4d9fff", c3: "#37e6c0" },
  },
  {
    id: "midnight",
    name: "Midnight",
    desc: "Clean, cool graphite — easy on the eyes",
    mode: "Dark",
    preview: { bg: "linear-gradient(140deg,#1b2233,#0a0c12)", c1: "#5b7cff", c2: "#3f9bff", c3: "#37c9d8" },
  },
  {
    id: "aurora",
    name: "Aurora",
    desc: "Emerald, mint & cyan northern lights",
    mode: "Dark",
    preview: { bg: "linear-gradient(140deg,#073433,#021312)", c1: "#19c39a", c2: "#5ff0c2", c3: "#2bd4ff" },
  },
  {
    id: "nebula",
    name: "Nebula",
    desc: "Cosmic indigo, violet & magenta",
    mode: "Dark",
    preview: { bg: "linear-gradient(140deg,#2a1247,#0b0518)", c1: "#a25bff", c2: "#6c5cff", c3: "#ff63d2" },
  },
];

export const DEFAULT_THEME = "professional";
export const THEME_KEY = "syntriq.theme";
