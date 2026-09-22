import { describe, expect, it } from "vitest";
import {
  DEEP_MODES,
  alignPairs,
  alignRatio,
  deepdivePath,
  fastestVariant,
  generalTip,
  modeFromQuery,
  modeIndex,
  normalizeSubjectType,
  pairColorIndex,
  predOptionMark,
  predictionBranch,
  predictionFeedback,
  railOf,
  selectStep,
  variantRows,
  type DeepStep,
  type PredState,
  type Variant,
} from "./deepdiveUi";

const steps: DeepStep[] = [
  {
    seq: 1,
    typeLabel: "工具选择",
    content: "尝试因式分解",
    warrant: "十字相乘法适用（首项系数为 1）",
    warrantNodes: ["因式分解·符号规则"],
    motive: "6=2×3 且 2+3=5——信号明显",
    offRamp: "因数组不合才转求根公式",
  },
  {
    seq: 2,
    typeLabel: "等价变形",
    content: "(x−2)(x−3)=0",
    warrant: "乘法分配律逆用",
    warrantNodes: ["整式乘法"],
    motive: "S1 已锁定 2 与 3",
    offRamp: "写成 (x+2)(x+3) 是符号错",
  },
];

describe("五玩 Tab", () => {
  it("query 合法化与索引", () => {
    expect(modeFromQuery("predict")).toBe("predict");
    expect(modeFromQuery("nope")).toBe("read");
    expect(modeFromQuery(undefined)).toBe("read");
    expect(modeFromQuery(42)).toBe("read");
    expect(DEEP_MODES.map((m) => m.key)).toEqual(["read", "predict", "dual", "multi", "ai"]);
    expect(modeIndex("multi")).toBe(3);
    expect(modeIndex("bad" as never)).toBe(0);
  });
});

describe("步卡-右栏联动（WD3）", () => {
  it("rail 取三层与挂点", () => {
    const r = railOf(steps[0]);
    expect(r.warrant).toContain("十字相乘");
    expect(r.nodes).toEqual(["因式分解·符号规则"]);
    expect(r.motive).toContain("2×3");
    expect(r.offRamp).toContain("求根公式");
  });
  it("未选/不存在 → 首步回退；空列表 null", () => {
    expect(railOf(null).warrant).toContain("未选择");
    expect(selectStep(steps, 99)?.seq).toBe(1);
    expect(selectStep(steps, 2)?.seq).toBe(2);
    expect(selectStep([], 1)).toBeNull();
  });
});

describe("预测双分支渲染（E2）", () => {
  const base: PredState = { kind: "PICK", answered: false, selectedIndex: -1, correctIndex: 1 };
  const opts = {
    reinforce: "零因子律正是此步依据；动机=目标降次。",
    wrongBridge: "你会这么想，因为除掉更快——",
    offRamp: "(x−2) 可能为 0，同除会丢根",
    reference: "设未知 x 后列一元一次方程",
  };

  it("客观三态：idle/right/wrong", () => {
    expect(predictionBranch(base)).toBe("idle");
    expect(predictionBranch({ ...base, answered: true, selectedIndex: 1 })).toBe("right");
    expect(predictionBranch({ ...base, answered: true, selectedIndex: 0 })).toBe("wrong");
  });

  it("主观恒 self（不自动判）", () => {
    const s: PredState = { kind: "SUBJECTIVE", answered: true, selectedIndex: 0, correctIndex: 0 };
    expect(predictionBranch(s)).toBe("self");
    expect(predictionBranch({ ...s, answered: false })).toBe("idle");
  });

  it("点评文案句式", () => {
    const right = predictionFeedback({ ...base, answered: true, selectedIndex: 1 }, opts);
    expect(right.headline).toContain("正确");
    expect(right.body).toContain("动机");

    const wrong = predictionFeedback({ ...base, answered: true, selectedIndex: 0 }, opts);
    expect(wrong.headline).toContain("错");
    expect(wrong.body).toContain("你会这么想");
    expect(wrong.offRamp).toContain("丢根");

    const self = predictionFeedback(
      { kind: "SUBJECTIVE", answered: true, selectedIndex: 0, correctIndex: 0 },
      opts,
    );
    expect(self.headline).toContain("不自动判分");
    expect(self.body).toContain("对照参考");
    expect(self.body).toContain("不计入推理画像");

    expect(predictionFeedback(base, opts).headline).toBe("");
  });

  it("选项标记", () => {
    const s: PredState = { kind: "PICK", answered: false, selectedIndex: 0, correctIndex: 1 };
    expect(predOptionMark(s, 0)).toBe("sel");
    expect(predOptionMark({ ...s, answered: true }, 1)).toBe("right");
    expect(predOptionMark({ ...s, answered: true }, 0)).toBe("wrong");
    expect(predOptionMark({ ...s, answered: true }, 2)).toBe("");
    expect(predOptionMark({ ...s, kind: "SUBJECTIVE, answered: false" as never }, 0)).toBe("");
  });
});

