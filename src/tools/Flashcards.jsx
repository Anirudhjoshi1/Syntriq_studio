import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Pencil,
  Play,
  ArrowLeft,
  Shuffle,
  RotateCcw,
  Check,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocalState, uid } from "../hooks/useLocalState";

export default function Flashcards() {
  const [decks, setDecks] = useLocalState("syntriq.flashcards", []);
  const [view, setView] = useState("list"); // list | edit | study
  const [activeId, setActiveId] = useState(null);

  const active = decks.find((d) => d.id === activeId) || null;

  function addDeck() {
    const deck = { id: uid("deck"), name: "Untitled deck", cards: [] };
    setDecks((d) => [deck, ...d]);
    setActiveId(deck.id);
    setView("edit");
  }
  function updateDeck(id, patch) {
    setDecks((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function deleteDeck(id) {
    setDecks((d) => d.filter((x) => x.id !== id));
  }

  if (view === "edit" && active)
    return (
      <DeckEditor
        deck={active}
        onBack={() => setView("list")}
        onChange={(patch) => updateDeck(active.id, patch)}
      />
    );

  if (view === "study" && active)
    return <StudyMode deck={active} onBack={() => setView("list")} />;

  return (
    <div className="fc-list">
      <div className="fc-list-head">
        <span className="list-count">
          {decks.length} deck{decks.length !== 1 ? "s" : ""}
        </span>
        <button className="export-btn fc-new" onClick={addDeck}>
          <Plus size={17} /> New deck
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="empty-hint big">
          <Layers size={22} />
          <span>Create your first deck and start revising.</span>
        </div>
      ) : (
        <div className="fc-grid">
          <AnimatePresence>
            {decks.map((deck) => (
              <motion.div
                key={deck.id}
                className="fc-deck glass"
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
              >
                <div className="fc-deck-top">
                  <span className="fc-deck-ic">
                    <Layers size={20} />
                  </span>
                  <span className="fc-deck-count">{deck.cards.length} cards</span>
                </div>
                <h3 className="fc-deck-name">{deck.name}</h3>
                <div className="fc-deck-actions">
                  <button
                    className="fc-study-btn"
                    disabled={!deck.cards.length}
                    onClick={() => {
                      setActiveId(deck.id);
                      setView("study");
                    }}
                  >
                    <Play size={15} /> Study
                  </button>
                  <button
                    className="icon-act"
                    title="Edit"
                    onClick={() => {
                      setActiveId(deck.id);
                      setView("edit");
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-act del"
                    title="Delete"
                    onClick={() => deleteDeck(deck.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function DeckEditor({ deck, onBack, onChange }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  function addCard() {
    if (!front.trim() || !back.trim()) return;
    onChange({
      cards: [...deck.cards, { id: uid("card"), front: front.trim(), back: back.trim() }],
    });
    setFront("");
    setBack("");
  }
  function removeCard(id) {
    onChange({ cards: deck.cards.filter((c) => c.id !== id) });
  }

  return (
    <div className="fc-editor">
      <div className="fc-edit-head">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Decks
        </button>
        <input
          className="fc-name-input"
          value={deck.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Deck name"
        />
        <span className="list-count">{deck.cards.length} cards</span>
      </div>

      <div className="fc-add glass">
        <div className="fc-add-fields">
          <textarea
            placeholder="Front (question)"
            value={front}
            onChange={(e) => setFront(e.target.value)}
          />
          <textarea
            placeholder="Back (answer)"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addCard();
            }}
          />
        </div>
        <button
          className="export-btn fc-add-btn"
          onClick={addCard}
          disabled={!front.trim() || !back.trim()}
        >
          <Plus size={16} /> Add card
        </button>
      </div>

      {deck.cards.length === 0 ? (
        <div className="empty-hint">
          <Layers size={18} />
          <span>No cards yet — add your first above.</span>
        </div>
      ) : (
        <div className="fc-cards">
          <AnimatePresence>
            {deck.cards.map((c, i) => (
              <motion.div
                key={c.id}
                className="fc-card-row glass"
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <span className="fc-card-i">{i + 1}</span>
                <div className="fc-card-text">
                  <span className="fc-card-front">{c.front}</span>
                  <span className="fc-card-back">{c.back}</span>
                </div>
                <button className="icon-act del" onClick={() => removeCard(c.id)}>
                  <Trash2 size={15} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function StudyMode({ deck, onBack }) {
  const order0 = useMemo(() => deck.cards.map((_, i) => i), [deck.cards]);
  const [queue, setQueue] = useState(order0);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);

  const total = deck.cards.length;
  const done = pos >= queue.length;
  const card = !done ? deck.cards[queue[pos]] : null;

  function shuffle() {
    const arr = [...queue.slice(pos)];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setQueue([...queue.slice(0, pos), ...arr]);
    setFlipped(false);
  }
  function restart() {
    setQueue(order0);
    setPos(0);
    setFlipped(false);
    setKnown(0);
  }
  function got() {
    setKnown((k) => k + 1);
    next();
  }
  function again() {
    setQueue((q) => [...q, q[pos]]); // requeue at the end
    next();
  }
  function next() {
    setFlipped(false);
    setPos((p) => p + 1);
  }
  function prev() {
    if (pos > 0) {
      setFlipped(false);
      setPos((p) => p - 1);
    }
  }

  return (
    <div className="fc-study">
      <div className="fc-study-head">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Decks
        </button>
        <span className="fc-study-title">{deck.name}</span>
        <button className="ghost-btn" onClick={shuffle} disabled={done}>
          <Shuffle size={15} /> Shuffle
        </button>
      </div>

      <div className="fc-progress">
        <div className="fc-progress-bar">
          <span
            style={{
              width: `${total ? (Math.min(pos, total) / queue.length) * 100 : 0}%`,
            }}
          />
        </div>
        <span className="fc-progress-txt">
          {Math.min(pos + (done ? 0 : 1), queue.length)} / {queue.length}
        </span>
      </div>

      {done ? (
        <motion.div
          className="fc-done glass"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Check size={34} />
          <h3>Round complete</h3>
          <p>
            You knew <strong>{known}</strong> of {total} cards.
          </p>
          <button className="export-btn" onClick={restart}>
            <RotateCcw size={17} /> Study again
          </button>
        </motion.div>
      ) : (
        <>
          <div className="fc-flip-area" onClick={() => setFlipped((f) => !f)}>
            <motion.div
              className="fc-flip"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="fc-face fc-front glass">
                <span className="fc-face-label">Question</span>
                <p>{card.front}</p>
                <span className="fc-tap-hint">tap to flip</span>
              </div>
              <div className="fc-face fc-back glass">
                <span className="fc-face-label">Answer</span>
                <p>{card.back}</p>
                <span className="fc-tap-hint">tap to flip</span>
              </div>
            </motion.div>
          </div>

          <div className="fc-study-controls">
            <button className="icon-act big" onClick={prev} disabled={pos === 0}>
              <ChevronLeft size={20} />
            </button>
            <button className="fc-again" onClick={again}>
              <X size={17} /> Again
            </button>
            <button className="fc-got" onClick={got}>
              <Check size={17} /> Got it
            </button>
            <button className="icon-act big" onClick={next}>
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
