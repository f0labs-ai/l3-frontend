// Mirrors of the backend contracts (backend/app/models). Keep in sync by hand
// until the shared-contracts package (M0 follow-up) generates these.

export type StepAction =
  | "navigate"
  | "expect_screen"
  | "click"
  | "fill"
  | "extract"
  | "assert"
  | "assert_row"
  | "download"
  | "assert_file"
  | "screenshot";

export type AssertOp = "==" | "!=" | ">=" | "<=" | "contains" | "not-empty";

export interface StepMeta {
  source?: "wizard" | "recorder" | "import" | null;
  unmapped?: boolean;
  volatile?: boolean;
  note?: string | null;
}

export interface Step {
  action: StepAction;
  params: Record<string, unknown>;
  meta?: StepMeta;
}

export interface TestCase {
  test_case: string;
  app: string;
  on_fail: "abort" | "continue" | "capture-and-continue";
  steps: Step[];
}

export interface AppSummary {
  app: string;
  base_url: string;
  screens: number;
  targets: number;
  test_cases: number;
}

export interface SecretField {
  name: string;
  label?: string | null;
  kind: "text" | "password" | "totp";
  field?: string | null;
}

export interface AppMap {
  app: string;
  base_url: string;
  auth?: { type?: string; secrets?: SecretField[] };
  screens: Record<string, { url: string; landmark: string; label?: string | null }>;
  targets: Record<
    string,
    { selector: string; kind?: string; label?: string | null; mask?: boolean }
  >;
}

export type Credentials = Record<string, string>;

export interface CaseSummary {
  slug: string;
  test_case: string;
  steps: number;
}

export interface ValidationIssue {
  step_index: number | null;
  severity: "error" | "warning";
  message: string;
  did_you_mean: string | null;
}

export interface ValidateResponse {
  issues: ValidationIssue[];
  publishable: boolean;
  sentences: string[];
}

export interface StepResult {
  index: number;
  action: string;
  sentence: string;
  status: "ok" | "failed" | "skipped";
  ms: number;
  error: string | null;
  screenshot: string | null;
  extracted: string | null;
}

export interface RunResult {
  run_id: string;
  test_case: string;
  app: string;
  status: "passed" | "failed";
  started_at: string;
  duration_ms: number;
  steps: StepResult[];
  artifacts_dir: string;
}

export type ExecutionStatus = "queued" | "running" | "passed" | "failed" | "error";
export type ExecutionKind = "manual" | "scheduled";

// One row of an app's run history (Test Executor). Report URLs are /runs-relative.
export interface ExecutionSummary {
  execution_id: string;
  app: string;
  kind: ExecutionKind;
  status: ExecutionStatus;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  total: number;
  passed: number;
  failed: number;
  report_pdf: string | null;
  report_html: string | null;
}

// Live status streamed while an execution runs.
export type ExecutionMessage =
  | { type: "started"; execution_id: string; app: string; total: number }
  | { type: "case_start"; index: number; slug: string; test_case: string; total: number }
  | {
      type: "case_done";
      index: number;
      slug: string;
      status: "passed" | "failed";
      duration_ms: number;
      first_failure: string | null;
    }
  | { type: "done"; record: ExecutionSummary | null };

export type PreviewMessage =
  | { type: "frame"; data: string }
  | { type: "step"; result: StepResult }
  | { type: "done"; result: RunResult | null };

export interface TargetSuggestion {
  key: string;
  label: string;
  selector: string;
  fingerprint_locators: string[];
  attrs: Record<string, string>;
}

export interface RecorderStepMessage {
  type: "step";
  index: number;
  replaced: boolean;
  sentence: string;
  step: Record<string, unknown>; // verb-keyed YAML shape
}

export interface RecorderSnapshot {
  type: "snapshot";
  session_id: string;
  app: string;
  stopped: boolean;
  steps: { index: number; sentence: string; step: Record<string, unknown> }[];
  suggestions: TargetSuggestion[];
}

export interface RecorderInput {
  type: "input";
  event: "move" | "click" | "dblclick" | "wheel" | "key";
  nx?: number;
  ny?: number;
  button?: "left" | "middle" | "right";
  dx?: number;
  dy?: number;
  key?: string;
}

export type RecorderMessage =
  | RecorderSnapshot
  | RecorderStepMessage
  | { type: "suggestion"; suggestion: TargetSuggestion }
  | { type: "frame"; data: string }
  | { type: "status"; status: string };
