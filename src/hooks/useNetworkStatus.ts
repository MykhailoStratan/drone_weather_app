import { useEffect, useState } from "react";

function readInitialOnlineStatus(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function useNetworkStatus(): { online: boolean } {
  const [online, setOnline] = useState<boolean>(readInitialOnlineStatus);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return { online };
}
