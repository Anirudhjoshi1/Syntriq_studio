import { useCallback, useRef, useState } from "react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  X,
  GripVertical,
  FileDown,
  Loader2,
  ImagePlus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import jsPDF from "jspdf";

const PAGE_SIZES = {
  a4: { label: "A4", w: 210, h: 297 },
  letter: { label: "Letter", w: 216, h: 279 },
  fit: { label: "Fit to image", w: 0, h: 0 },
};

let uid = 0;

/** Read a File into a data URL + natural pixel dimensions. */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () =>
        resolve({
          id: `img-${uid++}`,
          name: file.name,
          src: reader.result,
          w: img.naturalWidth,
          h: img.naturalHeight,
          format: file.type === "image/png" ? "PNG" : "JPEG",
        });
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageToPdf() {
  const [images, setImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [filename, setFilename] = useState("study-document");
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState("auto");
  const [margin, setMargin] = useState(10);
  const inputRef = useRef(null);

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!files.length) return;
    setDone(false);
    const loaded = await Promise.all(files.map(loadImage));
    setImages((prev) => [...prev, ...loaded]);
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const remove = (id) => setImages((prev) => prev.filter((i) => i.id !== id));
  const clearAll = () => {
    setImages([]);
    setDone(false);
  };

  async function generate() {
    if (!images.length || busy) return;
    setBusy(true);
    setDone(false);
    try {
      // let the spinner paint before the (sync) jsPDF work
      await new Promise((r) => setTimeout(r, 60));

      let doc = null;
      for (const img of images) {
        const isLandscape = img.w > img.h;
        const orient =
          orientation === "auto"
            ? isLandscape
              ? "landscape"
              : "portrait"
            : orientation;

        let pageW, pageH;
        if (pageSize === "fit") {
          // page matches the image aspect, using a 96dpi -> mm conversion
          pageW = (img.w * 25.4) / 96;
          pageH = (img.h * 25.4) / 96;
        } else {
          const s = PAGE_SIZES[pageSize];
          pageW = orient === "landscape" ? s.h : s.w;
          pageH = orient === "landscape" ? s.w : s.h;
        }

        if (!doc) {
          doc = new jsPDF({
            orientation: pageW > pageH ? "landscape" : "portrait",
            unit: "mm",
            format: [pageW, pageH],
          });
        } else {
          doc.addPage([pageW, pageH], pageW > pageH ? "landscape" : "portrait");
        }

        const m = pageSize === "fit" ? 0 : margin;
        const availW = pageW - m * 2;
        const availH = pageH - m * 2;
        const ratio = Math.min(availW / img.w, availH / img.h);
        const drawW = img.w * ratio;
        const drawH = img.h * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        doc.addImage(img.src, img.format, x, y, drawW, drawH, undefined, "FAST");
      }

      doc.save(`${filename.trim() || "document"}.pdf`);
      setDone(true);
      setTimeout(() => setDone(false), 3500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-page">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="ipdf-layout">
        {/* LEFT: dropzone + image list */}
        <div className="ipdf-main">
          <motion.div
            className={`dropzone glass ${dragOver ? "over" : ""} ${
              images.length ? "compact" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            whileHover={{ scale: images.length ? 1 : 1.005 }}
          >
            <div className="dz-icon">
              <UploadCloud size={images.length ? 24 : 34} />
            </div>
            <div className="dz-text">
              <strong>
                {images.length ? "Add more images" : "Drop your images here"}
              </strong>
              <span>
                {images.length
                  ? "or click to browse"
                  : "or click to browse — JPG, PNG, WebP"}
              </span>
            </div>
          </motion.div>

          {images.length > 0 && (
            <div className="list-head">
              <span className="list-count">
                {images.length} image{images.length > 1 ? "s" : ""} · drag to
                reorder
              </span>
              <button className="ghost-btn danger" onClick={clearAll}>
                <Trash2 size={15} /> Clear all
              </button>
            </div>
          )}

          <Reorder.Group
            axis="y"
            values={images}
            onReorder={setImages}
            className="img-list"
          >
            <AnimatePresence initial={false}>
              {images.map((img, idx) => (
                <Reorder.Item
                  key={img.id}
                  value={img}
                  className="img-row glass"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                >
                  <span className="img-grip">
                    <GripVertical size={18} />
                  </span>
                  <span className="img-index">{idx + 1}</span>
                  <div className="img-thumb">
                    <img src={img.src} alt={img.name} />
                  </div>
                  <div className="img-meta">
                    <span className="img-name">{img.name}</span>
                    <span className="img-dim">
                      {img.w} × {img.h}px
                    </span>
                  </div>
                  <button
                    className="img-remove"
                    onClick={() => remove(img.id)}
                    aria-label="Remove image"
                  >
                    <X size={16} />
                  </button>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>

          {images.length === 0 && (
            <div className="empty-hint">
              <ImagePlus size={18} />
              <span>Your images will appear here, ready to arrange.</span>
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
            <span className="field-label">Page size</span>
            <div className="seg">
              {Object.entries(PAGE_SIZES).map(([key, v]) => (
                <button
                  key={key}
                  className={`seg-btn ${pageSize === key ? "active" : ""}`}
                  onClick={() => setPageSize(key)}
                >
                  {pageSize === key && (
                    <motion.span layoutId="seg-size" className="seg-pill" />
                  )}
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`field ${pageSize === "fit" ? "disabled" : ""}`}>
            <span className="field-label">Orientation</span>
            <div className="seg">
              {["auto", "portrait", "landscape"].map((o) => (
                <button
                  key={o}
                  disabled={pageSize === "fit"}
                  className={`seg-btn ${orientation === o ? "active" : ""}`}
                  onClick={() => setOrientation(o)}
                >
                  {orientation === o && pageSize !== "fit" && (
                    <motion.span layoutId="seg-orient" className="seg-pill" />
                  )}
                  <span style={{ textTransform: "capitalize" }}>{o}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`field ${pageSize === "fit" ? "disabled" : ""}`}>
            <span className="field-label">
              Margin <span className="field-val">{margin}mm</span>
            </span>
            <input
              type="range"
              min="0"
              max="30"
              value={margin}
              disabled={pageSize === "fit"}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="range"
            />
          </div>

          <div className="panel-spacer" />

          <button
            className={`export-btn ${done ? "ok" : ""}`}
            disabled={!images.length || busy}
            onClick={generate}
          >
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> Building PDF…
              </>
            ) : done ? (
              <>
                <CheckCircle2 size={18} /> Saved!
              </>
            ) : (
              <>
                <FileDown size={18} /> Create PDF
              </>
            )}
          </button>
          <p className="panel-note">
            {images.length
              ? `${images.length} page${images.length > 1 ? "s" : ""} · stays on your device`
              : "Add at least one image to export"}
          </p>
        </aside>
      </div>
    </div>
  );
}
