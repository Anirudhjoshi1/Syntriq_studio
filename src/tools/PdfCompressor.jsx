import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  X,
  Minimize2,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import jsPDF from "jspdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const UNITS = { kb: 1024, mb: 1024 * 1024 };
// render scales relative to 72dpi (2 ≈ 144dpi). Tried high→low until target fits.
const SCALES = [2, 1.6, 1.3, 1.0, 0.8, 0.62, 0.48];

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

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

export default function PdfCompressor() {
  const [file, setFile] = useState(null);
  const [doc, setDoc] = useState(null); // { pageCount, sizePt:[{w,h}], thumb }
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { url, size, met }
  const [filename, setFilename] = useState("document");
  const [unit, setUnit] = useState("kb");
  const [target, setTarget] = useState(500);
  const inputRef = useRef(null);
  const bufRef = useRef(null); // keep a pristine copy of the bytes
  const resultRef = useRef(null);
  resultRef.current = result;

  useEffect(
    () => () => {
      if (resultRef.current?.url) URL.revokeObjectURL(resultRef.current.url);
    },
    []
  );

  const loadFile = useCallback(async (f) => {
    if (!f) return;
    setError("");
    setResult(null);
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setDoc(null);
      setError("Please choose a PDF file.");
      return;
    }
    setFile(f);
    setFilename(f.name.replace(/\.pdf$/i, "") || "document");
    try {
      const buf = await f.arrayBuffer();
      bufRef.current = buf.slice(0); // pdf.js detaches the buffer; keep our own
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const sizePt = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i);
        const v = p.getViewport({ scale: 1 });
        sizePt.push({ w: v.width, h: v.height });
      }
      // small thumbnail of page 1
      const p1 = await pdf.getPage(1);
      const tCanvas = await renderToCanvas(p1, 0.35);
      setDoc({
        pageCount: pdf.numPages,
        sizePt,
        thumb: tCanvas.toDataURL("image/jpeg", 0.7),
      });
    } catch (e) {
      setError("Could not read that PDF. It may be encrypted or corrupted.");
      setFile(null);
      setDoc(null);
    }
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      loadFile(e.dataTransfer.files?.[0]);
    },
    [loadFile]
  );

  function reset() {
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setDoc(null);
    setResult(null);
    setError("");
    bufRef.current = null;
  }

  async function compress() {
    if (!file || busy || !bufRef.current) return;
    const targetBytes = Math.max(1, target) * UNITS[unit];
    setBusy(true);
    setError("");
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const pdf = await pdfjsLib.getDocument({ data: bufRef.current.slice(0) })
        .promise;
      const n = pdf.numPages;
      let fallback = null; // smallest achievable if target unreachable

      // never make a file bigger than it started — deliver the smaller of the two
      const deliver = (blob) => {
        const useOriginal = !blob || blob.size >= file.size;
        const finalBlob = useOriginal ? file : blob;
        const size = useOriginal ? file.size : blob.size;
        const url = URL.createObjectURL(finalBlob);
        setResult({ url, size, met: size <= targetBytes, original: useOriginal });
      };

      for (const scale of SCALES) {
        // render every page at this scale
        const pages = [];
        for (let i = 1; i <= n; i++) {
          setStatus(`Rendering page ${i}/${n} @ ${Math.round(scale * 72)}dpi`);
          const page = await pdf.getPage(i);
          const canvas = await renderToCanvas(page, scale);
          pages.push(canvas);
          await new Promise((r) => setTimeout(r, 0));
        }

        setStatus("Optimising quality…");
        // binary-search a single JPEG quality shared by all pages, measuring the
        // REAL output PDF size each step so we never overshoot the target.
        let lo = 0.08,
          hi = 0.92,
          best = null;
        for (let k = 0; k < 7; k++) {
          const q = (lo + hi) / 2;
          const blob = buildPdf(pages, doc.sizePt, q);
          if (!fallback || blob.size < fallback.size) fallback = blob;
          if (blob.size <= targetBytes) {
            best = blob;
            lo = q; // room to spare — try higher quality
          } else {
            hi = q;
          }
        }

        if (best) {
          deliver(best);
          return;
        }
      }

      // never met target — deliver the smallest we could make (or original)
      deliver(fallback);
    } catch (e) {
      setError("Something went wrong while compressing. Please try again.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  // Encode each page canvas to JPEG at `quality` and assemble a PDF; returns a Blob.
  function buildPdf(canvases, sizePt, quality) {
    let out = null;
    canvases.forEach((canvas, i) => {
      const { w, h } = sizePt[i];
      const orient = w > h ? "landscape" : "portrait";
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (!out) {
        out = new jsPDF({ unit: "pt", format: [w, h], orientation: orient });
      } else {
        out.addPage([w, h], orient);
      }
      out.addImage(dataUrl, "JPEG", 0, 0, w, h, undefined, "FAST");
    });
    return out.output("blob");
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `${filename.trim() || "document"}-compressed.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const targetBytes = Math.max(1, target) * UNITS[unit];
  const saved =
    result && file ? Math.round((1 - result.size / file.size) * 100) : 0;

  return (
    <div className="tool-page">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          loadFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="ipdf-layout">
        <div className="ipdf-main">
          <motion.div
            className={`dropzone glass ${dragOver ? "over" : ""} ${
              file ? "compact" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            whileHover={{ scale: file ? 1 : 1.005 }}
          >
            <div className="dz-icon">
              <UploadCloud size={file ? 24 : 34} />
            </div>
            <div className="dz-text">
              <strong>{file ? "Replace PDF" : "Drop your PDF here"}</strong>
              <span>
                {file ? "or click to browse" : "or click to browse — .pdf only"}
              </span>
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="error-bar glass"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AlertTriangle size={17} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {file && doc && (
            <div className="pdfc-card glass">
              <div className="pdfc-thumb">
                <img src={doc.thumb} alt="PDF first page" />
              </div>
              <div className="pdfc-info">
                <div className="pdfc-top">
                  <span className="file-chip-name">{file.name}</span>
                  <button className="img-remove" onClick={reset} aria-label="Remove">
                    <X size={16} />
                  </button>
                </div>
                <span className="pdfc-meta">
                  {doc.pageCount} page{doc.pageCount > 1 ? "s" : ""} ·{" "}
                  {fmtSize(file.size)}
                </span>

                <div className="pdfc-sizes">
                  {busy ? (
                    <span className="pdfc-status">
                      <Loader2 size={15} className="spin" /> {status || "Working…"}
                    </span>
                  ) : result ? (
                    <>
                      <span className="size-old">{fmtSize(file.size)}</span>
                      <span className="size-arrow">→</span>
                      <span className="size-new">{fmtSize(result.size)}</span>
                      <span className={`savings ${saved <= 0 ? "bad" : ""}`}>
                        {saved > 0
                          ? `−${saved}%`
                          : result.original
                          ? "already small"
                          : "no gain"}
                      </span>
                      {result.original && (
                        <span className="pdfc-warn">kept original</span>
                      )}
                      {!result.met && !result.original && (
                        <span className="pdfc-warn">couldn’t reach target</span>
                      )}
                    </>
                  ) : (
                    <span className="cmp-dim">Ready to compress</span>
                  )}
                </div>

                {result && !busy && (
                  <button className="pdfc-dl" onClick={download}>
                    <Download size={16} /> Download PDF
                  </button>
                )}
              </div>
            </div>
          )}

          {!file && !error && (
            <div className="empty-hint">
              <FileText size={18} />
              <span>Add a PDF and set a target size to shrink it.</span>
            </div>
          )}
        </div>

        {/* options */}
        <aside className="ipdf-panel glass">
          <h3 className="panel-title">Compression</h3>

          <label className="field">
            <span className="field-label">File name</span>
            <div className="field-input">
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="document"
                spellCheck={false}
              />
              <span className="field-suffix">.pdf</span>
            </div>
          </label>

          <div className="field">
            <span className="field-label">Target size</span>
            <div className="target-row">
              <div className="field-input target-input">
                <input
                  type="number"
                  min="1"
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                />
              </div>
              <div className="seg unit-seg">
                {Object.keys(UNITS).map((u) => (
                  <button
                    key={u}
                    className={`seg-btn ${unit === u ? "active" : ""}`}
                    onClick={() => setUnit(u)}
                  >
                    {unit === u && (
                      <motion.span layoutId="pdfc-unit" className="seg-pill" />
                    )}
                    <span>{u.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            <span className="field-hint">
              Squeezes the PDF to ≤ {fmtSize(targetBytes)}
            </span>
          </div>

          <div className="info-note glass">
            <CheckCircle2 size={15} />
            <span>
              Pages are re-rendered as optimised images to hit your size — great
              for scans &amp; assignment uploads. Text becomes part of the image.
            </span>
          </div>

          <div className="panel-spacer" />

          <button
            className="export-btn"
            disabled={!file || !doc || busy}
            onClick={compress}
          >
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> Compressing…
              </>
            ) : result ? (
              <>
                <CheckCircle2 size={18} /> Re-compress
              </>
            ) : (
              <>
                <Minimize2 size={18} /> Compress PDF
              </>
            )}
          </button>
          <p className="panel-note">
            {file
              ? "Processed on your device · original untouched"
              : "Upload a PDF to begin"}
          </p>
        </aside>
      </div>
    </div>
  );
}
