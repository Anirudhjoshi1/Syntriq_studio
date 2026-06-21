import { useCallback, useEffect, useRef, useState } from "react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  X,
  Minimize2,
  Loader2,
  Download,
  CheckCircle2,
  ImagePlus,
  Trash2,
  AlertTriangle,
} from "lucide-react";

const FORMATS = {
  jpeg: { label: "JPEG", mime: "image/jpeg", ext: "jpg" },
  webp: { label: "WebP", mime: "image/webp", ext: "webp" },
};
const UNITS = { kb: 1024, mb: 1024 * 1024 };
const SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.26];

let uid = 0;

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

const toBlob = (canvas, mime, q) =>
  new Promise((res) => canvas.toBlob(res, mime, q));

function drawScaled(img, scale, mime) {
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // JPEG has no alpha — flatten onto white so transparent areas don't go black
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, w, h };
}

/**
 * Compress an image as close to (but under) targetBytes as possible.
 * Strategy: at each scale, binary-search the encoder quality for the highest
 * quality that fits. If even the lowest quality overflows, downscale & retry.
 * Returns the result that meets the target, or the smallest achievable.
 */
async function compress(img, targetBytes, mime) {
  let smallest = null;
  for (const scale of SCALES) {
    const { canvas, w, h } = drawScaled(img, scale, mime);
    let lo = 0.05,
      hi = 0.96,
      fit = null;
    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2;
      const blob = await toBlob(canvas, mime, q);
      if (!blob) break;
      if (!smallest || blob.size < smallest.size)
        smallest = { blob, size: blob.size, w, h, quality: q, met: false };
      if (blob.size <= targetBytes) {
        fit = { blob, size: blob.size, w, h, quality: q, met: true };
        lo = q; // try for higher quality
      } else {
        hi = q;
      }
    }
    if (fit) return fit;
  }
  return smallest;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        id: `img-${uid++}`,
        name: file.name,
        url,
        img,
        originalSize: file.size,
        w: img.naturalWidth,
        h: img.naturalHeight,
        status: "idle",
        result: null,
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject();
    };
    img.src = url;
  });
}

