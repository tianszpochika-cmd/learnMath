package com.learnmath.app.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** AI 接入层 —— 02 §5.8 / 04 §2.4 SSE / E5 双模式 / U-42/U-44。 */
class AiGatewayTest {

    @Test
    void disabled_gives3100_andCapabilitiesHidden() {
        assertEquals(AiGateway.Decision.DISABLED_3100,
                AiGateway.capabilityGate(false, AiGateway.Capability.CHAT));
        assertEquals(3100, AiGateway.authorizeChat(false, 0, 100).cost() == 0
                ? AiGateway.authorizeChat(false, 0, 100).decision() == AiGateway.Decision.DISABLED_3100 ? 3100 : 0 : 0);
        assertTrue(AiGateway.visibleCapabilities(false).isEmpty(), "关闭 → 入口整行隐藏");
        assertEquals(5, AiGateway.visibleCapabilities(true).size());
        assertTrue(AiGateway.authorizeChat(false, 0, 999).reason().contains("3100"));
    }

    @Test
    void chat_freeFirst3_thenPoints_then3101() {
        // 前 3 次免费
        assertEquals(0, AiGateway.authorizeChat(true, 0, 0).cost());
        assertEquals(0, AiGateway.authorizeChat(true, 2, 0).cost());
        // 第 4 次起 5 分
        AiGateway.Authorize paid = AiGateway.authorizeChat(true, 3, 20);
        assertEquals(AiGateway.Decision.ALLOW, paid.decision());
        assertEquals(5, paid.cost());
        // 余额不足 → 3101
        AiGateway.Authorize poor = AiGateway.authorizeChat(true, 3, 3);
        assertEquals(AiGateway.Decision.LIMITED_3101, poor.decision());
        assertTrue(poor.reason().contains("3101"));
        // 出题固定 10 分
        AiGateway.Authorize quiz = AiGateway.authorizeFixed(true, AiGateway.Capability.QUIZ, 10, 5);
        assertEquals(AiGateway.Decision.LIMITED_3101, quiz.decision());
        assertEquals(AiGateway.Decision.ALLOW,
                AiGateway.authorizeFixed(true, AiGateway.Capability.QUIZ, 10, 10).decision());
        // 上游失败 3102
        assertEquals(AiGateway.Decision.UPSTREAM_3102, AiGateway.upstreamError().decision());
    }

    @Test
    void sse_frames_roundTrip() {
        AiGateway.Frame msg = AiGateway.message("{\"delta\":\"解\"}");
        String rendered = msg.render();
        assertTrue(rendered.startsWith("event: message\n"));
        assertTrue(rendered.endsWith("\n\n"));
        AiGateway.Frame parsed = AiGateway.parseFrame(rendered);
        assertEquals("message", parsed.event());
        assertEquals("{\"delta\":\"解\"}", parsed.dataJson());

        AiGateway.Frame done = AiGateway.done("{\"tokens\":12}");
        assertEquals("done", AiGateway.parseFrame(done.render()).event());
        assertTrue(AiGateway.parseFrame(done.render()).dataJson().contains("tokens"));

        AiGateway.Frame err = AiGateway.error(3102, "上游\"超时\"");
        assertTrue(err.render().contains("event: error"));
        assertTrue(err.render().contains("\"code\":3102"));
        assertFalse(err.render().contains("上游\"超时\""), "引号已转义防破帧");
        assertEquals("error", AiGateway.parseFrame(err.render()).event());

        assertTrue(AiGateway.isTerminator("[DONE]"));
        assertFalse(AiGateway.isTerminator("data"));
        assertTrue(AiGateway.STREAM_TERMINATOR.contains("[DONE]"));
    }

    @Test
    void mode_defaultSocratic_directExplicit() {
        assertEquals(AiGateway.Mode.SOCRATIC, AiGateway.defaultMode());
        assertEquals(AiGateway.Mode.SOCRATIC, AiGateway.resolveMode(null), "未指定 → 苏格拉底（E5）");
        assertEquals(AiGateway.Mode.DIRECT, AiGateway.resolveMode(AiGateway.Mode.DIRECT));
        assertTrue(AiGateway.modeDirective(AiGateway.Mode.SOCRATIC).contains("一次只问一个问题"));
        assertTrue(AiGateway.modeDirective(AiGateway.Mode.SOCRATIC).contains("不给答案"));
        assertTrue(AiGateway.modeDirective(AiGateway.Mode.DIRECT).contains("完整解答"));
    }

    @Test
    void plan_json_validation_andRuleFallback() {
        assertTrue(AiGateway.planStructureValid(
                List.of("2026-09-23", "2026-09-24"),
                List.of("判别式课时", "错题重练")));
        assertFalse(AiGateway.planStructureValid(List.of(), List.of()), "空");
        assertFalse(AiGateway.planStructureValid(List.of("2026-09-23"), List.of("a", "b")), "数量不齐");
        assertFalse(AiGateway.planStructureValid(List.of("09-23"), List.of("a")), "日期格式错");
        assertFalse(AiGateway.planStructureValid(List.of("2026-09-23"), List.of("  ")), "标题空");
        assertTrue(AiGateway.planFallback(7).contains("规则引擎"));
        assertTrue(AiGateway.planFallback(7).contains("7 天"));
    }

    @Test
    void quizItems_neverDirectlyUsable_and_quotaText() {
        assertFalse(AiGateway.quizItemsUsableBeforeReview(), "U-42：AI 题先入待审池未审不进卷");
        String quota = AiGateway.quotaText(PointsRules.Pricing.defaults());
        assertTrue(quota.contains("前 3 次免费"));
        assertTrue(quota.contains("10 积分/次") || quota.contains("积分/次"));
        assertTrue(quota.contains("讲解"));
    }
}
