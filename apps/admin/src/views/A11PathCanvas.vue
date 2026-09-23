<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RESOURCE_TYPES, nodeErrors, parseRule, projectNodes, projectPaths, validationVerdict, type PathNode, type PathSummary } from "../features/path/pathAdmin";
import { createPathsApi, type PathNodeWrite } from "../services/paths";

const api = createPathsApi();
const paths = ref<PathSummary[]>([]);
const code = ref("");
const nodes = ref<PathNode[]>([]);
const nodesLoaded = ref(false);
const selectedId = ref<number | null>(null);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const validation = ref<ReturnType<typeof validationVerdict> | null>(null);
const coverage = ref<unknown>(null);
const coverageOpen = ref(false);
const creating = ref(false);
const form = ref({ title: "", refType: 1, refId: 0, ruleText: '{"type":"sequential"}', seq: 1, mapX: "", mapY: "" });
const selected = computed(() => nodes.value.find((item) => item.id === selectedId.value) ?? null);
const selectedPath = computed(() => paths.value.find((item) => item.code === code.value) ?? null);
const formErrors = computed(() => nodeErrors(form.value, code.value));
const json = (value: unknown): string => { try { return JSON.stringify(value, null, 2) ?? "—"; } catch { return "响应无法显示"; } };
const errorText = (value: unknown): string => value instanceof Error ? value.message : "请求失败，请检查服务端状态";
const resourceLabel = (value: number) => RESOURCE_TYPES.find((type) => type.value === value)?.label ?? "未知类型";

function select(node: PathNode): void {
  creating.value = false;
  selectedId.value = node.id;
  form.value = { title: node.title, refType: node.refType, refId: node.refId,
    ruleText: json(node.rule ?? { type: "sequential" }), seq: node.seq,
    mapX: node.mapX === null ? "" : String(node.mapX), mapY: node.mapY === null ? "" : String(node.mapY) };
}
function startCreate(type: number): void {
  if (!nodesLoaded.value) return;
  creating.value = true;
  selectedId.value = null;
  form.value = { title: "", refType: type, refId: 0, ruleText: '{"type":"sequential"}',
    seq: (nodes.value.at(-1)?.seq ?? 0) + 1, mapX: "", mapY: "" };
  validation.value = null;
  notice.value = "填写真实资源编号与解锁规则后提交；新节点须由服务端返回并重新读取。";
}
async function loadPaths(): Promise<void> {
  busy.value = true; error.value = "";
  try {
    const result = projectPaths(await api.list());
    if (result === null) throw new Error("路径列表响应结构未定义，当前无法安全编排");
    paths.value = result;
    code.value = result.some((item) => item.code === code.value) ? code.value : result[0]?.code ?? "";
    if (code.value) await loadNodes();
    else notice.value = "服务端暂无可编排路径。";
  } catch (cause) { error.value = errorText(cause); }
  finally { busy.value = false; }
}
async function loadNodes(): Promise<boolean> {
  if (!code.value) return false;
  busy.value = true; error.value = ""; validation.value = null; notice.value = "";
  nodesLoaded.value = false;
  try {
    const result = projectNodes(await api.nodes(code.value));
    if (result === null) throw new Error("节点响应缺少 id / seq / ref_type / ref_id，已停止编辑以免覆盖数据");
    nodes.value = result;
    nodesLoaded.value = true;
    if (result.length) select(result.find((item) => item.id === selectedId.value) ?? result[0]!);
    else { selectedId.value = null; creating.value = false; }
    return true;
  } catch (cause) { nodes.value = []; selectedId.value = null; error.value = errorText(cause); return false; }
  finally { busy.value = false; }
}
function body(): PathNodeWrite {
  const rule = parseRule(form.value.ruleText).value;
  if (!rule) throw new Error("解锁规则 JSON 无效");
  const result: PathNodeWrite = { title: form.value.title.trim(), ref_type: form.value.refType,
    ref_id: form.value.refId, unlock_rule: rule, seq: form.value.seq };
  if (code.value === "P6" && form.value.mapX !== "") result.map_x = Number(form.value.mapX);
  if (code.value === "P6" && form.value.mapY !== "") result.map_y = Number(form.value.mapY);
  return result;
}
async function save(): Promise<void> {
  if (!code.value || !nodesLoaded.value || formErrors.value.length || busy.value || (!creating.value && !selected.value)) return;
  busy.value = true; error.value = ""; notice.value = ""; validation.value = null;
  try {
    if (creating.value) await api.createNode(code.value, body());
    else await api.updateNode(code.value, selected.value!.id, body());
    if (await loadNodes()) notice.value = "服务端已响应，节点列表已重新读取。路径可发布性仍需独立校验。";
  } catch (cause) { error.value = errorText(cause); }
  finally { busy.value = false; }
}
async function remove(): Promise<void> {
  if (!selected.value || busy.value || !window.confirm(`确认删除节点 #${selected.value.id}？删除可能影响已关联的学习路径。`)) return;
  const id = selected.value.id;
  busy.value = true; error.value = ""; validation.value = null;
  try { await api.deleteNode(code.value, id); if (await loadNodes()) notice.value = "删除请求已由服务端响应，节点列表已重新读取。"; }
  catch (cause) { error.value = errorText(cause); }
  finally { busy.value = false; }
}
async function validate(): Promise<void> {
  if (!code.value || busy.value) return;
  busy.value = true; error.value = ""; validation.value = null;
  try {
    validation.value = validationVerdict(await api.validate(code.value));
    notice.value = validation.value.passed === true ? "服务端报告校验通过；路径发布仍缺少独立接口契约。" :
      validation.value.passed === false ? "服务端报告存在发布阻断，请查看下方问题。" :
        "服务端返回了校验数据，但未给出明确通过字段；请核对原始响应。";
  } catch (cause) { error.value = errorText(cause); }
  finally { busy.value = false; }
}
async function loadCoverage(): Promise<void> {
  coverageOpen.value = true; coverage.value = null; error.value = "";
  try { coverage.value = await api.coverage(); }
  catch (cause) { error.value = errorText(cause); }
}
onMounted(loadPaths);
</script>

