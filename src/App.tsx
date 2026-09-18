import { useCallback, useEffect, useRef, useState } from "react";
import { api, executionSocket, previewSocket, recorderSocket, screenshotUrl } from "./api";
import type {
  AppMap,
  AppSummary,
  AssertOp,
  CaseSummary,
  Credentials,
  ExecutionMessage,
  ExecutionSummary,
  PreviewMessage,
  RecorderInput,
  RecorderMessage,
  RunResult,
  SecretField,
  Step,
  StepAction,
  StepResult,
  TestCase,
  ValidationIssue,
} from "./types";

type View =
  | { kind: "apps" }
  | { kind: "cases"; app: string }
  | { kind: "history"; app: string }
  | { kind: "editor"; app: string; slug: string | null };

export default function App() {
  const [view, setView] = useState<View>({ kind: "apps" });
  const [error, setError] = useState<string | null>(null);
  const [editorNonce, setEditorNonce] = useState(0);
  const newCase = (app: string) => {
    setEditorNonce((n) => n + 1);
    setView({ kind: "editor", app, slug: null });
  };

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand" onClick={() => setView({ kind: "apps" })}>
          Business App Validator Tool
        </span>
        {view.kind !== "apps" && (
          <nav className="crumbs">
            <button onClick={() => setView({ kind: "apps" })}>Applications</button>
            {(view.kind === "editor" || view.kind === "history") && (
              <>
                <span>›</span>
                <button onClick={() => setView({ kind: "cases", app: view.app })}>
                  {view.app}
                </button>
              </>
            )}
            {view.kind === "history" && (
              <>
                <span>›</span>
                <span className="crumb-current">history</span>
              </>
            )}
          </nav>
        )}
      </header>
      {error && (
        <div className="banner error">
          {error} <button onClick={() => setError(null)}>dismiss</button>
        </div>
      )}
      {view.kind === "apps" && (
        <AppsView
          onOpen={(app) => setView({ kind: "cases", app })}
          onOpenHistory={(app) => setView({ kind: "history", app })}
          onError={setError}
        />
      )}
      {view.kind === "cases" && (
        <CasesView
          app={view.app}
          onOpen={(slug) => setView({ kind: "editor", app: view.app, slug })}
          onNew={() => newCase(view.app)}
          onHistory={() => setView({ kind: "history", app: view.app })}
          onError={setError}
        />
      )}
      {view.kind === "history" && <HistoryView app={view.app} onError={setError} />}
      {view.kind === "editor" && (
        <EditorView
          key={`${view.app}:${view.slug ?? "new"}:${editorNonce}`}
          app={view.app}
          slug={view.slug}
          onError={setError}
          onNewCase={() => newCase(view.app)}
          onBackToCases={() => setView({ kind: "cases", app: view.app })}
        />
      )}
    </div>
  );
}

interface EditApp {
  slug: string;
  base_url: string;
  requiresLogin: boolean;
  usesTotp: boolean;
}

