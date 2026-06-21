import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Minus, Plus, Flame, CheckCircle2 } from "lucide-react";
import { useLocalState } from "../hooks/useLocalState";

const MODES = {
  focus: { label: "Focus", key: "focus" },
  short: { label: "Short break", key: "short" },
  long: { label: "Long break", key: "long" },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    o.start();
    o.stop(ctx.currentTime + 0.72);
  } catch {
    /* audio not available */
  }
}

export default function FocusTimer() {
  const [durations, setDurations] = useLocalState("syntriq.timer.durations", {
    focus: 25,
    short: 5,
    long: 15,
  });
  const [stats, setStats] = useLocalState("syntriq.timer.stats", {
    date: todayStr(),
    today: 0,
    total: 0,
    cycles: 0,
    streak: 0,
    lastDay: null,
  });

  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(durations.focus * 60);
  const targetRef = useRef(null);
  const tickRef = useRef(null);

  const full = durations[mode] * 60;
  const progress = full > 0 ? 1 - secondsLeft / full : 0;

  // reset the clock whenever the mode or its duration changes (while paused)
  useEffect(() => {
    if (!running) setSecondsLeft(durations[mode] * 60);
  }, [mode, durations, running]);

  // tick loop driven by an absolute target time (robust to tab throttling)
  useEffect(() => {
    if (!running) {
      clearInterval(tickRef.current);
      return;
    }
    targetRef.current = Date.now() + secondsLeft * 1000;
    tickRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((targetRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(tickRef.current);
        onFinish();
      }
    }, 200);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function onFinish() {
    setRunning(false);
    beep();
    if (mode === "focus") {
      setStats((s) => {
        const t = todayStr();
        const sameDay = s.date === t;
        // streak: bump when first focus of a new day, continued from yesterday
        let streak = s.streak;
        if (s.lastDay !== t) {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          const yStr = y.toISOString().slice(0, 10);
          streak = s.lastDay === yStr ? s.streak + 1 : 1;
        }
        return {
          date: t,
          today: (sameDay ? s.today : 0) + 1,
          total: s.total + 1,
          cycles: s.cycles + 1,
          streak,
          lastDay: t,
        };
      });
      // after 4 focus cycles, suggest a long break
      const nextLong = (stats.cycles + 1) % 4 === 0;
      setMode(nextLong ? "long" : "short");
    } else {
      setMode("focus");
    }
  }

  const toggle = () => setRunning((r) => !r);
  const reset = () => {
    setRunning(false);
    setSecondsLeft(durations[mode] * 60);
  };

  const adjust = (key, delta) =>
    setDurations((d) => ({
      ...d,
      [key]: Math.min(90, Math.max(1, d[key] + delta)),
    }));

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const R = 130;
  const C = 2 * Math.PI * R;

  return (
    <div className="ft-wrap">
      <div className="ft-main glass">
        <div className="seg ft-modes">
          {Object.values(MODES).map((m) => (
            <button
              key={m.key}
              className={`seg-btn ${mode === m.key ? "active" : ""}`}
              onClick={() => setMode(m.key)}
            >
              {mode === m.key && (
                <motion.span layoutId="ft-mode" className="seg-pill" />
              )}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="ft-ring">
          <svg viewBox="0 0 300 300" className="ft-svg">
            <circle cx="150" cy="150" r={R} className="ft-track" />
            <motion.circle
              cx="150"
              cy="150"
              r={R}
              className="ft-prog"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 150 150)"
              animate={{ strokeDashoffset: C * (1 - progress) }}
              transition={{ ease: "linear", duration: 0.2 }}
            />
          </svg>
          <div className="ft-time">
            <span className="ft-clock">
              {mm}:{ss}
            </span>
            <span className="ft-state">
              {running ? "in progress" : secondsLeft === full ? "ready" : "paused"}
            </span>
          </div>
        </div>

        <div className="ft-controls">
          <button className="ft-reset" onClick={reset} title="Reset">
            <RotateCcw size={20} />
          </button>
          <button className="ft-play" onClick={toggle}>
            {running ? <Pause size={26} /> : <Play size={26} />}
            <span>{running ? "Pause" : "Start"}</span>
          </button>
          <div className="ft-reset ghost-spacer" />
        </div>
      </div>

      <div className="ft-side">
        <div className="ft-stats glass">
          <div className="ft-stat">
            <CheckCircle2 size={18} className="ft-stat-ic teal" />
            <div>
              <span className="ft-stat-n">{stats.date === todayStr() ? stats.today : 0}</span>
              <span className="ft-stat-l">Today</span>
            </div>
          </div>
          <div className="ft-stat">
            <Flame size={18} className="ft-stat-ic orange" />
            <div>
              <span className="ft-stat-n">{stats.streak || 0}</span>
              <span className="ft-stat-l">Day streak</span>
            </div>
          </div>
          <div className="ft-stat">
            <span className="ft-stat-total">{stats.total}</span>
            <div>
              <span className="ft-stat-l">Total focus sessions</span>
            </div>
          </div>
        </div>

        <div className="ft-durations glass">
          <h3 className="panel-title">Durations (min)</h3>
          {Object.values(MODES).map((m) => (
            <div className="ft-dur-row" key={m.key}>
              <span className="ft-dur-label">{m.label}</span>
              <div className="ft-stepper">
                <button onClick={() => adjust(m.key, -1)} disabled={running}>
                  <Minus size={15} />
                </button>
                <span>{durations[m.key]}</span>
                <button onClick={() => adjust(m.key, 1)} disabled={running}>
                  <Plus size={15} />
                </button>
              </div>
            </div>
          ))}
          <p className="panel-note">A long break is suggested every 4 focus sessions.</p>
        </div>
      </div>
    </div>
  );
}
