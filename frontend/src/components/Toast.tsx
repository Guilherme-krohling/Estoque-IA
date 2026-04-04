"use client";

import { useEffect, useState } from "react";

interface ToastData {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
let addToastExternal: ((msg: string, type?: "success" | "error" | "info") => void) | null = null;

export function showToast(message: string, type: "success" | "error" | "info" = "success") {
  addToastExternal?.(message, type);
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    addToastExternal = (message, type = "success") => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000
      );
    };
    return () => {
      addToastExternal = null;
    };
  }, []);

  const colors = {
    success: "bg-emerald-500/90 border-emerald-400",
    error: "bg-red-500/90 border-red-400",
    info: "bg-cyan-500/90 border-cyan-400",
  };

  return (
    <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg border ${colors[t.type]} animate-slide-in`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