function AppsView({
  onOpen,
  onOpenHistory,
  onError,
}: {
  onOpen: (app: string) => void;
  onOpenHistory: (app: string) => void;
  onError: (message: string) => void;
}) {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditApp | null>(null);
  const [credFor, setCredFor] = useState<{ app: string; fields: SecretField[] } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [running, setRunning] = useState<{ app: string; executionId: string } | null>(null);

  const fail = (err: unknown) => onError(err instanceof Error ? err.message : String(err));
  const reload = useCallback(() => {
    api.listApps().then(setApps).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError]);
  useEffect(reload, [reload]);

  const runExecution = async (appName: string, creds: Credentials) => {
    setStarting(appName);
    try {
      const { execution_id } = await api.startExecution(appName, creds);
      setRunning({ app: appName, executionId: execution_id });
    } catch (err) {
      fail(err);
    } finally {
      setStarting(null);
    }
  };

  const startRun = async (appName: string) => {
    try {
      const appmap = await api.getAppMap(appName);
      const fields = appmap.auth?.secrets ?? [];
      if (fields.length) setCredFor({ app: appName, fields });
      else runExecution(appName, {});
    } catch (err) {
      fail(err);
    }
  };

  const startEdit = async (appName: string) => {
    try {
      const appmap = await api.getAppMap(appName);
      const secrets = appmap.auth?.secrets ?? [];
      setEditing({
        slug: appName,
        base_url: appmap.base_url,
        requiresLogin: secrets.length > 0,
        usesTotp: secrets.some((s) => s.kind === "totp"),
      });
    } catch (err) {
      fail(err);
    }
  };

  const removeApp = async (appName: string) => {
    if (!window.confirm(`Delete application “${appName}” and all its test cases?`)) return;
    try {
      await api.deleteApp(appName);
      reload();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <main className="page">
      <div className="pagehead">
        <h1>Applications</h1>
        <button className="primary" onClick={() => setCreating(true)}>
          New Application
        </button>
      </div>
      <div className="cards">
        {apps.map((app) => (
          <div key={app.app} className="card project-card">
            <div className="project-head">
              <span className="card-title">{app.app}</span>
              <div className="icon-actions">
                <button
                  className="icon-btn"
                  title="Edit application"
                  aria-label={`Edit ${app.app}`}
                  onClick={() => startEdit(app.app)}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
                <button
                  className="icon-btn icon-danger"
                  title="Delete application"
                  aria-label={`Delete ${app.app}`}
                  onClick={() => removeApp(app.app)}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="project-body">
              <span className="card-sub mono">{app.base_url}</span>
              <span className="card-sub">
                {app.test_cases === 0
                  ? "No test cases yet"
                  : `${app.test_cases} test case${app.test_cases === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="card-actions">
              <button
                className="validate-btn"
                onClick={() => startRun(app.app)}
                disabled={starting !== null || app.test_cases === 0}
                title={app.test_cases === 0 ? "Add a test case first" : "Run all test cases"}
              >
                {starting === app.app ? "Starting…" : "▶ Run tests"}
              </button>
              <button className="open-cases" onClick={() => onOpen(app.app)}>
                {app.test_cases === 0 ? "Add test case" : "Edit test cases"}
              </button>
              <button className="ghost" onClick={() => onOpenHistory(app.app)}>
                History
              </button>
            </div>
          </div>
        ))}
        {apps.length === 0 && (
          <p className="muted">No applications yet — add one to start building test cases.</p>
        )}
      </div>

      {creating && (
        <AppModal
          onDone={(slug) => {
            setCreating(false);
            onOpen(slug);
          }}
          onCancel={() => setCreating(false)}
          onError={onError}
        />
      )}
      {editing && (
        <AppModal
          edit={editing}
          onDone={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
          onError={onError}
        />
      )}
      {credFor && (
        <CredentialModal
          app={credFor.app}
          fields={credFor.fields}
          onSubmit={(creds) => {
            const appName = credFor.app;
            setCredFor(null);
            runExecution(appName, creds);
          }}
          onCancel={() => setCredFor(null)}
        />
      )}
      {running && (
        <ExecutionRunModal
          app={running.app}
          executionId={running.executionId}
          onClose={() => setRunning(null)}
          onError={onError}
        />
      )}
    </main>
  );
}

function AppModal({
  edit,
  onDone,
  onCancel,
  onError,
}: {
  edit?: EditApp;
  onDone: (slug: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(edit?.slug ?? "");
  const [url, setUrl] = useState(edit?.base_url ?? "https://");
  const [requiresLogin, setRequiresLogin] = useState(edit?.requiresLogin ?? true);
  const [usesTotp, setUsesTotp] = useState(edit?.usesTotp ?? false);
  const [busy, setBusy] = useState(false);

  const valid = (edit ? true : name.trim().length > 0) && /^https?:\/\/.+/.test(url.trim());

  const submit = async () => {
    setBusy(true);
    try {
      const secrets: SecretField[] = requiresLogin
        ? [
            { name: "username", label: "Username", kind: "text" },
            { name: "password", label: "Password", kind: "password" },
            ...(usesTotp
              ? [{ name: "totp", label: "One-time code", kind: "totp" as const }]
              : []),
          ]
        : [];
      if (edit) {
        await api.updateApp(edit.slug, {
          base_url: url.trim(),
          requires_login: requiresLogin,
          secrets,
        });
        onDone(edit.slug);
      } else {
        const { app } = await api.createApp({
          name: name.trim(),
          base_url: url.trim(),
          requires_login: requiresLogin,
          secrets,
        });
        onDone(app);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{edit ? "Edit application" : "New Application"}</h2>
        {!edit && (
          <p className="muted">
            Add an app by its URL. You’ll build its test cases by recording against it.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) submit();
          }}
        >
          <label className="cred-field">
            <span>Application name</span>
            <input
              value={name}
              autoFocus={!edit}
              disabled={!!edit}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Billing Portal"
            />
          </label>
          <label className="cred-field">
            <span>Application URL</span>
            <input
              value={url}
              autoFocus={!!edit}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://app.internal.example"
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={requiresLogin}
              onChange={(e) => setRequiresLogin(e.target.checked)}
            />
            <span>This application requires a login</span>
          </label>
          {requiresLogin && (
            <>
              <p className="muted small">
                Each run will ask for a username and password — entered fresh, encrypted in
                memory, never stored.
              </p>
              <label className="check-row indent">
                <input
                  type="checkbox"
                  checked={usesTotp}
                  onChange={(e) => setUsesTotp(e.target.checked)}
                />
                <span>Also needs a one-time code (TOTP)</span>
              </label>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!valid || busy}>
              {busy ? "Saving…" : edit ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ExecRow {
  index: number;
  test_case: string;
  status: "running" | "passed" | "failed";
  duration_ms?: number;
  first_failure?: string | null;
}

function ExecutionRunModal({
  app,
  executionId,
  onClose,
  onError,
}: {
  app: string;
  executionId: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [rows, setRows] = useState<ExecRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [done, setDone] = useState<ExecutionSummary | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    // `cancelled` guards against StrictMode's mount→cleanup→remount in dev: the
    // first socket is closed by cleanup, and its error event must stay silent.
    let cancelled = false;
    const socket = executionSocket(executionId);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ExecutionMessage;
      if (msg.type === "started") {
        setTotal(msg.total);
      } else if (msg.type === "case_start") {
        setTotal(msg.total);
        setRows((prev) =>
          [
            ...prev.filter((r) => r.index !== msg.index),
            { index: msg.index, test_case: msg.test_case, status: "running" as const },
          ].sort((a, b) => a.index - b.index),
        );
      } else if (msg.type === "case_done") {
        setRows((prev) =>
          prev.map((r) =>
            r.index === msg.index
              ? {
                  ...r,
                  status: msg.status,
                  duration_ms: msg.duration_ms,
                  first_failure: msg.first_failure,
                }
              : r,
          ),
        );
      } else if (msg.type === "done") {
        doneRef.current = true;
        setDone(msg.record);
        socket.close();
      }
    };
    // A completed run (or a cleanup close) shuts the socket, which can surface as
    // an error event — only treat it as a failure if the run is still live.
    socket.onerror = () => {
      if (!cancelled && !doneRef.current) onError("execution connection failed");
    };
    return () => {
      cancelled = true;
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  const allPassed = done?.status === "passed";
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {app} — {done ? "run complete" : "running tests"}
        </h2>
        {done ? (
          <p className={allPassed ? "result-ok" : "result-bad"}>
            {done.passed} of {done.total} test case{done.total === 1 ? "" : "s"} passed
          </p>
        ) : (
          <p className="muted">
            Running {total ?? "…"} test case{total === 1 ? "" : "s"} — this keeps going even if you
            close, and lands in History.
          </p>
        )}
        <ul className="exec-rows">
          {rows.map((r) => (
            <li key={r.index} className={r.status}>
              <span className={`exec-mark ${r.status}`}>
                {r.status === "running" ? "" : r.status === "passed" ? "✓" : "✗"}
              </span>
              <span className="exec-name">{r.test_case}</span>
              {r.duration_ms != null && (
                <span className="muted mono">{(r.duration_ms / 1000).toFixed(1)}s</span>
              )}
              {r.first_failure && <p className="issue error">{r.first_failure}</p>}
            </li>
          ))}
          {rows.length === 0 && <li className="muted">Starting…</li>}
        </ul>
        <div className="modal-actions">
          {done?.report_html && (
            <a className="btn-link" href={done.report_html} target="_blank" rel="noreferrer">
              View report ↗
            </a>
          )}
          {done?.report_pdf && (
            <a className="btn-link" href={done.report_pdf} download>
              Download PDF ↓
            </a>
          )}
          <button className="primary" onClick={onClose}>
            {done ? "Close" : "Run in background"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ app, onError }: { app: string; onError: (message: string) => void }) {
  const [runs, setRuns] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const fail = (err: unknown) => onError(err instanceof Error ? err.message : String(err));

  useEffect(() => {
    api
      .listExecutions(app)
      .then(setRuns)
      .catch(fail)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  return (
    <main className="page">
      <div className="pagehead">
        <h1>{app} — run history</h1>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="muted">
          No runs yet. Use “▶ Run tests” on the Applications page to run this app’s test cases.
        </p>
      ) : (
        <div className="history">
          {runs.map((r) => (
            <div key={r.execution_id} className={`history-row ${r.status}`}>
              <span className={`badge ${r.status === "passed" ? "ok" : "bad"}`}>
                {r.status.toUpperCase()}
              </span>
              <div className="history-main">
                <div className="history-title">
                  {r.passed} / {r.total} passed
                  <span className="muted"> · {(r.duration_ms / 1000).toFixed(1)}s</span>
                </div>
                <div className="history-sub muted">
                  {when(r.started_at)} · {r.kind} · {r.triggered_by}
                </div>
              </div>
              <div className="history-actions">
                {r.report_html && (
                  <a href={r.report_html} target="_blank" rel="noreferrer">
                    Report ↗
                  </a>
                )}
                {r.report_pdf && (
                  <a href={r.report_pdf} download>
                    PDF ↓
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function CasesView({
  app,
  onOpen,
  onNew,
  onHistory,
  onError,
}: {
  app: string;
  onOpen: (slug: string) => void;
  onNew: () => void;
  onHistory: () => void;
  onError: (message: string) => void;
}) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const reload = useCallback(() => {
    api.listCases(app).then(setCases).catch((err) => onError(String(err.message ?? err)));
  }, [app, onError]);
  useEffect(reload, [reload]);

  const removeCase = async (slug: string, name: string) => {
    if (!window.confirm(`Delete test case “${name}”?`)) return;
    try {
      await api.deleteCase(app, slug);
      reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="page">
      <div className="pagehead">
        <h1>{app} — test cases</h1>
        <div className="head-actions">
          <button className="ghost" onClick={onHistory}>
            Run history
          </button>
          <button className="primary" onClick={onNew}>
            New test case
          </button>
        </div>
      </div>
      <div className="cards">
        {cases.map((c) => (
          <div key={c.slug} className="card app-card">
            <button className="card-open" onClick={() => onOpen(c.slug)}>
              <span className="card-title">{c.test_case}</span>
              <span className="card-sub">
                {c.steps} step{c.steps === 1 ? "" : "s"}
              </span>
            </button>
            <div className="card-actions">
              <button className="ghost danger-text" onClick={() => removeCase(c.slug, c.test_case)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {cases.length === 0 && (
          <p className="muted">No test cases yet — record one or build it step by step.</p>
        )}
      </div>
    </main>
  );
}

interface LiveStep {
  sentence: string;
}

function EditorView({
  app,
  slug,
  onError,
  onNewCase,
  onBackToCases,
}: {
  app: string;
  slug: string | null;
  onError: (message: string) => void;
  onNewCase: () => void;
  onBackToCases: () => void;
}) {
  const [appmap, setAppmap] = useState<AppMap | null>(null);
  const [caseName, setCaseName] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [sentences, setSentences] = useState<string[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [publishable, setPublishable] = useState(false);
  const [run, setRun] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [previewSteps, setPreviewSteps] = useState<StepResult[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [credPrompt, setCredPrompt] = useState<{
    fields: SecretField[];
    run: (creds: Credentials) => void;
  } | null>(null);

  const [recording, setRecording] = useState<string | null>(null); // session id
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([]);
  const [frame, setFrame] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const sendInput = useCallback((event: Omit<RecorderInput, "type">) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", ...event }));
    }
  }, []);

  const fail = useCallback(
    (err: unknown) => onError(err instanceof Error ? err.message : String(err)),
    [onError],
  );

  const testCase = useCallback(
    (): TestCase => ({
      test_case: caseName,
      app,
      on_fail: "capture-and-continue",
      steps,
    }),
    [app, caseName, steps],
  );

  const revalidate = useCallback(
    (nextSteps: Step[], name: string) => {
      if (nextSteps.length === 0) {
        setSentences([]);
        setIssues([]);
        setPublishable(false);
        return;
      }
      api
        .validate(app, { test_case: name, app, on_fail: "capture-and-continue", steps: nextSteps })
        .then((result) => {
          setSentences(result.sentences);
          setIssues(result.issues);
          setPublishable(result.publishable);
        })
        .catch(fail);
    },
    [app, fail],
  );

  useEffect(() => {
    api.getAppMap(app).then(setAppmap).catch(fail);
    if (slug) {
      api
        .getCase(app, slug)
        .then((loaded) => {
          setCaseName(loaded.case.test_case);
          setSteps(loaded.case.steps);
          setSentences(loaded.sentences);
          setSaved(true);
          revalidate(loaded.case.steps, loaded.case.test_case);
        })
        .catch(fail);
    } else {
      // A new case gets a default, editable name in sequence.
      api.newCaseName(app).then((r) => setCaseName(r.name)).catch(fail);
    }
  }, [app, slug, fail, revalidate]);

  const updateSteps = (next: Step[]) => {
    setSteps(next);
    setRun(null);
    setSaved(false);
    setJustSaved(false);
    revalidate(next, caseName);
  };

  // Renaming after a save must re-arm Save (and clear the post-save banner) just
  // like a step edit does — otherwise a typo fix in the name can't be persisted.
  const renameCase = (name: string) => {
    setCaseName(name);
    setSaved(false);
    setJustSaved(false);
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = steps.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setEditingIndex(null);
    updateSteps(next);
  };

  const addBlankStep = () => {
    // A always-valid default; the inline editor opens immediately to change it.
    const blank: Step = { action: "screenshot", params: { label: "snapshot" }, meta: { source: "wizard" } };
    const next = [...steps, blank];
    updateSteps(next);
    setEditingIndex(next.length - 1);
  };

  // ---------- credential gate: ask every run, never cache ----------

  const secretFields = appmap?.auth?.secrets ?? [];

  const withCredentials = (run: (creds: Credentials) => void) => {
    if (secretFields.length === 0) {
      run({});
    } else {
      setCredPrompt({ fields: secretFields, run });
    }
  };

  // ---------- recorder ----------

  const startRecording = (prefix: Step[] = []) => {
    // A fresh recording: the user signs in themselves in the browser, so we
    // never handle their credentials. A prefix replays the login, so we ask.
    if (prefix.length) {
      withCredentials((creds) => beginRecording(prefix, creds));
    } else {
      beginRecording(prefix, {});
    }
  };

  const beginRecording = async (prefix: Step[], creds: Credentials) => {
    try {
      setEditingIndex(null);
      if (prefix.length) setBusy("Replaying earlier steps to get back to where you were…");
      const { session_id } = await api.startRecorder(app, prefix, creds);
      setBusy(null);
      setRecording(session_id);
      setLiveSteps([]);
      setFrame(null);
      const socket = recorderSocket(session_id);
      socketRef.current = socket;
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as RecorderMessage;
        if (message.type === "frame") {
          setFrame(message.data);
        } else if (message.type === "snapshot") {
          setLiveSteps(message.steps.map((s) => ({ sentence: s.sentence })));
        } else if (message.type === "step") {
          setLiveSteps((prev) => {
            const next = [...prev];
            next[message.index] = { sentence: message.sentence };
            return next;
          });
        } else if (message.type === "status" && message.status === "stopped") {
          finishRecording();
        }
        // element naming ("suggestion" messages) is backend-only — not shown here
      };
    } catch (err) {
      setBusy(null);
      fail(err);
    }
  };

  const finishRecording = async () => {
    const sessionId = recording ?? undefined;
    socketRef.current?.close();
    socketRef.current = null;
    if (!sessionId) return;
    setRecording(null);
    try {
      const result = await api.stopRecorder(sessionId);
      // The recorder auto-named new elements and saved them to the app map
      // (backend detail); reload it so the draft validates against those names.
      const freshMap = await api.getAppMap(app).catch(() => null);
      if (freshMap) setAppmap(freshMap);
      updateSteps(result.draft.steps);
      if (!slug) setCaseName(result.draft.test_case);
    } catch (err) {
      fail(err);
    } finally {
      setFrame(null);
    }
  };

  // ---------- preview / save ----------

  const doPreview = () =>
    withCredentials(async (creds) => {
      setRun(null);
      setPreviewFrame(null);
      setPreviewSteps([]);
      setPreviewing(true);
      try {
        const { preview_id } = await api.startPreview(app, testCase(), creds);
        const socket = previewSocket(preview_id);
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data) as PreviewMessage;
          if (message.type === "frame") {
            setPreviewFrame(message.data);
          } else if (message.type === "step") {
            setPreviewSteps((prev) => [...prev, message.result]);
          } else if (message.type === "done") {
            setPreviewing(false);
            if (message.result) setRun(message.result);
            socket.close();
          }
        };
        socket.onerror = () => {
          setPreviewing(false);
          fail("preview connection failed");
        };
      } catch (err) {
        setPreviewing(false);
        fail(err);
      }
    });

  const doSave = async () => {
    setBusy("Saving…");
    try {
      await api.save(app, testCase(), "business-user");
      setSaved(true);
      setJustSaved(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="page editor">
      <div className="pagehead">
        <input
          className="case-name"
          value={caseName}
          onChange={(event) => renameCase(event.target.value)}
          placeholder={`${app}.what-this-validates`}
        />
        <div className="actions">
          {recording !== null ? (
            <button className="danger" onClick={finishRecording}>
              ■ Stop recording
            </button>
          ) : steps.length > 0 ? (
            // After a recording exists, the way to add more is to continue it —
            // showing a bare "Record" here is confusing (it would start over).
            <button onClick={() => startRecording(steps)} disabled={busy !== null}>
              ● Continue recording
            </button>
          ) : (
            <button onClick={() => startRecording()} disabled={busy !== null}>
              ● Record
            </button>
          )}
          <button
            onClick={doPreview}
            disabled={steps.length === 0 || busy !== null || previewing || recording !== null}
          >
            {previewing ? "Previewing…" : "Preview"}
          </button>
          <button
            className="primary"
            onClick={doSave}
            disabled={!publishable || busy !== null || (saved && steps.length > 0)}
            title={publishable ? "" : "fix the errors below first"}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {busy && <div className="banner info">{busy}</div>}

      {justSaved && !busy && (
        <div className="banner ok saved-bar">
          <span>Saved ✓</span>
          <button className="ghost" onClick={onNewCase}>
            ＋ New test case
          </button>
          <button className="ghost" onClick={onBackToCases}>
            All test cases
          </button>
        </div>
      )}

      {credPrompt && (
        <CredentialModal
          app={app}
          fields={credPrompt.fields}
          onSubmit={(creds) => {
            const run = credPrompt.run;
            setCredPrompt(null);
            run(creds);
          }}
          onCancel={() => setCredPrompt(null)}
        />
      )}

      {recording !== null && (
        <section className="panel live">
          <h2>Recording — interact with your app below</h2>
          <div className="live-tip">
            <b>To check a value is correct</b> — <b>right-click</b> the value (or a table row) and
            choose <b>✓ Check this value</b>. A box opens asking what it must be: <i>is</i>,
            <i> contains</i>, <i>is at least</i>, or for a table, <i>the row must show…</i>
          </div>
          <RecorderStage frame={frame} onInput={sendInput} />
          <ol className="sentences">
            {liveSteps.map((step, index) => (
              <li key={index}>{step.sentence}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="panel">
        <h2>Steps</h2>
        {steps.length === 0 && recording === null && (
          <p className="muted">Record a flow, or add a step manually.</p>
        )}
        <ol className="sentences steps-list">
          {steps.map((step, index) => {
            const stepIssues = issues.filter((issue) => issue.step_index === index);
            const editingThis = editingIndex === index;
            return (
              <li
                key={index}
                className={
                  (stepIssues.some((i) => i.severity === "error") ? "bad " : "") +
                  (editingThis ? "editing" : "")
                }
              >
                <div className="step-line">
                  <span>{sentences[index] ?? `${step.action}…`}</span>
                  <div className="step-tools">
                    <button className="ghost" title="Move up" disabled={index === 0}
                      onClick={() => moveStep(index, -1)}>↑</button>
                    <button className="ghost" title="Move down" disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}>↓</button>
                    <button className={`ghost ${editingThis ? "active" : ""}`} title="Edit this step"
                      onClick={() => setEditingIndex(editingThis ? null : index)}>edit</button>
                    <button className="ghost" title="Replay the steps before this one, then record from here"
                      disabled={recording !== null || busy !== null}
                      onClick={() => startRecording(steps.slice(0, index))}>record from here</button>
                    <button className="ghost danger-text" title="Remove"
                      onClick={() => { setEditingIndex(null); updateSteps(steps.filter((_, i) => i !== index)); }}>
                      remove
                    </button>
                  </div>
                </div>
                {stepIssues.map((issue, i) => (
                  <p key={i} className={`issue ${issue.severity}`}>
                    {issue.message}
                    {issue.did_you_mean && <> — did you mean <b>{issue.did_you_mean}</b>?</>}
                  </p>
                ))}
                {editingThis && appmap && (
                  <StepEditor
                    appmap={appmap}
                    editing={step}
                    onSubmit={(updated) => {
                      const next = steps.slice();
                      next[index] = updated;
                      setEditingIndex(null);
                      updateSteps(next);
                    }}
                    onCancel={() => setEditingIndex(null)}
                  />
                )}
              </li>
            );
          })}
        </ol>
        {appmap && recording === null && (
          <button className="add-step" onClick={addBlankStep}>
            ＋ Add a step manually
          </button>
        )}
      </section>

      {previewing && <PreviewPanel frame={previewFrame} steps={previewSteps} />}
      {run && <RunPanel run={run} />}
    </main>
  );
}

const ACTIONS: { value: StepAction; label: string }[] = [
  { value: "navigate", label: "Open a screen" },
  { value: "expect_screen", label: "Wait for a screen" },
  { value: "click", label: "Click" },
  { value: "fill", label: "Enter a value" },
  { value: "extract", label: "Read a value" },
  { value: "assert", label: "Check a value" },
  { value: "assert_row", label: "Check a table row" },
  { value: "download", label: "Download a file" },
  { value: "assert_file", label: "Check a downloaded file" },
  { value: "screenshot", label: "Take a screenshot" },
];

const OPS: { value: AssertOp; label: string }[] = [
  { value: "==", label: "is" },
  { value: "contains", label: "contains" },
  { value: "not-empty", label: "is not empty" },
  { value: ">=", label: "is at least" },
  { value: "<=", label: "is at most" },
  { value: "!=", label: "is not" },
];

interface Pair {
  col: string;
  value: string;
}

function toPairs(obj: unknown): Pair[] {
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, string>).map(([col, value]) => ({ col, value }));
  }
  return [];
}

function fromPairs(pairs: Pair[]): Record<string, string> {
  return Object.fromEntries(pairs.filter((p) => p.col.trim()).map((p) => [p.col, p.value]));
}

function StepEditor({
  appmap,
  editing,
  onSubmit,
  onCancel,
}: {
  appmap: AppMap;
  editing: Step | null;
  onSubmit: (step: Step) => void;
  onCancel: () => void;
}) {
  const screens = Object.keys(appmap.screens);
  const targets = Object.keys(appmap.targets);
  const tableTargets = targets.filter((t) => appmap.targets[t].kind === "table");
  const p = (editing?.params ?? {}) as Record<string, unknown>;

  const [action, setAction] = useState<StepAction>(editing?.action ?? "click");
  const [screen, setScreen] = useState<string>((p.screen as string) ?? screens[0] ?? "");
  const [target, setTarget] = useState<string>((p.target as string) ?? targets[0] ?? "");
  const [value, setValue] = useState<string>((p.value as string) ?? "");
  const [asName, setAsName] = useState<string>((p.as as string) ?? "value_1");
  const [actual, setActual] = useState<string>((p.actual as string) ?? "");
  const [op, setOp] = useState<AssertOp>((p.op as AssertOp) ?? "==");
  const [expected, setExpected] = useState<string>((p.expected as string) ?? "");
  const [label, setLabel] = useState<string>((p.label as string) ?? "snapshot");
  const [inTable, setInTable] = useState<string>(
    (p.in as string) ?? tableTargets[0] ?? targets[0] ?? "",
  );
  const initWhere = toPairs(p.where);
  const initExpect = toPairs(p.expect);
  const [wherePairs, setWherePairs] = useState<Pair[]>(
    initWhere.length ? initWhere : [{ col: "", value: "" }],
  );
  const [expectPairs, setExpectPairs] = useState<Pair[]>(
    initExpect.length ? initExpect : [{ col: "", value: "" }],
  );
  // download / assert_file
  const [fileAs, setFileAs] = useState<string>((p.as as string) ?? "download_1");
  const [expectExt, setExpectExt] = useState<string>((p.expect_ext as string) ?? "");
  const [fileRef, setFileRef] = useState<string>((p.file as string) ?? "download_1");
  const [containsText, setContainsText] = useState<string>((p.contains as string) ?? "");
  const [fileMode, setFileMode] = useState<"row" | "text">(p.contains ? "text" : "row");

  const buildParams = (): Record<string, unknown> => {
    switch (action) {
      case "navigate":
      case "expect_screen":
        return { screen };
      case "click":
        return { target };
      case "fill":
        return { target, value };
      case "extract":
        return { target, as: asName };
      case "assert":
        return { actual, op, expected: op === "not-empty" ? "" : expected };
      case "assert_row":
        return { in: inTable, where: fromPairs(wherePairs), expect: fromPairs(expectPairs) };
      case "download":
        return { target, as: fileAs, expect_ext: expectExt };
      case "assert_file":
        return fileMode === "text"
          ? { file: fileRef, contains: containsText }
          : { file: fileRef, where: fromPairs(wherePairs), expect: fromPairs(expectPairs) };
      case "screenshot":
        return { label };
    }
  };

  const submit = () => {
    onSubmit({ action, params: buildParams(), meta: { source: editing?.meta?.source ?? "wizard" } });
    if (!editing) {
      setValue("");
      setActual("");
      setExpected("");
    }
  };

  const targetSelect = (chosen: string, onChange: (v: string) => void, only?: string[]) => (
    <select value={chosen} onChange={(e) => onChange(e.target.value)}>
      {(only ?? targets).map((t) => (
        <option key={t} value={t}>
          {appmap.targets[t]?.label ?? t}
        </option>
      ))}
    </select>
  );

  const pairEditor = (pairs: Pair[], setPairs: (p: Pair[]) => void, verb: string) => (
    <div className="pairs">
      {pairs.map((pair, i) => (
        <div className="pair" key={i}>
          <input
            placeholder="column"
            value={pair.col}
            onChange={(e) => setPairs(pairs.map((q, j) => (j === i ? { ...q, col: e.target.value } : q)))}
          />
          <span className="pair-verb">{verb}</span>
          <input
            placeholder="value"
            value={pair.value}
            onChange={(e) => setPairs(pairs.map((q, j) => (j === i ? { ...q, value: e.target.value } : q)))}
          />
          <button
            className="ghost"
            onClick={() => setPairs(pairs.length > 1 ? pairs.filter((_, j) => j !== i) : pairs)}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="ghost add-pair" onClick={() => setPairs([...pairs, { col: "", value: "" }])}>
        + column
      </button>
    </div>
  );

  return (
    <div className={`wizard ${editing ? "editing" : ""}`}>
      <div className="wizard-row">
        <select value={action} onChange={(e) => setAction(e.target.value as StepAction)}>
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {(action === "navigate" || action === "expect_screen") && (
          <select value={screen} onChange={(e) => setScreen(e.target.value)}>
            {screens.map((s) => (
              <option key={s} value={s}>
                {appmap.screens[s].label ?? s}
              </option>
            ))}
          </select>
        )}
        {(action === "click" || action === "fill" || action === "extract") &&
          targetSelect(target, setTarget)}
        {action === "fill" && (
          <input placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        {action === "extract" && (
          <input placeholder="store as…" value={asName} onChange={(e) => setAsName(e.target.value)} />
        )}
        {action === "assert" && (
          <>
            <input
              placeholder="{{ value_1 }} or element name"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
            <select value={op} onChange={(e) => setOp(e.target.value as AssertOp)}>
              {OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {op !== "not-empty" && (
              <input
                placeholder="expected"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            )}
          </>
        )}
        {action === "download" && (
          <>
            {targetSelect(target, setTarget)}
            <input
              placeholder="save as…"
              value={fileAs}
              onChange={(e) => setFileAs(e.target.value)}
            />
            <input
              className="ext-input"
              placeholder="type? e.g. csv"
              value={expectExt}
              onChange={(e) => setExpectExt(e.target.value)}
            />
          </>
        )}
        {action === "assert_file" && (
          <>
            <input
              placeholder="downloaded file name"
              value={fileRef}
              onChange={(e) => setFileRef(e.target.value)}
            />
            <select value={fileMode} onChange={(e) => setFileMode(e.target.value as "row" | "text")}>
              <option value="row">has a row…</option>
              <option value="text">contains text…</option>
            </select>
          </>
        )}
        {action === "screenshot" && (
          <input placeholder="label" value={label} onChange={(e) => setLabel(e.target.value)} />
        )}
        <div className="wizard-actions">
          {editing && (
            <button className="ghost" onClick={onCancel}>
              cancel
            </button>
          )}
          <button className="primary" onClick={submit}>
            {editing ? "Update step" : "Add step"}
          </button>
        </div>
      </div>
      {action === "assert_row" && (
        <div className="rowcheck">
          <label className="l3f">In table</label>
          {targetSelect(inTable, setInTable, tableTargets.length ? tableTargets : targets)}
          <label className="l3f">Match the row by</label>
          {pairEditor(wherePairs, setWherePairs, "is")}
          <label className="l3f">That row must show</label>
          {pairEditor(expectPairs, setExpectPairs, "is")}
        </div>
      )}
      {action === "assert_file" && fileMode === "row" && (
        <div className="rowcheck">
          <label className="l3f">Match the row by</label>
          {pairEditor(wherePairs, setWherePairs, "is")}
          <label className="l3f">That row must show</label>
          {pairEditor(expectPairs, setExpectPairs, "is")}
        </div>
      )}
      {action === "assert_file" && fileMode === "text" && (
        <div className="rowcheck">
          <label className="l3f">The file must contain</label>
          <input
            className="contains-input"
            placeholder="text to find"
            value={containsText}
            onChange={(e) => setContainsText(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function RecorderStage({
  frame,
  onInput,
}: {
  frame: string | null;
  onInput: (event: Omit<RecorderInput, "type">) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastMove = useRef(0);

  const norm = (e: { clientX: number; clientY: number }) => {
    const rect = (ref.current as HTMLElement).getBoundingClientRect();
    return {
      nx: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      ny: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <div
      className="stage"
      ref={ref}
      tabIndex={0}
      role="application"
      aria-label="Recording view — click and type to interact with your app"
      onClick={(e) => {
        (e.currentTarget as HTMLElement).focus();
        onInput({ event: "click", ...norm(e) });
      }}
      onMouseMove={(e) => {
        const now = Date.now();
        if (now - lastMove.current < 50) return;
        lastMove.current = now;
        onInput({ event: "move", ...norm(e) });
      }}
      onWheel={(e) => onInput({ event: "wheel", dx: e.deltaX, dy: e.deltaY })}
      onKeyDown={(e) => {
        // Let the browser keep tabbing/shortcuts out of the stage minimal set.
        if (e.key === "Tab") return;
        e.preventDefault();
        onInput({ event: "key", key: e.key });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).focus();
        onInput({ event: "click", button: "right", ...norm(e) });
      }}
    >
      {frame ? (
        <img src={`data:image/jpeg;base64,${frame}`} alt="Live recording view" draggable={false} />
      ) : (
        <div className="stage-loading">Starting the recorder…</div>
      )}
    </div>
  );
}

function CredentialModal({
  app,
  fields,
  onSubmit,
  onCancel,
}: {
  app: string;
  fields: SecretField[];
  onSubmit: (creds: Credentials) => void;
  onCancel: () => void;
}) {
  // Local, unpersisted state — discarded on unmount, never lifted or cached.
  const [vals, setVals] = useState<Credentials>({});
  const complete = fields.every((f) => (vals[f.name] ?? "").length > 0);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Sign in to {app} for this run</h2>
        <p className="muted">
          Entered fresh each run, encrypted in memory, injected during execution, and destroyed
          when the run ends. Never saved to disk or config.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (complete) onSubmit(vals);
          }}
        >
          {fields.map((f) => (
            <label key={f.name} className="cred-field">
              <span>{f.label ?? f.name}</span>
              <input
                type={f.kind === "password" ? "password" : "text"}
                autoComplete="off"
                autoFocus={f === fields[0]}
                value={vals[f.name] ?? ""}
                onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })}
              />
            </label>
          ))}
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!complete}>
              Run
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RunPanel({ run }: { run: RunResult }) {
  return (
    <section className={`panel ${run.status === "passed" ? "ok" : "bad"}`}>
      <h2>
        Report — {run.status} in {(run.duration_ms / 1000).toFixed(1)}s
      </h2>
      <ol className="sentences">
        {run.steps.map((step) => (
          <li key={step.index} className={step.status === "failed" ? "bad" : ""}>
            <span className={`dot ${step.status}`} />
            <span>{step.sentence}</span>
            <span className="muted mono">{step.ms}ms</span>
            {step.extracted && <span className="chip">“{step.extracted}”</span>}
            {step.error && <p className="issue error">{step.error}</p>}
            {step.screenshot && (
              <a href={screenshotUrl(run, step.screenshot)} target="_blank" rel="noreferrer">
                <img className="thumb" src={screenshotUrl(run, step.screenshot)} alt="evidence" />
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PreviewPanel({ frame, steps }: { frame: string | null; steps: StepResult[] }) {
  return (
    <section className="panel live">
      <h2>Preview — watching it run</h2>
      <div className="stage preview-stage">
        {frame ? (
          <img src={`data:image/jpeg;base64,${frame}`} alt="Live preview" draggable={false} />
        ) : (
          <div className="stage-loading">Starting…</div>
        )}
      </div>
      <ol className="sentences">
        {steps.map((step) => (
          <li key={step.index} className={step.status === "failed" ? "bad" : ""}>
            <span className={`dot ${step.status}`} />
            <span>{step.sentence}</span>
            {step.extracted && <span className="chip">“{step.extracted}”</span>}
            {step.error && <p className="issue error">{step.error}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
