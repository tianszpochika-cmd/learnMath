package com.learnmath.app.domain;

import com.learnmath.app.domain.GraphCycleDetector.Edge;
import com.learnmath.app.domain.GraphCycleDetector.Reason;
import com.learnmath.app.domain.GraphCycleDetector.ValidationResult;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 无环校验 —— 02 §5.1（成环 3310 + 环路径回显、自环、重复边、体检）。
 */
class GraphCycleDetectorTest {

    private static Edge e(long f, long t) {
        return new Edge(f, t);
    }

    @Test
    void acyclic_add_isOk() {
        // 0→2, 2→4 已有；新增 4→6 不成环
        List<Edge> edges = List.of(e(0, 2), e(2, 4));
        ValidationResult r = GraphCycleDetector.validateAdd(edges, 4, 6);
        assertTrue(r.ok());
        assertEquals(Reason.OK, r.reason());
    }

    @Test
    void backEdge_createsCycle_echoPath() {
        // 0→2, 2→4 已有；新增 4→0 → 环 [0,2,4,0]
        List<Edge> edges = List.of(e(0, 2), e(2, 4));
        ValidationResult r = GraphCycleDetector.validateAdd(edges, 4, 0);
        assertFalse(r.ok());
        assertEquals(Reason.CYCLE, r.reason());
        assertEquals(List.of(0L, 2L, 4L, 0L), r.cyclePath());
        assertTrue(r.message().contains("3310"), r.message());
    }

    @Test
    void selfLoop_rejected() {
        ValidationResult r = GraphCycleDetector.validateAdd(List.of(), 7, 7);
        assertEquals(Reason.CYCLE, r.reason());
        assertEquals(List.of(7L, 7L), r.cyclePath());
    }

    @Test
    void duplicateEdge_rejectedWithoutCycleCode() {
        List<Edge> edges = List.of(e(1, 3));
        ValidationResult r = GraphCycleDetector.validateAdd(edges, 1, 3);
        assertFalse(r.ok());
        assertEquals(Reason.DUPLICATE, r.reason());
    }

    @Test
    void longerCycle_diamondSafe() {
        // 菱形 0→1,0→2,1→3,2→3 是 DAG；新增 3→0 成环 [0,1,3,0]（最短回路）
        List<Edge> edges = List.of(e(0, 1), e(0, 2), e(1, 3), e(2, 3));
        ValidationResult r = GraphCycleDetector.validateAdd(edges, 3, 0);
        assertEquals(Reason.CYCLE, r.reason());
        List<Long> p = r.cyclePath();
        assertEquals(0L, p.get(0));
        assertEquals(0L, p.get(p.size() - 1));
        assertTrue(p.contains(1L) || p.contains(2L));
        // 菱形本身可入（不误报）
        assertTrue(GraphCycleDetector.validateAdd(List.of(e(0, 1), e(0, 2), e(1, 3)), 2, 3).ok());
    }

    @Test
    void existingGraph_healthCheckFindsCycle() {
        assertTrue(GraphCycleDetector.findExistingCycle(List.of(e(1, 2), e(2, 3))).isEmpty(), "DAG 无环");
        Optional<List<Long>> c = GraphCycleDetector.findExistingCycle(List.of(e(1, 2), e(2, 3), e(3, 1)));
        assertTrue(c.isPresent());
        assertEquals(1L, c.get().get(0));
        assertEquals(c.get().get(0), c.get().get(c.get().size() - 1));
    }
}
