package com.learnmath.app.domain;

import com.learnmath.app.domain.JudgeService.QuestionType;
import com.learnmath.app.domain.QuestionImportParser.ImportResult;
import com.learnmath.app.domain.QuestionImportParser.JudgeConfig;
import com.learnmath.app.domain.QuestionImportParser.QuestionDraft;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 题目导入 + judge_config 校验（03 T09 / 02 §5.4 / 17 A08）。 */
class QuestionImportParserTest {

    @Test
    void happyRows_parsed() {
        String csv = "type,stem,options,answer,analysis,difficulty,nodes\n"
                + "SINGLE,1+1=?,A.1|B.2,B,显然,1,代数;算术\n"
                + "FILL,解方程得 2||3,,2||3,,3,方程\n"
                + "ESSAY,证明勾股,,要点:面积法,面积拼图,4,几何\n";
        ImportResult r = QuestionImportParser.parse(csv);
        assertTrue(r.ok(), r.errors().toString());
        assertEquals(3, r.drafts().size());
        QuestionDraft d = r.drafts().get(0);
        assertEquals(QuestionType.SINGLE, d.type());
        assertEquals(List.of("A.1", "B.2"), d.options());
        assertEquals(List.of("代数", "算术"), d.nodes());
    }

    @Test
    void choiceAnswerKeyMustExistInOptions() {
        String csv = "type,stem,options,answer,analysis,difficulty,nodes\n"
                + "SINGLE,题干,A.甲|B.乙,C,,2,代数\n";
        ImportResult r = QuestionImportParser.parse(csv);
        assertFalse(r.ok());
        assertTrue(r.errors().get(0).reason().contains("答案键不在选项中"), r.errors().toString());
    }

    @Test
    void choiceWithoutOptions_rejected() {
        String csv = "type,stem,options,answer,analysis,difficulty,nodes\n"
                + "MULTI,题干,,AB,,2,代数\n";
        ImportResult r = QuestionImportParser.parse(csv);
        assertFalse(r.ok());
        assertTrue(r.errors().stream().anyMatch(e -> e.reason().contains("选择题必须有选项")));
    }

    @Test
    void nodesRequired_forPaperQueries() {
        String csv = "type,stem,options,answer,analysis,difficulty,nodes\n"
                + "FILL,题干,,42,,3,\n";
        ImportResult r = QuestionImportParser.parse(csv);
        assertFalse(r.ok());
        assertTrue(r.errors().get(0).reason().contains("知识点"));
    }

    @Test
    void judgeConfig_rules_toleranceOnlyFill() {
        // 容差仅填空；范围 [0,0.1]；比例计分仅填空
        assertTrue(QuestionImportParser.validateJudgeConfig(QuestionType.FILL,
                new JudgeConfig(true, true, false, 1e-6, true)).isEmpty());
        assertFalse(QuestionImportParser.validateJudgeConfig(QuestionType.SINGLE,
                new JudgeConfig(true, true, false, 1e-6, false)).isEmpty());
        assertFalse(QuestionImportParser.validateJudgeConfig(QuestionType.FILL,
                new JudgeConfig(true, true, false, 0.5, false)).isEmpty(), "超 0.1");
        assertFalse(QuestionImportParser.validateJudgeConfig(QuestionType.FILL,
                new JudgeConfig(true, true, false, -1, false)).isEmpty(), "负容差");
        assertFalse(QuestionImportParser.validateJudgeConfig(QuestionType.MULTI,
                new JudgeConfig(true, true, false, 0, true)).isEmpty(), "比例仅填空");
    }

    @Test
    void lineErrors_doNotKillGoodRows() {
        String csv = "type,stem,options,answer,analysis,difficulty,nodes\n"
                + "SINGLE,好题,A.1|B.2,A,,9,代数\n"       // line2 难度越界 → 错
                + "SINGLE,更好题,A.1|B.2,B,,2,代数\n";     // line3 好
        ImportResult r = QuestionImportParser.parse(csv);
        assertFalse(r.ok());
        assertEquals(1, r.drafts().size());
        assertEquals(2, r.errors().get(0).line());
        assertTrue(r.errors().get(0).reason().contains("1-5"));
    }

    @Test
    void stem_withQuotedComma_and_badType() {
        String csv = "type,stem,options,answer,analysis,difficulty,nodes\n"
                + "SINGLE,\"若 a>b, 则\",A.对|B.错,A,,2,不等式\n"
                + "RIDDLE,未知题型,,, ,2,代数\n";
        ImportResult r = QuestionImportParser.parse(csv);
        assertTrue(r.drafts().stream().anyMatch(d -> d.stem().contains("a>b, 则")));
        assertTrue(r.errors().stream().anyMatch(e -> e.reason().contains("未知题型")));
    }

    @Test
    void optionKeys_and_answerLetters_helpers() {
        Set<String> keys = QuestionImportParser.optionKeys(List.of("A.甲", "B.乙", "C.丙"));
        assertEquals(Set.of("A", "B", "C"), keys);
        assertEquals(List.of("A", "C"), QuestionImportParser.answerLetters("A,C"));
        assertEquals(List.of("A", "B"), QuestionImportParser.answerLetters("a b"));
        assertTrue(QuestionImportParser.answerLetters("").isEmpty());
    }
}
