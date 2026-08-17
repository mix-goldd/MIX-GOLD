import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

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

  it("ينقل جلسة المستخدم إلى Home عبر جزء الرابط الآمن", () => {
    expect(source).toContain("async function openHomeStandalone()");
    expect(source).toContain("await openStandalonePage('home')");
    expect(source).toContain('target.hash = new URLSearchParams({ [MIX_GOLD_AUTH_FRAGMENT_KEY]: encodedSession }).toString();');
    expect(source).toContain('href="https://mix-gold-jet.vercel.app/" onclick="event.preventDefault(); if (isNavLocked(\'home\')) { showLockedNotice(\'home\'); } else { openHomeStandalone(); }"');
  });

  it("يعرّف روابط Vercel المستقلة للإعدادات وسجل المشاهدات ويحافظ على الجلسة عند فتحها", () => {
    expect(source).toContain("settings: 'https://mix-gold-jet-settings.vercel.app/'");
    expect(source).toContain("'watch-history': 'https://mix-gold-jet-watch-history.vercel.app/'");
    expect(source).toContain("async function openStandalonePage(page)");
    expect(source).toContain("await openStandaloneWithSession(destinationUrl, getPageName(page) || page)");
    expect(source).toContain("openStandalonePage('settings')");
    expect(source).toContain("openStandalonePage('watch-history')");
  });

  it("يفتح أيقونة الحساب في الصفحة المستقلة المناسبة", () => {
    expect(source).toContain("btn.onclick = () => openStandalonePage(isLoggedIn ? 'profile' : 'login')");
  });

  it("يعيد توجيه روابط المنشورات المباشرة إلى واجهة الموقع عند إعادة التحميل", () => {
    expect(vercelConfig.rewrites).toEqual(expect.arrayContaining([
      { source: "/post/:path*", destination: "/index.html" },
      { source: "/download/:path*", destination: "/index.html" },
      { source: "/manga/:path*", destination: "/index.html" },
    ]));
  });

  it("لا يمسح مسار المنشور قبل أن يستعيد تفاصيل الفيديو", () => {
    expect(source).toContain("const hasDirectContentRoute = Boolean(initialPost || initialDl || initialImg || initialManga);");
    expect(source).toContain("if (!hasDirectContentRoute) navigateTo(initialRoute.page);");
    expect(source).toContain("if (initialPost) openPostBySlug(initialPost);");
  });

  it("يخفي تفاصيل الفيديو غير المتاحة ويربط قسم النجوم ببيانات الفيديو الفعلية", () => {
    expect(source).toContain("if (studioMeta) studioMeta.style.display = studio ? '' : 'none';");
    expect(source).toContain("if (seriesMeta) seriesMeta.style.display = series ? '' : 'none';");
    expect(source).toContain("if (metaLinks) metaLinks.style.display = studio || series ? '' : 'none';");
    expect(source).toContain(".filter(category => typeof category === 'string' && category.trim())");
    expect(source).toContain("function renderPostModels(video)");
    expect(source).toContain("modelsData.filter(model => linkedStarIds.includes(model.id))");
    expect(source).toContain("section.style.display = 'none';");
    expect(source).toContain("renderPostModels(videoData);");
  });

  it("يعرض صفحة 404 ثنائية اللغة للمنشور غير المتوفر ويحافظ على مسار الرابط", () => {
    expect(source).toContain('id="post-not-found"');
    expect(source).toContain("المنشور غير متوفر");
    expect(source).toContain("This post is unavailable or no longer exists.");
    expect(source).toContain("onclick=\"navigateTo('home')\"");
    expect(source).toContain("function showPostNotFound()");
    expect(source).toContain("if (!videoData) {\n                showPostNotFound();\n                return true;");
    expect(source).toContain("if (postSlug && openPostBySlug(postSlug)) return;");
  });

  it("يعرض ملخص القصة المحفوظ للمنشور ولا يعيد النص التجريبي القديم", () => {
    expect(source).toContain("description: typeof relation.details.summary === 'string'");
    expect(source).toContain('id="post-description-section" hidden');
    expect(source).toContain("function renderPostDescription(video)");
    expect(source).toContain("section.hidden = !description;");
    expect(source).toContain("text.textContent = description;");
    expect(source).toContain("renderPostDescription(videoData);");
    expect(source).not.toContain("A highly detailed, photorealistic image of a specialized armless wheelchair.");
  });

  it("يقرأ علاقات كل منشور بصورة مستقلة مع بديل متوافق للبيانات القديمة", () => {
    expect(source).toContain("supabaseClient.from('post_details').select('post_id, summary, studio_name, series_name, duration')");
    expect(source).toContain("supabaseClient.from('post_categories').select('post_id, category')");
    expect(source).toContain("supabaseClient.from('post_stars').select('post_id, model_id')");
    expect(source).toContain("supabaseClient.from('post_links').select('post_id, link_type, url')");
    expect(source).toContain("supabaseClient.from('post_media').select('post_id, media_kind, url, sort_order')");
    expect(source).toContain("supabaseClient.from('post_metrics').select('post_id, views, likes_count, dislikes_count')");
    expect(source).toContain("const getPostRelation = post =>");
    expect(source).toContain("model_ids: relation.starIds");
    expect(source).toContain("modelsData.filter(model => linkedStarIds.includes(model.id))");
  });

  it("يفصل رابط وإحصاءات كل منشور عن رابط صورته حتى عند تطابق الأغلفة", () => {
    expect(source).toContain("div.dataset.postId = character.id || '';");
    expect(source).toContain("div.dataset.url = character.id || character.url;");
    expect(source).toContain("characterData.find(v => v.id === url || v.url === url)");
    expect(source).toContain("slugFromKey(v.id || v.url) === slug || slugFromKey(v.url) === slug");
    expect(source).toContain("slugFromKey(cardElement.dataset.postId || cardElement.dataset.url)");
  });

  it("يفتح كل منشور بمعرّف سجله المستقل أو برابط المشاركة المختصر", () => {
    expect(source).toContain("v.id === slug || slugFromKey(v.id || v.url) === slug");
    expect(source).toContain("p.id === slug || slugFromKey(p.id || p.url) === slug");
    expect(source).toContain("const slug = slugFromKey(cardElement.dataset.postId || cardElement.dataset.url);");
  });

  it("يثبت كلمة ورقم الحلقة في بطاقة الفيديو دون تصغير حجم العنوان", () => {
    expect(source).toContain("function splitEpisodeFromPostTitle(rawTitle)");
    expect(source).toContain("episodeLabel: useArabicLabel ? `الحلقة ${episodeNumber}` : `Episode ${episodeNumber}`");
    expect(source).toContain('class="post-title-main"');
    expect(source).toContain('class="post-title-episode"');
    expect(source).toContain("flex: 0 0 auto;");
    expect(source).toContain("font-size: 0.9rem;");
  });

  it("يعرض الوقت والتاريخ وفق لغة الواجهة المختارة ويعيد بناء العناصر الزمنية", () => {
    expect(source).toContain("const isArabic = currentLanguage === 'ar';");
    expect(source).toContain("return isArabic ? 'الآن' : 'Just now';");
    expect(source).toContain("function getLocalizedDateLabel(item)");
    expect(source).toContain("${getLocalizedDateLabel(character)}");
    expect(source).toContain("createdAt: p.created_at");
    expect(source).toContain("function timeAgo(timestamp) {\n            return humanizeDate(timestamp);");
    expect(source).toContain("else if (currentPage === 'notifications') renderNotifications();");
    expect(source).toContain("else if (currentPage === 'watch-history') renderWatchHistory();");
    expect(source).toContain("renderCommentsList();");
  });

  it("يصوغ الوقت النسبي فعليًا بالعربية أو الإنجليزية وفق اللغة المختارة", () => {
    const match = source.match(/function humanizeDate\(value\) \{[\s\S]*?\n        \}\n\n        function getLocalizedDateLabel/);
    expect(match).not.toBeNull();
    const formatterSource = match![0].replace(/\n\n        function getLocalizedDateLabel$/, "");
    const createFormatter = new Function("currentLanguage", `${formatterSource}\nreturn humanizeDate;`) as (language: string) => (value: number) => string;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    const tenHoursEarlier = new Date("2026-08-17T02:00:00.000Z").getTime();
    expect(createFormatter("en")(tenHoursEarlier)).toBe("10 hours ago");
    expect(createFormatter("ar")(tenHoursEarlier)).toBe("منذ 10 ساعة");
    vi.useRealTimers();
  });
});
