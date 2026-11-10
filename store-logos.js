/* Store name badges for the shop. These are original name plates, not the stores' trademark artwork. */
(function () {
  "use strict";
  if (document.getElementById("store-logo-style")) return;

  var style = document.createElement("style");
  style.id = "store-logo-style";
  style.textContent = ""
    + ".store-logo{height:28px;width:auto;display:block;flex:none}"
    + ".shelf-head .label,.kobo-band .kicker{display:flex;align-items:center;gap:10px}"
    + ".buy .row>div{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center}"
    + ".buy .row .store-logo{grid-row:1 / span 2;height:32px}"
    + ".btn .store-logo{height:18px}"
    + ".btn{display:inline-flex;align-items:center;justify-content:center;gap:8px}";
  document.head.appendChild(style);

  function plate(label, bg, fg) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 132 28");
    svg.setAttribute("class", "store-logo");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
    var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "132");
    rect.setAttribute("height", "28");
    rect.setAttribute("rx", "6");
    rect.setAttribute("fill", bg);
    var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "66");
    text.setAttribute("y", "18.5");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", fg);
    text.setAttribute("font-family", "Arial, Helvetica, sans-serif");
    text.setAttribute("font-size", label.length > 12 ? "11" : "13");
    text.setAttribute("font-weight", "700");
    text.textContent = label;
    svg.appendChild(rect);
    svg.appendChild(text);
    return svg;
  }

  var plates = {
    amazon: function () { return plate("amazon", "#232f3e", "#ffffff"); },
    kindle: function () { return plate("kindle", "#232f3e", "#ff9900"); },
    kobo: function () { return plate("kobo", "#111111", "#ffffff"); },
    apple: function () { return plate("Apple Books", "#000000", "#ffffff"); },
    eleven: function () { return plate("ElevenReader", "#111111", "#ffffff"); }
  };

  function kindFromText(text) {
    var value = String(text || "");
    if (/apple books/i.test(value)) return "apple";
    if (/kobo/i.test(value)) return "kobo";
    if (/eleven/i.test(value)) return "eleven";
    if (/kindle/i.test(value)) return "kindle";
    if (/amazon|paperback|in print/i.test(value)) return "amazon";
    return "";
  }

  function add(parent, kind, before) {
    if (!parent || !plates[kind] || parent.querySelector(".store-logo")) return;
    var node = plates[kind]();
    if (before) parent.insertBefore(node, before);
    else parent.appendChild(node);
  }

  document.querySelectorAll(".buy .row").forEach(function (row) {
    var label = row.querySelector("span");
    var box = row.querySelector("div");
    add(box, kindFromText(label ? label.textContent : row.textContent), box && box.firstChild);
  });

  document.querySelectorAll("section.shelf, .kobo-band").forEach(function (section) {
    var heading = section.querySelector(".label, .kicker");
    var kind = kindFromText((section.id || "") + " " + (heading ? heading.textContent : ""));
    if (heading) add(heading, kind, heading.firstChild);
    if (!kind) return;
    section.querySelectorAll("a.btn[href^='http']").forEach(function (button) {
      add(button, kind, button.firstChild);
    });
  });
})();
