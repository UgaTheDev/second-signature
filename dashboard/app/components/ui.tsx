"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** Native <dialog>: focus is trapped, Esc closes, and the page behind is inert. */
export function Dialog({
  open,
  onClose,
  title,
  side = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const position = side ? "ml-auto mr-0 h-full max-h-none w-[min(440px,100vw)]" : "m-auto w-[min(480px,calc(100vw-32px))]";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`${position} border border-line bg-panel p-0`}
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="font-serif text-[24px] tracking-[-.01em]">{title}</h2>
        <button type="button" aria-label="Close" title="Close" onClick={onClose}
          className="inline-flex size-10 items-center justify-center text-muted hover:bg-panel2 hover:text-ink">
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}

type Toast = { id: number; text: string; bad: boolean };
const ToastContext = createContext<(text: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, bad = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, bad }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), bad ? 9000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-32px))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.bad ? "alert" : "status"}
            className={`border bg-panel2 px-4 py-3 text-[15px] shadow-lg ${t.bad ? "border-red" : "border-line"}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