<template>
  <div class="canvas-page">
    <header class="heading">
      <div><span class="eyebrow">A11 · PATH CANVAS</span><h1>路径编排器</h1><p>从真实路径与节点读取工作稿，编辑资源引用、顺序和解锁规则；发布门禁由服务端判定。</p></div>
      <div class="heading-actions"><button type="button" class="btn ghost" :disabled="busy" @click="loadPaths">刷新</button><button type="button" class="btn ghost" :disabled="!code || busy" @click="validate">服务端校验</button><button type="button" class="btn primary" disabled title="04 §5.4 未定义路径发布接口">发布接口待定义</button></div>
    </header>
    <div class="toolbar"><label for="path-code">选择路径</label><select id="path-code" v-model="code" :disabled="busy || !paths.length" @change="loadNodes"><option v-for="path in paths" :key="path.code" :value="path.code">{{ path.code }} · {{ path.name }}</option></select><span>{{ selectedPath?.status || "状态未提供" }}</span><span>{{ nodes.length }} 个服务端节点</span></div>
    <p v-if="error" class="message bad" role="alert">{{ error }}</p><p v-if="notice" class="message" role="status">{{ notice }}</p>
    <div v-if="!paths.length && !busy" class="empty">服务端暂无路径，或列表尚不可读取。请先完成路径配置。</div>
    <div v-else class="columns">
      <section class="panel library"><h2>素材类型</h2><p>输入真实资源 ID 创建引用；这里不提供示例资源。</p><button v-for="type in RESOURCE_TYPES" :key="type.value" type="button" class="asset" :disabled="!code || busy || !nodesLoaded" @click="startCreate(type.value)"><span>＋ {{ type.label }}</span><small>ref_type {{ type.value }}</small></button><div class="hint">素材检索接口尚未定义。资源编号请从对应管理模块核对。</div></section>
      <section class="panel sequence"><div class="section-head"><h2>{{ selectedPath?.name || code }} · 节点画布</h2><span>{{ busy ? "读取中…" : `${nodes.length} 节点` }}</span></div><p class="hint">节点按服务端 seq 排列。修改顺序请在右侧填写目标 seq 并保存；重排冲突以服务端为准。</p><div v-if="!nodes.length" class="empty">该路径暂无节点。</div><button v-for="node in nodes" :key="node.id" type="button" class="node" :class="{ active: selectedId === node.id && !creating }" @click="select(node)"><span class="ord">{{ String(node.seq).padStart(2, '0') }}</span><span class="node-copy"><strong>{{ node.title || `节点 #${node.id}` }}</strong><small>#{{ node.id }} · {{ resourceLabel(node.refType) }} #{{ node.refId }}</small></span><span class="arrow">→</span></button></section>
      <aside class="panel inspector"><h2>{{ creating ? "新建节点" : selected ? `节点 #${selected.id}` : "节点属性" }}</h2><p v-if="!creating && !selected" class="hint">选择服务端节点，或从左侧创建引用。</p><template v-else><label>标题<input v-model="form.title" maxlength="100"></label><div class="pair"><label>引用类型<select v-model.number="form.refType"><option v-for="type in RESOURCE_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option></select></label><label>真实资源 ID<input v-model.number="form.refId" type="number" min="1" step="1"></label></div><label>顺序 seq<input v-model.number="form.seq" type="number" min="1" step="1"></label><label>解锁规则 DSL JSON<textarea v-model="form.ruleText" rows="8" spellcheck="false"></textarea></label><p class="hint">支持 sequential、mastery、ladder、stars、paper_pass、allOf/anyOf；最终语义以服务端校验为准。</p><div v-if="code === 'P6'" class="pair"><label>地图 X<input v-model="form.mapX" inputmode="numeric"></label><label>地图 Y<input v-model="form.mapY" inputmode="numeric"></label></div><ul v-if="formErrors.length" class="errors"><li v-for="item in formErrors" :key="item">{{ item }}</li></ul><div class="form-actions"><button type="button" class="btn primary" :disabled="busy || formErrors.length > 0" @click="save">{{ busy ? "提交中…" : creating ? "创建并回读" : "保存并回读" }}</button><button v-if="selected && !creating" type="button" class="btn danger" :disabled="busy" @click="remove">删除节点</button></div></template></aside>
    </div>
    <section class="panel audit"><div class="section-head"><h2>发布前覆盖与可达性</h2><button type="button" class="btn ghost" @click="loadCoverage">读取覆盖矩阵</button></div><p>路径校验需覆盖题族、难度、题型、前置可达性、晋级循环和资源可用性。页面不会把本地字段检查视为发布许可。</p><ul v-if="validation?.blockers.length" class="errors"><li v-for="item in validation.blockers" :key="item">{{ item }}</li></ul><pre v-if="validation">{{ json(validation.raw) }}</pre><pre v-if="coverageOpen">{{ coverage === null ? "暂无覆盖响应" : json(coverage) }}</pre></section>
  </div>
