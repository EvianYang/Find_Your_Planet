import { useCallback, useState, type ReactNode } from "react";

export function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.6" fill="none" stroke="#f3c98b" strokeWidth="1.5" />
      <path d="M10 5.6v5.6" stroke="#f3c98b" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14.3" r="1.1" fill="#f3c98b" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="8" fill="none" stroke="#9fe3b5" strokeWidth="1.4" />
      <path d="M5.2 9.3 7.8 11.8 12.9 6.4" fill="none" stroke="#9fe3b5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WaitIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.4" fill="none" stroke="#9aa0b5" strokeWidth="1.3" strokeDasharray="2 2.6" />
    </svg>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="sc-error" id={id}>
      <WarnIcon />
      <span>{children}</span>
    </p>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "danger";
  /** Label while a request is running; the button stays focusable but ignores clicks. */
  busyLabel?: string | null;
  disabled?: boolean;
  describedBy?: string;
  type?: "button" | "submit";
};

/** aria-disabled instead of disabled so keyboard users can still reach the button and hear why. */
export function Button({ children, onClick, kind = "primary", busyLabel, disabled, describedBy, type = "button" }: ButtonProps) {
  const busy = Boolean(busyLabel);
  return (
    <button
      className={`sc-btn sc-btn--${kind}`}
      type={type}
      aria-busy={busy || undefined}
      aria-disabled={busy || disabled || undefined}
      aria-describedby={describedBy}
      onClick={(event) => {
        if (busy || disabled) {
          event.preventDefault();
          return;
        }
        onClick?.();
      }}
    >
      {busy ? <span className="sc-spin" aria-hidden="true" /> : null}
      {busy ? busyLabel : children}
    </button>
  );
}

/** Copy to the clipboard with a fallback; returns a status message for a live region. */
export function useCopy() {
  const [message, setMessage] = useState("");
  const copy = useCallback(async (text: string, success = "Copied.") => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
    }
    setMessage(ok ? success : "Couldn't copy automatically. Select the text and copy it.");
  }, []);
  return { message, copy, reset: () => setMessage("") };
}
