package com.learnmath.app.domain;

import com.learnmath.app.domain.FormulaHall.DrillType;
import com.learnmath.app.domain.FormulaHall.FamilyRel;
import com.learnmath.app.domain.FormulaHall.Formula;
import com.learnmath.app.domain.FormulaHall.SymbolEntry;
import com.learnmath.app.domain.FormulaHall.Variant;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 公式馆 —— 11 号七件套 / alias 索引(F1) / 徽标(F3) / 小练三型(F5) / BR-08。 */
class FormulaHallTest {

    private static Formula full() {
        return new Formula(7L, "勾股定理",
                List.of("毕达哥拉斯定理", "商高定理"), "a^2+b^2=c^2", 2, 1, 1,
                "古希腊面积拼图",
                List.of(new SymbolEntry("a", "直角边", "正实数"),
                        new SymbolEntry("θ", "角度", "无量纲")), true,
                "仅直角三角形（∠C=90°）。边长为正实数。",
                "不可达测距、拱桥跨径",
                "勾三股四弦五",
                List.of(new Variant(true, "a²+b²=c²", "正位"),
                        new Variant(false, "a²+b²=c² 对任意三角形", "缺 −2ab·cosC")),
                List.of(new FamilyRel(8L, 1, "推广为余弦定理")));
    }

    private static Formula bare() {
        return new Formula(8L, "裸公式", null, "x=1", 1, 1, 4,
                null, null, false, null, null, null, null, null);
    }

    @Test
    void aliasIndex_nameAndAliases_caseInsensitive() {
        Map<String, Long> idx = FormulaHall.buildAliasIndex(List.of(full(), bare()));
        assertEquals(7L, idx.get("勾股定理"));
        assertEquals(7L, idx.get("毕达哥拉斯定理"));
        assertEquals(7L, idx.get("商高定理"));
        assertEquals(Optional.of(7L), FormulaHall.lookup(idx, "  毕达哥拉斯定理 "));
        assertEquals(Optional.empty(), FormulaHall.lookup(idx, "不存在的别名"));
        assertEquals(Optional.empty(), FormulaHall.lookup(null, "x"));
    }

    @Test
    void conditionSummary_isAnchorNotFullConditions() {
        var s = FormulaHall.publicSummary(full());
        assertEquals("仅直角三角形（∠C=90°）。", s.conditionSummary(), "截第一句");
        assertTrue(s.hasFullConditionsAnchor(), "红条必须给完整条件锚点");
        assertEquals(1, s.proofStatus());
        // 无条件 → 无锚点（摘要空）
        var none = FormulaHall.publicSummary(bare());
        assertEquals("", none.conditionSummary());
        assertFalse(none.hasFullConditionsAnchor());
    }

    @Test
    void missingPieces_fullVsBare() {
        assertEquals(Set.of(), FormulaHall.missingPieces(full()), "七件套齐全");
        Set<String> miss = FormulaHall.missingPieces(bare());
        assertEquals(Set.of("origin", "symbols", "derivation", "conditions",
                "applications", "family", "variants"), miss, "全缺可见即待补全");
    }

    @Test
    void symbolTable_meaningAndRangeOrDimensionless() {
        assertNull(FormulaHall.symbolProblem(new SymbolEntry("a", "直角边", "正实数")));
        assertNull(FormulaHall.symbolProblem(new SymbolEntry("θ", "夹角", "无量纲")), "无单位明确标无量纲");
        assertNotNull(FormulaHall.symbolProblem(new SymbolEntry("a", "", "正实数")), "缺含义");
        assertNotNull(FormulaHall.symbolProblem(new SymbolEntry("a", "边长", null)), "缺定义域/单位");
        assertNotNull(FormulaHall.symbolProblem(new SymbolEntry("a", "边长", "  ")), "空白不算");
    }

    @Test
    void proofBadge_andCitable() {
        assertEquals("✓ 严格证明", FormulaHall.proofBadge(1));
        assertEquals("✓ 推导确立", FormulaHall.proofBadge(2));
        assertEquals("≈ 经验拟合", FormulaHall.proofBadge(3));
        assertEquals("⚑ 未证实（猜想）", FormulaHall.proofBadge(4), "F3 红紫徽标文案");
        assertFalse(FormulaHall.citableAsTheorem(4), "未证实不可作定理引用");
        assertTrue(FormulaHall.citableAsTheorem(1));
        assertTrue(FormulaHall.proofBadge(9).contains("未知"));
    }

    @Test
    void drillAvailability_showWhatExists() {
        assertEquals(Set.of(DrillType.CONDITION_JUDGE, DrillType.VARIANT_RECOGNIZE,
                DrillType.APPLICATION_MATCH), FormulaHall.drillAvailability(full()), "三型全 → 全显示");
        // 缺条件 → 条件判断型不可用
        Formula noCond = new Formula(9L, "无条件式", null, "x", 1, 1, 2,
                "o", List.of(new SymbolEntry("x", "量", "无量纲")), true,
                null, "app", null,
                List.of(new Variant(true, "x", "唯一")), List.of());
        Set<DrillType> avail = FormulaHall.drillAvailability(noCond);
        assertFalse(avail.contains(DrillType.CONDITION_JUDGE));
        assertTrue(avail.contains(DrillType.VARIANT_RECOGNIZE));
        assertTrue(avail.contains(DrillType.APPLICATION_MATCH));
        // 什么都没有 → 空集（有多少显示多少，不硬凑）
        assertEquals(Set.of(), FormulaHall.drillAvailability(bare()));
    }

    @Test
    void errorVariants_separated_fromLegal() {
        assertEquals(1, FormulaHall.errorVariants(full()).size());
        assertTrue(FormulaHall.errorVariants(full()).get(0).expression().contains("任意三角形"));
        assertEquals(0, FormulaHall.errorVariants(bare()).size());
    }
}
