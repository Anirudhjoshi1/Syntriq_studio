import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, RefreshCw, X, CheckCircle2 } from "lucide-react";

/** Topbar button that appears only when the browser says the app is installable. */
export function InstallButton() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches)
      setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <button
      className="install-btn"
      onClick={async () => {
        deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
    >
      <Download size={16} />
      <span>Install app</span>
    </button>
  );
}

/** Small toast for "offline ready" and "new version available". */
export function UpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="pwa-toast glass">
      <span className="pwa-toast-ic">
        {needRefresh ? <RefreshCw size={16} /> : <CheckCircle2 size={16} />}
      </span>
      <span className="pwa-toast-msg">
        {needRefresh
          ? "A new version is available."
          : "Ready to use offline."}
      </span>
      {needRefresh && (
        <button className="pwa-toast-btn" onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
      )}
      <button className="pwa-toast-x" onClick={close} aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  );
}
