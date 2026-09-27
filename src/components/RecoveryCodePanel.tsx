import { useEffect, useRef, useState } from "react";

import "../styles/tokens.css";
import "../styles/screens.css";
import { errorCopy } from "./error-copy.ts";
import { Button, CheckIcon, FieldError, useCopy } from "./ui.tsx";

export type RecoveryCodePanelProps = {
  /** null in the view variant when this browser doesn't have the current code (the server only keeps a hash). */
  code: string | null;
  /** new: shown once right after identity/create; restored: after identity/recover; view: opened later. */
  variant: "new" | "restored" | "view";
  /** new / restored: primary action once the player has saved the code. */
  onDone?: () => void;
  /** view: identity/rotate_recovery. Hidden until the backend implements it. Resolves with the new code. */
  onRotate?: () => Promise<{ recoveryCode?: string }>;
  onBack?: () => void;
};

const spell = (code: string) => code.replace(/-/g, "").split("").join(" ");

/** 1.10: shows a private recovery code (grouped by four as returned by the server), copy, purpose and consequences. */
export function RecoveryCodePanel({ code, variant, onDone, onRotate, onBack }: RecoveryCodePanelProps) {
  const [current, setCurrent] = useState(code);
  const [confirming, setConfirming] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message, copy, reset } = useCopy();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const rotate = async () => {
    if (!onRotate) return;
    setRotating(true);
    setError(null);
    try {
      const result = await onRotate();
      if (result.recoveryCode) setCurrent(result.recoveryCode);
      setRotated(true);
      setConfirming(false);
      reset();
    } catch (err) {
      setError(errorCopy(err, "rotate"));
    } finally {
      setRotating(false);
    }
  };

  const unknown = current === null;
  const title = variant === "new" ? "Your private recovery code" : variant === "restored" ? "Welcome back" : "Recovery code";
  const lede =
    variant === "new"
      ? "Keep it somewhere safe. It opens your saved encounters on another device."
      : variant === "restored"
        ? "Your encounters are here. We've issued a new recovery code, and the old one no longer works."
        : unknown
          ? "We only keep a scrambled version, so we can't show your current code again. If you've lost it, get a new one. Your current code stops working as soon as you do."
          : "Use it to open your encounters on another device. Anyone with this code can open them, so keep it private.";

  return (
    <section className="fyp-screen" lang="en" aria-labelledby="fyp-recovery-title">
      <div className="sc-sheet">
        {variant === "view" && onBack ? (
          <button className="sc-link" type="button" onClick={onBack}>
            Back to My encounters
          </button>
        ) : null}
        {variant !== "view" ? <p className="sc-eyebrow">{variant === "new" ? "Before you start" : "Restored"}</p> : null}
        <h1 className="sc-title" id="fyp-recovery-title" ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
        <p className="sc-lede">{lede}</p>
        {current !== null ? (
          <p className="sc-code" aria-label={`Recovery code: ${spell(current)}`}>
            {current.split("-").map((group, index) => (
              <span key={`${group}-${index}`}>{group}</span>
            ))}
          </p>
        ) : null}
        {rotated ? (
          <p className="sc-copied" role="status">
            <CheckIcon />
            New code issued. Your old code no longer works.
          </p>
        ) : null}
        {current !== null ? (
          <div className="sc-stack">
            <Button kind="secondary" onClick={() => void copy(current)}>
              {message ? "Copy again" : "Copy code"}
            </Button>
            <p className="sc-copied" role="status">
              {message ? <CheckIcon /> : null}
              {message}
            </p>
          </div>
        ) : null}
        {variant === "new" ? (
          <ul className="sc-notes">
            <li>We only keep a scrambled version, so we can't show it again from our side or find it by nickname.</li>
            <li>If you lose this code and this browser's data, your encounters can't be recovered.</li>
          </ul>
        ) : null}
        {variant === "restored" ? <p className="sc-small">Other browsers that used your old code will be asked to restore again.</p> : null}
        {variant === "view" && onRotate ? (
          confirming ? (
            <div className="sc-confirm" role="group" aria-label="Confirm new code" style={{ gridColumn: "auto" }}>
              <p>Get a new code? Your current code stops working right away.</p>
              <Button onClick={() => void rotate()} busyLabel={rotating ? "Issuing" : null}>
                Get a new code
              </Button>
              <button className="sc-link" type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : unknown ? (
            <Button kind="secondary" onClick={() => setConfirming(true)}>
              Get a new code
            </Button>
          ) : (
            <button className="sc-link" type="button" onClick={() => setConfirming(true)}>
              Get a new code
            </button>
          )
        ) : null}
        {variant === "view" && unknown && !onRotate ? (
          <p className="sc-status" role="status">Getting a new code isn't available yet.</p>
        ) : null}
        {error ? <FieldError id="fyp-recovery-error">{error}</FieldError> : null}
        {variant !== "view" ? (
          <div className="sc-stack">
            <Button onClick={onDone}>{variant === "new" ? "I've saved it" : "Continue"}</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
