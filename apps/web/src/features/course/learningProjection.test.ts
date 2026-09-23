import { describe, expect, it } from "vitest";
import { courseList, coursePreview, lessonReading, readReceipt } from "./learningProjection";

describe("documented learning fields", () => {
  it("accepts only usable course ids and titles from the documented pagination shell", () => {
    expect(courseList({ items: [{ id: 12, title: "代数入门" }], total: 1 })).toEqual({
      items: [{ id: "12", title: "代数入门" }], total: 1,
    });
    expect(courseList({ items: [{ id: 0, title: "示例" }], total: 1 })).toBeNull();
    expect(courseList({ records: [{ id: 12, title: "代数入门" }], total: 1 })).toBeNull();
    expect(coursePreview({ id: 3, title: " " })).toBeNull();
  });

  it("does not render malformed lesson content or unsafe video links", () => {
    expect(lessonReading({ title: "求根公式", content: "a x² + b x + c = 0", video_url: "https://cdn.example.com/a.mp4", completion_policy: "read_only" }))
      .toEqual({ title: "求根公式", content: "a x² + b x + c = 0", videoUrl: "https://cdn.example.com/a.mp4", completionPolicy: "read_only" });
    expect(lessonReading({ title: "求根公式", content: "", video_url: "javascript:alert(1)" })).toBeNull();
    expect(lessonReading({ title: "求根公式", content: "正文", video_url: "javascript:alert(1)" }))
      .toEqual({ title: "求根公式", content: "正文" });
  });

  it("requires all three server booleans before showing read or completion success", () => {
    expect(readReceipt({ readCompleted: true, lessonCompleted: false, practicePassed: false }))
      .toEqual({ readCompleted: true, lessonCompleted: false, practicePassed: false });
    expect(readReceipt({ readCompleted: true, lessonCompleted: true })).toBeNull();
    expect(readReceipt({ readCompleted: "true", lessonCompleted: true, practicePassed: true })).toBeNull();
    expect(readReceipt({ readCompleted: false, lessonCompleted: true, practicePassed: true })).toBeNull();
  });
});
