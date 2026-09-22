package com.learnmath.app.domain;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 社区内容状态机 + 敏感词 AC 自动机（02 §5.9 · 09 L7 · 16W15；纯函数）。
 *
 * 状态机：submit 时实时检测 —— 命中词库 → HELD（作者见"审核中"，他人不可见，3401）；
 * 未命中 → ACTIVE（先发后审，入抽审队列）；审核 APPROVE/REJECT；举报 → TAKEN_DOWN（待处理）；
 * 处理 不成立→恢复 ACTIVE / 成立→DELETED（深链失效 3402）。全部写操作留审计（服务层）。
 * 词库为分组多模式，**AC 自动机构建后整体热替换**（发布词库 → 新实例原子替换）。
 */
public final class CommunityModeration {

    /** 内容状态。 */
    public enum State { ACTIVE, HELD, REJECTED, TAKEN_DOWN, DELETED }

    /** 审核动作。 */
    public enum Action { APPROVE, REJECT }

    /** 提交回执。 */
    public record SubmitResult(State state, boolean visibleToOthers, boolean intoReviewQueue,
                               int code, List<String> hitGroups, String message) {}

    /** 处理回执。 */
    public record ModerateResult(boolean ok, State newState, String message) {}

    /** 点赞（3403 防重复）。 */
    public static boolean like(SetLikeState state, long userId, long targetId) {
        String key = targetId + ":" + userId;
        if (state.marked(key)) {
            return false; // 3403
        }
        state.add(key);
        return true;
    }

    /** 可变点赞去重集（服务层以 Redis SET 落地；域内以接口表达）。 */
    public interface SetLikeState {
        boolean marked(String key);

        void add(String key);
    }

    /** 简单内存实现（单测/服务层草稿）。 */
    public static final class MemoryLikeState implements SetLikeState {
        private final java.util.HashSet<String> set = new java.util.HashSet<>();

        @Override
        public boolean marked(String key) {
            return set.contains(key);
        }

        @Override
        public void add(String key) {
            set.add(key);
        }
    }

    /** 采纳：一次只允许一个（幂等：重复采纳同 answer 不报错）。 */
    public static boolean adoptOnce(String currentAdoptedAnswerId, String answerId) {
        return answerId != null && (currentAdoptedAnswerId == null
                || currentAdoptedAnswerId.equals(answerId));
    }

    private CommunityModeration() {
    }

    // ---------- 状态机 ----------

    /** 提交（实时检测）。 */
    public static SubmitResult submit(String content, SensitiveWords.AhoCorasick matcher) {
        List<String> hits = matcher == null ? List.of() : matcher.matchGroups(content);
        if (!hits.isEmpty()) {
            return new SubmitResult(State.HELD, false, false, 3401, hits,
                    "内容命中审核词库，暂不可见（3401）；作者可见「审核中」");
        }
        return new SubmitResult(State.ACTIVE, true, true, 0, List.of(),
                "已发布（先发后审，进入抽审队列）");
    }

    /** 审核处理。 */
    public static ModerateResult moderate(State current, Action action, String reason) {
        if (current == State.DELETED) {
            return new ModerateResult(false, current, "内容已删除（3402），不可再操作");
        }
        return switch (action) {
            case APPROVE -> current == State.HELD || current == State.TAKEN_DOWN
                    ? new ModerateResult(true, State.ACTIVE, "已通过并恢复可见")
                    : new ModerateResult(true, current, "已是可见态（幂等通过）");
            case REJECT -> new ModerateResult(true, State.REJECTED,
                    "已驳回并通知作者" + (reason == null ? "" : "：" + reason));
        };
    }

    /** 举报 → 下架待处理（不直接删）。 */
    public static ModerateResult report(State current) {
        if (current == State.ACTIVE) {
            return new ModerateResult(true, State.TAKEN_DOWN, "已下架待处理（举报）");
        }
        if (current == State.DELETED) {
            return new ModerateResult(false, current, "内容已删除（3402）");
        }
        return new ModerateResult(false, current, "当前状态不可举报下架：" + current);
    }

    /** 举报处理结论。 */
    public static ModerateResult handleReport(State takenDown, boolean founded, String reason) {
        if (takenDown != State.TAKEN_DOWN) {
            return new ModerateResult(false, takenDown, "非待处理态");
        }
        return founded
                ? new ModerateResult(true, State.DELETED, "举报成立 → 删除" + (reason == null ? "" : "：" + reason))
                : new ModerateResult(true, State.ACTIVE, "举报不成立 → 恢复可见");
    }

    /** 可见性（他人视角）：HELD/REJECTED/TAKEN_DOWN/DELETED 均不可见。 */
    public static boolean visibleToOthers(State s) {
        return s == State.ACTIVE;
    }

