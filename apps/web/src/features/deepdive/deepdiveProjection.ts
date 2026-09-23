/** 仅映射 03 §T50-T52、04 §4.13 已记录的链字段；未定义的 GET 外壳不猜测。 */
export interface PredictionView {
  stem: string;
  options: string[];
  mode: 1 | 2 | 3 | 4;
}

export interface StepView {
  id: number;
  seq: number;
  content: string;
  warrant: string;
  motive: string;
  offRamp: string;
  warrantNodes: number[];
  prediction: PredictionView | null;
}

export interface PathView {
  id: number;
  title: string;
  quality: 1 | 2 | null;
  view: 1 | 2 | 3 | null;
  summary: string;
  stepCount: number | null;
  chainVersion: number | null;
  steps: StepView[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function prediction(value: unknown): PredictionView | null {
  if (!record(value)) return null;
  const mode = value.mode;
  const stem = text(value.stem);
  if ((mode !== 1 && mode !== 2 && mode !== 3 && mode !== 4) || !stem) return null;
  const options = value.options === undefined && mode >= 3 ? [] : value.options;
  if (!Array.isArray(options) || (mode <= 2 && options.length < 2)) return null;
  if (!options.every((option) => typeof option === "string" && option.trim())) return null;
  return { mode, stem, options: options.map((option: string) => option.trim()) };
}
function step(value: unknown): StepView | null {
  if (!record(value)) return null;
  const id = positive(value.id);
  const seq = positive(value.seq);
  const content = text(value.content);
  if (!id || !seq || !content) return null;
  const nodes = Array.isArray(value.warrant_nodes) ? value.warrant_nodes.filter((id): id is number => positive(id) !== null) : [];
  return {
    id, seq, content, warrant: text(value.warrant), motive: text(value.motive),
    offRamp: text(value.off_ramp), warrantNodes: nodes, prediction: prediction(value.prediction),
  };
}
function path(value: unknown): PathView | null {
  if (!record(value) || !Array.isArray(value.steps)) return null;
  const id = positive(value.id);
  const title = text(value.title);
  if (!id || !title) return null;
  const steps = value.steps.map(step);
  if (steps.some((item) => item === null)) return null;
  const quality = value.quality === 1 || value.quality === 2 ? value.quality : null;
  const view = value.view === 1 || value.view === 2 || value.view === 3 ? value.view : null;
  return {
    id, title, quality, view, summary: text(value.summary),
    stepCount: positive(value.step_count), chainVersion: positive(value.chainVersion),
    steps: (steps as StepView[]).sort((a, b) => a.seq - b.seq),
  };
}

/** 04 只承诺“解法链[]”，因此仅接受直接数组；对象外壳需后端契约补充。 */
export function deepdivePaths(value: unknown): PathView[] | null {
  if (!Array.isArray(value)) return null;
  const paths = value.map(path);
  return paths.some((item) => item === null) ? null : paths as PathView[];
}

/** POST 点评响应没有约定字段。若服务端直接返回文字，才可直接显示。 */
export function feedbackText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
