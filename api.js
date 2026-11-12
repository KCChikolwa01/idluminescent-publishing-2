/* ID Luminescent Publishing: public API connection (notes, articles, newsletter letters).
   API base: https://api.idluminescent.co.za/
   Public endpoints:
     /api/public/notes
     /api/public/articles
     /api/public/reflections
     /api/public/newsletter   (same letters)
   Notes list shows title + excerpt only; full note opens at /notes/read/?slug=…
   Articles list opens at /articles/read/?slug=…
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
    s.textContent = ".api-photo{display:block;width:100%;height:auto;border-radius:13px;background:#efe8da}"
      + ".api-figure{margin:18px 0 22px}"
      + ".api-promo{display:grid;grid-template-columns:112px 1fr;gap:16px;align-items:center;margin-top:22px;padding:16px 18px;border-radius:18px;background:#3a332c;color:#f6f1e6}"
      + ".api-promo-cover{width:112px;height:168px;object-fit:cover;border-radius:8px;background:#efe8da}"
      + ".api-promo h4{font-size:22px;margin:0 0 6px;line-height:1.2;color:#f6f1e6}"
      + ".api-promo p{margin:0 0 10px;color:#f6f1e6;font-size:16px;line-height:1.45}"
      + ".api-promo-kicker{font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#e7c27a;margin:0 0 6px}"
      + ".api-promo a{display:inline-block;background:#f6f1e6;color:#2b2622;text-decoration:none;font-family:Inter,Arial,sans-serif;font-weight:800;font-size:14px;padding:8px 12px;border-radius:999px}"
      + ".post .api-thumb{border-radius:13px;overflow:hidden;background:#efe8da;min-height:120px;display:block;text-decoration:none}"
      + ".post .api-thumb img{width:100%;height:100%;object-fit:cover;aspect-ratio:1.618/1;display:block}"
      + ".api-share{appearance:none;font-family:var(--sans,Inter,Arial,sans-serif);font-size:13px;font-weight:800;color:var(--flame,#8a5a32);background:transparent;border:1px solid var(--line,#c4b39a);border-radius:999px;padding:7px 14px;margin-top:12px;cursor:pointer}"
      + ".api-share:hover{background:var(--wash,#f6f1e6)}"
      + ".post .btn{margin-top:10px}"
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
    placementList(it).forEach(function (pic) {
      parent.appendChild(makeFigure(pic));
    });
  }

  function splitParagraphs(text) {
    var raw = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!raw) return [];
    var blocks = raw.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (blocks.length > 1) return blocks;
    var lines = raw.split(/\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    return lines.length ? lines : blocks;
  }

  function placementList(it) {
    var list = [];
    var source = it && Array.isArray(it.placements) ? it.placements : [];
    source.forEach(function (item) {
      if (!item || typeof item !== "object") return;
      var href = safeHttpUrl(item.url);
      if (!href || list.some(function (pic) { return pic.url === href; })) return;
      var after = item.after === null || item.after === undefined || item.after === "" ? null : Number(item.after);
      list.push({
        url: href,
        alt: String(item.alt || "").slice(0, 180),
        after: isFinite(after) ? after : null
      });
    });
    if (!list.length) {
      imageList(it).forEach(function (href) {
        list.push({ url: href, alt: "", after: null });
      });
    }
    return list;
  }

  function makeFigure(pic) {
    var fig = el("figure", "api-figure");
    var img = document.createElement("img");
    img.className = "api-photo";
    img.src = pic.url;
    img.alt = pic.alt || "";
    img.loading = "lazy";
    fig.appendChild(img);
    return fig;
  }

  function appendPlaced(parent, content, placements) {
    var pics = placements || [];
    var positioned = pics.filter(function (pic) {
      return pic.after !== null && pic.after !== undefined && Number(pic.after) >= 1;
    });
    var loose = pics.filter(function (pic) { return positioned.indexOf(pic) === -1; });
    loose.forEach(function (pic) { parent.appendChild(makeFigure(pic)); });
    if (!positioned.length) {
      if (String(content || "").trim()) {
        var body = el("div", "api-text");
        linkify(body, content || "");
        parent.appendChild(body);
      }
      return;
    }
    var paras = splitParagraphs(content);
    if (!paras.length) {
      positioned.forEach(function (pic) { parent.appendChild(makeFigure(pic)); });
      return;
    }
    paras.forEach(function (text, i) {
      var p = el("p", "api-text");
      linkify(p, text);
      parent.appendChild(p);
      positioned.filter(function (pic) { return Number(pic.after) === i + 1; }).forEach(function (pic) {
        parent.appendChild(makeFigure(pic));
      });
    });
    positioned.filter(function (pic) { return Number(pic.after) > paras.length; }).forEach(function (pic) {
      parent.appendChild(makeFigure(pic));
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

  function shortExcerpt(it) {
    var ex = String(it.excerpt || "").trim();
    if (!ex && it.content) {
      ex = String(it.content).trim().replace(/\s+/g, " ");
      if (ex.length > 220) ex = ex.slice(0, 217).replace(/\s+\S*$/, "") + "…";
    }
    return ex;
  }

  function firstPicture(it) {
    var list = imageList(it);
    return list.length ? list[0] : "";
  }

  function pictureName(url, type) {
    var clean = String(url || "").split("?")[0];
    var name = clean.split("/").pop() || "picture";
    if (!/\.(png|jpe?g|webp|gif)$/i.test(name)) {
      name += type === "image/png" ? ".png" : ".jpg";
    }
    return name;
  }

  function loadPicture(url) {
    return fetch(url, { mode: "cors" }).then(function (res) {
      if (!res.ok) throw new Error("picture");
      return res.blob();
    }).then(function (blob) {
      var type = blob.type && blob.type.indexOf("image/") === 0 ? blob.type : "image/jpeg";
      if (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp" && type !== "image/gif") type = "image/jpeg";
      return new File([blob], pictureName(url, type), { type: type });
    });
  }

  function applyShareMeta(it) {
    try {
      var title = String(it.title || "ID Luminescent Publishing");
      var description = String(it.excerpt || it.title || "").trim();
      var picture = firstPicture(it);
      document.title = title + " — ID Luminescent Publishing";
      var pairs = [
        ["property", "og:title", title],
        ["property", "og:description", description],
        ["property", "og:url", location.href],
        ["name", "description", description]
      ];
      if (picture) {
        pairs.push(["property", "og:image", picture]);
        pairs.push(["name", "twitter:image", picture]);
      }
      pairs.forEach(function (pair) {
        if (!pair[2]) return;
        var node = document.querySelector('meta[' + pair[0] + '="' + pair[1] + '"]');
        if (!node) {
          node = document.createElement("meta");
          node.setAttribute(pair[0], pair[1]);
          document.head.appendChild(node);
        }
        node.setAttribute("content", pair[2]);
      });
    } catch (e) { /* ignore meta updates */ }
  }

  function addShareButton(parent, it, url) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "api-share";
    btn.textContent = "Share";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var picture = firstPicture(it);
      var payload = {
        title: String(it.title || "ID Luminescent Publishing"),
        text: String(it.excerpt || it.title || "").trim(),
        url: url
      };
      if (navigator.share && picture) {
        loadPicture(picture).then(function (file) {
          var withFile = {
            title: payload.title,
            text: payload.text,
            url: payload.url,
            files: [file]
          };
          if (navigator.canShare && !navigator.canShare(withFile)) throw new Error("no-file-share");
          return navigator.share(withFile);
        }).catch(function (err) {
          if (err && err.name === "AbortError") return;
          navigator.share(payload).catch(function (err2) {
            if (err2 && err2.name === "AbortError") return;
            copyShareLink(btn, url, picture);
          });
        });
        return;
      }
      if (navigator.share) {
        navigator.share(payload).catch(function (err) {
          if (err && err.name === "AbortError") return;
          copyShareLink(btn, url, picture);
        });
        return;
      }
      copyShareLink(btn, url, picture);
    });
    parent.appendChild(btn);
  }

  function copyShareLink(btn, url, picture) {
    var done = function (label) {
      btn.textContent = label || "Link copied";
      setTimeout(function () { btn.textContent = "Share"; }, 2000);
    };
    var writeText = function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done("Link copied"); }).catch(function () {
          window.prompt("Copy this link", url);
        });
        return;
      }
      window.prompt("Copy this link", url);
    };
    if (!(picture && navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)) {
      writeText();
      return;
    }
    loadPicture(picture).then(function (file) {
      var type = file.type === "image/png" ? "image/png" : "image/jpeg";
      var data = { "text/plain": new Blob([url], { type: "text/plain" }) };
      data[type] = file;
      return navigator.clipboard.write([new ClipboardItem(data)]);
    }).then(function () {
      done("Link and picture copied");
    }).catch(writeText);
  }

  /* ---------- notes: list = preview only; full text on /notes/read/ ---------- */
  function noteHref(it) {
    var slug = String(it.slug || "").trim();
    if (slug) return "/notes/read/?slug=" + encodeURIComponent(slug);
    if (it.id != null) return "/notes/read/?id=" + encodeURIComponent(String(it.id));
    return "";
  }

  function noteShareUrl(it) {
    var path = noteHref(it);
    if (!path) return "https://idluminescent.co.za/notes/";
    return "https://idluminescent.co.za" + path;
  }

  function renderNotes(box, items) {
    box.textContent = "";
    var head = el("p", "label", "More notes");
    box.appendChild(head);
    items.forEach(function (it) {
      var href = noteHref(it);
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
      var ex = shortExcerpt(it);
      if (ex) left.appendChild(el("p", null, ex));
      var meta = metaLine(it);
      if (meta) left.appendChild(meta);
      if (href) {
        var open = document.createElement("a");
        open.href = href;
        open.className = "btn btn-line btn-sm";
        open.textContent = "Read note";
        left.appendChild(open);
      }
      addShareButton(left, it, noteShareUrl(it));
      card.appendChild(left);
      var pics = imageList(it);
      if (pics.length) {
        var thumbWrap = document.createElement(href ? "a" : "div");
        if (href) thumbWrap.href = href;
        thumbWrap.className = "api-thumb";
        var img = document.createElement("img");
        img.src = pics[0];
        img.alt = "";
        img.loading = "lazy";
        thumbWrap.appendChild(img);
        card.appendChild(thumbWrap);
      }
      box.appendChild(card);
    });
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

  function findItem(items, slug, id) {
    var found = null;
    items.forEach(function (row) {
      if (found) return;
      if (slug && String(row.slug || "") === slug) found = row;
      else if (id && String(row.id) === String(id)) found = row;
    });
    return found;
  }

  function initNoteReader(box) {
    var params = new URLSearchParams(location.search || "");
    var slug = params.get("slug") || "";
    var id = params.get("id") || "";
    setStatus(box, "Loading the note…", false);
    fetchItems(ENDPOINTS.notes).then(function (items) {
      var it = findItem(items, slug, id);
      if (!it) throw new Error("Note not found");
      box.textContent = "";
      var back = el("a", "crumb", "← Notes");
      back.href = "/notes/";
      box.appendChild(back);
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
      addShareButton(box, it, noteShareUrl(it));
      appendPlaced(box, it.content || "", placementList(it));
      appendPromo(box, it.book_promo);
      applyShareMeta(it);
    }).catch(function (err) {
      box.textContent = "";
      var back = el("a", "crumb", "← Notes");
      back.href = "/notes/";
      box.appendChild(back);
      box.appendChild(el("h1", null, "We could not load this note"));
      box.appendChild(el("p", "dek", friendlyApiError(err, "notes")));
    });
  }

  /* ---------- articles ---------- */
  function articleHref(it) {
    var slug = String(it.slug || "").trim();
    if (slug) return "/articles/read/?slug=" + encodeURIComponent(slug);
    if (it.id != null) return "/articles/read/?id=" + encodeURIComponent(String(it.id));
    return "";
  }

  function articleShareUrl(it) {
    var path = articleHref(it);
    if (!path) return "https://idluminescent.co.za/articles/";
    return "https://idluminescent.co.za" + path;
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
      var ex = shortExcerpt(it);
      if (ex) left.appendChild(el("p", null, ex));
      var meta = metaLine(it);
      if (meta) left.appendChild(meta);
      if (href) {
        var open = document.createElement("a");
        open.href = href;
        open.className = "btn btn-line btn-sm";
        open.textContent = "Read article";
        left.appendChild(open);
      }
      addShareButton(left, it, articleShareUrl(it));
      card.appendChild(left);
      var pics = imageList(it);
      if (pics.length) {
        var thumbWrap = document.createElement(href ? "a" : "div");
        if (href) thumbWrap.href = href;
        thumbWrap.className = "api-thumb";
        var img = document.createElement("img");
        img.src = pics[0];
        img.alt = "";
        img.loading = "lazy";
        thumbWrap.appendChild(img);
        card.appendChild(thumbWrap);
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

  function initReader(box) {
    var params = new URLSearchParams(location.search || "");
    var slug = params.get("slug") || "";
    var id = params.get("id") || "";
    setStatus(box, "Loading the article…", false);
    fetchItems(ENDPOINTS.articles).then(function (items) {
      var it = findItem(items, slug, id);
      if (!it) throw new Error("Article not found");
      box.textContent = "";
      var back = el("a", "crumb", "← Articles");
      back.href = "/articles/";
      box.appendChild(back);
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
      appendPlaced(box, it.content || "", placementList(it).slice(0, 2));
      appendPromo(box, it.book_promo);
      applyShareMeta(it);
    }).catch(function (err) {
      box.textContent = "";
      var back = el("a", "crumb", "← Articles");
      back.href = "/articles/";
      box.appendChild(back);
      box.appendChild(el("h1", null, "We could not load this article"));
      box.appendChild(el("p", "dek", friendlyApiError(err, "articles")));
    });
  }

  /* ---------- reflections / newsletter letters ---------- */
  function letterShareUrl(it) {
    var slug = String(it.slug || "").trim();
    if (slug) return "https://idluminescent.co.za/newsletter/?slug=" + encodeURIComponent(slug);
    if (it.id != null) return "https://idluminescent.co.za/newsletter/?id=" + encodeURIComponent(String(it.id));
    return "https://idluminescent.co.za/newsletter/";
  }

  function renderReflections(box, items) {
    box.textContent = "";
    var head = el("p", "label", "Letters");
    box.appendChild(head);
    var params = new URLSearchParams(location.search || "");
    var wantedSlug = params.get("slug") || "";
    var wantedId = params.get("id") || "";
    items.forEach(function (it) {
      var art = el("article", "api-note");
      if ((wantedSlug && String(it.slug || "") === wantedSlug) || (wantedId && String(it.id) === wantedId)) {
        art.id = "shared-letter";
      }
      art.appendChild(el("h3", null, it.title));
      var meta = metaLine(it);
      if (meta) art.appendChild(meta);
      var letter = String(it.content || it.excerpt || "").trim();
      appendPlaced(art, letter, placementList(it).slice(0, 1));
      appendPromo(art, it.book_promo);
      addShareButton(art, it, letterShareUrl(it));
      box.appendChild(art);
    });
    var shared = document.getElementById("shared-letter");
    if (shared) {
      var match = items.filter(function (it) {
        return (wantedSlug && String(it.slug || "") === wantedSlug) || (wantedId && String(it.id) === wantedId);
      })[0];
      if (match) applyShareMeta(match);
      shared.scrollIntoView({ block: "start" });
    }
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
  else if (mode === "note") initNoteReader(box);
  else if (mode === "reflections") initReflections(box);
})();
