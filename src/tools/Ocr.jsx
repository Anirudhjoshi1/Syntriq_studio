import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  ScanText,
  Loader2,
  Copy,
  Check,
  Download,
  X,
  FileText,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const LANGS = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "hin", label: "Hindi" },
  { code: "ita", label: "Italian" },
];

let uid = 0;

function renderToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return page.render({ canvasContext: ctx, viewport }).promise.then(() => canvas);
}

export default function Ocr() {
  const [items, setItems] = useState([]); // { id, name, kind, file, url }
  const [lang, setLang] = useState("eng");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, label: "", idx: 0, total: 0 });
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const labelRef = useRef("");

  const addFiles = useCallback((fileList) => {
    const next = [];
    for (const f of Array.from(fileList)) {
      const isImg = f.type.startsWith("image/");
      const isPdf = f.name.toLowerCase().endsWith(".pdf");
      if (!isImg && !isPdf) continue;
      next.push({
        id: `f-${uid++}`,
        name: f.name,
        kind: isImg ? "image" : "pdf",
        file: f,
        url: isImg ? URL.createObjectURL(f) : null,
      });
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  function remove(id) {
    setItems((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.url) URL.revokeObjectURL(f.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  async function run() {
    if (!items.length || busy) return;
    setBusy(true);
    setText("");
    setProgress({ pct: 0, label: "Loading language model…", idx: 0, total: 0 });

    const worker = await createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setProgress((p) => ({ ...p, pct: Math.round(m.progress * 100), label: labelRef.current }));
        } else if (m.status?.includes("loading") || m.status?.includes("initiali")) {
          setProgress((p) => ({ ...p, label: "Loading language model…" }));
        }
      },
    });

    try {
      // build the job list (one per image, one per PDF page)
      const jobs = [];
      for (const it of items) {
        if (it.kind === "image") {
          jobs.push({ label: it.name, get: async () => it.file });
        } else {
          const buf = await it.file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            jobs.push({
              label: `${it.name} — page ${i}/${pdf.numPages}`,
              get: async () => renderToCanvas(await pdf.getPage(i), 2),
            });
          }
        }
      }

      const out = [];
      for (let j = 0; j < jobs.length; j++) {
        labelRef.current = jobs[j].label;
        setProgress({ pct: 0, label: jobs[j].label, idx: j + 1, total: jobs.length });
        const source = await jobs[j].get();
        const {
          data: { text: t },
        } = await worker.recognize(source);
        out.push((jobs.length > 1 ? `# ${jobs[j].label}\n` : "") + t.trim());
        setText(out.join("\n\n"));
      }
      setProgress((p) => ({ ...p, pct: 100, label: "Done" }));
    } catch (e) {
      setText("Sorry — text recognition failed. Please try another file.");
    } finally {
      await worker.terminate();
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function download() {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted-text.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="tool-page">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="ipdf-layout">
        <div className="ipdf-main">
          <motion.div
            className={`dropzone glass ${dragOver ? "over" : ""} ${
              items.length ? "compact" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            whileHover={{ scale: items.length ? 1 : 1.005 }}
          >
            <div className="dz-icon">
              <UploadCloud size={items.length ? 24 : 34} />
            </div>
            <div className="dz-text">
              <strong>
                {items.length ? "Add more files" : "Drop images or PDFs here"}
              </strong>
              <span>
                {items.length ? "or click to browse" : "or click to browse — JPG, PNG, PDF"}
              </span>
            </div>
          </motion.div>

          {items.length > 0 && (
            <div className="ocr-files">
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.div
                    key={it.id}
                    className="ocr-file glass"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                  >
                    <span className="ocr-file-ic">
                      {it.kind === "image" ? <ImageIcon size={16} /> : <FileText size={16} />}
                    </span>
                    <span className="ocr-file-name">{it.name}</span>
                    <button className="img-remove" onClick={() => remove(it.id)}>
                      <X size={15} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* output */}
          {(text || busy) && (
            <div className="ocr-output glass">
              <div className="ocr-out-bar">
                <span className="ocr-out-title">
                  Extracted text{words ? ` · ${words} words` : ""}
                </span>
                {text && !busy && (
                  <div className="ocr-out-actions">
                    <button className="ghost-btn" onClick={copy}>
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button className="ghost-btn" onClick={download}>
                      <Download size={15} /> .txt
                    </button>
                  </div>
                )}
              </div>
              {busy && (
                <div className="ocr-progress">
                  <div className="ocr-progress-bar">
                    <span style={{ width: `${progress.pct}%` }} />
                  </div>
                  <span className="ocr-progress-txt">
                    {progress.total > 1 ? `(${progress.idx}/${progress.total}) ` : ""}
                    {progress.label} {progress.pct ? `· ${progress.pct}%` : ""}
                  </span>
                </div>
              )}
              <textarea
                className="ocr-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Recognised text will appear here…"
                spellCheck={false}
              />
            </div>
          )}

          {!items.length && !text && (
            <div className="empty-hint">
              <ScanText size={18} />
              <span>Add a photo, scan or PDF and pull the text straight out of it.</span>
            </div>
          )}
        </div>

        {/* options */}
        <aside className="ipdf-panel glass">
          <h3 className="panel-title">Recognition</h3>

          <div className="field">
            <span className="field-label">Language</span>
            <div className="ocr-lang-grid">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  className={`ocr-lang ${lang === l.code ? "active" : ""}`}
                  onClick={() => setLang(l.code)}
                  disabled={busy}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="info-note glass">
            <ScanText size={15} />
            <span>
              Recognition runs in your browser — your files never leave the
              device. The language model downloads once, then works offline.
            </span>
          </div>

          {items.length > 0 && (
            <button className="ghost-btn danger ocr-clear" onClick={() => {
              items.forEach((i) => i.url && URL.revokeObjectURL(i.url));
              setItems([]);
              setText("");
            }}>
              <Trash2 size={15} /> Clear files
            </button>
          )}

          <div className="panel-spacer" />

          <button
            className="export-btn"
            disabled={!items.length || busy}
            onClick={run}
          >
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> Reading…
              </>
            ) : (
              <>
                <ScanText size={18} /> Extract text
              </>
            )}
          </button>
          <p className="panel-note">
            {items.length
              ? `${items.length} file${items.length > 1 ? "s" : ""} ready`
              : "Add an image or PDF to begin"}
          </p>
        </aside>
      </div>
    </div>
  );
}
