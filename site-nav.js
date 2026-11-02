(function () {
  document.querySelectorAll('a[aria-label="ID Luminescent Publishing, home"]').forEach(function (a) {
    a.setAttribute('href', '/index.html');
  });
  document.querySelectorAll('a[href="/"]').forEach(function (a) {
    a.setAttribute('href', '/index.html');
  });
  document.querySelectorAll('header').forEach(function (header) {
    var button = header.querySelector('button[aria-controls="mobile-nav"]');
    var nav = header.querySelector('nav[aria-label="Primary"]');
    if (!button || !nav) return;
    var panel = header.querySelector('#mobile-nav');
    if (!panel) {
      panel = document.createElement('nav');
      panel.id = 'mobile-nav';
      panel.setAttribute('aria-label', 'Mobile');
      panel.className = 'lg:hidden border-t border-paper/15 px-5 py-3 bg-charcoal';
      panel.hidden = true;
      panel.innerHTML = '<div class="mx-auto grid max-w-6xl gap-1">' +
        '<a class="inline-flex min-h-11 items-center text-paper" href="/index.html">Home</a>' +
        '<a class="inline-flex min-h-11 items-center text-paper" href="/books">Books</a>' +
        '<a class="inline-flex min-h-11 items-center text-paper" href="/articles">Articles</a>' +
        '<a class="inline-flex min-h-11 items-center text-paper" href="/notes">Notes</a>' +
        '<a class="inline-flex min-h-11 items-center text-paper" href="/advertising">Advertising</a>' +
        '<a class="inline-flex min-h-11 items-center text-paper" href="/index.html#shop">Shop now</a></div>';
      header.appendChild(panel);
    }
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  });
})();