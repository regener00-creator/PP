"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallResult = "accepted" | "dismissed" | "unavailable" | "error";
type InstallContextValue = {
  installed: boolean;
  busy: boolean;
  install(): Promise<InstallResult>;
};
const InstallContext = createContext<InstallContextValue | null>(null);

// Keep the browser's one-use install prompt across client-side navigation.
export function InstallAppProvider({ children }: { children: ReactNode }) {
  const pendingPrompt = useRef<InstallPrompt | null>(null);
  const prompting = useRef(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const detectStandalone = () => {
      if (displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone) setInstalled(true);
    };
    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      pendingPrompt.current = event as InstallPrompt;
    };
    const onInstalled = () => {
      pendingPrompt.current = null;
      setInstalled(true);
    };
    detectStandalone();
    displayMode.addEventListener("change", detectStandalone);
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      displayMode.removeEventListener("change", detectStandalone);
      window.removeEventListener("beforeinstallprompt", rememberPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install(): Promise<InstallResult> {
    const prompt = pendingPrompt.current;
    if (!prompt || prompting.current) return "unavailable";
    prompting.current = true;
    pendingPrompt.current = null;
    setBusy(true);
    try {
      // Must run directly from the user's click, without a preceding async task.
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      return outcome;
    } catch {
      return "error";
    } finally {
      prompting.current = false;
      setBusy(false);
    }
  }

  return <InstallContext value={{ installed, busy, install }}>{children}</InstallContext>;
}

export function InstallAppButton({ className = "", showHelpLink = true }: { className?: string; showHelpLink?: boolean }) {
  const state = useContext(InstallContext);
  const [result, setResult] = useState<InstallResult | null>(null);
  if (!state) return null;
  if (state.installed) return null;
  return <div className="install-control">
    <button type="button" className={className} disabled={state.busy}
      onClick={async () => setResult(await state.install())}>
      {state.busy ? "กำลังเปิดหน้าต่างติดตั้ง" : "ติดตั้งบนคอม"}
    </button>
    {result && result !== "accepted" && <p className="install-status" role="status">
      {result === "dismissed" ? "ยังไม่ได้ติดตั้ง สามารถติดตั้งภายหลังจากเมนูของเบราว์เซอร์ได้" : "กดไอคอนติดตั้งที่แถบที่อยู่ของ Chrome หรือ Edge ได้เลย"}
      {showHelpLink && <> <Link href="/install">ดูวิธีติดตั้ง</Link></>}
    </p>}
  </div>;
}
