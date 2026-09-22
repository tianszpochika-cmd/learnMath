package com.learnmath.app.auth;

import com.learnmath.app.common.BizException;
import com.learnmath.app.common.ErrorCode;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 双域 JWT 编解码（02 §4.3 · **纯 JDK 实现**——不依赖 Jackson：
 * Boot 4 线 Jackson 3 包名迁移 tools.jackson，domain 层避免直接绑 JSON 库；
 * payload 字段全部自产自销，手写构建 + 正则提取即可，可离线单测）。
 *
 * 约定（04 §2）：
 *  - HS256；学员域（app）与管理域（admin）**独立密钥，绝不共用**；
 *  - Access TTL 2h；Refresh 白名单 jti 存 Redis（服务层职责，不在本类）；
 *  - 互用：app token 打 admin 接口 → 2004；过期 → 2003；篡改/格式错 → 2001。
 */
public final class TokenCodec {

    public static final String DOMAIN_APP = "app";
    public static final String DOMAIN_ADMIN = "admin";

    private static final String HEADER_B64 = b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
    private static final Pattern P_SUB = Pattern.compile("\"sub\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern P_DOM = Pattern.compile("\"dom\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern P_JTI = Pattern.compile("\"jti\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern P_EXP = Pattern.compile("\"exp\"\\s*:\\s*(\\d+)");

    /** 解析后的声明。 */
    public record Claims(String subject, String domain, String jti, Instant expiresAt) {}

    private final String secret;
    private final String domain;

    public TokenCodec(String secret, String domain) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalArgumentException("JWT secret must be >= 16 chars");
        }
        this.secret = secret;
        this.domain = domain;
    }

    /** 签发（默认 2 小时）。 */
    public String issue(String subject) {
        return issue(subject, Duration.ofHours(2), newJti());
    }

    public String issue(String subject, Duration ttl, String jti) {
        long exp = Instant.now().plus(ttl).getEpochSecond();
        long iat = Instant.now().getEpochSecond();
        String payload = "{\"sub\":\"" + escape(subject) + "\""
                + ",\"dom\":\"" + escape(domain) + "\""
                + ",\"jti\":\"" + escape(jti) + "\""
                + ",\"exp\":" + exp
                + ",\"iat\":" + iat + "}";
        String body = b64(payload.getBytes(StandardCharsets.UTF_8));
        String signing = HEADER_B64 + "." + body;
        return signing + "." + b64(hmac(signing));
    }

    /**
     * 校验并解析。
     * 顺序（04 §3/02 §4.3 语义）：① 结构 → ② 提取域声明做**分类**（仅用于错误归类，未验签不信任其内容）
     * → ③ 域不匹配=2004（app/admin 互用；两域密钥独立，跨域必然签名不符，但先分类给出正确语义码）
     * → ④ 验签 2001 → ⑤ 过期 2003。
     * @param expectedDomain 期望域
     * @throws BizException 2001 签名无效/格式错 · 2003 过期 · 2004 域不匹配
     */
    public Claims parse(String token, String expectedDomain) {
        if (token == null || token.isBlank()) {
            throw new BizException(ErrorCode.NOT_LOGIN);
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3 || !parts[0].equals(HEADER_B64)) {
            throw new BizException(ErrorCode.NOT_LOGIN, "malformed token");
        }
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new BizException(ErrorCode.NOT_LOGIN, "bad payload encoding");
        }
        Matcher expM = P_EXP.matcher(payload);
        Matcher subM = P_SUB.matcher(payload);
        Matcher domM = P_DOM.matcher(payload);
        Matcher jtiM = P_JTI.matcher(payload);
        if (!expM.find() || !subM.find() || !domM.find() || !jtiM.find()) {
            throw new BizException(ErrorCode.NOT_LOGIN, "missing claims");
        }
        // ②③ 域分类（未验签声明仅用于错误归类，不进入信任路径）
        String dom = domM.group(1);
        if (expectedDomain != null && !expectedDomain.equals(dom)) {
            throw new BizException(ErrorCode.FORBIDDEN, "token domain mismatch: " + dom);
        }
        // ④ 验签
        String signing = parts[0] + "." + parts[1];
        byte[] expectedSig = hmac(signing);
        byte[] actualSig;
        try {
            actualSig = Base64.getUrlDecoder().decode(parts[2]);
        } catch (IllegalArgumentException e) {
            throw new BizException(ErrorCode.NOT_LOGIN, "bad signature encoding");
        }
        if (!MessageDigest.isEqual(expectedSig, actualSig)) {
            throw new BizException(ErrorCode.NOT_LOGIN, "bad signature");
        }
        // ⑤ 过期
        Instant exp = Instant.ofEpochSecond(Long.parseLong(expM.group(1)));
        if (Instant.now().isAfter(exp)) {
            throw new BizException(ErrorCode.TOKEN_EXPIRED);
        }
        return new Claims(subM.group(1), dom, jtiM.group(1), exp);
    }

    public String domain() {
        return domain;
    }

    public static String newJti() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static String escape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private byte[] hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("hmac failed", e);
        }
    }

    private static String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