export default function ImageCompressor() {
  const [images, setImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState("jpeg");
  const [unit, setUnit] = useState("kb");
  const [target, setTarget] = useState(200);
  const inputRef = useRef(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // tidy up object URLs on unmount
  useEffect(
    () => () => {
      imagesRef.current.forEach((i) => {
        URL.revokeObjectURL(i.url);
        if (i.result?.url) URL.revokeObjectURL(i.result.url);
      });
    },
    []
  );

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
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

  function patch(id, data) {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
  }

  function remove(id) {
    setImages((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) {
        URL.revokeObjectURL(found.url);
        if (found.result?.url) URL.revokeObjectURL(found.result.url);
      }
      return prev.filter((i) => i.id !== id);
    });
  }

  function clearAll() {
    images.forEach((i) => {
      URL.revokeObjectURL(i.url);
      if (i.result?.url) URL.revokeObjectURL(i.result.url);
    });
    setImages([]);
  }

  async function compressAll() {
    if (!images.length || busy) return;
    const targetBytes = Math.max(1, target) * UNITS[unit];
    const mime = FORMATS[format].mime;
    setBusy(true);
    try {
      for (const item of imagesRef.current) {
        if (item.result?.url) URL.revokeObjectURL(item.result.url);
        patch(item.id, { status: "processing", result: null });
        await new Promise((r) => setTimeout(r, 20)); // let UI paint
        try {
          const out = await compress(item.img, targetBytes, mime);
          if (!out) {
            patch(item.id, { status: "failed" });
            continue;
          }
          const url = URL.createObjectURL(out.blob);
          patch(item.id, { status: "done", result: { ...out, url } });
        } catch {
          patch(item.id, { status: "failed" });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  function download(item) {
    if (!item.result) return;
    const base = item.name.replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = item.result.url;
    a.download = `${base}-compressed.${FORMATS[format].ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAll() {
    images.filter((i) => i.result).forEach((i, idx) => setTimeout(() => download(i), idx * 150));
  }

  const doneCount = images.filter((i) => i.status === "done").length;
  const targetBytes = Math.max(1, target) * UNITS[unit];

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
                {images.length ? "Add more images" : "Drop images to compress"}
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
                {images.length} image{images.length > 1 ? "s" : ""}
                {doneCount ? ` · ${doneCount} compressed` : ""}
              </span>
              <div className="list-actions">
                {doneCount > 0 && (
                  <button className="ghost-btn" onClick={downloadAll}>
                    <Download size={15} /> Download all
                  </button>
                )}
                <button className="ghost-btn danger" onClick={clearAll}>
                  <Trash2 size={15} /> Clear
                </button>
              </div>
            </div>
          )}

          <Reorder.Group axis="y" values={images} onReorder={setImages} className="img-list">
            <AnimatePresence initial={false}>
              {images.map((img) => {
                const overshoot =
                  img.result && !img.result.met;
                const saved =
                  img.result && img.originalSize
                    ? Math.round(
                        (1 - img.result.size / img.originalSize) * 100
                      )
                    : 0;
                return (
                  <Reorder.Item
                    key={img.id}
                    value={img}
                    className="img-row glass"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  >
                    <div className="img-thumb">
                      <img src={img.url} alt={img.name} />
                    </div>
                    <div className="img-meta">
                      <span className="img-name">{img.name}</span>
                      <span className="cmp-sizes">
                        <span className="size-old">{fmtSize(img.originalSize)}</span>
                        {img.result && (
                          <>
                            <span className="size-arrow">→</span>
                            <span className="size-new">
                              {fmtSize(img.result.size)}
                            </span>
                            <span className={`savings ${saved <= 0 ? "bad" : ""}`}>
                              {saved > 0 ? `−${saved}%` : "no gain"}
                            </span>
                          </>
                        )}
                        {!img.result && (
                          <span className="cmp-dim">
                            {img.w}×{img.h}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="cmp-action">
                      {img.status === "processing" ? (
                        <span className="cmp-spin">
                          <Loader2 size={17} className="spin" />
                        </span>
                      ) : img.status === "done" ? (
                        <button
                          className="dl-btn"
                          onClick={() => download(img)}
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      ) : img.status === "failed" ? (
                        <span className="cmp-fail" title="Could not compress">
                          <AlertTriangle size={16} />
                        </span>
                      ) : null}
                      <button
                        className="img-remove"
                        onClick={() => remove(img.id)}
                        aria-label="Remove"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {overshoot && (
                      <span className="cmp-note-overshoot">
                        smallest possible — already maxed out
                      </span>
                    )}
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>

          {images.length === 0 && (
            <div className="empty-hint">
              <ImagePlus size={18} />
              <span>Add images and pick a target size to shrink them.</span>
            </div>
          )}
        </div>

        {/* options */}
        <aside className="ipdf-panel glass">
          <h3 className="panel-title">Compression</h3>

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
                      <motion.span layoutId="cmp-unit" className="seg-pill" />
                    )}
                    <span>{u.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            <span className="field-hint">
              Each image will be squeezed to ≤ {fmtSize(targetBytes)}
            </span>
          </div>

          <div className="field">
            <span className="field-label">Output format</span>
            <div className="seg">
              {Object.entries(FORMATS).map(([key, v]) => (
                <button
                  key={key}
                  className={`seg-btn ${format === key ? "active" : ""}`}
                  onClick={() => setFormat(key)}
                >
                  {format === key && (
                    <motion.span layoutId="cmp-fmt" className="seg-pill" />
                  )}
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
            <span className="field-hint">
              {format === "webp"
                ? "Smaller files, supports transparency"
                : "Best compatibility for photos"}
            </span>
          </div>

          <div className="panel-spacer" />

          <button
            className="export-btn"
            disabled={!images.length || busy}
            onClick={compressAll}
          >
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> Compressing…
              </>
            ) : doneCount === images.length && doneCount > 0 ? (
              <>
                <CheckCircle2 size={18} /> Re-compress
              </>
            ) : (
              <>
                <Minimize2 size={18} /> Compress{" "}
                {images.length > 1 ? `${images.length} images` : "image"}
              </>
            )}
          </button>
          <p className="panel-note">
            {images.length
              ? "Processed on your device · originals untouched"
              : "Add at least one image"}
          </p>
        </aside>
      </div>
    </div>
  );
}
