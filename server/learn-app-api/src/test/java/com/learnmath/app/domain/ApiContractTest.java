package com.learnmath.app.domain;

import com.learnmath.app.domain.ApiContract.ApiDef;
import com.learnmath.app.domain.ApiContract.Auth;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** OpenAPI 契约 —— T3.11（结构校验 + JSON 生成）。 */
class ApiContractTest {

    private static List<ApiDef> sample() {
        return List.of(
                new ApiDef("auth", "POST", "/api/app/v1/auth/login", Auth.APP, "短信登录", List.of(1004, 2006)),
                new ApiDef("auth", "POST", "/api/app/v1/auth/login", Auth.APP, "重复定义（故意）", List.of()),
                new ApiDef("public", "GET", "/api/app/v1/legal", Auth.NONE, "◎ 协议公开", List.of()),
                new ApiDef("attempt", "POST", "/api/app/v1/attempts/{id}/submit", Auth.APP, "交卷", List.of(3007)),
                new ApiDef("content", "GET", "/api/admin/v1/questions", Auth.ADMIN, "题库列表", List.of(2004)));
    }

    @Test
    void validate_duplicatePathMethod_and_authPrefixMismatch() {
        var result = ApiContract.validate(sample());
        assertFalse(result.ok());
        assertTrue(result.issues().stream().anyMatch(i -> i.kind().equals("duplicate")),
                "重复 POST login 必须报");
        // 其余校验项（前缀一致性）应通过：APP 挂 /api/app、ADMIN 挂 /api/admin、◎ 标注
        assertFalse(result.issues().stream().anyMatch(i -> i.kind().equals("auth")),
                "前缀与 auth 全部一致: " + result.issues());
        assertFalse(result.issues().stream().anyMatch(i -> i.kind().equals("path")));
        assertFalse(result.issues().stream().anyMatch(i -> i.kind().equals("errorCode")),
                "错误码 1004/2006/3007/2004 均在 ErrorCode");
    }

    @Test
    void validate_authPrefixViolations_flagged() {
        List<ApiDef> bad = List.of(
                new ApiDef("x", "GET", "/api/admin/v1/thing", Auth.APP, "APP 挂错前缀", List.of()),
                new ApiDef("x", "GET", "/api/app/v1/thing2", Auth.ADMIN, "ADMIN 挂错前缀", List.of()),
                new ApiDef("x", "GET", "/api/app/v1/open", Auth.NONE, "公开但未标注", List.of()));
        var result = ApiContract.validate(bad);
        assertEquals(3, result.issues().stream().filter(i -> i.kind().equals("auth")).count());
    }

    @Test
    void validate_unknownErrorCode_requiresRegisteredFirst() {
        List<ApiDef> bad = List.of(new ApiDef("x", "GET", "/api/app/v1/x", Auth.APP, "◎ x", List.of(9999)));
        var result = ApiContract.validate(bad);
        assertTrue(result.issues().stream().anyMatch(i ->
                i.kind().equals("errorCode") && i.detail().contains("9999")));
    }

    @Test
    void validate_nonApiPath_and_emptyRegistry() {
        assertTrue(ApiContract.validate(List.of()).issues().stream().anyMatch(i -> i.kind().equals("empty")));
        var badPath = ApiContract.validate(List.of(
                new ApiDef("x", "GET", "/legacy/x", Auth.NONE, "◎ x", List.of())));
        assertTrue(badPath.issues().stream().anyMatch(i -> i.kind().equals("path")));
    }

    @Test
    void toJson_minimalOpenApiStructure() {
        List<ApiDef> defs = List.of(
                new ApiDef("auth", "POST", "/api/app/v1/auth/login", Auth.APP, "登录", List.of(2006)));
        String json = ApiContract.toJson(defs, "learnMath", "0.1.0");
        assertTrue(json.contains("\"openapi\": \"3.1.0\""));
        assertTrue(json.contains("\"title\": \"learnMath\""));
        assertTrue(json.contains("\"version\": \"0.1.0\""));
        assertTrue(json.contains("\"/api/app/v1/auth/login\""));
        assertTrue(json.contains("\"post\""));
        assertTrue(json.contains("\"x-auth\": \"APP\""));
        assertTrue(json.contains("\"x-error-codes\": [2006]"));
        assertTrue(json.contains("securitySchemes"));
        assertTrue(json.contains("appJwt"));
        // 转义不破 JSON：summary 带引号
        String tricky = ApiContract.toJson(List.of(
                new ApiDef("x", "GET", "/api/app/v1/y", Auth.NONE, "◎ 含\"引号\"与\\反斜杠", List.of())),
                "t", "1");
        assertTrue(tricky.contains("含\\\"引号\\\"与\\\\反斜杠"), tricky);
    }

    @Test
    void moduleCounts_coverageDashboard() {
        Map<String, Integer> counts = ApiContract.moduleCounts(sample());
        assertEquals(2, counts.get("auth"));
        assertEquals(1, counts.get("attempt"));
        assertEquals(1, counts.get("content"));
        assertEquals(5, counts.values().stream().mapToInt(Integer::intValue).sum());
        // 排序稳定：同输入同输出
        String a = ApiContract.toJson(sample(), "t", "1");
        String b = ApiContract.toJson(sample().reversed(), "t", "1");
        assertEquals(a, b, "生成与输入顺序无关（按 key 排序）");
    }

    @Test
    void knownCodes_alignWithErrorCodeEnum() {
        assertTrue(ApiContract.knownErrorCodes().contains(3011));
        assertTrue(ApiContract.knownErrorCodes().contains(3310));
        assertTrue(ApiContract.knownErrorCodes().contains(3100));
        assertFalse(ApiContract.knownErrorCodes().contains(0));
        assertTrue(ApiContract.knownErrorCodes().size() >= 20);
    }
}
