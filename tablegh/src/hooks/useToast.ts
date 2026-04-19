"use client";

import { useState, useCallback } from "react";

export type ToastVariant = "default" | "destructive" | "success";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastState = {
  toasts: ToastItem[];
};

// Simple in-memory toast store (no external dep needed for MVP)
let toastListeners: Array<(toasts: ToastItem[]) => void> = [];
let toastList: ToastItem[] = [];

function notifyListeners() {
  toastListeners.forEach((fn) => fn([...toastList]));
}

export function toast(item: Omit<ToastItem, "id">) {
  const id = Math.random().toString(36).slice(2);
  const newToast: ToastItem = { id, duration: 4000, ...item };
  toastList = [...toastList, newToast];
  notifyListeners();

  setTimeout(() => {
    toastList = toastList.filter((t) => t.id !== id);
    notifyListeners();
  }, newToast.duration);
}

export function useToast(): ToastState {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useState(() => {
    toastListeners.push(setToasts);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== setToasts);
    };
  });

  return { toasts };
}
