package com.learnmath.app.domain;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 知识点 CSV 导入解析（04 admin /knowledge/import · 17 A03「导入逐行报错可见」；纯函数）。
 *
 * CSV 约定（表头固定含 path,name，difficulty/description 可选）：
 *   path            层级路径，"/" 分隔，如 代数/方程；空 = 建根
 *   name            节点名（必填）
 *   difficulty      1-5 基线（可选，默认 3；非法 → 该行报错）
 *   description     描述（可选）
 * 支持 RFC4180 子集：双引号包裹、"" 转义。
 * 逐行校验：**错误收集不抛出**，行号可见；同级重名 → 报错（03 uk 口径）。
 */
public final class KnowledgeTreeParser {

    /** 一行 → 一棵节点草稿（parentPath = 上级路径段）。 */
    public record NodeDraft(List<String> parentPath, String name, int difficulty,
                            String description, int line) {}

    public record ImportError(int line, String reason) {}

    public record ImportResult(List<NodeDraft> nodes, List<ImportError> errors) {
        public boolean ok() {
            return errors.isEmpty();
        }
    }

    private KnowledgeTreeParser() {
    }

    public static ImportResult parse(String csv) {
        List<NodeDraft> nodes = new ArrayList<>();
        List<ImportError> errors = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            errors.add(new ImportError(1, "内容为空"));
            return new ImportResult(List.of(), errors);
        }
        String[] rawLines = csv.split("\r?\n", -1);
        int idxPath = -1;
        int idxName = -1;
        int idxDiff = -1;
        int idxDesc = -1;
        boolean headerDone = false;
        Set<String> seenFullPath = new HashSet<>();

        for (int i = 0; i < rawLines.length; i++) {
            String line = rawLines[i];
            int lineNo = i + 1;
            if (line.isBlank()) {
                continue;
            }
            List<String> cols = splitCsvLine(line);
            if (!headerDone) {
                for (int c = 0; c < cols.size(); c++) {
                    String h = cols.get(c).trim().toLowerCase();
                    if (h.equals("path")) idxPath = c;
                    if (h.equals("name")) idxName = c;
                    if (h.equals("difficulty")) idxDiff = c;
                    if (h.equals("description")) idxDesc = c;
                }
                if (idxPath == -1 || idxName == -1) {
                    errors.add(new ImportError(lineNo, "表头必须包含 path,name 两列"));
                    return new ImportResult(List.of(), errors);
                }
                headerDone = true;
                continue;
            }

            String pathRaw = get(cols, idxPath).trim();
            String name = get(cols, idxName).trim();
            if (name.isEmpty()) {
                errors.add(new ImportError(lineNo, "name 为空"));
                continue;
            }
            // 路径段
            List<String> segments = new ArrayList<>();
            boolean pathOk = true;
            if (!pathRaw.isEmpty()) {
                for (String seg : pathRaw.split("/")) {
                    String s = seg.trim();
                    if (s.isEmpty()) {
                        errors.add(new ImportError(lineNo, "path 存在空段: \"" + pathRaw + "\""));
                        pathOk = false;
                        break;
                    }
                    if (s.length() > 64) {
                        errors.add(new ImportError(lineNo, "path 段超长(>64): " + s));
                        pathOk = false;
                        break;
                    }
                    segments.add(s);
                }
            }
            if (!pathOk) {
                continue;
            }
            // 难度
            int difficulty = 3;
            if (idxDiff != -1) {
                String d = get(cols, idxDiff).trim();
                if (!d.isEmpty()) {
                    try {
                        difficulty = Integer.parseInt(d);
                    } catch (NumberFormatException e) {
                        errors.add(new ImportError(lineNo, "difficulty 非整数: " + d));
                        continue;
                    }
                    if (difficulty < 1 || difficulty > 5) {
                        errors.add(new ImportError(lineNo, "difficulty 超出 1-5: " + difficulty));
                        continue;
                    }
                }
            }
            // 同级完整路径唯一（含最终 name）
            String full = join(segments, "/") + "/" + name;
            if (!seenFullPath.add(full)) {
                errors.add(new ImportError(lineNo, "重复路径: " + full));
                continue;
            }
            String desc = idxDesc != -1 ? get(cols, idxDesc).trim() : "";
            nodes.add(new NodeDraft(List.copyOf(segments), name, difficulty, desc, lineNo));
        }
        if (headerDone && nodes.isEmpty() && errors.isEmpty()) {
            errors.add(new ImportError(1, "无数据行"));
        }
        return new ImportResult(List.copyOf(nodes), List.copyOf(errors));
    }

    /** RFC4180 子集：支持引号包裹与 "" 转义。 */
    static List<String> splitCsvLine(String line) {
        List<String> out = new StringBuilderList();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out;
    }

    private static String get(List<String> cols, int idx) {
        return idx >= 0 && idx < cols.size() ? cols.get(idx) : "";
    }

    private static String join(List<String> parts, String sep) {
        return String.join(sep, parts);
    }

    /** 仅复用 List 能力的别名（避免额外类型名）。 */
    private static final class StringBuilderList extends java.util.ArrayList<String> {
        private static final long serialVersionUID = 1L;
    }
}
