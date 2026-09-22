package com.learnmath.app.domain;

import com.learnmath.app.common.ErrorCode;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 内容发布快照状态机（20 §6 BR-06 / DR-06；纯函数）。
 *
 * 核心分离：
 *  - 工作稿 status（draft/review/published）与完整性 completeness 独立；
 *  - 学员与官网只读 published_snapshot（含 version/publishedAt/已审核字段/missingCards）；
 *  - **首次无快照 → 返回空四卡+missingCards=全部，绝不返回草稿正文**；
 *  - 部分审核可发"部分快照"（显示待补全）；改动进待审不覆盖已发布快照；
 *  - publish 用 expectedRevision 校验并原子替换（3012 冲突）、publishedVersion+1；
 *  - 下线必须显式 unpublish 清除对外快照（不靠工作稿 status 隐式下线）；
 *  - quality=ai_draft 只是来源标签，不等于审核状态、不赋予可见性。
 * 同规则适用于四卡/公式/推理链（concept_narrative / formula / solution_path 的 snapshot 列）。
 */
public final class ContentPublication {

    public enum WorkStatus { DRAFT, REVIEW, PUBLISHED }

    /**
     * @param approvedFields 已审核通过的字段/卡名（工作稿侧）
     * @param allFields      该内容应有的全部字段/卡名（如四卡 = origin/prototype/capability/ladder）
     * @param workRevision   工作稿版本（发布请求需携带其期望值）
     */
    public record ContentItem(
            long id,
            String type,
            WorkStatus status,
            Set<String> approvedFields,
            Set<String> allFields,
            long workRevision,
            long publishedVersion) {

        public static ContentItem of(long id, String type, Set<String> allFields) {
            return new ContentItem(id, type, WorkStatus.DRAFT, Set.of(), allFields, 1L, 0L);
        }

        public ContentItem withApproved(Set<String> approved) {
            return new ContentItem(id, type, status, Set.copyOf(approved), allFields, workRevision, publishedVersion);
        }

        public ContentItem withStatus(WorkStatus s) {
            return new ContentItem(id, type, s, approvedFields, allFields, workRevision, publishedVersion);
        }

        public ContentItem revise(long newRevision) {
            // 修改进入待审：approved 保持已过部分，整体回到 REVIEW，版本前进
            return new ContentItem(id, type, WorkStatus.REVIEW, approvedFields, allFields, newRevision, publishedVersion);
        }
    }

    /** 发布快照（对外可见的唯一来源）。 */
    public record PublishedSnapshot(
            long version,
            Instant publishedAt,
            Map<String, String> publishedValues, // 仅已审核且有值的字段
            Set<String> missingCards,            // all - approved
            boolean partial) {

        public boolean visible() {
            return true;
        }
    }

    /** 公开读投影：无快照 → 空值 + missing=全部（绝不回草稿）。 */
    public record PublicRead(Map<String, String> values, Set<String> missingCards, Long version, Instant publishedAt) {}

    public record PublishResult(boolean ok, ErrorCode error, PublishedSnapshot snapshot, String reason) {}

    public static final String CARD_MISSING_FIRST_PUBLISH = "first-publish";

    private ContentPublication() {
    }

    /**
     * 发布（原子替换快照）。
     *
     * @param expectedRevision 客户端持有的工作稿版本（04 admin publish 参数）
     * @param draftValues      工作稿当前字段值（仅 approved ∩ draft 会进入快照）
     */
    public static PublishResult publish(ContentItem item, long expectedRevision,
                                        Map<String, String> draftValues, Instant now) {
        if (expectedRevision != item.workRevision()) {
            return new PublishResult(false, ErrorCode.REVISION_CONFLICT, null,
                    "内容版本冲突: 期望 " + expectedRevision + " 实际 " + item.workRevision());
        }
        if (item.status() == WorkStatus.DRAFT) {
            // 必须先经 review（送审动作把状态推到 REVIEW）；DRAFT 不允许直接发布
            return new PublishResult(false, ErrorCode.PARAM_INVALID, null,
                    "工作稿未送审（draft → review 后才能发布）");
        }
        Map<String, String> values = new LinkedHashMap<>();
        for (Map.Entry<String, String> en : draftValues.entrySet()) {
            if (item.approvedFields().contains(en.getKey()) && en.getValue() != null && !en.getValue().isBlank()) {
                values.put(en.getKey(), en.getValue());
            }
        }
        Set<String> missing = new LinkedHashSet<>(item.allFields());
        missing.removeAll(item.approvedFields());
        PublishedSnapshot snap = new PublishedSnapshot(
                item.publishedVersion() + 1, now, Map.copyOf(values), Set.copyOf(missing),
                !missing.isEmpty());
        return new PublishResult(true, null, snap, "published v" + snap.version());
    }

    /** 显式下线：清除对外快照（BR-06：不能靠工作稿 status 隐式下线）。 */
    public static PublishResult unpublish(ContentItem item, long expectedRevision) {
        if (expectedRevision != item.workRevision()) {
            return new PublishResult(false, ErrorCode.REVISION_CONFLICT, null,
                    "内容版本冲突: 期望 " + expectedRevision + " 实际 " + item.workRevision());
        }
        // 返回空快照 = 调用方以 null 落库 published_snapshot/unpublished_at
        return new PublishResult(true, null, null, "unpublished（对外快照已清除，工作稿保留）");
    }

    /** 公开/学习端读：只认快照。 */
    public static PublicRead readForPublic(PublishedSnapshot snapshot, Set<String> allFields) {
        if (snapshot == null) {
            // 首次未发布：空四卡 + missing=全部，绝不返回草稿正文
            return new PublicRead(Map.of(), Set.copyOf(allFields), null, null);
        }
        return new PublicRead(snapshot.publishedValues(), snapshot.missingCards(),
                snapshot.version(), snapshot.publishedAt());
    }

    /** completeness（完整性，仅管理端指标展示；与 status 独立，不控制可见性）。 */
    public static double completeness(ContentItem item) {
        if (item.allFields().isEmpty()) {
            return 0d;
        }
        long have = item.approvedFields().stream().filter(item.allFields()::contains).count();
        return (double) have / item.allFields().size();
    }

    /** 管理端预览与公开读分离的语义标记（管理域权限校验在 Filter 层，见 04 /admin preview）。 */
    public static boolean adminPreviewAllowed() {
        return true; // 契约占位：管理预览接口必须走 admin JWT，公开接口走快照
    }

    @Override
    public boolean equals(Object obj) {
        return super.equals(obj);
    }

    static boolean sameSet(Set<String> a, Set<String> b) {
        return Objects.equals(a, b);
    }
}
