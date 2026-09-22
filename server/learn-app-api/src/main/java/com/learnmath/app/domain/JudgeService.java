package com.learnmath.app.domain;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 判分引擎（02 §5.4 · 纯函数，禁止 Spring 依赖 —— 02 §4.1 domain 规则）。
 *
 * 归一化流水线：trim → 全角转半角 → 去千分位/货币符 →（可选小写）→ 分数等价 → 数值比较。
 * 多空：期望按 "||" 分空，空内可接受答案按 "|" 分隔（03 T09 answer 约定、07 §3.1 用例）。
 * 解答题不判分 → PENDING_SELF_ASSESS（01 U-04 / 20 BR-04）。
 */
public final class JudgeService {

    public enum QuestionType { SINGLE, MULTI, JUDGE, FILL, ESSAY }

    public enum Outcome { CORRECT, WRONG, PENDING_SELF_ASSESS }

    /**
     * 判分规格 = 题目 judge_config（03 T09）投影。
     *
     * @param numericTolerance  相对容差；<=0 表示关闭（07 用例：关=不等，开=可容）
     * @param proportionalFill  多空按命中比例计（false=全对才算对，07 用例）
     */
    public record JudgeSpec(
            QuestionType type,
            String expected,
            boolean fullWidthToHalf,
            boolean stripSeparators,
            boolean lowercase,
            boolean fractionEquivalent,
            double numericTolerance,
            boolean proportionalFill) {

        /** 常用默认：开全角/分隔符/分数等价，关容差与大小写（英文题显式开）。 */
        public static JudgeSpec defaults(QuestionType type, String expected) {
            return new JudgeSpec(type, expected, true, true, false, true, 0d, false);
        }
    }

    /** 结果：outcome + 多空命中明细（proportionalFill 反馈用）+ 双端归一化串（审计/展示）。 */
    public record JudgeResult(Outcome outcome, int matchedBlanks, int totalBlanks,
                              String normalizedUser, String normalizedExpected) {

        public boolean correct() {
            return outcome == Outcome.CORRECT;
        }
    }

    private static final Pattern FRACTION = Pattern.compile("^(-?\\d+(?:\\.\\d+)?)/(-?\\d+(?:\\.\\d+)?)$");
    private static final Pattern NUMBER = Pattern.compile("^-?\\d+(?:\\.\\d+)?$");

    public JudgeResult judge(JudgeSpec spec, String rawUser) {
        if (spec.type() == QuestionType.ESSAY) {
            return new JudgeResult(Outcome.PENDING_SELF_ASSESS, 0, 0, rawUser, spec.expected());
        }

        String normExpected = normalize(spec, spec.expected() == null ? "" : spec.expected());
        String normUser = normalize(spec, rawUser == null ? "" : rawUser);

        if (isChoice(spec.type())) {
            Set<String> expectedSet = splitChoice(normExpected);
            Set<String> userSet = splitChoice(normUser);
            boolean ok = !expectedSet.isEmpty() && expectedSet.equals(userSet);
            return new JudgeResult(ok ? Outcome.CORRECT : Outcome.WRONG,
                    ok ? expectedSet.size() : 0, expectedSet.size(), normUser, normExpected);
        }

        // FILL：多空
        String[] expectedBlanks = splitBlanks(normExpected);
        String[] userBlanks = splitBlanks(normUser);
        if (expectedBlanks.length == 0) {
            return new JudgeResult(Outcome.WRONG, 0, 0, normUser, normExpected);
        }
        if (expectedBlanks.length != userBlanks.length) {
            // 空数不一致：整体判错；proportionalFill 仅在空数一致时按比例
            return new JudgeResult(Outcome.WRONG, 0, expectedBlanks.length, normUser, normExpected);
        }
        int matched = 0;
        for (int i = 0; i < expectedBlanks.length; i++) {
            if (blankMatches(spec, expectedBlanks[i], userBlanks[i])) {
                matched++;
            }
        }
        boolean allMatched = matched == expectedBlanks.length;
        boolean ok = allMatched || (spec.proportionalFill() && matched > 0);
        // proportionalFill 模式下 matched>0 即视为"部分得分路径"，由上层按比例计分；
        // 判定语义：outcome 仅 CORRECT(全对) / WRONG(未全对)，比例通过 matched/total 暴露。
        Outcome outcome = allMatched ? Outcome.CORRECT : Outcome.WRONG;
        return new JudgeResult(outcome, matched, expectedBlanks.length, normUser, normExpected);
    }

    /** 多空命中比例（proportionalFill 计分用）：0..1；无空返回 0。 */
    public double fillRatio(JudgeResult result) {
        return result.totalBlanks() == 0 ? 0d : (double) result.matchedBlanks() / result.totalBlanks();
    }

