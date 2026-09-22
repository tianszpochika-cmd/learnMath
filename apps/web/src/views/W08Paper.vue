<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  MATH_SYMBOLS,
  cellClass,
  countdownTone,
  formatCountdown,
  insertMath,
  keyAction,
  remainingMs,
  sheetCounts,
  sheetProgressLabel,
  submitConfirmText,
  type SheetItem,
} from "../features/attempt/attemptUi";

/** W08 作答页（16W08 · WD4 考试布局：左题面70% + 右答题卡30% 常驻）。 */
const router = useRouter();

// 服务端 deadline fixture（serverNow 校准接线在 B30）
const deadlineMs = Date.now() + 12 * 60_000 + 34_000;
const serverNowBase = Date.now();
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

const remain = computed(() => remainingMs(deadlineMs, now.value - serverNowBase + (Date.now() - now.value)));
const remainDisplay = computed(() => formatCountdown(deadlineMs - Date.now()));
const tone = computed(() => countdownTone(deadlineMs - Date.now()));

const items = reactive<SheetItem[]>([
  { seq: 1, answered: true, flagged: false },
  { seq: 2, answered: false, flagged: false },
  { seq: 3, answered: false, flagged: true },
  { seq: 4, answered: false, flagged: false },
  { seq: 5, answered: false, flagged: false },
]);
const counts = computed(() => sheetCounts(items));
const progressLabel = computed(() => sheetProgressLabel(counts.value));

const current = ref(2); // 当前题号
const fill = ref("x = ");
const fillCursor = ref(4);
const selected = ref(-1);
const judged = ref(false);
const confirmBox = ref(false);

function onFillInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  fill.value = el.value;
  fillCursor.value = el.selectionStart ?? el.value.length;
}
function ins(sym: string): void {
  const r = insertMath(fill.value, sym, fillCursor.value);
  fill.value = r.value;
  fillCursor.value = r.cursor;
}
function pick(i: number): void {
  if (judged.value) return;
  selected.value = i;
}
function submitItem(): void {
  // 练习态：选填空题提交给服务端（fixture 判分展示）
  items[1].answered = true;
  judged.value = true;
}
function jump(seq: number): void {
  current.value = seq;
}
function toggleFlag(): void {
  const it = items.find((i) => i.seq === current.value);
  if (it) it.flagged = !it.flagged;
}
function askSubmit(): void {
  confirmBox.value = true;
}
function doSubmit(): void {
  confirmBox.value = false;
  void router.push("/report/attempt/9001");
}

function onKey(e: KeyboardEvent): void {
  const action = keyAction({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, target: e.target as never });
  if (!action) return;
  if (action.type === "search") {
    void router.push("/search");
    return;
  }
  if (action.type === "submit") {
    if (confirmBox.value) doSubmit();
    else submitItem();
    return;
  }
  if (action.type === "close") {
    confirmBox.value = false;
    return;
  }
  if (action.type === "flag") {
    toggleFlag();
    return;
  }
  if (action.type === "prev" && current.value > 1) current.value -= 1;
  if (action.type === "next" && current.value < items.length) current.value += 1;
  if (action.type === "select" && !judged.value) selected.value = action.index;
}
const confirmText = computed(() => submitConfirmText(items));

onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
  document.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div class="paper">
    <header class="topbar">
      <span class="bk" @click="router.push('/wrongbook')">‹</span>
      <b>每日一练 · 练习态</b>
      <span class="chip">{{ progressLabel }}</span>
      <span class="cd" :class="tone">⏱ {{ remainDisplay }}</span>
      <span class="hint">快捷键 1-4/Enter/←→/F/Esc · 输入框内不劫持</span>
      <button class="btn" @click="askSubmit">交卷</button>
    </header>

    <div class="grid">
      <!-- 左：题面 -->
      <section>
        <div class="card">
          <div class="qhead">
            <b>第 {{ current }} 题 · 填空（10 分）</b>
            <span class="chip">知识点：因式分解</span>
          </div>
          <template v-if="current === 2">
            <p class="stem">配方解 <span class="math">x²−6x+5=0</span>，较大根为 ______</p>
            <input
              class="fillin"
              :value="fill"
              @input="onFillInput"
              @click="fillCursor = ($event.target as HTMLInputElement).selectionStart ?? fill.length"
            />
            <div class="mbar">
              <button v-for="s in MATH_SYMBOLS" :key="s" @click="ins(s)">{{ s }}</button>
              <button @click="ins('AC')">AC</button>
            </div>
            <div class="acts">
              <button class="btn" :disabled="!fill.trim()" @click="submitItem">提交本题</button>
              <button class="btn gray" @click="toggleFlag">{{ items[2].flagged ? "⚑ 取消标记" : "⚑ 标记" }}</button>
              <button class="btn ghost" @click="router.push('/deepdive/question/1024')">本题深钻</button>
            </div>
            <p v-if="judged" class="judged">✓ 服务端判分：正确（练习态逐题反馈 01-U-04；解析题下展开）</p>
          </template>
          <template v-else>
            <p class="stem">第 {{ current }} 题内容（fixture 占位 · 题面由 04 投影注入）</p>
            <div class="mut">seq={{ current }} · answered={{ items[current - 1].answered }} · flagged={{ items[current - 1].flagged }}</div>
            <div class="acts"><button class="btn gray" @click="current = 2">跳到可作答示例题</button></div>
          </template>
        </div>
      </section>

      <!-- 右：答题卡（WD4 常驻 30%） -->
      <aside class="side">
        <div class="card sticky">
          <div class="sheethead">
            <b>答题卡</b>
            <span class="mut">{{ progressLabel }}</span>
          </div>
          <div class="grid5">
            <span
              v-for="it in items"
              :key="it.seq"
              class="cell"
              :class="cellClass(it, current)"
              @click="jump(it.seq)"
            >
              {{ it.flagged && !it.answered ? it.seq + "⚑" : it.seq }}
            </span>
          </div>
          <div class="bar"><i :style="{ width: (counts.total ? (counts.answered / counts.total) * 100 : 0) + '%' }" /></div>
          <div class="legend">
            <span><i class="d" />已答 {{ counts.answered }}</span>
            <span><i class="f" />标记 {{ counts.flagged }}</span>
            <span><i class="t" />未答 {{ counts.total - counts.answered }}</span>
          </div>
          <div class="sect">标记列表</div>
          <div class="mut flaglist" @click="jump(3)">⚑ 第 3 题（想不出来）</div>
          <button class="btn" style="width: 100%; margin-top: 12px" @click="askSubmit">交卷</button>
          <p class="mut center">≤1023px 本栏 → 底部抽屉（同 15-S20）</p>
        </div>
      </aside>
    </div>

    <!-- 交卷确认 -->
    <div v-if="confirmBox" class="dim" @click.self="confirmBox = false">
      <div class="dlg">
        <b>交卷确认</b>
        <p>{{ confirmText }}</p>
        <p class="mut">到期由服务端幂等交卷（BR-07）；当前剩余 {{ remainDisplay }}</p>
        <div class="dlgacts">
          <button class="btn gray" @click="confirmBox = false">继续作答</button>
          <button class="btn" @click="doSubmit">确认交卷</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paper {
  padding: 18px 28px 40px;
  max-width: 1440px;
  margin: 0 auto;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 16px;
  position: sticky;
  top: 68px;
  z-index: 20;
}
.bk {
  font-size: 20px;
  cursor: pointer;
  color: var(--ink3);
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.cd {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.cd.ok {
  color: var(--ink2);
}
.cd.warn {
  color: var(--warn);
}
.cd.danger,
.cd.expired {
  color: var(--bad);
}
.hint {
  flex: 1;
  text-align: right;
  font-size: 12px;
  color: var(--ink3);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
}
.qhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chip {
  font-size: 12.5px;
}
.stem {
  font-size: 16.5px;
  line-height: 1.8;
  margin-top: 12px;
}
.math {
  font-family: var(--font-math);
  font-style: italic;
}
.fillin {
  width: 100%;
  max-width: 460px;
  height: 44px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  padding: 0 14px;
  font-size: 17px;
  font-family: var(--font-math);
  font-style: italic;
  outline: none;
  margin-top: 8px;
}
.fillin:focus {
  border-color: var(--brand);
}
.mbar {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.mbar button {
  min-width: 38px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
  font-family: var(--font-math);
  font-size: 14.5px;
}
.mbar button:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.acts {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 40px;
  padding: 0 20px;
  cursor: pointer;
  font-size: 14.5px;
}
.btn:disabled {
  opacity: 0.45;
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
.judged {
  margin-top: 12px;
  color: var(--ok);
  font-size: 14px;
  font-weight: 600;
}
.mut {
  color: var(--ink3);
  font-size: 13px;
}
.side .sticky {
  position: sticky;
  top: 132px;
}
.sheethead {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.grid5 {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.cell {
  aspect-ratio: 1;
  border: 1.5px solid var(--line);
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  background: #fff;
}
.cell.cur {
  border-color: var(--brand);
  color: var(--brand);
}
.cell.done {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.cell.flag {
  background: #fef3c7;
  border-color: var(--warn);
  color: #b45309;
}
.cell.todo {
  color: var(--ink2);
}
.bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 5px;
  overflow: hidden;
  margin-top: 10px;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--grad);
}
.legend {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--ink3);
}
.legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 4px;
}
.legend .d {
  background: var(--brand);
}
.legend .f {
  background: var(--warn);
}
.legend .t {
  background: #e5e7eb;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 14px 0 8px;
}
.flaglist {
  cursor: pointer;
}
.center {
  text-align: center;
  margin-top: 8px;
}
.dim {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.45);
  z-index: 60;
  display: grid;
  place-items: center;
}
.dlg {
  width: 460px;
  background: #fff;
  border-radius: 14px;
  padding: 22px;
}
.dlg p {
  margin-top: 10px;
  font-size: 14.5px;
  line-height: 1.7;
}
.dlgacts {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
}
@media (max-width: 1023px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
