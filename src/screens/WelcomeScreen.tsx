import { useId, useRef, useState, type FormEvent } from "react";

import "../styles/tokens.css";
import "../styles/screens.css";
import { PlanetPair } from "../components/PlanetPair.tsx";
import { RecoveryCodePanel } from "../components/RecoveryCodePanel.tsx";
import {
  JOIN_CODE_LENGTH,
  clipUnicode,
  errorCodeOf,
  errorCopy,
  isValidJoinCode,
  isValidRecoveryCode,
  normalizeJoinCode,
  unicodeLength,
} from "../components/error-copy.ts";
import { Button, FieldError } from "../components/ui.tsx";

export type WelcomeScreenProps = {
  /** From identity/me. When set, the nickname is fixed and no new identity is created. */
  profileNickname: string | null;
  /** identity/create (B: createIdentityProfile). The recovery code is shown once before continuing. */
  onCreateIdentity: (nickname: string) => Promise<{ recoveryCode?: string }>;
  /** game/create (B: createRoom). */
  onCreateRoom: () => Promise<unknown>;
  /** game/join (B: joinRoom). Receives a normalized 8-character code. */
  onJoinRoom: (joinCode: string) => Promise<unknown>;
  /** identity/recover. Omit until the backend implements it; the entry then explains it isn't available yet. */
  onRecover?: (recoveryCode: string) => Promise<{ recoveryCode?: string }>;
  /** Called after the restored-code screen, for example to open My encounters. */
  onRecovered?: () => void;
  initialPanel?: "start" | "join" | "restore";
};

type Action = "create" | "join";
type FieldKey = "nickname" | "code" | "recovery" | "form";

const NICKNAME_MAX = 20;

