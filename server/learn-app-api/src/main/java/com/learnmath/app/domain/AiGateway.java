package com.learnmath.app.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * AI 接入层（02 §5.8 · 04 §2.4 SSE · 01 U-41~45 · E5 双模式；纯函数）。
 *
 * - Provider 开关关闭 → **3100**（入口隐藏，能力全拒）；
 * - 限流与积分：对话 每日前 3 次免费、其后按 PointsRules.aiChatCost 扣；
 *   余额不足 → **3101**；上游失败 → **3102**（降级不阻塞业务，BR-05 同源）；
 * - SSE 帧协议（04 §2.4）：`event: message/done/error` + `data: {...}`，流终结 `data:[DONE]`；
 * - 双模式默认**苏格拉底**（E5）；出题走标准作答流（AI 题先入 source=AI 待审池，U-42）；
 *   计划生成 JSON 结构校验失败 → 规则回落（U-44）。
 */
public final class AiGateway {

    /** 功能能力。 */
    public enum Capability { CHAT, EXPLAIN, QUIZ, PLAN, DIAGNOSE }

    /** 授权结果。 */
    public enum Decision { ALLOW, DISABLED_3100, LIMITED_3101, UPSTREAM_3102 }

    /** 对话模式（E5 默认苏格拉底）。 */
    public enum Mode { SOCRATIC, DIRECT }

    public record Authorize(Decision decision, int cost, String reason) {}

    /** SSE 帧。 */
    public record Frame(String event, String dataJson) {

        public String render() {
            return "event: " + event + "\n" + "data: " + dataJson + "\n\n";
        }
    }

    private AiGateway() {
    }

    // ---------- 授权 / 限流 ----------

    /** Provider 总开关。 */
    public static Decision capabilityGate(boolean providerEnabled, Capability cap) {
        if (!providerEnabled || cap == null) {
            return Decision.DISABLED_3100;
        }
        return Decision.ALLOW;
    }

    /**
     * 对话授权：免费次数内 0 分；其后查余额（不足 3101）。
     *
     * @param usedToday 今日已用次数
     * @param balance   当前积分
     */
    public static Authorize authorizeChat(boolean providerEnabled, int usedToday, int balance) {
        if (!providerEnabled) {
            return new Authorize(Decision.DISABLED_3100, 0, "AI 未启用（3100）");
        }
        int cost = PointsRules.aiChatCost(PointsRules.Pricing.defaults(), usedToday);
        if (cost > balance) {
            return new Authorize(Decision.LIMITED_3101, cost, "积分不足（3101）");
        }
        return new Authorize(Decision.ALLOW, cost, cost == 0 ? "前 3 次免费" : "扣 " + cost + " 积分");
    }

    public static Authorize authorizeFixed(boolean providerEnabled, Capability cap, int cost, int balance) {
        if (!providerEnabled) {
            return new Authorize(Decision.DISABLED_3100, 0, "AI 未启用（3100）");
        }
        if (cost > balance) {
            return new Authorize(Decision.LIMITED_3101, cost, "积分不足（3101）");
        }
        return new Authorize(Decision.ALLOW, cost, "扣 " + cost + " 积分");
    }

    /** 上游失败回执（3102；业务不等待，BR-05 降级同源）。 */
    public static Authorize upstreamError() {
        return new Authorize(Decision.UPSTREAM_3102, 0, "AI 服务暂时不可用（3102）");
    }

    // ---------- SSE 帧协议 ----------

    public static Frame message(String payloadJson) {
        return new Frame("message", payloadJson);
    }

    public static Frame done(String usageJson) {
        return new Frame("done", usageJson == null || usageJson.isBlank() ? "{}" : usageJson);
    }

    public static Frame error(int code, String message) {
        String msg = message == null ? "" : message.replace("\"", "'");
        return new Frame("error", "{\"code\":" + code + ",\"message\":\"" + msg + "\"}");
    }

    public static final String STREAM_TERMINATOR = "data:[DONE]\n\n";

    /** 解析单帧（测试/客户端共用）：event + data 行。 */
    public static Frame parseFrame(String rendered) {
        String event = null;
        StringBuilder data = new StringBuilder();
        for (String line : rendered.split("\n", -1)) {
            if (line.startsWith("event: ")) {
                event = line.substring(7).trim();
            } else if (line.startsWith("data: ")) {
                if (data.length() > 0) {
                    data.append('\n');
                }
                data.append(line.substring(6));
            }
        }
        return new Frame(event == null ? "message" : event, data.toString());
    }

    /** 流是否终结（[DONE]）。 */
    public static boolean isTerminator(String dataLine) {
        return "[DONE]".equals(dataLine);
    }

    // ---------- 模式与业务回落 ----------

    public static Mode defaultMode() {
        return Mode.SOCRATIC; // E5：未指定 → 苏格拉底
    }

    /** 客户端未传模式 → 苏格拉底；传了才用传值（显式切换允许）。 */
    public static Mode resolveMode(Mode requested) {
        return requested == null ? Mode.SOCRATIC : requested;
    }

    /** 模式提示语（直接讲解模式需明示给出答案，苏格拉底引导）。 */
    public static String modeDirective(Mode m) {
        return m == Mode.DIRECT
                ? "直接讲解：给出完整解答步骤并标注依据"
                : "苏格拉底：一次只问一个问题，引导用户自己发现下一步（默认不给答案）";
    }

    /**
     * AI 计划 JSON 结构校验（U-44：失败 → 规则回落）。
     * 结构要求：tasks 非空，每项含 date(YYYY-MM-DD) 与 title。
     */
    public static boolean planStructureValid(List<String> taskDates, List<String> taskTitles) {
        if (taskDates == null || taskTitles == null || taskDates.isEmpty()
                || taskDates.size() != taskTitles.size()) {
            return false;
        }
        for (int i = 0; i < taskDates.size(); i++) {
            String d = taskDates.get(i);
            String t = taskTitles.get(i);
            if (d == null || !d.matches("\\d{4}-\\d{2}-\\d{2}") || t == null || t.isBlank()) {
                return false;
            }
        }
        return true;
    }

    /** 计划回落（规则引擎兜底文案）。 */
    public static String planFallback(int days) {
        return "AI 计划校验失败，已按规则引擎生成 " + Math.max(1, days) + " 天计划（01 U-44 回落）";
    }

    /** AI 出题 → 标准作答流的入库前置（U-42：先入 source=AI 待审池，未审不进卷）。 */
    public static boolean quizItemsUsableBeforeReview() {
        return false;
    }

    /** 额度文案（设置页）。 */
    public static String quotaText(PointsRules.Pricing p) {
        return "对话：每日前 " + p.aiChatFreePerDay() + " 次免费，之后 " + p.aiChatCost()
                + " 积分/次；出题 " + p.aiQuizCost() + "；讲解 " + p.aiExplainCost()
                + "；单日上限 " + p.dailyGlobalEarnCap() + "（02 §5.7 默认）";
    }

    /** 供设置页展示的能力列表（关闭的能力整行隐藏）。 */
    public static List<Capability> visibleCapabilities(boolean providerEnabled) {
        List<Capability> out = new ArrayList<>();
        if (providerEnabled) {
            for (Capability c : Capability.values()) {
                out.add(c);
            }
        }
        return out;
    }

    static String normalizeMode(Mode m) {
        return m == null ? "socratic" : m.name().toLowerCase(Locale.ROOT);
    }
}
