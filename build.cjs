/* Builds plain, independently addressable HTML. No packages or server required. */
const fs = require('node:fs');
const path = require('node:path');
const { createView, openStays, escape } = require('./app.js');

function documentFor(stay) {
  const root = stay ? '../' : '';
  const view = createView('en', root);
  const title = stay ? `${view.local(stay.name)} — Serenity Stay` : view.t('title');
  const description = stay ? view.local(stay.description) : view.t('meta');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(description)}">
  <meta name="theme-color" content="#282e29">
  <title>${escape(title)}</title>
  <link rel="icon" type="image/png" href="${root}assets/logo-wood.png">
  <link rel="stylesheet" href="${root}styles.css?v=4">
  <script src="${root}content.js?v=4" defer></script>
  <script src="${root}app.js?v=4" defer></script>
</head>
<body data-page="${stay ? stay.id : 'home'}" data-root="${root}">
  <a class="skip-link" href="#main">${view.t('skip')}</a>
  <main id="main" tabindex="-1">${stay ? view.detail(stay) : view.home()}</main>
  <div id="footer">${view.footer()}</div>
</body>
</html>
`;
}

fs.mkdirSync(path.join(__dirname, 'stays'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'index.html'), documentFor(null));
for (const stay of openStays) fs.writeFileSync(path.join(__dirname, 'stays', `${stay.id}.html`), documentFor(stay));
console.log(`Built index.html and ${openStays.length} independent accommodation pages.`);
