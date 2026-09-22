package com.learnmath.app.domain;

import com.learnmath.app.common.ErrorCode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * OpenAPI 契约生成与校验（T3.11 · 04 号为权威；纯函数）。
 *
 * 设计：接口以**声明式 ApiDef 注册表**描述（module/method/path/auth/summary/错误码），
 * 由本域生成 OpenAPI 3.1 结构 JSON（string 构建，不引第三方 JSON 库 —— 与 TokenCodec 同策略），
 * 并做结构校验：路径+方法唯一、前缀与 auth 一致、引用错误码必须存在于 ErrorCode。
 * 运行期由 springdoc/控制器层把真实路由与本注册表对账（服务层职责，W6/B30 接线）。
 */
public final class ApiContract {

    /** 鉴权级别：NONE=◎免登录；APP=学员域 JWT；ADMIN=管理域 JWT。 */
    public enum Auth { NONE, APP, ADMIN }

    /** 一条接口声明。 */
    public record ApiDef(String module, String method, String path, Auth auth,
                         String summary, List<Integer> errorCodes) {

        public String key() {
            return method.toUpperCase(java.util.Locale.ROOT) + " " + path;
        }
    }

    public record Issue(String kind, String detail) {}

    public record ValidationResult(List<Issue> issues) {

        public boolean ok() {
            return issues.isEmpty();
        }
    }

    private ApiContract() {
    }

    // ---------- 校验 ----------

    public static ValidationResult validate(List<ApiDef> defs) {
        List<Issue> issues = new ArrayList<>();
        if (defs == null || defs.isEmpty()) {
            issues.add(new Issue("empty", "注册表为空"));
            return new ValidationResult(issues);
        }
        Set<String> keys = new LinkedHashSet<>();
        for (ApiDef d : defs) {
            if (d.path() == null || !d.path().startsWith("/api/")) {
                issues.add(new Issue("path", "路径必须以 /api/ 开头: " + d.path()));
                continue;
            }
            if (!keys.add(d.key())) {
                issues.add(new Issue("duplicate", "重复定义: " + d.key()));
            }
            // 前缀 ↔ auth 一致性（04 §1：/api/app→APP、/api/admin→ADMIN；◎ 显式标注可为任一前缀的公开口）
            if (d.auth() == Auth.APP && !d.path().startsWith("/api/app/")) {
                issues.add(new Issue("auth", "APP 鉴权必须挂 /api/app 前缀: " + d.path()));
            }
            if (d.auth() == Auth.ADMIN && !d.path().startsWith("/api/admin/")) {
                issues.add(new Issue("auth", "ADMIN 鉴权必须挂 /api/admin 前缀: " + d.path()));
            }
            if (d.auth() == Auth.NONE && (d.path().startsWith("/api/app/") || d.path().startsWith("/api/admin/"))
                    && !d.summary().contains("◎")) {
                issues.add(new Issue("auth", "公开口需在 summary 标注 ◎: " + d.path()));
            }
            if (d.errorCodes() != null) {
                for (Integer code : d.errorCodes()) {
                    if (!knownErrorCodes().contains(code)) {
                        issues.add(new Issue("errorCode", "未登记错误码 " + code + " @ " + d.key()
                                + "（须先入 ErrorCode/04 §3）"));
                    }
                }
            }
        }
        return new ValidationResult(issues);
    }

    /** 已知错误码（与 ErrorCode 枚举对齐 —— 单一事实源为 04 §3，此处以枚举自检）。 */
    public static Set<Integer> knownErrorCodes() {
        Set<Integer> set = new LinkedHashSet<>();
        for (ErrorCode ec : ErrorCode.values()) {
            set.add(ec.code());
        }
        return set;
    }

    // ---------- 生成 ----------

    /** 生成 OpenAPI 3.1 结构 JSON（最小可用：openapi/info/paths/components.securitySchemes）。 */
    public static String toJson(List<ApiDef> defs, String title, String version) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"openapi\": \"3.1.0\",\n");
        sb.append("  \"info\": {\"title\": \"").append(escape(title)).append("\", \"version\": \"")
          .append(escape(version)).append("\"},\n");
        sb.append("  \"paths\": {\n");
        List<ApiDef> sorted = new ArrayList<>(defs == null ? List.of() : defs);
        // 同 key（重复定义）时以 summary/module 二级排序，保证**输入顺序无关**的确定性输出
        sorted.sort(java.util.Comparator.comparing(ApiDef::key)
                .thenComparing(ApiDef::summary, java.util.Comparator.nullsFirst(String::compareTo))
                .thenComparing(ApiDef::module, java.util.Comparator.nullsFirst(String::compareTo)));
        Map<String, List<ApiDef>> byPath = new LinkedHashMap<>();
        for (ApiDef d : sorted) {
            byPath.computeIfAbsent(d.path(), k -> new ArrayList<>()).add(d);
        }
        int pi = 0;
        for (Map.Entry<String, List<ApiDef>> en : byPath.entrySet()) {
            sb.append("    \"").append(escape(en.getKey())).append("\": {");
            int mi = 0;
            for (ApiDef d : en.getValue()) {
                if (mi++ > 0) {
                    sb.append(",");
                }
                sb.append("\n      \"").append(d.method().toLowerCase(java.util.Locale.ROOT))
                  .append("\": {\"summary\": \"").append(escape(d.summary()))
                  .append("\", \"x-auth\": \"").append(d.auth().name())
                  .append("\", \"x-module\": \"").append(escape(d.module())).append("\"");
                if (d.errorCodes() != null && !d.errorCodes().isEmpty()) {
                    sb.append(", \"x-error-codes\": [");
                    for (int i = 0; i < d.errorCodes().size(); i++) {
                        if (i > 0) {
                            sb.append(",");
                        }
                        sb.append(d.errorCodes().get(i));
                    }
                    sb.append("]");
                }
                sb.append("}");
            }
            sb.append("\n    }");
            if (++pi < byPath.size()) {
                sb.append(",");
            }
            sb.append("\n");
        }
        sb.append("  },\n");
        sb.append("  \"components\": {\"securitySchemes\": {")
          .append("\"appJwt\": {\"type\": \"http\", \"scheme\": \"bearer\"}, ")
          .append("\"adminJwt\": {\"type\": \"http\", \"scheme\": \"bearer\"}}}\n");
        sb.append("}");
        return sb.toString();
    }

    /** 模块分组统计（覆盖率看板：04 ≈125+86 逐模块核对）。 */
    public static Map<String, Integer> moduleCounts(List<ApiDef> defs) {
        Map<String, Integer> out = new LinkedHashMap<>();
        if (defs != null) {
            for (ApiDef d : defs) {
                out.merge(d.module(), 1, Integer::sum);
            }
        }
        return out;
    }

    static String escape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "");
    }
}
