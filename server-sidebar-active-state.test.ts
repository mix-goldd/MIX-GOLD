import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildPreviewHtml, findPostBySlug, getPreviewImage, getShareImage, sanitizeSlug, slugFromPostKey } from "../api/post-preview.mjs";

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

  it("يزيل تحديد القائمة عند فتح تفاصيل فيديو ويحتفظ بتنقل عناصر القائمة", () => {
    expect(source).toContain("document.getElementById('post-detail').classList.add('active');\n            updateSidebarActiveState('');");
    expect(source).toContain("function updateSidebarActiveState(page)");
    expect(source).toContain("targetElement.classList.add('active');");
    expect(source).toContain("function navigateTo(page, options = {})");
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
    expect(source).toContain("await openStandaloneWithSession(destinationUrl, getPageTitle(page) || page)");
    expect(source).not.toContain("getPageName(page)");
    expect(source).toContain("openStandalonePage('settings')");
    expect(source).toContain("openStandalonePage('watch-history')");
  });

  it("يستعيد جلسة Supabase قبل بناء واجهة الصفحة المستقلة فلا يظهر الحساب كزائر", () => {
    expect(source).toContain("async function checkUserSession(options = {})");
    expect(source).toContain("if (!options.skipTransfer) await restoreTransferredAuthSession();");
    expect(source).toMatch(/async function init\(\) \{\s*\/\/ صفحات Vercel المستقلة[\s\S]*?await restoreTransferredAuthSession\(\);\s*await loadDynamicContent\(\);/);
    expect(source).toContain("currentUserProfile = loadCachedUserProfile();\n            await checkUserSession({ skipTransfer: true });");
    const initBlock = source.match(/async function init\(\) \{[\s\S]*?\n        \}\n        init\(\);/)?.[0] || "";
    expect(initBlock).not.toContain("checkUserSession();");
  });

  it("يفتح أيقونة الحساب في الصفحة المستقلة المناسبة", () => {
    expect(source).toContain("btn.onclick = () => openStandalonePage(isLoggedIn ? 'profile' : 'login')");
  });

  it("يعيد توجيه روابط المنشورات المباشرة إلى واجهة الموقع عند إعادة التحميل", () => {
    expect(vercelConfig.rewrites).toEqual(expect.arrayContaining([
      { source: "/post/:slug", destination: "/api/post-preview?slug=:slug" },
      { source: "/post/:path*", destination: "/api/post-preview?slug=:path*" },
      { source: "/download/:path*", destination: "/index.html" },
      { source: "/manga/:path*", destination: "/index.html" },
    ]));
  });

  it("لا يمسح مسار المنشور قبل أن يستعيد تفاصيل الفيديو", () => {
    expect(source).toContain("const hasDirectContentRoute = Boolean(initialPost || initialDl || initialImg || initialManga);");
    expect(source).toContain("if (!hasDirectContentRoute) navigateTo(initialRoute.page, { historyMode: 'replace' });");
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

  it("يخفي منشورات الأقسام المقفلة من الصفحة الرئيسية مع إبقاء قفل القائمة", () => {
    expect(source).toContain("let showVideos = !isNavLocked('video');");
    expect(source).toContain("let showImages = !isNavLocked('pulsex');");
    expect(source).toContain("let showModels = !isNavLocked('models');");
    expect(source).toContain("let showManga = !isNavLocked('comics');");
    expect(source).toContain("let showManhwa = !isNavLocked('comics');");
    expect(source).toContain("return isNavLocked(key) ? ' menu-item-locked' : '';");
  });

  it("يضع سهم Comics قبل أيقونة القفل مع إبقاء المجموعة بمحاذاة نهاية الصف", () => {
    const comicsToggle = source.match(/<div class="sidebar-dropdown">[\s\S]*?toggleComicsMenu[\s\S]*?id="comics-categories"/)?.[0] || "";
    expect(comicsToggle).toMatch(/class="comics-dropdown-controls">[\s\S]*?fa-chevron-down dropdown-arrow[\s\S]*?navLockIcon\('comics'\)/);
    expect(source).toContain(".comics-dropdown-controls {");
    expect(source).toContain(".comics-dropdown-controls .dropdown-arrow,");
  });

  it("يستخدم شعار MIX GOLD الجديد في ترويسة الموقع", () => {
    expect(source).toContain('src="https://i.ibb.co/bjyKccjV/Picsart-26-08-17-15-37-39-933.png"');
    expect(source).toContain('alt="MIX GOLD Logo"');
    expect(source).not.toContain('src="https://iili.io/KAz9Ybt.jpg"');
  });

  it("يحاذي نص ملخص القصة إلى اليمين دون تغيير زر إظهار المزيد", () => {
    expect(source).toMatch(/\.desc-text\s*\{[\s\S]*?text-align:\s*right;[\s\S]*?direction:\s*rtl;/);
    expect(source).toContain('class="desc-toggle-btn"');
  });

  it("ينقل صفحات فصل المانجا بحركة أفقية تراعي اتجاه القراءة والسحب", () => {
    expect(source).toContain("function initMangaReaderSwipe()");
    expect(source).toContain("if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;");
    expect(source).toContain("const goNext = mangaReaderDirection === 'rtl' ? !swipedLeft : swipedLeft;");
    expect(source).toContain("renderMangaReaderChapter(currentMangaPageIndex + 1, { transition: 'next' });");
    expect(source).toContain("renderMangaReaderChapter(currentMangaPageIndex - 1, { transition: 'prev' });");
    expect(source).toContain("manga-page-slide-from-right");
    expect(source).toContain("manga-page-slide-from-left");
  });

  it("يرتب Anime وفق تاريخ الإضافة والمشاهدات وعدد الإعجابات الفعلي", () => {
    expect(source).toContain("function parseAnimeSortMetric(value)");
    expect(source).toContain("return sorted.sort((a, b) => getAnimeAddedAt(b) - getAnimeAddedAt(a));");
    expect(source).toContain("parseAnimeSortMetric(b.views) - parseAnimeSortMetric(a.views)");
    expect(source).toContain("function getAnimeRatingScore(item)");
    expect(source).toContain("relationMetrics.likes_count");
    expect(source).toContain("getAnimeRatingScore(b) - getAnimeRatingScore(a)");
    expect(source).toContain("{ value: 'top_rated', label: 'Top Rated', labelAr: 'الأكثر تقييمًا' }");
  });

  it("يربط نافذة فرز Anime بزرها على الهاتف ويضبط حجمها ومحاذاة نصها", () => {
    expect(source).toContain("#videos-page-sort-dropdown .sort-dropdown.show");
    expect(source).toContain("top: calc(100% + 8px);");
    expect(source).toContain("right: 0;");
    expect(source).toContain("width: max-content;");
    expect(source).toContain("max-width: calc(100vw - 24px);");
    expect(source).toContain("justify-content: center !important;");
    expect(source).toContain("text-align: center !important;");
  });

  it("يفتح لوحة المشاركة الأصلية ويحافظ على نسخ الرابط كبديل آمن", () => {
    expect(source).toContain("if (typeof navigator.share === 'function')");
    expect(source).toContain("await navigator.share({ title, text, url });");
    expect(source).toContain("if (error?.name === 'AbortError') return;");
    expect(source).toContain("await navigator.clipboard.writeText(url);");
    expect(source).toContain("if (shareBtn) shareBtn.onclick = handleShare;");
  });

  it("يحذف تضمين مزود الفيديو المحظور وينظف المشغل عند الرجوع أو مغادرة المنشور", () => {
    expect(source).not.toContain('youtube-player-iframe');
    expect(source).not.toContain('youtube.com/iframe_api');
    expect(source).not.toContain('onYouTubeIframeAPIReady');
    expect(source).toContain('id="post-player-iframe" src="about:blank"');
    expect(source).toContain("function clearPostPlayer()");
    expect(source).toContain("clearPostPlayer();\n            document.getElementById('post-detail').classList.remove('active');");
    expect(source).toContain("window.addEventListener('popstate', function () {\n            clearPostPlayer();\n            const postDetail = document.getElementById('post-detail');\n            if (postDetail) postDetail.classList.remove('active');");
    expect(source).toContain("setPostPlayerSource(videoData?.pageUrl);");
  });

  it("يعيد زر الرجوع للخطوة السابقة دون إنشاء صفحة منشور أو تنزيل وسيطة", () => {
    expect(source).toContain("function returnToPreviousView(fallbackPage = 'home')");
    expect(source).toContain("history.back();");
    expect(source).toContain("function backToPostFromDownload() {\n            returnToPreviousView('home');");
    expect(source).toContain("function backFromMangaReader() {\n        returnToPreviousView('manga');");
    expect(source).toContain("onclick=\"returnToPreviousView('images')\"");
    expect(source).toContain("navigateTo(route.page || 'home', { historyMode: 'none' });");
    expect(source).not.toContain("if (currentPostCard) openPostFromCard(currentPostCard);");
  });

  it("يكيّف عنوان ترويسة المنشور مع المساحة المتاحة بين زري القائمة والبحث", () => {
    expect(source).toContain("function fitHeaderPageTitle()");
    expect(source).toContain("header.querySelector('.menu-toggle')?.offsetWidth");
    expect(source).toContain("header.querySelector('.header-controls')?.offsetWidth");
    expect(source).toContain("const isCompactScreen = window.matchMedia('(max-width: 480px)').matches;");
    expect(source).toContain("? 15");
    expect(source).toContain("titleEl.style.setProperty('--header-page-title-max-width', 'none');");
    expect(source).toContain("const naturalWidth = titleEl.scrollWidth;");
    expect(source).toContain("const controlGap = isCompactScreen ? 12 : 44;");
    expect(source).toContain("const fittedFontSize = isCompactScreen");
    expect(source).toContain("const minimumFontSize = isCompactScreen ? 13 : 13;");
    expect(source).toContain("titleEl.style.setProperty('--header-page-title-font-size'");
    expect(source).toContain("window.addEventListener('resize', fitHeaderPageTitle);");
    expect(source).toContain("requestAnimationFrame(() => requestAnimationFrame(fitHeaderPageTitle));");
    expect(source).toContain("font-size: var(--header-page-title-font-size, 0.9375rem);");
    expect(source).toContain("max-width: var(--header-page-title-max-width, 55%);");
    expect(source).toContain("white-space: normal;");
    expect(source).toContain("overflow: visible;");
    expect(source).toContain("unicode-bidi: plaintext;");
    expect(source).toContain(".header-title-episode {");
    expect(source).toContain("unicode-bidi: isolate;");
    expect(source).toContain("const title = [titleMain, episodeTitle].filter(Boolean).join(' ')");
    expect(source).toContain("episodeSpan.dir = /[\\u0600-\\u06FF]/.test(episodeMatch[2]) ? 'rtl' : 'ltr';");
  });

  it("ينشئ معاينة مشاركة برابط وصورة وعنوان المنشور لكل مسار post", () => {
    const previewHtml = buildPreviewHtml("<html><head><title>MIX GOLD</title></head><body></body></html>", {
      title: "Episode One",
      description: "A concise post description.",
      image: "https://cdn.example.com/post-cover.jpg",
      canonicalUrl: "https://mix-gold-jet.vercel.app/post/6t1nx1",
      category: "Anime",
    });
    expect(previewHtml).toContain('<meta property="og:title" content="Episode One">');
    expect(previewHtml).toContain('<meta property="og:image:width" content="1200">');
    expect(previewHtml).toContain('<meta property="og:image:height" content="675">');
    expect(previewHtml).toContain('<meta property="og:image:type" content="image/jpeg">');
    expect(previewHtml).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(previewHtml).toContain('<link rel="canonical" href="https://mix-gold-jet.vercel.app/post/6t1nx1">');
    expect(getPreviewImage({ images: ["https://cdn.example.com/fallback.jpg"] })).toBe("https://cdn.example.com/fallback.jpg");
    expect(getPreviewImage({}, [{ media_kind: "video", url: "https://video.example.com/watch" }])).not.toBe("https://video.example.com/watch");
    const shareImage = getShareImage("https://cdn.example.com/post-cover.jpg");
    expect(shareImage).toContain("url=https%3A%2F%2Fcdn.example.com%2Fpost-cover.jpg");
    expect(shareImage).toContain("w=1200");
    expect(shareImage).toContain("h=675");
    expect(shareImage).toContain("fit=cover");
    expect(sanitizeSlug("6t1nx1")).toBe("6t1nx1");
    expect(sanitizeSlug("../unsafe")).toBe("");
    const postId = "f4462b9f-e9ee-47e1-ae01-1cc688c91b18";
    expect(slugFromPostKey(postId)).toBe("6t1nx1");
    expect(findPostBySlug([{ id: postId, page_url: "https://vidmoly.example/embed" }], "6t1nx1")).toMatchObject({ id: postId });
    expect(vercelConfig.functions).toEqual(expect.objectContaining({
      "api/post-preview.mjs": expect.objectContaining({ maxDuration: 10 }),
    }));
    expect(vercelConfig.rewrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/post/:slug", destination: "/api/post-preview?slug=:slug" }),
    ]));
  });

  it("يبدأ دخول Google على الهاتف بالمسار المدمج وFedCM قبل بديل إعادة التوجيه", () => {
    expect(source).toContain('https://accounts.google.com/gsi/client');
    expect(source).toContain("signInWithIdToken({\n                provider: 'google'");
    expect(source).toContain('use_fedcm_for_prompt: true');
    expect(source).toContain('async function continueWithGoogleOAuthRedirect()');
    expect(source).toContain('async function loginWithGoogleOnDevice()');
  });

  it("لا تحجب طبقة الاتفاقية المخفية لمس أزرار تسجيل الدخول", () => {
    expect(source).toContain('pointer-events: none;');
    expect(source).toContain('#agreement-overlay.active {\n            visibility: visible;\n            opacity: 1;\n            pointer-events: auto;');
  });
});
