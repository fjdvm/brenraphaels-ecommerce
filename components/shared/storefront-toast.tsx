"use client";

import { AlertCircle, X } from "lucide-react";
import { Toaster, toast } from "sonner";

/** Toasts on the storefront and auth pages use their own Toaster, so they never land in the Careers one. */
const toasterId = "storefront";

/** A refusal the Customer must notice, such as an ID already used by another account. Stays until dismissed. */
export function showErrorToast(message: string) {
  toast.custom((id) => (
    <div role="alert" className="flex w-[calc(100vw-32px)] max-w-[380px] items-center gap-3 bg-ink py-3.5 pl-3.5 pr-4 text-white shadow-[0_12px_16px_rgba(43,26,69,0.25)] sm:w-auto sm:min-w-[300px]">
      <span aria-hidden className="grid size-7 shrink-0 place-items-center bg-red-600 text-white">
        <AlertCircle className="size-3.5" />
      </span>
      <p className="text-sm font-medium tracking-[0.35px]">{message}</p>
      <button type="button" aria-label="Dismiss" onClick={() => toast.dismiss(id)} className="ml-auto text-white/80 hover:text-white">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  ), { id: `error:${message}`, duration: 8000, toasterId });
}

/** Mounted once in the storefront and the signed-out auth layouts. */
export function StorefrontToaster() {
  return <Toaster id={toasterId} position="bottom-right" visibleToasts={3} offset={{ right: 40, bottom: 32 }} mobileOffset={{ right: 16, left: 16, bottom: 88 }} />;
}
