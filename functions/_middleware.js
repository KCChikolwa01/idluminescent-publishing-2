/* Puts the real title, description and picture into the link preview
   for a shared note, article or newsletter letter. */
var API = "https://api.idluminescent.co.za/api/public/";

var ROUTES = [
  { test: /^\/notes\/read\/?$/, kind: "notes" },
  { test: /^\/articles\/read\/?$/, kind: "articles" },
  { test: /^\/newsletter\/?$/, kind: "reflections" }
];

function escapeHtml(value) {
  return String(value || "")
    .replace(/\u0026/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

function absoluteImage(value) {
  var picture = String(value || "").trim();
  if (!picture) return "https://idluminescent.co.za/og.jpg";
  if (picture.indexOf("//") === 0) return "https:" + picture;
  if (picture.charAt(0) === "/") return "https://idluminescent.co.za" + picture;
  return picture;
}

function firstImage(item) {
  if (item && Array.isArray(item.images) && item.images.length) return absoluteImage(item.images[0]);
  if (item && item.image_url) return absoluteImage(item.image_url);
  return "https://idluminescent.co.za/og.jpg";
}

function setMeta(html, attr, key, value) {
  var tag = "<meta " + attr + "=\"" + key + "\" content=\"" + escapeHtml(value) + "\">";
  var re = new RegExp("<meta\\s+" + attr + "=\"" + key + "\"\\s+content=\"[^\"]*\">", "i");
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", "\n" + tag + "\n</head>");
}

export async function onRequest(context) {
  var url = new URL(context.request.url);
  var route = null;
  for (var i = 0; i < ROUTES.length; i++) {
    if (ROUTES[i].test.test(url.pathname)) route = ROUTES[i];
  }
  if (!route) return context.next();

  var slug = url.searchParams.get("slug") || "";
  var id = url.searchParams.get("id") || "";
  if (!slug && !id) return context.next();

  var response = await context.next();
  var type = response.headers.get("content-type") || "";
  if (type.indexOf("text/html") === -1) return response;

  var item = null;
  try {
    var api = await fetch(API + route.kind, { cf: { cacheTtl: 120 } });
    if (api.ok) {
      var data = await api.json();
      var items = data && data.items ? data.items : [];
      for (var n = 0; n < items.length; n++) {
        var row = items[n];
        if ((slug && String(row.slug || "") === slug) || (id && String(row.id) === String(id))) {
          item = row;
          break;
        }
      }
    }
  } catch (error) {
    return response;
  }
  if (!item) return response;

  var title = String(item.title || "ID Luminescent Publishing") + " — ID Luminescent Publishing";
  var description = String(item.excerpt || item.title || "").trim();
  var image = firstImage(item);
  var pageUrl = url.origin + url.pathname + url.search;
  var html = await response.text();
  html = html.replace(/<title>[^<]*<\/title>/i, "<title>" + escapeHtml(title) + "</title>");
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "property", "og:url", pageUrl);
  html = setMeta(html, "name", "twitter:card", "summary_large_image");
  html = setMeta(html, "name", "twitter:image", image);

  var headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(html, { status: response.status, headers: headers });
}
