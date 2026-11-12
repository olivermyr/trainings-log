import { useRef, useState } from 'react';
import { db } from '../db/db';
import { syncNow, useSyncStatus } from '../sync';
import { sendCode, signOut, verifyCode } from '../sync/supabase';
import { backupName, buildBackup, buildSetsCsv, deliverFile, restoreBackup } from '../sync/backup';
import { Sheet } from '../components/Form';
import { useNow } from '../components/useNow';

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

export function AccountSection() {
  const st = useSyncStatus();
  const now = useNow(30_000);
  const [login, setLogin] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const statusText =
    st.state === 'syncing'
      ? 'Syncing…'
      : st.state === 'offline'
        ? 'Offline — syncs when back online'
        : st.state === 'error'
          ? `Sync failed: ${st.error}`
          : st.lastSyncAt
            ? `Backed up ${ago(st.lastSyncAt, now)}`
            : 'Not synced yet';

  return (
    <>
      <section className="section">
        <p className="eyebrow">Cloud backup</p>
        <div className="list">
          {st.state === 'signed-out' ? (
            <button className="row action" onClick={() => setLogin(true)}>
              Sign In to Back Up
            </button>
          ) : (
            <>
              <div className="row">
                <div className="row-main">
                  <div className="row-title">{st.email}</div>
                  <div className={`row-sub${st.state === 'error' ? ' sync-error' : ''}`}>{statusText}</div>
                </div>
                <span className={`sync-dot ${st.state}`} aria-hidden="true" />
              </div>
              <button className="row action" disabled={st.state === 'syncing'} onClick={() => syncNow()}>
                Sync Now
              </button>
              <button
                className="row destructive"
                onClick={async () => {
                  if (!confirmOut) return setConfirmOut(true);
                  await signOut();
                  setConfirmOut(false);
                }}
              >
                {confirmOut ? 'Tap again to sign out' : 'Sign Out'}
              </button>
            </>
          )}
        </div>
        <p className="footnote">
          {st.state === 'signed-out'
            ? 'Your data is only on this device until you sign in. Backup and Mac access need an account.'
            : 'Changes sync automatically. Everything also stays on this device and works offline.'}
        </p>
      </section>

      <section className="section">
        <p className="eyebrow">Data</p>
        <div className="list">
          <button className="row action" onClick={async () => deliverFile(backupName('json'), JSON.stringify(await buildBackup(db)), 'application/json')}>
            Export Backup (JSON)
          </button>
          <button className="row action" onClick={async () => deliverFile(backupName('csv'), await buildSetsCsv(db), 'text/csv')}>
            Export Sets (CSV)
          </button>
          <button className="row action" onClick={() => fileRef.current?.click()}>
            Restore from Backup…
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const n = await restoreBackup(db, JSON.parse(await f.text()));
              setMsg(`Restored ${n} ${n === 1 ? 'entry' : 'entries'}. Newer data on this device was kept.`);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Could not read this file.');
            }
          }}
        />
        <p className="footnote">{msg ?? 'JSON contains everything and can be restored. CSV lists every set for Excel or Numbers.'}</p>
      </section>

      <LoginSheet open={login} onClose={() => setLogin(false)} />
    </>
  );
}

function LoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const close = () => {
    setStep('email');
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="Sign In">
      {step === 'email' ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!validEmail) return;
            setBusy(true);
            setError(null);
            try {
              await sendCode(email.trim());
              setStep('code');
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="sheet-text">We'll email you a code. No password needed.</p>
          <div className="list section">
            <div className="row">
              <input
                className="field"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                aria-label="Email"
                value={email}
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={!validEmail || busy}>
            {busy ? 'Sending…' : 'Send Code'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await verifyCode(email.trim(), code.trim());
              close();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="sheet-text">Enter the code sent to {email.trim()}.</p>
          <div className="list section">
            <div className="row">
              <input
                className="field code-field num"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                placeholder="000000"
                aria-label="Code"
                value={code}
                autoFocus
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={code.length < 6 || busy}>
            {busy ? 'Checking…' : 'Sign In'}
          </button>
          <button type="button" className="btn-plain small" style={{ width: '100%' }} onClick={() => setStep('email')}>
            Use a different email
          </button>
        </form>
      )}
    </Sheet>
  );
}
