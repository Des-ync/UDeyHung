"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@radix-ui/react-toast";
import { useToast } from "@/hooks/useToast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, ...props }) => (
        <Toast
          key={id}
          {...props}
          className={`
            pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-lg border
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[swipe=end]:animate-out data-[state=closed]:fade-out-80
            data-[state=open]:slide-in-from-bottom-2
            ${
              variant === "destructive"
                ? "bg-[#EF4444] text-white border-[#EF4444]"
                : variant === "success"
                ? "bg-[#10B981] text-white border-[#10B981]"
                : "bg-white text-[#1A1A1A] border-[#E8E5E0]"
            }
          `}
        >
          <div className="flex-1">
            {title && (
              <ToastTitle className="text-sm font-semibold">{title}</ToastTitle>
            )}
            {description && (
              <ToastDescription className="text-xs mt-0.5 opacity-90">
                {description}
              </ToastDescription>
            )}
          </div>
          <ToastClose className="opacity-70 hover:opacity-100 transition-opacity" />
        </Toast>
      ))}
      <ToastViewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]" />
    </ToastProvider>
  );
}
