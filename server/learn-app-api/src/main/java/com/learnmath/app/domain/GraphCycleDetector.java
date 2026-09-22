package com.learnmath.app.domain;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 知识图谱依赖边校验（02 §5.1 无环校验 → 3310 成环回显；纯函数）。
 *
 * 规则：
 *  - 自环 from==to → 成环 [x, x]；
 *  - 新增 from→to 成环 ⇔ 现有图中 to 可达 from；
 *  - 重复边 → DUPLICATE（不入库，不报 3310）；
 *  - 环路径回显按访问顺序 [a, b, c, a]（02 §5.1 "加边校验…命中即成环 → 拒绝 3310 + 高亮路径"）。
 */
public final class GraphCycleDetector {

    public enum Reason { OK, DUPLICATE, CYCLE }

    /** 校验结果：ok / 原因 / 环路径（CYCLE 时非空，首尾同点） / 人类可读消息。 */
    public record ValidationResult(boolean ok, Reason reason, List<Long> cyclePath, String message) {

        /** 静态工厂（命名为 passed 以避开 record 访问器 ok() 同名冲突）。 */
        public static ValidationResult passed() {
            return new ValidationResult(true, Reason.OK, List.of(), null);
        }
    }

    /** 有向边（from 是 to 的前置）。 */
    public record Edge(long from, long to) {}

    private GraphCycleDetector() {
    }

    /** 邻接表（from → to 们）。 */
    public static Map<Long, List<Long>> adjacency(Collection<Edge> edges) {
        Map<Long, List<Long>> adj = new HashMap<>();
        if (edges != null) {
            for (Edge e : edges) {
                adj.computeIfAbsent(e.from(), k -> new ArrayList<>()).add(e.to());
            }
        }
        return adj;
    }

    /** 在现有图上新增 from→to 前的校验。 */
    public static ValidationResult validateAdd(Collection<Edge> existing, long from, long to) {
        if (from == to) {
            return new ValidationResult(false, Reason.CYCLE, List.of(from, from),
                    "自环依赖: node=" + from);
        }
        if (existing != null) {
            for (Edge e : existing) {
                if (e.from() == from && e.to() == to) {
                    return new ValidationResult(false, Reason.DUPLICATE, List.of(),
                            "依赖已存在: " + from + " → " + to);
                }
            }
        }
        Map<Long, List<Long>> adj = adjacency(existing);
        // 新增 from→to 成环 ⇔ 现有图中 to 可达 from；回显按 [to,…,from,to] 闭合顺序（02 §5.1 高亮路径）
        Optional<List<Long>> path = reachablePath(adj, to, from);
        if (path.isPresent()) {
            List<Long> cycle = new ArrayList<>(path.get()); // to … from
            cycle.add(to);                                   // 闭合
            return new ValidationResult(false, Reason.CYCLE, List.copyOf(cycle),
                    "图谱成环: " + join(cycle) + "（3310）");
        }
        return ValidationResult.passed();
    }

    /** 全图既有环检测（体检报告用）。返回第一个环（DFS 灰白黑三色）。 */
    public static Optional<List<Long>> findExistingCycle(Collection<Edge> edges) {
        Map<Long, List<Long>> adj = adjacency(edges);
        // 按边出现顺序确定遍历起点（保证回显稳定：1→2→3→1 从 1 起）
        java.util.LinkedHashSet<Long> nodes = new java.util.LinkedHashSet<>();
        if (edges != null) {
            for (Edge e : edges) {
                nodes.add(e.from());
                nodes.add(e.to());
            }
        }
        Set<Long> visiting = new LinkedHashSet<>();
        Set<Long> done = new HashSet<>();
        for (Long node : nodes) {
            Optional<List<Long>> c = dfs(node, adj, visiting, done);
            if (c.isPresent()) {
                return c;
            }
        }
        return Optional.empty();
    }

    /** from → to 是否可达；返回具体路径（含首尾 to…from 段）。 */
    static Optional<List<Long>> reachablePath(Map<Long, List<Long>> adj, long from, long to) {
        // BFS 保最短路径（回显更可读）
        ArrayDeque<List<Long>> queue = new ArrayDeque<>();
        Set<Long> seen = new HashSet<>();
        queue.add(List.of(from));
        seen.add(from);
        while (!queue.isEmpty()) {
            List<Long> path = queue.poll();
            long last = path.get(path.size() - 1);
            if (last == to) {
                return Optional.of(path);
            }
            for (Long next : adj.getOrDefault(last, List.of())) {
                if (seen.add(next)) {
                    List<Long> np = new ArrayList<>(path);
                    np.add(next);
                    queue.add(np);
                }
            }
        }
        return Optional.empty();
    }

    private static Optional<List<Long>> dfs(Long node, Map<Long, List<Long>> adj,
                                            Set<Long> visiting, Set<Long> done) {
        if (done.contains(node)) {
            return Optional.empty();
        }
        if (visiting.contains(node)) {
            // 收集环：从 visiting 中 node 之后到末尾
            List<Long> cycle = new ArrayList<>();
            boolean start = false;
            for (Long n : visiting) {
                if (n.equals(node)) {
                    start = true;
                }
                if (start) {
                    cycle.add(n);
                }
            }
            cycle.add(node);
            return Optional.of(cycle);
        }
        visiting.add(node);
        for (Long next : adj.getOrDefault(node, List.of())) {
            Optional<List<Long>> c = dfs(next, adj, visiting, done);
            if (c.isPresent()) {
                return c;
            }
        }
        visiting.remove(node);
        done.add(node);
        return Optional.empty();
    }

    private static String join(List<Long> path) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < path.size(); i++) {
            if (i > 0) {
                sb.append(" → ");
            }
            sb.append(path.get(i));
        }
        return sb.toString();
    }
}