/** 1.1: title, slogan, nickname, create or join a room, restore entry. Same names are allowed; nothing says a name is taken. */
export function WelcomeScreen({
  profileNickname,
  onCreateIdentity,
  onCreateRoom,
  onJoinRoom,
  onRecover,
  onRecovered,
  initialPanel = "start",
}: WelcomeScreenProps) {
  const id = useId();
  const [panel, setPanel] = useState(initialPanel);
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [busy, setBusy] = useState<Action | "restore" | null>(null);
  const [error, setError] = useState<{ field: FieldKey; message: string } | null>(null);
  const [newCode, setNewCode] = useState<{ code: string; variant: "new" | "restored"; next: Action | "recovered" } | null>(null);
  const identityCreated = useRef(false);
  const fieldRefs = {
    nickname: useRef<HTMLInputElement>(null),
    code: useRef<HTMLInputElement>(null),
    recovery: useRef<HTMLInputElement>(null),
  };

  const fail = (field: FieldKey, message: string) => {
    setError({ field, message });
    if (field !== "form") requestAnimationFrame(() => fieldRefs[field].current?.focus());
  };
  const errorId = (field: FieldKey) => `${id}-${field}-error`;
  const fieldError = (field: FieldKey) =>
    error?.field === field ? <FieldError id={errorId(field)}>{error.message}</FieldError> : null;
  const invalid = (field: FieldKey) =>
    error?.field === field ? { "aria-invalid": true, "aria-describedby": errorId(field) } : {};

  const runAction = async (action: Action) => {
    setBusy(action);
    try {
      if (action === "create") await onCreateRoom();
      else await onJoinRoom(normalizeJoinCode(joinCode));
    } catch (err) {
      const code = errorCodeOf(err);
      const joinField = action === "join" && (code === "NOT_FOUND" || code === "ROOM_FULL" || code === "EXPIRED" || code === "INVALID_PHASE");
      fail(joinField ? "code" : "form", errorCopy(err, action));
    } finally {
      setBusy(null);
    }
  };

  const start = async (action: Action) => {
    setError(null);
    const name = nickname.trim();
    if (!profileNickname && !identityCreated.current && unicodeLength(name) === 0) {
      fail("nickname", "Enter a nickname to continue.");
      return;
    }
    if (action === "join" && !isValidJoinCode(normalizeJoinCode(joinCode))) {
      fail("code", `Room codes are ${JOIN_CODE_LENGTH} letters or numbers.`);
      return;
    }
    if (!profileNickname && !identityCreated.current) {
      setBusy(action);
      try {
        const identity = await onCreateIdentity(name);
        identityCreated.current = true;
        if (identity.recoveryCode) {
          setNewCode({ code: identity.recoveryCode, variant: "new", next: action });
          setBusy(null);
          return;
        }
      } catch (err) {
        setBusy(null);
        fail(errorCodeOf(err) === "INVALID_INPUT" ? "nickname" : "form", errorCopy(err, "identity"));
        return;
      }
    }
    await runAction(action);
  };

  const restore = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!onRecover) return;
    if (!isValidRecoveryCode(recovery)) {
      fail("recovery", "Recovery codes are 26 letters and numbers. Dashes are optional.");
      return;
    }
    setBusy("restore");
    try {
      const result = await onRecover(recovery.trim());
      if (result.recoveryCode) setNewCode({ code: result.recoveryCode, variant: "restored", next: "recovered" });
      else onRecovered?.();
    } catch (err) {
      fail("recovery", errorCopy(err, "recover"));
    } finally {
      setBusy(null);
    }
  };

  if (newCode) {
    return (
      <RecoveryCodePanel
        code={newCode.code}
        variant={newCode.variant}
        onDone={() => {
          const next = newCode.next;
          setNewCode(null);
          if (next === "recovered") onRecovered?.();
          else void runAction(next);
        }}
      />
    );
  }

  const switchPanel = (next: "start" | "join" | "restore") => {
    setPanel(next);
    setError(null);
    requestAnimationFrame(() => (next === "join" ? fieldRefs.code : next === "restore" ? fieldRefs.recovery : fieldRefs.nickname).current?.focus());
  };

  const nicknameField = profileNickname ? (
    <p className="sc-small">
      Playing as <b style={{ color: "var(--fyp-ink)" }}>{profileNickname}</b>
    </p>
  ) : (
    <div className="sc-field">
      <label htmlFor={`${id}-nickname`}>Your nickname</label>
      <input
        id={`${id}-nickname`}
        ref={fieldRefs.nickname}
        value={nickname}
        autoComplete="nickname"
        readOnly={busy !== null}
        onChange={(e) => {
          setNickname(clipUnicode(e.target.value, NICKNAME_MAX));
          if (error?.field === "nickname") setError(null);
        }}
        {...invalid("nickname")}
      />
      <div className="sc-help">
        <span>Others can use the same name. That's fine.</span>
        <span className="sc-count">{unicodeLength(nickname)}/{NICKNAME_MAX}</span>
      </div>
      {fieldError("nickname")}
    </div>
  );

  return (
    <section className="fyp-screen" lang="en" aria-labelledby={`${id}-title`}>
      <PlanetPair mode="resting" nicknames={{ A: "", B: "" }} ariaLabel="Two small asteroids resting in the night sky." />
      <div className="sc-sheet">
        <header className="sc-brand">
          <h1 id={`${id}-title`} tabIndex={-1}>Find Your Planet</h1>
          <p className="sc-slogan">The distance between two stars. The distance between two hearts.</p>
          <p className="sc-ask" aria-hidden="true">Same question, same world?</p>
        </header>

        {panel === "start" ? (
          <>
            {nicknameField}
            {fieldError("form")}
            <div className="sc-stack">
              <Button onClick={() => void start("create")} busyLabel={busy === "create" ? "Creating room" : null}>Create a room</Button>
              <Button kind="secondary" onClick={() => switchPanel("join")} disabled={busy !== null}>Join with a code</Button>
            </div>
            <button className="sc-link" type="button" onClick={() => switchPanel("restore")}>
              {profileNickname ? "Not you? Restore with a recovery code" : "Have a recovery code? Restore your encounters"}
            </button>
          </>
        ) : null}

        {panel === "join" ? (
          <>
            {nicknameField}
            <div className="sc-field">
              <label htmlFor={`${id}-code`}>Room code</label>
              <input
                id={`${id}-code`}
                ref={fieldRefs.code}
                className="sc-code-input"
                value={joinCode}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                readOnly={busy !== null}
                onChange={(e) => {
                  setJoinCode(normalizeJoinCode(e.target.value).slice(0, JOIN_CODE_LENGTH));
                  if (error?.field === "code") setError(null);
                }}
                {...invalid("code")}
              />
              <div className="sc-help">
                <span>{JOIN_CODE_LENGTH} characters, from your partner's invite.</span>
              </div>
              {fieldError("code")}
            </div>
            {fieldError("form")}
            <div className="sc-stack">
              <Button onClick={() => void start("join")} busyLabel={busy === "join" ? "Joining" : null}>Join room</Button>
              <button className="sc-link" type="button" onClick={() => switchPanel("start")}>Back</button>
            </div>
          </>
        ) : null}

        {panel === "restore" ? (
          <form className="sc-stack" style={{ gap: 20 }} onSubmit={(e) => void restore(e)} noValidate>
            <div className="sc-stack" style={{ gap: 4 }}>
              <h2 className="sc-subtitle">Restore your encounters</h2>
              <p className="sc-small">Use the recovery code you saved. Your nickname isn't needed, and we can't look anyone up by name.</p>
            </div>
            {onRecover ? (
              <>
                <div className="sc-field">
                  <label htmlFor={`${id}-recovery`}>Recovery code</label>
                  <input
                    id={`${id}-recovery`}
                    ref={fieldRefs.recovery}
                    className="sc-code-input"
                    value={recovery}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={busy !== null}
                    onChange={(e) => {
                      setRecovery(e.target.value.slice(0, 40));
                      if (error?.field === "recovery") setError(null);
                    }}
                    {...invalid("recovery")}
                  />
                  <div className="sc-help">
                    <span>26 letters and numbers. Dashes are optional.</span>
                  </div>
                  {fieldError("recovery")}
                </div>
                <Button type="submit" busyLabel={busy === "restore" ? "Checking" : null}>Restore</Button>
              </>
            ) : (
              <p className="sc-status" role="status">Restoring isn't available yet. Your code still works once it is.</p>
            )}
            <button className="sc-link" type="button" onClick={() => switchPanel("start")}>Back</button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
