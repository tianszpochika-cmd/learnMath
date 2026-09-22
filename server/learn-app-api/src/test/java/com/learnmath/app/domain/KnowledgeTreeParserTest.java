package com.learnmath.app.domain;

import com.learnmath.app.domain.KnowledgeTreeParser.ImportError;
import com.learnmath.app.domain.KnowledgeTreeParser.ImportResult;
import com.learnmath.app.domain.KnowledgeTreeParser.NodeDraft;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 知识点 CSV 导入（04 admin /knowledge/import · 逐行报错）。 */
class KnowledgeTreeParserTest {

    @Test
    void happyTree_buildsParentPaths() {
        String csv = "path,name,difficulty,description\n"
                + "代数,方程,3,一次到三次\n"
                + "代数/方程,一元一次,2,\n"
                + ",根节点,3,顶层\n";
        ImportResult r = KnowledgeTreeParser.parse(csv);
        assertTrue(r.ok(), r.errors().toString());
        assertEquals(3, r.nodes().size());
        NodeDraft n = r.nodes().get(1);
        assertEquals(2, n.parentPath().size(), "path=代数/方程 → 两段父路径");
        assertEquals("代数", n.parentPath().get(0));
        assertEquals("方程", n.parentPath().get(1));
        assertEquals("一元一次", n.name());
        assertEquals(2, n.difficulty());
        assertTrue(r.nodes().get(2).parentPath().isEmpty(), "空 path = 根");
    }

    @Test
    void quotedComma_insideField() {
        String csv = "path,name,difficulty,description\n"
                + "几何,\"勾股,专题\",3,\"含逗号,描述\"\n";
        ImportResult r = KnowledgeTreeParser.parse(csv);
        assertTrue(r.ok());
        assertEquals("勾股,专题", r.nodes().get(0).name());
        assertEquals("含逗号,描述", r.nodes().get(0).description());
    }

    @Test
    void quotedEscapedDoubleQuote() {
        // RFC4180：字段整体加引号时 "" 才转义出一个 "
        String csv = "path,name,description\n" + ",\"说\"\"明\",\"描述\"\"串\"\n";
        ImportResult r = KnowledgeTreeParser.parse(csv);
        assertTrue(r.ok());
        assertEquals("说\"明", r.nodes().get(0).name());
        assertEquals("描述\"串", r.nodes().get(0).description());
    }

    @Test
    void duplicateFullPath_reportedWithLine() {
        String csv = "path,name,difficulty\n"
                + "代数,方程,3\n"
                + "代数,方程,4\n";
        ImportResult r = KnowledgeTreeParser.parse(csv);
        assertFalse(r.ok());
        ImportError e = r.errors().get(0);
        assertEquals(3, e.line());
        assertTrue(e.reason().contains("重复路径"), e.reason());
        assertEquals(1, r.nodes().size(), "坏行不影响好行入库");
    }

    @Test
    void invalidDifficulty_and_emptyName_lineErrors() {
        String csv = "path,name,difficulty\n"
                + "代数,,3\n"          // line2 空名
                + "代数,不等式,9\n"      // line3 难度越界
                + "代数,函数,abc\n";     // line4 非整数
        ImportResult r = KnowledgeTreeParser.parse(csv);
        assertFalse(r.ok());
        assertEquals(3, r.errors().size());
        assertEquals(2, r.errors().get(0).line());
        assertTrue(r.errors().get(1).reason().contains("1-5"));
    }

    @Test
    void badHeader_failsFast() {
        ImportResult r = KnowledgeTreeParser.parse("foo,bar\n1,2\n");
        assertFalse(r.ok());
        assertTrue(r.errors().get(0).reason().contains("表头"));
    }

    @Test
    void emptySegment_reported() {
        String csv = "path,name\n代数//方程,多项式\n";
        ImportResult r = KnowledgeTreeParser.parse(csv);
        assertFalse(r.ok());
        assertTrue(r.errors().get(0).reason().contains("空段"));
    }
}
