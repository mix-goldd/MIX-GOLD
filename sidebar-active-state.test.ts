import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

describe("حالة القائمة الجانبية", () => {
  it("يعيد تطبيق التحديد بعد كل إعادة بناء للقائمة", () => {
    expect(source).toMatch(
      /sidebarMenu\.innerHTML = html;\s*rebuildVideoCategories\(\);\s*\/\/[^\n]*\s*\/\/[^\n]*\s*updateSidebarActiveState\(currentPage\);/,
    );
  });

  it("يحتوي Home وSaved على معرّفات صفحة صريحة للاختيار الدقيق", () => {
    expect(source).toContain('data-page="home"');
    expect(source).toContain('data-page="saved"');
  });
});