    // ---------- 内部：归一化与比较 ----------

    private static boolean isChoice(QuestionType type) {
        return type == QuestionType.SINGLE || type == QuestionType.MULTI || type == QuestionType.JUDGE;
    }

    private String normalize(JudgeSpec spec, String in) {
        String s = in.trim();
        if (spec.fullWidthToHalf()) {
            s = toHalfWidth(s);
        }
        if (spec.stripSeparators()) {
            s = s.replace(",", "").replace("，", "")
                 .replace("￥", "").replace("¥", "").replace("$", "")
                 .replace(" ", "");
        }
        if (spec.lowercase()) {
            s = s.toLowerCase(Locale.ROOT);
        }
        if (spec.fractionEquivalent()) {
            s = canonicalizeMath(s);
        }
        return s;
    }

    static String toHalfWidth(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            if (c >= 0xFF01 && c <= 0xFF5E) {
                sb.append((char) (c - 0xFEE0));
            } else if (c == 0x3000) {
                sb.append(' ');
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** 分数等价 + 数字规范化：1/2、0.5、½ → 统一十进制串；1.00 → 1。 */
    static String canonicalizeMath(String s) {
        // 通俗分数字符 → n/d
        StringBuilder converted = new StringBuilder();
        boolean replaced = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '½') { converted.append("1/2"); replaced = true; }
            else if (c == '¼') { converted.append("1/4"); replaced = true; }
            else if (c == '¾') { converted.append("3/4"); replaced = true; }
            else { converted.append(c); }
        }
        String t = replaced ? converted.toString() : s;

        Matcher fm = FRACTION.matcher(t);
        if (fm.matches()) {
            try {
                BigDecimal num = new BigDecimal(fm.group(1));
                BigDecimal den = new BigDecimal(fm.group(2));
                if (den.signum() == 0) {
                    return t;
                }
                return stripZeros(num.divide(den, new MathContext(12)));
            } catch (ArithmeticException ignored) {
                return t;
            }
        }
        Matcher nm = NUMBER.matcher(t);
        if (nm.matches()) {
            return stripZeros(new BigDecimal(t));
        }
        return t;
    }

    private static String stripZeros(BigDecimal v) {
        BigDecimal stripped = v.stripTrailingZeros();
        // stripTrailingZeros 对整数可能得到 1E+2 形式 → toPlainString 归一
        return stripped.signum() == 0 ? "0" : stripped.toPlainString();
    }

    private static Set<String> splitChoice(String normalized) {
        Set<String> set = new HashSet<>();
        for (String token : normalized.split("[,、/\\s]+")) {
            String t = token.trim().toUpperCase(Locale.ROOT);
            if (!t.isEmpty()) {
                // 单 token 多字母（"ACD"）拆成单字母集合
                boolean allLetters = t.length() > 1 && t.chars().allMatch(c -> c >= 'A' && c <= 'Z');
                if (allLetters) {
                    for (char c : t.toCharArray()) {
                        set.add(String.valueOf(c));
                    }
                } else {
                    set.add(t);
                }
            }
        }
        return set;
    }

    private static String[] splitBlanks(String normalized) {
        List<String> blanks = new ArrayList<>();
        for (String part : normalized.split("\\|\\|", -1)) {
            blanks.add(part.trim());
        }
        return blanks.toArray(new String[0]);
    }

    private static boolean blankMatches(JudgeSpec spec, String expectedBlank, String userBlank) {
        String user = userBlank.trim();
        // 空内可接受答案（"|" 分隔）
        for (String alt : expectedBlank.split("\\|", -1)) {
            String a = alt.trim();
            if (a.isEmpty()) {
                continue;
            }
            if (a.equals(user)) {
                return true;
            }
            if (spec.fractionEquivalent() && canonicalizeMath(a).equals(canonicalizeMath(user))) {
                return true;
            }
            if (spec.numericTolerance() > 0 && numericClose(spec.numericTolerance(), a, user)) {
                return true;
            }
        }
        return false;
    }

    static boolean numericClose(double tolerance, String expected, String user) {
        try {
            double e = Double.parseDouble(stripZeros(new BigDecimal(canonicalizeMath(expected))));
            double u = Double.parseDouble(stripZeros(new BigDecimal(canonicalizeMath(user))));
            double diff = Math.abs(e - u);
            return diff <= tolerance * Math.max(Math.abs(e), 1.0d);
        } catch (RuntimeException ex) {
            return false;
        }
    }

    /** 便于单测与调试的静态入口。 */
    public static JudgeResult judgeDefault(QuestionType type, String expected, String user) {
        return new JudgeService().judge(JudgeSpec.defaults(type, expected), user);
    }
}