    /** 作者视角：HELD 显示"审核中"；REJECTED 显示驳回理由；DELETED 显示已删除（3402）。 */
    public static String authorView(State s) {
        return switch (s) {
            case ACTIVE -> "已发布";
            case HELD -> "审核中（暂不可见）";
            case REJECTED -> "未通过（含理由）";
            case TAKEN_DOWN -> "已暂时下架（待处理）";
            case DELETED -> "内容已删除（3402）";
        };
    }

    // ================= 敏感词 AC 自动机 =================

    /**
     * 分组敏感词 + Aho-Corasick 多模式匹配；构建后整体热替换。
     */
    public static final class SensitiveWords {

        /** 词 → 分组（营销/色情/政治/自定义，03/02 §6）。 */
        public static final class Dict {
            private final Map<String, String> word2Group = new LinkedHashMap<>();

            public Dict add(String group, String word) {
                if (word != null && !word.isBlank()) {
                    word2Group.put(word.trim(), group);
                }
                return this;
            }

            public Map<String, String> words() {
                return Map.copyOf(word2Group);
            }
        }

        static final class Node {
            final Map<Character, Node> next = new HashMap<>();
            Node fail;
            String word;      // 模式终点
            String group;
        }

        /** 构建好的自动机（不可变使用；热替换=换实例引用）。 */
        public static final class AhoCorasick {
            private final Node root;
            private final int size;

            private AhoCorasick(Node root, int size) {
                this.root = root;
                this.size = size;
            }

            public int patternCount() {
                return size;
            }

            /** 返回命中的原词（有序去重，沿 fail 链收集输出）。 */
            public List<String> matchWords(String text) {
                List<String> out = new ArrayList<>();
                if (text == null || text.isEmpty()) {
                    return out;
                }
                Node cur = root;
                java.util.LinkedHashSet<String> seen = new java.util.LinkedHashSet<>();
                for (int i = 0; i < text.length(); i++) {
                    cur = walk(cur, text.charAt(i));
                    Node n = cur;
                    while (n != null) {
                        if (n.word != null) {
                            seen.add(n.word);
                        }
                        if (n == root || n.fail == n) {
                            break;
                        }
                        n = n.fail;
                    }
                }
                out.addAll(seen);
                return out;
            }

            private Node walk(Node from, char c) {
                Node n = from;
                while (n != null && !n.next.containsKey(c)) {
                    if (n == root) {
                        return root;
                    }
                    n = n.fail;
                }
                return n == null ? root : n.next.getOrDefault(c, root);
            }

            /** 命中分组（去重，词→组）。 */
            public List<String> matchGroups(String text) {
                java.util.LinkedHashSet<String> groups = new java.util.LinkedHashSet<>();
                for (String w : matchWords(text)) {
                    Node found = find(root, w);
                    if (found != null && found.group != null) {
                        groups.add(found.group);
                    }
                }
                return new ArrayList<>(groups);
            }

            private Node find(Node from, String word) {
                Node n = from;
                for (char c : word.toCharArray()) {
                    n = n == null ? null : n.next.get(c);
                    if (n == null) {
                        return null;
                    }
                }
                return n != null && n.word != null ? n : null;
            }
        }

        private SensitiveWords() {
        }

        /** 构建（插入→BFS 建 fail→输出链接合入 fail 链收集）。 */
        public static AhoCorasick build(Dict dict) {
            Node root = new Node();
            root.fail = root;
            int count = 0;
            Map<String, String> words = dict == null ? Map.of() : dict.words();
            for (Map.Entry<String, String> e : words.entrySet()) {
                Node cur = root;
                for (char c : e.getKey().toCharArray()) {
                    cur = cur.next.computeIfAbsent(c, k -> new Node());
                }
                if (cur.word == null) {
                    count++;
                }
                cur.word = e.getKey();
                cur.group = e.getValue();
            }
            // BFS fail
            ArrayDeque<Node> q = new ArrayDeque<>();
            for (Node child : root.next.values()) {
                child.fail = root;
                q.add(child);
            }
            while (!q.isEmpty()) {
                Node u = q.poll();
                for (Map.Entry<Character, Node> en : u.next.entrySet()) {
                    Node v = en.getValue();
                    Node f = u.fail;
                    while (f != root && !f.next.containsKey(en.getKey())) {
                        f = f.fail;
                    }
                    v.fail = f.next.containsKey(en.getKey()) && f.next.get(en.getKey()) != v
                            ? f.next.get(en.getKey()) : root;
                    if (v.fail.word != null && v.word == null) {
                        v.word = v.fail.word; // 输出合并（沿 fail 命中长词的后缀词）
                        v.group = v.fail.group;
                    }
                    q.add(v);
                }
            }
            return new AhoCorasick(root, count);
        }
    }
}
