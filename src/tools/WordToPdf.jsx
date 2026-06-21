import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileDown,
  Loader2,
  CheckCircle2,
  FileText,
  X,
  AlertTriangle,
} from "lucide-react";
import { renderAsync } from "docx-preview";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// CSS px -> PDF points (browsers lay out at 96dpi; PDF uses 72pt/inch)
const PX_TO_PT = 72 / 96;

const QUALITY = {
  standard: { label: "Standard", scale: 2 },
  high: { label: "High", scale: 3 },
};

const RENDER_OPTS = {
  className: "docx",
  inWrapper: true,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  breakPages: true,
  experimental: true,
  trimXmlDeclaration: true,
  useBase64URL: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  ignoreLastRenderedPageBreak: false,
};

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function WordToPdf() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [filename, setFilename] = useState("document");
  const [quality, setQuality] = useState("standard");
  const inputRef = useRef(null);
  const previewRef = useRef(null);

  const pickFile = useCallback((f) => {
    if (!f) return;
    setError("");
    setDone(false);
    if (!f.name.toLowerCase().endsWith(".docx")) {
      setFile(null);
      setPageCount(0);
      setError(
        f.name.toLowerCase().endsWith(".doc")
          ? "Old .doc files aren't supported — please re-save as .docx."
          : "Please choose a Word (.docx) file."
      );
      return;
    }
    setFile(f);
    setFilename(f.name.replace(/\.docx$/i, "") || "document");
  }, []);

  // Render the document faithfully into the preview whenever the file changes.
  useEffect(() => {
    if (!file || !previewRef.current) return;
    let cancelled = false;
    const host = previewRef.current;

    (async () => {
      setRendering(true);
      setError("");
      host.innerHTML = "";
      try {
        const buf = await file.arrayBuffer();
        if (cancelled) return;
        await renderAsync(buf, host, host, RENDER_OPTS);
        if (cancelled) return;
        const pages = host.querySelectorAll(".docx-wrapper > section");
        setPageCount(pages.length);
        if (!pages.length)
          setError("This document appears to be empty or could not be read.");
      } catch (e) {
        if (!cancelled) {
          setError("Could not render that file. It may be corrupted.");
          setPageCount(0);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      pickFile(e.dataTransfer.files?.[0]);
    },
    [pickFile]
  );

  function reset() {
    setFile(null);
    setError("");
    setDone(false);
    setPageCount(0);
    if (previewRef.current) previewRef.current.innerHTML = "";
  }

  async function generate() {
    if (!file || busy || rendering || !previewRef.current) return;
    const pages = previewRef.current.querySelectorAll(".docx-wrapper > section");
    if (!pages.length) return;

    setBusy(true);
    setDone(false);
    setError("");
    try {
      const scale = QUALITY[quality].scale;
      let pdf = null;

      for (const page of pages) {
        const wPx = page.offsetWidth;
        const hPx = page.offsetHeight;
        const canvas = await html2canvas(page, {
          scale,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });
        const img = canvas.toDataURL("image/jpeg", 0.95);
        const wPt = wPx * PX_TO_PT;
        const hPt = hPx * PX_TO_PT;
        const orient = wPt > hPt ? "landscape" : "portrait";

        if (!pdf) {
          pdf = new jsPDF({ unit: "pt", format: [wPt, hPt], orientation: orient });
        } else {
          pdf.addPage([wPt, hPt], orient);
        }
        pdf.addImage(img, "JPEG", 0, 0, wPt, hPt, undefined, "FAST");
      }

      pdf.save(`${filename.trim() || "document"}.pdf`);
      setDone(true);
      setTimeout(() => setDone(false), 3500);
    } catch (e) {
      setError("Something went wrong while building the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-page">
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        hidden
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="ipdf-layout">
        {/* LEFT: dropzone + faithful preview */}
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
              <strong>
                {file ? "Replace document" : "Drop your Word file here"}
              </strong>
              <span>
                {file ? "or click to browse" : "or click to browse — .docx only"}
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

          {file && (
            <div className="list-head">
              <span className="file-chip">
                <FileText size={15} />
                <span className="file-chip-name">{file.name}</span>
                <span className="file-chip-size">{fmtSize(file.size)}</span>
              </span>
              <button className="ghost-btn danger" onClick={reset}>
                <X size={15} /> Remove
              </button>
            </div>
          )}

          {/* The live, true-to-Word render. Always mounted so the ref exists;
              hidden until a file is loaded. */}
          <div
            className="preview-frame"
            style={{ display: file ? "block" : "none" }}
          >
            <div className="preview-bar">
              <span className="preview-label">
                Exact preview{pageCount ? ` · ${pageCount} page${pageCount > 1 ? "s" : ""}` : ""}
              </span>
              {rendering && (
                <span className="preview-status">
                  <Loader2 size={14} className="spin" /> rendering…
                </span>
              )}
            </div>
            <div ref={previewRef} className="docx-host" />
          </div>

          {!file && !error && (
            <div className="empty-hint">
              <FileText size={18} />
              <span>An exact preview of your document will appear here.</span>
            </div>
          )}
        </div>

        {/* RIGHT: options + export */}
        <aside className="ipdf-panel glass">
          <h3 className="panel-title">PDF settings</h3>

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
            <span className="field-label">Quality</span>
            <div className="seg">
              {Object.entries(QUALITY).map(([key, v]) => (
                <button
                  key={key}
                  className={`seg-btn ${quality === key ? "active" : ""}`}
                  onClick={() => setQuality(key)}
                >
                  {quality === key && (
                    <motion.span layoutId="wseg-q" className="seg-pill" />
                  )}
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="info-note glass">
            <CheckCircle2 size={15} />
            <span>
              Page size, margins, fonts &amp; layout are taken straight from your
              document — the PDF matches it page-for-page.
            </span>
          </div>

          <div className="panel-spacer" />

          <button
            className={`export-btn ${done ? "ok" : ""}`}
            disabled={!file || busy || rendering || !pageCount}
            onClick={generate}
          >
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> Converting…
              </>
            ) : done ? (
              <>
                <CheckCircle2 size={18} /> Saved!
              </>
            ) : (
              <>
                <FileDown size={18} /> Convert to PDF
              </>
            )}
          </button>
          <p className="panel-note">
            {file
              ? "Pixel-faithful · stays on your device"
              : "Upload a .docx file to convert"}
          </p>
        </aside>
      </div>
    </div>
  );
}
