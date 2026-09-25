export type ToastTone = "success" | "info" | "error";

export const TOAST_EVENT = "dodio:toast";

export interface ToastDetail {
  message: string;
  tone: ToastTone;
}

/** Krátké potvrzení v rohu obrazovky („Žádost byla odeslána“). Zobrazuje ho <Toaster /> v hlavním rozložení. */
export function showToast(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, tone } }));
}