</template>

<style scoped>
.canvas-page{display:grid;gap:18px;color:var(--ink)}.heading{display:flex;align-items:end;justify-content:space-between;gap:24px}.eyebrow{font-size:11px;letter-spacing:.17em;font-weight:800;color:var(--brand)}h1{font-size:27px;margin:7px 0 8px}h2{font-size:16px;margin:0 0 12px}.heading p,.panel p{color:var(--ink2);line-height:1.6}.heading-actions,.form-actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);border-radius:8px;padding:9px 13px;background:var(--ops-card,#fff);color:var(--ink);font:inherit;cursor:pointer}.btn.primary{background:var(--brand);border-color:var(--brand);color:white;font-weight:700}.btn.danger{color:#b42334}.btn:disabled{opacity:.5;cursor:not-allowed}.toolbar,.panel{background:var(--ops-card,#fff);border:1px solid var(--line);border-radius:12px}.toolbar{display:flex;align-items:center;gap:16px;padding:12px 16px;color:var(--ink2)}.toolbar select{min-width:190px}.columns{display:grid;grid-template-columns:minmax(180px,240px) minmax(270px,1fr) minmax(280px,360px);gap:14px;align-items:start}.panel{padding:18px}.library,.sequence,.inspector{min-height:470px}.asset,.node{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;background:var(--ops-card,#fff);border:1px solid var(--line);border-radius:9px;padding:11px;margin-top:9px;color:var(--ink);cursor:pointer;font:inherit}.asset:hover,.node:hover,.node.active{border-color:var(--brand);background:var(--brand-soft)}small,.hint{font-size:12px;color:var(--ink2)}.hint{line-height:1.6;margin:12px 0}.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.section-head h2{margin:0}.node{justify-content:flex-start}.ord{display:grid;place-items:center;width:35px;height:35px;border-radius:8px;background:var(--brand-soft);color:var(--brand);font-weight:800;flex:none}.node-copy{display:grid;gap:4px;flex:1}.node-copy small{display:block}.arrow{color:var(--brand)}.inspector label{display:grid;gap:6px;margin-top:13px;font-size:12px;font-weight:700;color:var(--ink2)}input,select,textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px;background:var(--ops-card,#fff);color:var(--ink);font:inherit}textarea{font-family:ui-monospace,monospace;resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.form-actions{margin-top:17px}.errors{color:#b42334;padding-left:19px;line-height:1.6}.message,.empty{padding:13px;border-radius:9px;background:var(--brand-soft);color:var(--brand-deep)}.message.bad{background:var(--ops-bad-soft,#fef2f2);color:#b42334}.audit pre{max-height:300px;overflow:auto;padding:14px;background:var(--ops-soft,#f7f8fa);border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}.audit p{margin:10px 0}.toolbar label{font-weight:700;color:var(--ink)}@media(max-width:1120px){.columns{grid-template-columns:190px minmax(240px,1fr)}.inspector{grid-column:1/-1;min-height:0}}@media(max-width:680px){.heading{display:block}.heading-actions{margin-top:15px}.toolbar{flex-wrap:wrap}.columns{grid-template-columns:1fr}.inspector{grid-column:auto}.library,.sequence{min-height:0}}
</style>