describe("顺逆双画布对齐", () => {
  const F = [
    { id: "s1", label: "条件" },
    { id: "s2", label: "分解" },
    { id: "s3", label: "零因子" },
  ];
  const B = [
    { id: "s3", label: "要两根" },
    { id: "s2", label: "需分解" },
    { id: "s1", label: "先看条件" },
    { id: "sX", label: "多余" },
  ];

  it("按 id 对齐保持 forward 序，未对齐 null", () => {
    const pairs = alignPairs(F, B);
    expect(pairs.map((p) => p.matched)).toEqual([true, true, true]);
    expect(pairs[0].backward?.label).toBe("先看条件");
    expect(pairs[1].backward?.label).toBe("需分解");
    const partial = alignPairs(F, [{ id: "s2", label: "需分解" }]);
    expect(partial.map((p) => p.matched)).toEqual([false, true, false]);
    expect(partial[0].backward).toBeNull();
  });

  it("对齐率与色序号（未对齐灰）", () => {
    expect(alignRatio(alignPairs(F, B))).toBe(100);
    expect(alignRatio(alignPairs(F, [{ id: "s2", label: "x" }]))).toBe(33);
    expect(alignRatio([])).toBe(0);
    const pairs = alignPairs(F, [{ id: "s2", label: "x" }]);
    expect(pairColorIndex(pairs, 1)).toBe(1 % 6);
    expect(pairColorIndex(pairs, 0)).toBeNull();
    expect(pairColorIndex(pairs, 99)).toBeNull();
  });
});

describe("多解对比表", () => {
  const variants: Variant[] = [
    { id: "a", name: "因式分解", stepCount: 3, trick: "中", calcLoad: "小", applicable: "判别式完全平方" },
    { id: "b", name: "求根公式", stepCount: 4, trick: "低", calcLoad: "中", applicable: "恒可用", isGeneral: true },
    { id: "c", name: "图像交点", stepCount: 5, trick: "高", calcLoad: "中", applicable: "需估根" },
  ];

  it("行渲染：通法标注", () => {
    const rows = variantRows(variants);
    expect(rows).toHaveLength(3);
    expect(rows[1].name).toBe("求根公式（通法）");
    expect(rows[0].stepText).toBe("3 步");
    expect(variantRows([])).toEqual([]);
  });

  it("最快解：步数→技巧；空集 null", () => {
    expect(fastestVariant(variants)?.id).toBe("a");
    expect(fastestVariant([])).toBeNull();
    const tie: Variant[] = [
      { id: "x", name: "X", stepCount: 3, trick: "高", calcLoad: "中", applicable: "t" },
      { id: "y", name: "Y", stepCount: 3, trick: "低", calcLoad: "中", applicable: "t" },
    ];
    expect(fastestVariant(tie)?.id).toBe("y");
  });

  it("通法总结句含两级策略", () => {
    expect(generalTip()).toContain("优先因式分解");
    expect(generalTip()).toContain("求根公式");
  });
});

describe("typed 路由（20 §8）", () => {
  it("路径构造与非法 type 兜底", () => {
    expect(deepdivePath("question", 12)).toBe("/deepdive/question/12");
    expect(deepdivePath("formula", 7)).toBe("/deepdive/formula/7");
    expect(deepdivePath("evil", 7)).toBe("/deepdive/question/7");
    expect(normalizeSubjectType("formula")).toBe("formula");
    expect(normalizeSubjectType("QUESTION")).toBe("question");
    expect(normalizeSubjectType(undefined)).toBe("question");
  });
});
