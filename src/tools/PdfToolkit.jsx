import { useCallback, useEffect, useRef, useState } from "react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileDown,
  Loader2,
  RotateCw,
  Trash2,
  CheckCircle2,
  Files,
  Scissors,
  X,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, degrees } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SRC_COLORS = ["#7c5cff", "#4d9fff", "#37e6c0", "#ff8a5c", "#ff5c8a", "#ffb35c"];
let pageUid = 0;
let srcUid = 0;

function renderThumb(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return page.render({ canvasContext: ctx, viewport }).promise.then(() =>
    canvas.toDataURL("image/jpeg", 0.7)
  );
}

export default function PdfToolkit() {
  const [sources, setSources] = useState({}); // id -> { id, name, bytes, color }
  const [pages, setPages] = useState([]); // ordered working set
  const [selected, setSelected] = useState(() => new Set());
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const [filename, setFilename] = useState("syntriq-document");
  const inputRef = useRef(null);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  useEffect(() => {
    setDone(false);
  }, [pages]);

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (!files.length) return;
    setLoading(true);
    try {
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf.slice(0)); // keep a copy for pdf-lib
        const id = `src-${srcUid++}`;
        const color = SRC_COLORS[Object.keys(sourcesRef.current).length % SRC_COLORS.length];
        setSources((prev) => ({ ...prev, [id]: { id, name: file.name, bytes, color } }));

        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          setStatus(`Loading ${file.name} — page ${i}/${pdf.numPages}`);
          const page = await pdf.getPage(i);
          const thumb = await renderThumb(page, 0.4);
          const entry = {
            id: `pg-${pageUid++}`,
            srcId: id,
            srcName: file.name,
            index: i - 1,
            rot: 0,
            thumb,
          };
          setPages((prev) => [...prev, entry]);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    } finally {
      setLoading(false);
      setStatus("");
    }
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const selectAll = () => setSelected(new Set(pages.map((p) => p.id)));
  const clearSelect = () => setSelected(new Set());

  function rotate(ids, dir = 1) {
    const set = new Set(ids);
    setPages((prev) =>
      prev.map((p) =>
        set.has(p.id) ? { ...p, rot: (p.rot + dir * 90 + 360) % 360 } : p
      )
    );
  }

  function deletePages(ids) {
    const set = new Set(ids);
    setPages((prev) => prev.filter((p) => !set.has(p.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function clearAll() {
    setPages([]);
    setSources({});
    setSelected(new Set());
  }

  async function exportPdf(list, suffix = "") {
    if (!list.length || busy) return;
    setBusy(true);
    setStatus("Building PDF…");
    setDone(false);
    try {
      const out = await PDFDocument.create();
      const cache = {};
      for (const srcId of new Set(list.map((p) => p.srcId))) {
        cache[srcId] = await PDFDocument.load(sourcesRef.current[srcId].bytes);
      }
      for (const p of list) {
        const [copied] = await out.copyPages(cache[p.srcId], [p.index]);
        if (p.rot) {
          const base = copied.getRotation().angle || 0;
          copied.setRotation(degrees((base + p.rot) % 360));
        }
        out.addPage(copied);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename.trim() || "document"}${suffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 3500);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  const selectedList = pages.filter((p) => selected.has(p.id));
  const sourceCount = Object.keys(sources).length;
  const hasPages = pages.length > 0;

  return (
    <div className="tool-page">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* toolbar */}
      <div className="pdft-toolbar glass">
        <div className="pdft-tool-info">
          <Files size={18} />
          <span>
            {hasPages
              ? `${pages.length} page${pages.length > 1 ? "s" : ""}${
                  sourceCount > 1 ? ` · ${sourceCount} files merged` : ""
                }`
              : "No pages yet"}
          </span>
        </div>
        <div className="pdft-tool-right">
          {hasPages && (
            <button className="ghost-btn" onClick={selectAll}>
              Select all
            </button>
          )}
          <div className="field-input pdft-name">
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              spellCheck={false}
            />
            <span className="field-suffix">.pdf</span>
          </div>
          <button
            className={`export-btn pdft-export ${done ? "ok" : ""}`}
            disabled={!hasPages || busy}
            onClick={() => exportPdf(pages)}
          >
            {busy ? (
              <>
                <Loader2 size={17} className="spin" /> {status || "Working…"}
              </>
            ) : done ? (
              <>
                <CheckCircle2 size={17} /> Saved!
              </>
            ) : (
              <>
                <FileDown size={17} /> Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* dropzone */}
      <motion.div
        className={`dropzone glass ${dragOver ? "over" : ""} ${
          hasPages ? "compact" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        whileHover={{ scale: hasPages ? 1 : 1.005 }}
      >
        <div className="dz-icon">
          <UploadCloud size={hasPages ? 24 : 34} />
        </div>
        <div className="dz-text">
          <strong>{hasPages ? "Add more PDFs to merge" : "Drop your PDFs here"}</strong>
          <span>
            {hasPages
              ? "or click to browse"
              : "or click to browse — merge, reorder, rotate & split"}
          </span>
        </div>
        {loading && (
          <span className="pdft-loading">
            <Loader2 size={15} className="spin" /> {status}
          </span>
        )}
      </motion.div>

      {/* selection action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            className="pdft-selbar glass"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <span className="pdft-sel-count">{selected.size} selected</span>
            <div className="pdft-sel-actions">
              <button className="ghost-btn" onClick={() => rotate([...selected], 1)}>
                <RotateCw size={15} /> Rotate
              </button>
              <button
                className="ghost-btn"
                onClick={() => exportPdf(selectedList, "-extract")}
              >
                <Scissors size={15} /> Export selected
              </button>
              <button
                className="ghost-btn danger"
                onClick={() => deletePages([...selected])}
              >
                <Trash2 size={15} /> Delete
              </button>
              <button className="ghost-btn" onClick={clearSelect}>
                <X size={15} /> Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* page grid */}
      {hasPages ? (
        <>
          <div className="pdft-grid-head">
            <span className="list-count">Drag to reorder · click a page to select</span>
            <button className="ghost-btn danger" onClick={clearAll}>
              <Trash2 size={15} /> Clear all
            </button>
          </div>
          <Reorder.Group
            as="div"
            values={pages}
            onReorder={setPages}
            className="pdft-grid"
          >
            <AnimatePresence>
              {pages.map((p, idx) => {
                const isSel = selected.has(p.id);
                return (
                  <Reorder.Item
                    as="div"
                    key={p.id}
                    value={p}
                    className={`pdft-page ${isSel ? "sel" : ""}`}
                    whileDrag={{ scale: 1.04, zIndex: 5 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                  >
                    <div
                      className="pdft-thumb"
                      onClick={() => toggleSelect(p.id)}
                    >
                      <img
                        src={p.thumb}
                        alt={`page ${idx + 1}`}
                        style={{ transform: `rotate(${p.rot}deg)` }}
                        draggable={false}
                      />
                      <span
                        className="pdft-srcdot"
                        style={{ background: sources[p.srcId]?.color }}
                        title={p.srcName}
                      />
                      <span className={`pdft-check ${isSel ? "on" : ""}`}>
                        {isSel && <CheckCircle2 size={16} />}
                      </span>
                      <span className="pdft-pagenum">{idx + 1}</span>
                    </div>
                    <div className="pdft-page-actions">
                      <button
                        title="Rotate"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotate([p.id], 1);
                        }}
                      >
                        <RotateCw size={14} />
                      </button>
                      <button
                        title="Delete page"
                        className="del"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePages([p.id]);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>
        </>
      ) : (
        !loading && (
          <div className="empty-hint">
            <Files size={18} />
            <span>
              Add one or more PDFs — combine them, drag pages to reorder, rotate,
              delete, or export a selection.
            </span>
          </div>
        )
      )}
    </div>
  );
}
