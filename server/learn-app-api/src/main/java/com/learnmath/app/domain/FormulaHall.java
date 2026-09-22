package com.learnmath.app.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 公式馆域（11 号 · 20 §8 BR-08 · F1-F3；纯函数）。
 *
 * 七件套：起源 origin / 符号表 symbols / 推导链 derivation(→subject=formula 深钻) /
 * 条件边界 conditions / 应用 applications / 家族关系 family / 变形 variants。
 * - 空字段显示"待补全"，**有数据必须可达**（missingPieces）；
 * - 条件摘要（红条）≠ 完整条件 —— 摘要只是首屏锚点，必须给"完整条件与误用边界"入口；
 * - 符号表至少含 含义/定义域/单位（无单位明确标"无量纲"）；
 * - 小练三型"有多少显示多少"（drillAvailability）；
 * - proof_status=4 → "未证实"红紫徽标，不可作定理引用（F3）。
 */
public final class FormulaHall {

    /** 小练三型（F5 → 标准作答流）。 */
    public enum DrillType { CONDITION_JUDGE, VARIANT_RECOGNIZE, APPLICATION_MATCH }

    /** 符号表条目。 */
    public record SymbolEntry(String symbol, String meaning, String rangeNote) {}

    /** 变形：合法式 / 常见误用式（红笔区，不进首屏正位）。 */
    public record Variant(boolean legal, String expression, String note) {}

    /** 家族关系（03 T57 rel_type 1-6）。 */
    public record FamilyRel(long toFormulaId, int relType, String note) {}

    /** 公式实体（nullable = 未补全）。 */
    public record Formula(long id, String name, List<String> aliases, String latex,
                          int domain, int tier, int proofStatus,
                          String origin, List<SymbolEntry> symbols, boolean hasDerivation,
                          String conditions, String applications, String memoryHook,
                          List<Variant> variants, List<FamilyRel> family) {}

    /** 公开摘要（官网只读；不含推导链接）。 */
    public record PublicSummary(String name, String latex, String conditionSummary,
                                int proofStatus, boolean hasFullConditionsAnchor) {}

    private FormulaHall() {
    }

    // ---------- alias 倒排（F1 题面可点匹配键） ----------

    /** 构建 alias→formulaId 倒排（name+aliases 全入，归一化小写去空）。 */
    public static Map<String, Long> buildAliasIndex(List<Formula> formulas) {
        Map<String, Long> idx = new LinkedHashMap<>();
        if (formulas == null) {
            return idx;
        }
        for (Formula f : formulas) {
            if (f.name() != null && !f.name().isBlank()) {
                idx.putIfAbsent(normalizeAlias(f.name()), f.id());
            }
            if (f.aliases() != null) {
                for (String a : f.aliases()) {
                    if (a != null && !a.isBlank()) {
                        idx.putIfAbsent(normalizeAlias(a), f.id());
                    }
                }
            }
        }
        return idx;
    }

    public static Optional<Long> lookup(Map<String, Long> index, String text) {
        if (index == null || text == null || text.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(index.get(normalizeAlias(text)));
    }

    static String normalizeAlias(String s) {
        return s.trim().toLowerCase(Locale.ROOT).replace(" ", "");
    }

    // ---------- 条件摘要（红条 ≠ 完整条件） ----------

    /** 首屏红条摘要：截第一句 ≤50 字 + 必须带完整条件锚点（F4/BR-08）。 */
    public static PublicSummary publicSummary(Formula f) {
        String conditions = f.conditions() == null ? "" : f.conditions().trim();
        String firstSentence = conditions;
        int cut = firstSentence.indexOf('。');
        if (cut > 0) {
            firstSentence = firstSentence.substring(0, cut + 1);
        }
        if (firstSentence.length() > 50) {
            firstSentence = firstSentence.substring(0, 50) + "…";
        }
        boolean anchor = !conditions.isEmpty();
        return new PublicSummary(f.name(), f.latex(), firstSentence, f.proofStatus(), anchor);
    }

    // ---------- 完整度 ----------

    /** 七件套缺失清单（空=齐全；"空字段显示待补全，有数据必须可达"）。 */
    public static Set<String> missingPieces(Formula f) {
        Set<String> missing = new LinkedHashSet<>();
        if (f.origin() == null || f.origin().isBlank()) {
            missing.add("origin");
        }
        if (f.symbols() == null || f.symbols().isEmpty()) {
            missing.add("symbols");
        } else {
            for (SymbolEntry s : f.symbols()) {
                if (symbolProblem(s) != null) {
                    missing.add("symbols");
                    break;
                }
            }
        }
        if (!f.hasDerivation()) {
            missing.add("derivation");
        }
        if (f.conditions() == null || f.conditions().isBlank()) {
            missing.add("conditions");
        }
        if (f.applications() == null || f.applications().isBlank()) {
            missing.add("applications");
        }
        if (f.family() == null || f.family().isEmpty()) {
            missing.add("family");
        }
        if (f.variants() == null || f.variants().isEmpty()) {
            missing.add("variants");
        }
        return missing;
    }

    /** 符号表校验：含义必填；定义域/单位必填（无单位须标"无量纲"）。 */
    public static String symbolProblem(SymbolEntry s) {
        if (s == null || s.symbol() == null || s.symbol().isBlank()) {
            return "符号为空";
        }
        if (s.meaning() == null || s.meaning().isBlank()) {
            return "缺符号含义：" + s.symbol();
        }
        if (s.rangeNote() == null || s.rangeNote().isBlank()) {
            return "缺定义域/单位：" + s.symbol() + "（无单位请标 无量纲）";
        }
        return null;
    }

    // ---------- 徽标 ----------

    /** proof_status → 徽标文案（F3：4=未证实红紫，不可作定理引用）。 */
    public static String proofBadge(int proofStatus) {
        return switch (proofStatus) {
            case 1 -> "✓ 严格证明";
            case 2 -> "✓ 推导确立";
            case 3 -> "≈ 经验拟合";
            case 4 -> "⚑ 未证实（猜想）";
            default -> "？未知状态";
        };
    }

    public static boolean citableAsTheorem(int proofStatus) {
        return proofStatus != 4;
    }

    // ---------- 小练三型（有多少显示多少） ----------

    /** 可用小练型（条件判断需有完整条件；变形识别需 variants；应用匹配需 applications）。 */
    public static Set<DrillType> drillAvailability(Formula f) {
        Set<DrillType> out = new LinkedHashSet<>();
        if (f.conditions() != null && !f.conditions().isBlank()) {
            out.add(DrillType.CONDITION_JUDGE);
        }
        if (f.variants() != null && !f.variants().isEmpty()) {
            out.add(DrillType.VARIANT_RECOGNIZE);
        }
        if (f.applications() != null && !f.applications().isBlank()) {
            out.add(DrillType.APPLICATION_MATCH);
        }
        return out;
    }

    /** 误用式（error variants）单独取 —— 红笔区/首屏不正位展示。 */
    public static List<Variant> errorVariants(Formula f) {
        List<Variant> out = new ArrayList<>();
        if (f.variants() != null) {
            for (Variant v : f.variants()) {
                if (v != null && !v.legal()) {
                    out.add(v);
                }
            }
        }
        return out;
    }
}
