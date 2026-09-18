import type {
  AppMap,
  AppSummary,
  CaseSummary,
  Credentials,
  ExecutionSummary,
  RunResult,
  SecretField,
  Step,
  TargetSuggestion,
  TestCase,
  ValidateResponse,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export const api = {
  listApps: () => request<AppSummary[]>("/api/apps"),
  createApp: (input: {
    name: string;
    base_url: string;
    requires_login: boolean;
    secrets: SecretField[];
  }) =>
    request<{ app: string }>("/api/apps", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateApp: (
    app: string,
    input: { base_url: string; requires_login: boolean; secrets: SecretField[] },
  ) =>
    request<AppMap>(`/api/apps/${app}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteApp: (app: string) => request<{ deleted: boolean }>(`/api/apps/${app}`, { method: "DELETE" }),
  // Test Executor: run every case for the app in the background. Live status
  // streams over executionSocket; on completion the report + history are ready.
  startExecution: (app: string, credentials: Credentials = {}) =>
    request<{ execution_id: string }>(`/api/apps/${app}/executions`, {
      method: "POST",
      body: JSON.stringify({ credentials }),
    }),
  listExecutions: (app: string) =>
    request<ExecutionSummary[]>(`/api/apps/${app}/executions`),
  getAppMap: (app: string) => request<AppMap>(`/api/apps/${app}/appmap`),
  listCases: (app: string) => request<CaseSummary[]>(`/api/apps/${app}/testcases`),
  newCaseName: (app: string) => request<{ name: string }>(`/api/apps/${app}/new-case-name`),
  deleteCase: (app: string, slug: string) =>
    request<{ deleted: boolean }>(`/api/apps/${app}/testcases/${slug}`, { method: "DELETE" }),
  getCase: (app: string, slug: string) =>
    request<{ case: TestCase; sentences: string[]; yaml: string }>(
      `/api/apps/${app}/testcases/${slug}`,
    ),
  validate: (app: string, testCase: TestCase) =>
    request<ValidateResponse>(`/api/apps/${app}/testcases/validate`, {
      method: "POST",
      body: JSON.stringify(testCase),
    }),
  save: (app: string, testCase: TestCase, author: string) =>
    request<{ saved: boolean }>(`/api/apps/${app}/testcases`, {
      method: "POST",
      body: JSON.stringify({ case: testCase, author }),
    }),
  startPreview: (app: string, testCase: TestCase, credentials: Credentials = {}) =>
    request<{ preview_id: string }>(`/api/apps/${app}/preview`, {
      method: "POST",
      body: JSON.stringify({ case: testCase, credentials }),
    }),
  startRecorder: (app: string, prefix: Step[] = [], credentials: Credentials = {}) =>
    request<{ session_id: string }>("/api/recorder/start", {
      method: "POST",
      // headless: the browser runs with no window — it's streamed into the portal.
      body: JSON.stringify({ app, headless: true, prefix, credentials }),
    }),
  stopRecorder: (sessionId: string) =>
    request<{ draft: TestCase; suggestions: TargetSuggestion[] }>(
      `/api/recorder/${sessionId}/stop`,
      { method: "POST" },
    ),
};

export function recorderSocket(sessionId: string): WebSocket {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return new WebSocket(`${protocol}://${location.host}/api/recorder/${sessionId}/ws`);
}

export function previewSocket(previewId: string): WebSocket {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return new WebSocket(`${protocol}://${location.host}/api/preview/${previewId}/ws`);
}

export function executionSocket(executionId: string): WebSocket {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return new WebSocket(`${protocol}://${location.host}/api/executions/${executionId}/ws`);
}

export function screenshotUrl(run: RunResult, file: string): string {
  return `/runs/${run.app}/${run.run_id}/${file}`;
}
