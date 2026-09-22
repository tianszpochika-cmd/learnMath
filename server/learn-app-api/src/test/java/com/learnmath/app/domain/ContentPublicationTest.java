package com.learnmath.app.domain;

import com.learnmath.app.common.ErrorCode;
import com.learnmath.app.domain.ContentPublication.ContentItem;
import com.learnmath.app.domain.ContentPublication.PublicRead;
import com.learnmath.app.domain.ContentPublication.PublishResult;
import com.learnmath.app.domain.ContentPublication.PublishedSnapshot;
import com.learnmath.app.domain.ContentPublication.WorkStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 内容发布快照 —— 20 §6 BR-06（DR-06 DoD）：
 * 草稿/快照分离、首读空+missing、部分发布、版本冲突、显式下线、quality 不赋权。
 */
class ContentPublicationTest {

    private static final Set<String> FOUR_CARDS = Set.of("origin", "prototype", "capability", "ladder");
    private static final Instant NOW = Instant.parse("2026-09-22T08:00:00Z");

    private static Map<String, String> draftValues() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("origin", "希帕克斯弦表…（草稿正文，绝不能外泄）");
        m.put("prototype", "影长与角度");
        m.put("capability", "不可达测距");
        m.put("ladder", "[{real,model,symbol}]");
        return m;
    }

    @Test
    void firstRead_withoutSnapshot_returnsEmptyAndAllMissing_neverDraft() {
        // BR-06：首次无发布快照 → 空四卡 + missingCards，绝不返回草稿正文
        ContentItem item = ContentItem.of(1L, "narrative", FOUR_CARDS);
        PublicRead r = ContentPublication.readForPublic(null, item.allFields());
        assertTrue(r.values().isEmpty());
        assertEquals(FOUR_CARDS, r.missingCards());
        assertNull(r.version());
        assertFalse(r.values().values().stream().anyMatch(v -> v.contains("草稿")), "不得泄漏草稿");
    }

    @Test
    void partialPublish_onlyApprovedFields_snapshotPartial() {
        // BR-06：部分卡审核通过 → 部分快照 + missing 卡名（"待补全"）
        ContentItem item = ContentItem.of(1L, "narrative", FOUR_CARDS)
                .withApproved(Set.of("origin"))
                .withStatus(WorkStatus.REVIEW);
        PublishResult res = ContentPublication.publish(item, 1L, draftValues(), NOW);
        assertTrue(res.ok());
        PublishedSnapshot snap = res.snapshot();
        assertEquals(1L, snap.version());
        assertEquals(Set.of("origin"), Set.copyOf(snap.publishedValues().keySet()));
        assertEquals(Set.of("prototype", "capability", "ladder"), snap.missingCards());
        assertTrue(snap.partial());
        // 未审核字段不入快照（哪怕工作稿有值）
        assertFalse(snap.publishedValues().containsKey("prototype"));

        PublicRead r = ContentPublication.readForPublic(snap, FOUR_CARDS);
        assertEquals("希帕克斯弦表…（草稿正文，绝不能外泄）", r.values().get("origin"));
        assertEquals(3, r.missingCards().size());
    }

    @Test
    void fullApproval_publishNotPartial() {
        ContentItem item = ContentItem.of(2L, "narrative", FOUR_CARDS)
                .withApproved(FOUR_CARDS)
                .withStatus(WorkStatus.REVIEW);
        PublishResult res = ContentPublication.publish(item, 1L, draftValues(), NOW);
        assertTrue(res.ok());
        assertFalse(res.snapshot().partial());
        assertTrue(res.snapshot().missingCards().isEmpty());
        assertEquals(4, res.snapshot().publishedValues().size());
    }

    @Test
    void expectedRevisionMismatch_conflict3012() {
        ContentItem item = ContentItem.of(3L, "narrative", FOUR_CARDS)
                .withApproved(FOUR_CARDS)
                .withStatus(WorkStatus.REVIEW)
                .revise(5L); // 工作稿已前进到 5
        PublishResult res = ContentPublication.publish(item, 4L, draftValues(), NOW); // 客户端持 4
        assertFalse(res.ok());
        assertEquals(ErrorCode.REVISION_CONFLICT, res.error());
        assertEquals(3012, res.error().code());
    }

    @Test
    void draftNotSubmitted_publishRejected() {
        ContentItem item = ContentItem.of(4L, "narrative", FOUR_CARDS).withApproved(FOUR_CARDS); // 仍 DRAFT
        PublishResult res = ContentPublication.publish(item, 1L, draftValues(), NOW);
        assertFalse(res.ok());
        assertEquals(ErrorCode.PARAM_INVALID, res.error());
    }

    @Test
    void revisionAfterPublish_doesNotInvalidateOldSnapshot() {
        // 修改进入待审不覆盖上次发布快照
        ContentItem v1Item = ContentItem.of(5L, "narrative", FOUR_CARDS)
                .withApproved(Set.of("origin")).withStatus(WorkStatus.REVIEW);
        PublishedSnapshot v1 = ContentPublication.publish(v1Item, 1L, draftValues(), NOW).snapshot();

        ContentItem edited = v1Item.revise(2L).withApproved(Set.of()); // 修改并撤回审核
        assertEquals(2L, edited.workRevision());
        // 对外读仍用 v1 快照（旧快照对象不受工作稿影响）
        PublicRead r = ContentPublication.readForPublic(v1, FOUR_CARDS);
        assertEquals(1L, r.version());
        assertEquals(Set.of("origin"), Set.copyOf(r.values().keySet()));
    }

    @Test
    void unpublish_explicitClearsVisibility_draftStatusIrrelevant() {
        // 显式下线清快照；不能靠工作稿 status 隐式下线（读只认快照）
        ContentItem item = ContentItem.of(6L, "formula", Set.of("origin", "symbols", "derivation"))
                .withApproved(Set.of("origin", "symbols", "derivation")).withStatus(WorkStatus.REVIEW);
        PublishedSnapshot snap = ContentPublication.publish(item, 1L, draftValues(), NOW).snapshot();

        PublishResult down = ContentPublication.unpublish(item, 1L);
        assertTrue(down.ok());
        assertNull(down.snapshot(), "unpublish 后快照清除");
        // 落库为 null 后读 = 首读态
        PublicRead r = ContentPublication.readForPublic(null, item.allFields());
        assertTrue(r.values().isEmpty());
        assertEquals(3, r.missingCards().size());
        assertTrue(snap.visible());
    }

    @Test
    void aiDraftQuality_doesNotGrantVisibility_gateIsReview() {
        // quality=ai_draft 只是来源标签：可见性唯一闸门是"审核通过→快照"
        // 未审核的 AI 内容：无快照 → 不可见
        ContentItem aiItem = ContentItem.of(7L, "chain", Set.of("steps")).withStatus(WorkStatus.DRAFT);
        PublicRead hidden = ContentPublication.readForPublic(null, aiItem.allFields());
        assertTrue(hidden.values().isEmpty());

        // 审核通过后（哪怕 quality=ai_draft）可发布 —— 闸门是 approved 而非 quality
        ContentItem reviewed = aiItem.withApproved(Set.of("steps")).withStatus(WorkStatus.REVIEW);
        PublishResult res = ContentPublication.publish(reviewed, 1L,
                Map.of("steps", "S1..S3 推导步骤"), NOW);
        assertTrue(res.ok());
        assertEquals(1, res.snapshot().publishedValues().size());
    }

    @Test
    void completeness_metric_independentOfStatus() {
        ContentItem half = ContentItem.of(8L, "narrative", FOUR_CARDS).withApproved(Set.of("origin", "prototype"));
        assertEquals(0.5d, ContentPublication.completeness(half), 1e-9);
        assertEquals(0d, ContentPublication.completeness(ContentItem.of(9L, "n", Set.of())), 1e-9);
    }
}
