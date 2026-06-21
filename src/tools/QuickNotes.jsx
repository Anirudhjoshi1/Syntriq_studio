import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Search, StickyNote, FileText } from "lucide-react";
import { useLocalState, uid } from "../hooks/useLocalState";

const now = () => Date.now();

function relTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function QuickNotes() {
  const [notes, setNotes] = useLocalState("syntriq.notes", []);
  const [activeId, setActiveId] = useState(notes[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const sorted = [...notes].sort((a, b) => b.updated - a.updated);
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [notes, query]);

  const active = notes.find((n) => n.id === activeId) || null;

  function addNote() {
    const note = { id: uid("note"), title: "", body: "", updated: now() };
    setNotes((n) => [note, ...n]);
    setActiveId(note.id);
  }
  function patch(id, p) {
    setNotes((n) =>
      n.map((x) => (x.id === id ? { ...x, ...p, updated: now() } : x))
    );
  }
  function remove(id) {
    setNotes((n) => {
      const next = n.filter((x) => x.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  return (
    <div className="qn-layout">
      {/* list */}
      <aside className="qn-list glass">
        <div className="qn-search field-input">
          <Search size={16} />
          <input
            placeholder="Search notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="qn-new" onClick={addNote}>
          <Plus size={16} /> New note
        </button>

        <div className="qn-items">
          {filtered.length === 0 ? (
            <div className="qn-empty">
              {notes.length === 0 ? "No notes yet" : "No matches"}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((n) => (
                <motion.button
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`qn-item ${n.id === activeId ? "active" : ""}`}
                  onClick={() => setActiveId(n.id)}
                >
                  <span className="qn-item-title">
                    {n.title.trim() || "Untitled note"}
                  </span>
                  <span className="qn-item-prev">
                    {n.body.trim().slice(0, 60) || "No additional text"}
                  </span>
                  <span className="qn-item-time">{relTime(n.updated)}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>
      </aside>

      {/* editor */}
      <section className="qn-editor glass">
        {active ? (
          <>
            <div className="qn-editor-bar">
              <span className="qn-saved">Saved · {relTime(active.updated)}</span>
              <button className="icon-act del" onClick={() => remove(active.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            <input
              className="qn-title"
              placeholder="Title"
              value={active.title}
              onChange={(e) => patch(active.id, { title: e.target.value })}
            />
            <textarea
              className="qn-body"
              placeholder="Start writing…"
              value={active.body}
              onChange={(e) => patch(active.id, { body: e.target.value })}
            />
          </>
        ) : (
          <div className="qn-placeholder">
            <StickyNote size={26} />
            <p>Select a note or create a new one.</p>
            <button className="export-btn" onClick={addNote}>
              <Plus size={17} /> New note
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
