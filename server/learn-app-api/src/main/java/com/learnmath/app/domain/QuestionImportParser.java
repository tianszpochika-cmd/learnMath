package com.learnmath.app.domain;

import com.learnmath.app.domain.JudgeService.QuestionType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 题目导入与 judge_config 校验（03 T09 / 02 §5.4 / 17 A08；纯函数）。
 *
 * CSV 约定（表头固定）：type,stem,options,answer,analysis,difficulty,nodes
 *   type     SINGLE/MULTI/JUDGE/FILL/ESSAY
 *   options  "A.甲|B.乙|C.丙"（非选择题留空）
 *   answer   填空多空 "2||3"；空内多可接受 "x=2|2"
 *   nodes    知识点名，";" 分隔（抽题主查询必需 → 至少 1 个）
 * 逐行报错（行号可见），校验错误不抛出。
 */
public final class QuestionImportParser {

    public record JudgeConfig(boolean fullWidth, boolean stripSeparators, boolean lowercase,
                              double tolerance, boolean proportionalFill) {

        public static JudgeConfig defaults() {
            return new JudgeConfig(true, true, false, 0d, false);
        }
    }

    /** 一行题目草稿（已切分未深校验）。 */
    public record QuestionDraft(QuestionType type, String stem, List<String> options,
                                String answer, String analysis, int difficulty,
                                List<String> nodes, JudgeConfig judgeConfig, int line) {}

    public record ImportError(int line, String reason) {}

    public record ImportResult(List<QuestionDraft> drafts, List<ImportError> errors) {
        public boolean ok() {
            return errors.isEmpty();
        }
    }

    private QuestionImportParser() {
    }

    public static ImportResult parse(String csv) {
        List<QuestionDraft> drafts = new ArrayList<>();
        List<ImportError> errors = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            errors.add(new ImportError(1, "内容为空"));
            return new ImportResult(List.of(), errors);
        }
        String[] lines = csv.split("\r?\n", -1);
        boolean header = false;
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            int lineNo = i + 1;
            if (line.isBlank()) {
                continue;
            }
            List<String> cols = KnowledgeTreeParser.splitCsvLine(line);
            if (!header) {
                header = true;
                if (cols.isEmpty() || !cols.get(0).trim().equalsIgnoreCase("type")) {
                    errors.add(new ImportError(lineNo, "表头首列必须为 type"));
                    return new ImportResult(List.of(), errors);
                }
                continue;
            }
            String typeRaw = get(cols, 0).trim().toUpperCase();
            String stem = get(cols, 1).trim();
            String optionsRaw = get(cols, 2).trim();
            String answer = get(cols, 3).trim();
            String analysis = get(cols, 4).trim();
            String diffRaw = get(cols, 5).trim();
            String nodesRaw = get(cols, 6).trim();

            QuestionType type;
            try {
                type = QuestionType.valueOf(typeRaw);
            } catch (IllegalArgumentException e) {
                errors.add(new ImportError(lineNo, "未知题型: " + typeRaw));
                continue;
            }
            int difficulty;
            try {
                difficulty = Integer.parseInt(diffRaw);
            } catch (NumberFormatException e) {
                errors.add(new ImportError(lineNo, "difficulty 非整数: " + diffRaw));
                continue;
            }
            List<String> options = new ArrayList<>();
            if (!optionsRaw.isEmpty()) {
                for (String o : optionsRaw.split("\\|")) {
                    if (!o.isBlank()) {
                        options.add(o.trim());
                    }
                }
            }
            List<String> nodes = new ArrayList<>();
            if (!nodesRaw.isEmpty()) {
                for (String n : nodesRaw.split(";")) {
                    if (!n.isBlank()) {
                        nodes.add(n.trim());
                    }
                }
            }
            QuestionDraft draft = new QuestionDraft(type, stem, List.copyOf(options), answer,
                    analysis, difficulty, List.copyOf(nodes), JudgeConfig.defaults(), lineNo);
            List<String> problems = validate(draft);
            if (problems.isEmpty()) {
                drafts.add(draft);
            } else {
                for (String p : problems) {
                    errors.add(new ImportError(lineNo, p));
                }
            }
        }
        if (header && drafts.isEmpty() && errors.isEmpty()) {
            errors.add(new ImportError(1, "无数据行"));
        }
        return new ImportResult(List.copyOf(drafts), List.copyOf(errors));
    }

    /** 结构校验（17 A08 字段规则 + 02 §5.4 判分配置）。返回错误列表（空=通过）。 */
    public static List<String> validate(QuestionDraft d) {
        List<String> errs = new ArrayList<>();
        if (d.stem().isEmpty()) {
            errs.add("stem 为空");
        }
        if (d.difficulty() < 1 || d.difficulty() > 5) {
            errs.add("difficulty 超出 1-5: " + d.difficulty());
        }
        if (d.answer() == null || d.answer().isBlank()) {
            errs.add("answer 为空");
        }
        if (d.nodes().isEmpty()) {
            errs.add("至少关联 1 个知识点（抽题主查询必需）");
        }
        if (d.answer() != null && d.answer().length() > 500) {
            errs.add("answer 超长(>500)");
        }
        boolean isChoice = d.type() == QuestionType.SINGLE || d.type() == QuestionType.MULTI
                || d.type() == QuestionType.JUDGE;
        if (isChoice) {
            if (d.options().isEmpty()) {
                errs.add("选择题必须有选项");
            } else {
                Set<String> keys = optionKeys(d.options());
                for (String a : answerLetters(d.answer())) {
                    if (!keys.contains(a)) {
                        errs.add("答案键不在选项中: " + a + "（可选 " + keys + "）");
                    }
                }
                if (answerLetters(d.answer()).isEmpty()) {
                    errs.add("选择题答案必须为选项键（如 A 或 A,C）");
                }
            }
        }
        errs.addAll(validateJudgeConfig(d.type(), d.judgeConfig()));
        return errs;
    }

    /** judge_config 规则（02 §5.4）：容差仅填空且 0~0.1；比例计分仅填空。 */
    public static List<String> validateJudgeConfig(QuestionType type, JudgeConfig cfg) {
        List<String> errs = new ArrayList<>();
        if (cfg == null) {
            return errs;
        }
        if (cfg.tolerance() < 0 || cfg.tolerance() > 0.1) {
            errs.add("judge_config.tolerance 超出 [0,0.1]: " + cfg.tolerance());
        }
        if (cfg.tolerance() > 0 && type != QuestionType.FILL) {
            errs.add("judge_config.tolerance 仅填空题可用");
        }
        if (cfg.proportionalFill() && type != QuestionType.FILL) {
            errs.add("judge_config.proportionalFill 仅填空题可用");
        }
        return errs;
    }

    /** 选项键集合："A.甲" → A。 */
    public static Set<String> optionKeys(List<String> options) {
        Set<String> keys = new LinkedHashSet<>();
        for (String o : options) {
            String k = o.contains(".") ? o.substring(0, o.indexOf('.')).trim() : o.trim();
            keys.add(k.toUpperCase(java.util.Locale.ROOT));
        }
        return keys;
    }

    /** 答案字母集："A,C" → [A, C]（跳过非字母段）。 */
    public static List<String> answerLetters(String answer) {
        List<String> letters = new ArrayList<>();
        if (answer == null) {
            return letters;
        }
        for (String p : answer.split("[,、\\s]+")) {
            String t = p.trim().toUpperCase(java.util.Locale.ROOT);
            if (t.length() == 1 && t.charAt(0) >= 'A' && t.charAt(0) <= 'Z') {
                letters.add(t);
            }
        }
        return letters;
    }

    private static String get(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }
}
