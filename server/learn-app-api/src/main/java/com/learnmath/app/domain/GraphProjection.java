package com.learnmath.app.domain;

import com.learnmath.app.domain.MasteryCalculator.GraphColor;
import com.learnmath.app.domain.MasteryCalculator.MasteryScore;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 知识图谱投影（16 WD5 · 02 §5.1 · 03 §12 缓存键空间；纯函数）。
 *
 * - 子树 = parent_id 层级展开（与树结构一致），边过滤为子树内边；
 * - 节点着色 = MasteryCalculator.colorOf 的统一优先级（筹备 > 锁定 > 无数据/样本不足 > 分数档）；
 *   **前置锁定**：存在"必需"入边且其前置未掌握（score≥80 且 n≥5，复用 unlockable 口径）——推荐边不锁；
 * - 缓存键带 edgeVersion（边变更即失效，02 §5.1）。
 */
public final class GraphProjection {

    /** 树节点（knowledge_node 投影）。 */
    public record Node(long id, Long parentId, String name) {}

    /** 依赖边（knowledge_edge 投影；required=type1 必需 / type2 推荐）。 */
    public record DepEdge(long from, long to, boolean required) {}

    public record Projection(List<Node> nodes, List<DepEdge> edges,
                             Map<Long, GraphColor> colors) {

        public GraphColor colorOf(long nodeId) {
            return colors.getOrDefault(nodeId, GraphColor.NO_DATA);
        }

        public List<Long> nodeIds() {
            List<Long> ids = new ArrayList<>();
            for (Node n : nodes) {
                ids.add(n.id());
            }
            return ids;
        }
    }

    private GraphProjection() {
    }

    /** parent_id 层级子树（含 root）。 */
    public static Set<Long> subtreeIds(Collection<Node> nodes, long rootId) {
        Map<Long, List<Long>> children = new HashMap<>();
        Set<Long> all = new HashSet<>();
        for (Node n : nodes) {
            all.add(n.id());
            if (n.parentId() != null && n.parentId() > 0) {
                children.computeIfAbsent(n.parentId(), k -> new ArrayList<>()).add(n.id());
            }
        }
        if (!all.contains(rootId)) {
            return Set.of();
        }
        Set<Long> out = new LinkedHashSet<>();
        ArrayDeque<Long> q = new ArrayDeque<>();
        q.add(rootId);
        while (!q.isEmpty()) {
            Long cur = q.poll();
            if (!out.add(cur)) {
                continue;
            }
            for (Long c : children.getOrDefault(cur, List.of())) {
                q.add(c);
            }
        }
        return out;
    }

    /** 全量投影：子树裁剪 + 着色 + 锁定推导。 */
    public static Projection project(Collection<Node> allNodes, Collection<DepEdge> allEdges,
                                     Set<Long> rootScope,      // null=全图
                                     Map<Long, MasteryScore> scores,
                                     Set<Long> contentPreparing) {
        Set<Long> included = new LinkedHashSet<>();
        for (Node n : allNodes) {
            if (rootScope == null || rootScope.contains(n.id())) {
                included.add(n.id());
            }
        }
        List<Node> nodes = new ArrayList<>();
        for (Node n : allNodes) {
            if (included.contains(n.id())) {
                nodes.add(n);
            }
        }
        List<DepEdge> edges = new ArrayList<>();
        Map<Long, List<DepEdge>> incoming = new HashMap<>();
        for (DepEdge e : allEdges) {
            if (included.contains(e.from()) && included.contains(e.to())) {
                edges.add(e);
                incoming.computeIfAbsent(e.to(), k -> new ArrayList<>()).add(e);
            }
        }
        Map<Long, GraphColor> colors = new LinkedHashMap<>();
        for (Node n : nodes) {
            boolean preparing = contentPreparing != null && contentPreparing.contains(n.id());
            boolean locked = isPrerequisiteLocked(n.id(), incoming.getOrDefault(n.id(), List.of()), scores);
            MasteryScore s = scores == null ? null : scores.get(n.id());
            colors.put(n.id(), MasteryCalculator.colorOf(preparing, locked, s));
        }
        return new Projection(List.copyOf(nodes), List.copyOf(edges), Map.copyOf(colors));
    }

    /** 前置锁定：任一**必需**入边的前置未掌握 → 锁（推荐边不锁；20 §1.1 优先级红锁）。 */
    public static boolean isPrerequisiteLocked(long nodeId, List<DepEdge> incomingRequired,
                                               Map<Long, MasteryScore> scores) {
        if (incomingRequired == null || scores == null) {
            return false;
        }
        for (DepEdge e : incomingRequired) {
            if (!e.required()) {
                continue;
            }
            MasteryScore from = scores.get(e.from());
            if (from == null || !MasteryCalculator.unlockable(from)) {
                return true; // 前置未掌握（含未测量/样本不足）
            }
        }
        return false;
    }

    /** 邻接缓存键（边版本变更 → 键变 → 自然失效，02 §5.1/03 §12）。 */
    public static String adjacencyCacheKey(long edgeVersion) {
        return "graph:adj:v" + edgeVersion;
    }

    public static String subtreeCacheKey(long rootId, long edgeVersion) {
        return "graph:subtree:" + rootId + ":v" + edgeVersion;
    }

    /** 用户视图缓存（着色与个人掌握度相关）。 */
    public static String userViewCacheKey(long userId, long edgeVersion) {
        return "graph:user:" + userId + ":v" + edgeVersion;
    }

    /** 邻接导出（力导向/分层视图共用）。 */
    public static Map<Long, List<Long>> adjacencyOf(Collection<DepEdge> edges) {
        Map<Long, List<Long>> adj = new LinkedHashMap<>();
        for (DepEdge e : edges) {
            adj.computeIfAbsent(e.from(), k -> new ArrayList<>()).add(e.to());
        }
        return adj;
    }
}
