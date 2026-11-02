(async function () {
  try {
    const response = await fetch("/formats.json");
    if (!response.ok) return;
    const data = await response.json();
    document.querySelectorAll("[data-format]").forEach((node) => {
      const slug = node.getAttribute("data-book");
      const key = node.getAttribute("data-format");
      const url = data && data[slug] && data[slug][key];
      if (!url || !/^https?:\/\//i.test(url)) return;
      const status = node.querySelector("[data-format-status]");
      if (status) status.remove();
      if (node.tagName === "A") {
        node.setAttribute("href", url);
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener noreferrer";
      if (node.tagName === "LI") {
        link.className = "inline-flex min-h-11 items-center gap-2 text-sm text-ink hover:text-gold";
        while (node.firstChild) link.appendChild(node.firstChild);
        node.appendChild(link);
        return;
      }
      link.className = node.className;
      while (node.firstChild) link.appendChild(node.firstChild);
      node.replaceWith(link);
    });
  } catch {
    /* The page still shows the placeholder if this file cannot load. */
  }
})();
