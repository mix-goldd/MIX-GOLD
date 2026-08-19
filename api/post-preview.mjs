import { readFile } from "node:fs/promises";

const SUPABASE_URL = "https://sqfvrowywszlcmgfkzgc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZnZyb3d5d3N6bGNtZ2ZremdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NTI4NjgsImV4cCI6MjA5OTAyODg2OH0.e4i3wBOV3T42irXTRhpKr9cwjqtusYj_NHXkZpMBi5Q";
const DEFAULT_IMAGE = "https://mix-gold-jet.vercel.app/manus-storage/mix-gold-logo_310bd072.png";
const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 675;
const PAGE_TEMPLATE_URLS = [
  new URL("../index.html", import.meta.url),
  new URL("../client/index.html", import.meta.url),
];

export function sanitizeSlug(value) {
  const slug = Array.isArray(value) ? value[0] : value;
  return typeof slug === "string" && /^[a-zA-Z0-9_-]+$/.test(slug) ? slug : "";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeText(value, fallback = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
}

export function parseImageList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [value];
  }
}

export function slugFromPostKey(value) {
  const key = String(value || "");
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) + hash) + key.charCodeAt(index);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

export function findPostBySlug(posts, slug) {
  return posts.find((post) => post?.id === slug || slugFromPostKey(post?.id || post?.page_url) === slug || slugFromPostKey(post?.page_url) === slug) || null;
}

export function getPreviewImage(post, media = []) {
  const imageMedia = media
    .filter((item) => item?.media_kind === "thumbnail" || item?.media_kind === "image")
    .map((item) => item?.url);
  const candidates = [post?.thumbnail_url, ...parseImageList(post?.images), ...imageMedia];
  return candidates.find((value) => typeof value === "string" && /^https?:\/\//i.test(value.trim()))?.trim() || DEFAULT_IMAGE;
}

export function getShareImage(image) {
  const source = typeof image === "string" && /^https?:\/\//i.test(image.trim()) ? image.trim() : DEFAULT_IMAGE;
  const imageUrl = new URL("https://wsrv.nl/");
  imageUrl.searchParams.set("url", source);
  imageUrl.searchParams.set("w", String(SHARE_IMAGE_WIDTH));
  imageUrl.searchParams.set("h", String(SHARE_IMAGE_HEIGHT));
  imageUrl.searchParams.set("fit", "cover");
  imageUrl.searchParams.set("output", "jpg");
  return imageUrl.toString();
}

export async function loadPostPageTemplate(reader = readFile) {
  let lastError;
  for (const templateUrl of PAGE_TEMPLATE_URLS) {
    try {
      return await reader(templateUrl, "utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Post page template is unavailable");
}

export function buildPreviewHtml(pageHtml, { title, description, image, canonicalUrl, category }) {
  const safeTitle = escapeHtml(normalizeText(title, "MIX GOLD"));
  const safeDescription = escapeHtml(normalizeText(description, "Discover this post on MIX GOLD."));
  const safeImage = escapeHtml(getShareImage(image));
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeCategory = escapeHtml(normalizeText(category));
  const metadata = [
    `<meta name="description" content="${safeDescription}">`,
    `<link rel="canonical" href="${safeCanonicalUrl}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="MIX GOLD">`,
    `<meta property="og:title" content="${safeTitle}">`,
    `<meta property="og:description" content="${safeDescription}">`,
    `<meta property="og:url" content="${safeCanonicalUrl}">`,
    `<meta property="og:image" content="${safeImage}">`,
    `<meta property="og:image:secure_url" content="${safeImage}">`,
    `<meta property="og:image:type" content="image/jpeg">`,
    `<meta property="og:image:width" content="${SHARE_IMAGE_WIDTH}">`,
    `<meta property="og:image:height" content="${SHARE_IMAGE_HEIGHT}">`,
    `<meta property="og:image:alt" content="${safeTitle}">`,
    ...(safeCategory ? [`<meta property="article:section" content="${safeCategory}">`] : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${safeTitle}">`,
    `<meta name="twitter:description" content="${safeDescription}">`,
    `<meta name="twitter:image" content="${safeImage}">`,
  ].join("\n    ");

  return pageHtml
    .replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle} | MIX GOLD</title>`)
    .replace(/<\/head>/i, `    ${metadata}\n</head>`);
}

async function fetchJson(pathname, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${pathname}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

async function getPostPreviewData(slug) {
  const posts = await fetchJson("posts", {
    select: "id,title,description,thumbnail_url,images,category,page_url",
    order: "created_at.desc",
    limit: "1000",
  });
  const post = findPostBySlug(posts, slug);
  if (!post) return null;
  const media = await fetchJson("post_media", {
    select: "url,media_kind,sort_order",
    post_id: `eq.${post.id}`,
    order: "sort_order.asc",
  });
  return { post, media };
}

function requestOrigin(request) {
  const protocol = String(request.headers?.["x-forwarded-proto"] || "https").split(",")[0];
  const host = request.headers?.host || "mix-gold-jet.vercel.app";
  return `${protocol}://${host}`;
}

export default async function handler(request, response) {
  const slug = sanitizeSlug(request.query?.slug);
  const origin = requestOrigin(request);
  const canonicalUrl = slug ? `${origin}/post/${slug}` : `${origin}/`;

  try {
    const [pageHtml, preview] = await Promise.all([
      loadPostPageTemplate(),
      slug ? getPostPreviewData(slug) : Promise.resolve(null),
    ]);
    const post = preview?.post;
    const html = buildPreviewHtml(pageHtml, {
      title: post?.title || "MIX GOLD",
      description: post?.description || "This post is not available on MIX GOLD.",
      image: getPreviewImage(post, preview?.media),
      canonicalUrl,
      category: post?.category || "",
    });
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    response.status(post ? 200 : 404).send(html);
  } catch (error) {
    console.error("Unable to render post preview", error);
    response.status(502).send("Unable to load this MIX GOLD post preview.");
  }
}
