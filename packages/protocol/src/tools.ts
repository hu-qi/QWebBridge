// === Navigate ===
export interface NavigateParams {
  url: string;
  newTab?: boolean;
  _session?: string;
  group_title?: string;
}
export interface NavigateResult {
  success: boolean;
  url: string;
  tabId: number;
}

// === Snapshot ===
export interface SnapshotElement {
  role: string;
  name?: string;
  value?: string;
  ref: string;
  truncated?: boolean;
  children?: SnapshotElement[];
}
export interface SnapshotParams {
  roles?: string[];
  name_contains?: string;
  depth?: number;
  interactive_only?: boolean;
}
export type SnapshotResult = SnapshotElement[];
export interface MultiSnapshotParams extends SnapshotParams {
  tabIds: number[];
}
export interface MultiSnapshotResult {
  results: Array<{ tabId: number; tree?: SnapshotResult; error?: string }>;
}

// === Screenshot ===
export interface ScreenshotParams {
  format?: "png" | "jpeg" | "webp";
  quality?: number;
  fullPage?: boolean;
  selector?: string;
  element?: string;
}
export interface ScreenshotResult {
  success: boolean;
  data?: string;
  filePath?: string;
}

// === Click ===
export interface ClickParams {
  selector: string;
}
export interface ClickResult {
  success: boolean;
  tag: string;
  text: string;
}

// === Fill ===
export interface FillParams {
  selector: string;
  value: string;
  submit?: boolean;
}
export interface FillResult {
  success: boolean;
  tag: string;
  mode: "value" | "contenteditable";
  submitted?: boolean;
}

// === Evaluate ===
export interface EvaluateParams {
  code: string;
  parse_json?: boolean;
  structured?: boolean;
}
export type EvaluateResult = unknown;
export interface BatchEvalParams extends EvaluateParams {
  tabIds: number[];
}
export interface BatchEvalResult {
  results: Array<{ tabId: number; value?: unknown; error?: string }>;
}

// === WaitFor ===
export interface WaitForParams {
  selector: string;
  text?: string;
  state?: "visible" | "hidden" | "removed";
  timeout?: number;
}
export interface WaitForResult {
  success: boolean;
  found: boolean;
  ref?: string;
  elapsed_ms: number;
  error?: string;
}

// === StreamingStatus ===
export interface StreamingStatusParams {
  selector?: string;
}
export interface StreamingStatusResult {
  success: boolean;
  isStreaming: boolean;
  hasPendingAuth: boolean;
  url: string;
  title: string;
}

// === MouseClick ===
export interface MouseClickParams {
  selector: string;
}
export interface MouseClickResult {
  success: boolean;
  x: number;
  y: number;
  tag: string;
  text: string;
}

// === KeyType ===
export interface KeyTypeParams {
  text: string;
}
export interface KeyTypeResult {
  success: boolean;
}

// === SendKeys ===
export interface SendKeysParams {
  keys: string;
}
export interface SendKeysResult {
  success: boolean;
}

// === Upload ===
export interface UploadParams {
  selector: string;
  filePath?: string;
  files?: string[];
}
export interface UploadResult {
  success: boolean;
}

// === Network ===
export type NetworkCmd = "start" | "stop" | "list" | "detail";
export interface NetworkParams {
  cmd: NetworkCmd;
  filter?: string;
  requestId?: string;
}
export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  type: string;
  timestamp: number;
}
export interface NetworkListResult {
  requests: NetworkRequest[];
}
export interface NetworkDetailResult {
  request: NetworkRequest;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}
export type NetworkResult = { success: boolean } | NetworkListResult | NetworkDetailResult;

// === Tab management ===
export interface FindTabParams {
  url_contains: string;
  _session?: string;
}
export interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  active: boolean;
}
export interface FindTabResult {
  tabId: number;
  url: string;
  title: string;
}
export interface ListTabsParams {
  _tabIds?: number[];
  _session?: string;
}
export interface ListTabsResult {
  tabs: TabInfo[];
}
export interface CloseTabParams {
  _tabId: number;
}
export interface CloseSessionParams {
  _tabIds?: number[];
  _session?: string;
}
export interface SuccessResult {
  success: boolean;
}

// === SaveAsPdf ===
export interface SaveAsPdfParams {
  filePath?: string;
}
export interface SaveAsPdfResult {
  success: boolean;
  filePath?: string;
}

// === Tool params/result union ===
export type ToolParams =
  | NavigateParams
  | SnapshotParams
  | MultiSnapshotParams
  | ScreenshotParams
  | ClickParams
  | FillParams
  | EvaluateParams
  | BatchEvalParams
  | WaitForParams
  | StreamingStatusParams
  | MouseClickParams
  | KeyTypeParams
  | SendKeysParams
  | UploadParams
  | NetworkParams
  | FindTabParams
  | ListTabsParams
  | CloseTabParams
  | CloseSessionParams
  | SaveAsPdfParams
  | Record<string, unknown>;

export type ToolResult =
  | NavigateResult
  | SnapshotResult
  | MultiSnapshotResult
  | ScreenshotResult
  | ClickResult
  | FillResult
  | EvaluateResult
  | BatchEvalResult
  | WaitForResult
  | StreamingStatusResult
  | MouseClickResult
  | KeyTypeResult
  | SendKeysResult
  | UploadResult
  | NetworkResult
  | FindTabResult
  | ListTabsResult
  | SuccessResult
  | SaveAsPdfResult
  | unknown;
