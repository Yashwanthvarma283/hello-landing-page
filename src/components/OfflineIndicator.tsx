import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Shows a small banner when the browser goes offline. */
const OfflineIndicator = () => {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 sm:bottom-4">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-lg">
        <WifiOff className="h-3.5 w-3.5" />
        Offline — browsing cached content. Code execution needs internet.
      </div>
    </div>
  );
};

export default OfflineIndicator;
