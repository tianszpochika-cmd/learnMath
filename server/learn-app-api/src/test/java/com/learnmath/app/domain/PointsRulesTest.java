package com.learnmath.app.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 积分规则 —— 02 §5.7 定价与风控默认值（B-05 DoD）。
 */
class PointsRulesTest {

    private final PointsRules.Pricing p = PointsRules.Pricing.defaults();

    @Test
    void defaults_matchDesign() {
        assertEquals(1, p.questionCorrectEach());
        assertEquals(50, p.questionCorrectDailyCap());
        assertEquals(5, p.checkin());
        assertEquals(20, p.makeupCost());
        assertEquals(5, p.aiChatCost());
        assertEquals(3, p.aiChatFreePerDay());
        assertEquals(10, p.aiQuizCost());
        assertEquals(200, p.dailyGlobalEarnCap());
    }

    @Test
    void aiChat_first3Free_thenCharged() {
        // 02 §5.7：每日前 3 次免费
        assertEquals(0, PointsRules.aiChatCost(p, 0));
        assertEquals(0, PointsRules.aiChatCost(p, 2));
        assertEquals(5, PointsRules.aiChatCost(p, 3));
        assertEquals(5, PointsRules.aiChatCost(p, 10));
    }

    @Test
    void questionReward_dailyCap50() {
        // 做题日上限 50
        assertEquals(10, PointsRules.questionReward(p, 10, 0));
        assertEquals(10, PointsRules.questionReward(p, 50, 40), "已得40 → 只再给10");
        assertEquals(0, PointsRules.questionReward(p, 20, 50), "已封顶");
    }

    @Test
    void earn_globalCap200() {
        // 日获取上限 200：超额部分不入账
        assertEquals(200, PointsRules.earn(p, 0, 500, 0));
        assertEquals(1020, PointsRules.earn(p, 1000, 50, 180), "剩余额度20 → 只再入 20");
        assertEquals(1000, PointsRules.earn(p, 1000, 50, 250), "已超上限不再入账");
    }

    @Test
    void spend_neverBelowFloor_forNormalOps() {
        // 负分保护（管理员豁免）
        assertEquals(0, PointsRules.applyDelta(5, -20, false));
        assertEquals(-15, PointsRules.applyDelta(5, -20, true));
        assertEquals(1240, PointsRules.applyDelta(1245, -5, false));
    }

    @Test
    void makeup_affordability_guard3502() {
        assertTrue(PointsRules.canAffordMakeup(20, p));
        assertFalse(PointsRules.canAffordMakeup(19, p), "不足 → 3502");
    }
}
