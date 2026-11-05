/* ID Luminescent Publishing: public API connection (notes, articles, newsletter letters).
   API base: https://api.idluminescent.co.za/
   Public endpoints:
     /api/public/notes
     /api/public/articles
     /api/public/reflections
     /api/public/newsletter   (same letters)
   All API text is written with textContent / createTextNode only (no innerHTML). */
(function () {
  "use strict";
  var API = "https://api.idluminescent.co.za/";
  var ENDPOINTS = {
    notes: API + "api/public/notes",
    articles: API + "api/public/articles",
    reflections: API + "api/public/reflections",
    newsletter: API + "api/public/newsletter"
  };

  /* Manually written pieces that already exist on the site: never repeated from the API. */
  var MANUAL = {
    notes: {
      slugs: ["welcome", "a-final-note-from-the-author"],
      titles: ["welcome to id luminescent publishing", "a final note from the author"]
    },
    articles: {
      slugs: ["why-read-our-books", "why-read-these-books"],
      titles: ["why read our books", "why read these books"]
    },
    reflections: {
      slugs: [],
      titles: []
    }
  };

  function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fetchItems(url) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    return fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctl ? ctl.signal : undefined,
      credentials: "omit"
    })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!r.ok) {
            var msg = (data && data.error) ? String(data.error) : ("HTTP " + r.status);
            var err = new Error(msg);
            err.status = r.status;
            err.apiError = data && data.error ? String(data.error) : "";
            throw err;
          }
          return data;
        });
      })
      .then(function (data) {
        var list = data && Array.isArray(data.items) ? data.items
          : Array.isArray(data) ? data
          : [];
        return list.filter(function (it) {
          if (!it || typeof it !== "object") return false;
          if (it.status != null && String(it.status).toLowerCase() !== "published") return false;
          return String(it.title || "").trim() !== "";
        });
      });
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  /* Text with clickable http(s) links. Line breaks kept by CSS (white-space: pre-line). */
  function linkify(parent, text) {
    var re = /(https?:\/\/[^\s<>"']+)/g;
    var str = String(text == null ? "" : text);
    var last = 0, m;
    while ((m = re.exec(str)) !== null) {
      var url = m[1], trail = "";
      var t = url.match(/[.,;:!?)\]}]+$/);
      if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
      if (m.index > last) parent.appendChild(document.createTextNode(str.slice(last, m.index)));
      var a = document.createElement("a");
      a.href = url;
      a.textContent = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer nofollow";
      parent.appendChild(a);
      if (trail) parent.appendChild(document.createTextNode(trail));
      last = m.index + m[1].length;
    }
    if (last < str.length) parent.appendChild(document.createTextNode(str.slice(last)));
  }

  function dedupe(items, kind) {
    var seenSlug = {}, seenTitle = {}, seenId = {};
    var man = MANUAL[kind] || { slugs: [], titles: [] };
    man.slugs.forEach(function (s) { seenSlug[s] = 1; });
    man.titles.forEach(function (t) { seenTitle[t] = 1; });
    return items.filter(function (it) {
      var slug = String(it.slug || "").toLowerCase(), title = norm(it.title), id = it.id != null ? String(it.id) : "";
      if ((slug && seenSlug[slug]) || seenTitle[title] || (id && seenId[id])) return false;
      if (slug) seenSlug[slug] = 1;
      seenTitle[title] = 1;
      if (id) seenId[id] = 1;
      return true;
    });
  }

  function byNewest(a, b) {
    return (Date.parse(b.created_at || b.published_at || 0) || 0) - (Date.parse(a.created_at || a.published_at || 0) || 0);
  }

  function setStatus(box, msg, isError) {
    box.textContent = "";
    var p = el("p", "api-status" + (isError ? " api-error" : ""), msg);
    p.setAttribute("role", isError ? "alert" : "status");
    box.appendChild(p);
  }

  function friendlyApiError(err, kind) {
    var status = err && err.status;
    var apiErr = (err && err.apiError) ? err.apiError.toLowerCase() : "";
    var msg = (err && err.message) ? String(err.message).toLowerCase() : "";
    if (status === 401 || apiErr.indexOf("sign in") !== -1 || msg.indexOf("sign in") !== -1) {
      return "The public " + kind + " feed is not available yet. The publishing API is currently asking for a sign-in on a public endpoint. This needs to be corrected on the Cloudflare Worker (api.idluminescent.co.za). Existing " + kind + " on this page remain available.";
    }
    if (apiErr.indexOf("unknown endpoint") !== -1 || msg.indexOf("unknown endpoint") !== -1) {
      return "The public " + kind + " endpoint is not recognised by the API Worker (\"Unknown endpoint\"). The Cloudflare Worker route for /api/public/" + kind + " needs to be fixed. Existing " + kind + " on this page remain available.";
    }
    if (status === 404) {
      return "The public " + kind + " endpoint was not found (404). Please check the Cloudflare Worker routes. Existing " + kind + " on this page remain available.";
    }
    return "We could not load additional " + kind + " just now. The content already on this page is still here — please try again in a little while.";
  }

  function metaLine(it) {
    var d = fmtDate(it.created_at || it.published_at);
    if (!d) return null;
    var span = el("span", "meta");
    var b = el("b", null, "KC Chikolwa");
    span.appendChild(b);
    span.appendChild(document.createTextNode(" · " + d));
    return span;
  }

  function ensureStyles() {
    if (document.getElementById("api-extra-style")) return;
    var s = document.createElement("style");
    s.id = "api-extra-style";
    s.textContent = ".api-photo{display:block;width:100%;max-height:540px;object-fit:cover;border-radius:13px;margin:0 0 16px;background:#efe8da}"
      + ".api-promo{display:grid;grid-template-columns:112px 1fr;gap:16px;align-items:center;margin-top:22px;padding:16px 18px;border-radius:18px;background:#3a332c;color:#f6f1e6}"
      + ".api-promo-cover{width:112px;height:168px;object-fit:cover;border-radius:8px;background:#efe8da}"
      + ".api-promo h4{font-size:22px;margin:0 0 6px;line-height:1.2;color:#f6f1e6}"
      + ".api-promo p{margin:0 0 10px;color:#f6f1e6;font-size:16px;line-height:1.45}"
      + ".api-promo-kicker{font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#e7c27a;margin:0 0 6px}"
      + ".api-promo a{display:inline-block;background:#f6f1e6;color:#2b2622;text-decoration:none;font-family:Inter,Arial,sans-serif;font-weight:800;font-size:14px;padding:8px 12px;border-radius:999px}"
      + ".post .api-thumb{border-radius:13px;overflow:hidden;background:#efe8da;min-height:120px}"
      + ".post .api-thumb img{width:100%;height:100%;object-fit:cover;aspect-ratio:1.618/1;display:block}"
      + ".api-share{appearance:none;font-family:var(--sans,Inter,Arial,sans-serif);font-size:13px;font-weight:800;color:var(--flame,#8a5a32);background:transparent;border:1px solid var(--line,#c4b39a);border-radius:999px;padding:7px 14px;margin-top:12px;cursor:pointer}"
      + ".api-share:hover{background:var(--wash,#f6f1e6)}"
      + "@media(max-width:600px){.api-promo{grid-template-columns:1fr}.api-promo-cover{width:100%;height:220px}}";
    document.head.appendChild(s);
  }

  function safeHttpUrl(value) {
    try {
      var u = new URL(String(value || "").trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.href;
    } catch (e) {
      return "";
    }
  }

  function imageList(it) {
    var urls = [];
    var source = it && Array.isArray(it.images) ? it.images : [];
    if (!source.length && it && it.image_url) source = [it.image_url];
    source.forEach(function (raw) {
      var href = safeHttpUrl(raw);
      if (href && urls.indexOf(href) === -1) urls.push(href);
    });
    return urls;
  }

  function appendImages(parent, it) {
    imageList(it).forEach(function (href) {
      var img = document.createElement("img");
      img.className = "api-photo";
      img.src = href;
      img.alt = "";
      img.loading = "lazy";
      parent.appendChild(img);
    });
  }

  function appendPromo(parent, promo) {
    if (!promo || typeof promo !== "object") return;
    var title = String(promo.title || "").trim();
    var text = String(promo.text || promo.description || "").trim();
    var url = safeHttpUrl(promo.url);
    var cover = safeHttpUrl(promo.cover_image || promo.image);
    if (!title && !text && !cover && !url) return;
    var card = el("aside", "api-promo");
    if (cover) {
      var img = document.createElement("img");
      img.src = cover;
      img.alt = "";
      img.className = "api-promo-cover";
      img.loading = "lazy";
      card.appendChild(img);
    }
    var copy = el("div");
    copy.appendChild(el("p", "api-promo-kicker", "From the shelf"));
    if (title) copy.appendChild(el("h4", null, title));
    if (text) copy.appendChild(el("p", null, text));
    if (url) {
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Read this book";
      copy.appendChild(a);
    }
    card.appendChild(copy);
    parent.appendChild(card);
  }

  function articleShareUrl(it) {
    var path = articleHref(it);
    if (!path) return "https://idluminescent.co.za/articles/";
    return "https://idluminescent.co.za" + path;
  }

  function noteAnchor(it) {
    var slug = String(it.slug || "").trim().toLowerCase();
    if (slug) return slug;
    if (it.id != null) return "note-" + String(it.id);
    return "";
  }

  function noteShareUrl(it) {
    var anchor = noteAnchor(it);
    return "https://idluminescent.co.za/notes/" + (anchor ? "#" + anchor : "");
  }

  function addShareButton(parent, it, url) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "api-share";
    btn.textContent = "Share";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var payload = {
        title: String(it.title || "ID Luminescent Publishing"),
        text: String(it.excerpt || it.title || "").trim(),
        url: url
      };
      if (navigator.share) {
        navigator.share(payload).catch(function (err) {
          if (err && err.name === "AbortError") return;
          copyShareLink(btn, url);
        });
        return;
      }
      copyShareLink(btn, url);
    });
    parent.appendChild(btn);
  }

  function copyShareLink(btn, url) {
    var done = function () {
      btn.textContent = "Link copied";
      setTimeout(function () { btn.textContent = "Share"; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () {
        window.prompt("Copy this link", url);
      });
      return;
    }
    window.prompt("Copy this link", url);
  }

  function focusSharedNote() {
    var hash = "";
    try { hash = decodeURIComponent((location.hash || "").replace(/^#/, "")); }
    catch (e) { hash = (location.hash || "").replace(/^#/, ""); }
    if (!hash) return;
    var node = document.getElementById(hash);
    if (node && node.scrollIntoView) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- notes ---------- */
  function renderNotes(box, items) {
    box.textContent = "";
    var head = el("p", "label", "More notes");
    box.appendChild(head);
    items.forEach(function (it) {
      var art = el("article", "api-note");
      var anchor = noteAnchor(it);
      if (anchor) art.id = anchor;
      art.appendChild(el("h3", null, it.title));
      var meta = metaLine(it);
      if (meta) art.appendChild(meta);
      appendImages(art, it);
      var excerpt = String(it.excerpt || "").trim();
      var content = String(it.content || "").trim();
      if (excerpt && !(content && content.indexOf(excerpt) === 0)) {
        art.appendChild(el("p", "api-excerpt", excerpt));
      }
      if (content) {
        var body = el("div", "api-text");
        linkify(body, content);
        art.appendChild(body);
      }
      addShareButton(art, it, noteShareUrl(it));
      box.appendChild(art);
    });
    focusSharedNote();
  }

  function initNotes(box) {
    setStatus(box, "Loading more notes…", false);
    fetchItems(ENDPOINTS.notes).catch(function (err) {
      var msg = String((err && (err.apiError || err.message)) || "").toLowerCase();
      if (err && (err.status === 404 || msg.indexOf("unknown") !== -1)) return fetchItems(API + "api/public/note");
      throw err;
    }).then(function (items) {
      var more = dedupe(items, "notes").sort(byNewest);
      if (!more.length) {
        setStatus(box, "No additional notes have been published yet. Check back soon.", false);
        return;
      }
      renderNotes(box, more);
    }).catch(function (err) {
      setStatus(box, friendlyApiError(err, "notes"), true);
    });
  }

  /* ---------- articles ---------- */
  function articleHref(it) {
    var slug = String(it.slug || "").trim();
    if (slug) return "/articles/read/?slug=" + encodeURIComponent(slug);
    if (it.id != null) return "/articles/read/?id=" + encodeURIComponent(String(it.id));
    return "";
  }

  function renderArticles(box, items) {
    box.textContent = "";
    var head = el("p", "label", "More articles");
    box.appendChild(head);
    items.forEach(function (it) {
      var href = articleHref(it);
      var card = el("div", "post");
      var left = el("div");
      if (href) {
        var titleLink = document.createElement("a");
        titleLink.href = href;
        titleLink.style.textDecoration = "none";
        titleLink.style.color = "inherit";
        titleLink.appendChild(el("h3", null, it.title));
        left.appendChild(titleLink);
      } else {
        left.appendChild(el("h3", null, it.title));
      }
      var ex = String(it.excerpt || "").trim();
      if (!ex && it.content) {
        ex = String(it.content).trim().replace(/\s+/g, " ");
        if (ex.length > 220) ex = ex.slice(0, 217).replace(/\s+\S*$/, "") + "…";
      }
      if (ex) left.appendChild(el("p", null, ex));
      var meta = metaLine(it);
      if (meta) left.appendChild(meta);
      addShareButton(left, it, articleShareUrl(it));
      card.appendChild(left);
      var pics = imageList(it);
      if (pics.length) {
        var thumb = el("div", "api-thumb");
        var img = document.createElement("img");
        img.src = pics[0];
        img.alt = "";
        img.loading = "lazy";
        thumb.appendChild(img);
        card.appendChild(thumb);
      }
      box.appendChild(card);
    });
  }

  function initArticles(box) {
    setStatus(box, "Loading more articles…", false);
    fetchItems(ENDPOINTS.articles).catch(function (err) {
      var msg = String((err && (err.apiError || err.message)) || "").toLowerCase();
      if (err && (err.status === 404 || msg.indexOf("unknown") !== -1)) return fetchItems(API + "api/public/article");
      throw err;
    }).then(function (items) {
      var more = dedupe(items, "articles").sort(byNewest);
      if (!more.length) {
        setStatus(box, "No additional articles have been published yet. Check back soon.", false);
        return;
      }
      renderArticles(box, more);
    }).catch(function (err) {
      setStatus(box, friendlyApiError(err, "articles"), true);
    });
  }

  /* ---------- single article reader ---------- */
  function initReader(box) {
    var q = new URLSearchParams(location.search);
    var slug = (q.get("slug") || "").toLowerCase(), id = q.get("id");
    setStatus(box, "Loading the article…", false);
    fetchItems(ENDPOINTS.articles).then(function (items) {
      var it = items.filter(function (x) {
        return (slug && String(x.slug || "").toLowerCase() === slug) || (id && String(x.id) === id);
      })[0];
      box.textContent = "";
      var back = el("a", "crumb", "← Articles");
      back.href = "/articles/";
      box.appendChild(back);
      if (!it) {
        box.appendChild(el("h1", null, "Article not found"));
        box.appendChild(el("p", "dek", "That article may have moved or is not published. Please return to the articles page."));
        return;
      }
      document.title = it.title + " — ID Luminescent Publishing";
      box.appendChild(el("h1", null, it.title));
      var ex = String(it.excerpt || "").trim();
      if (ex) box.appendChild(el("p", "dek", ex));
      var by = el("div", "byline");
      var img = document.createElement("img");
      img.src = "/brand/mark.jpg";
      img.alt = "";
      by.appendChild(img);
      var who = el("div");
      who.appendChild(el("b", null, "KC Chikolwa"));
      var d = fmtDate(it.created_at || it.published_at);
      if (d) who.appendChild(document.createTextNode(" · " + d));
      by.appendChild(who);
      box.appendChild(by);
      addShareButton(box, it, articleShareUrl(it));
      appendImages(box, it);
      var body = el("div", "api-text api-article");
      linkify(body, it.content || "");
      box.appendChild(body);
      appendPromo(box, it.book_promo);
    }).catch(function (err) {
      box.textContent = "";
      var back = el("a", "crumb", "← Articles");
      back.href = "/articles/";
      box.appendChild(back);
      box.appendChild(el("h1", null, "We could not load this article"));
      box.appendChild(el("p", "dek", friendlyApiError(err, "articles")));
    });
  }

  /* ---------- reflections (optional; only if a page requests it) ---------- */
  function renderReflections(box, items) {
    box.textContent = "";
    var head = el("p", "label", "Letters");
    box.appendChild(head);
    items.forEach(function (it) {
      var art = el("article", "api-note");
      art.appendChild(el("h3", null, it.title));
      var meta = metaLine(it);
      if (meta) art.appendChild(meta);
      appendImages(art, it);
      var content = String(it.content || it.excerpt || "").trim();
      if (content) {
        var body = el("div", "api-text");
        linkify(body, content);
        art.appendChild(body);
      }
      appendPromo(art, it.book_promo);
      box.appendChild(art);
    });
  }

  function initReflections(box) {
    setStatus(box, "Loading letters…", false);
    fetchItems(ENDPOINTS.reflections).catch(function (err) {
      var msg = String((err && (err.apiError || err.message)) || "").toLowerCase();
      if (err && (err.status === 404 || msg.indexOf("unknown") !== -1)) return fetchItems(ENDPOINTS.newsletter);
      throw err;
    }).then(function (items) {
      var more = dedupe(items, "reflections").sort(byNewest);
      if (!more.length) {
        setStatus(box, "No letters have been published yet. Check back soon.", false);
        return;
      }
      renderReflections(box, more);
    }).catch(function (err) {
      setStatus(box, friendlyApiError(err, "reflections"), true);
    });
  }

  var mode = window.API_MODE, box = document.getElementById("api-box");
  if (!box) return;
  ensureStyles();
  if (mode === "notes") initNotes(box);
  else if (mode === "articles") initArticles(box);
  else if (mode === "article") initReader(box);
  else if (mode === "reflections") initReflections(box);
})();
