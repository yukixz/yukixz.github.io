# Dazzy Ding's blog

A Hexo site published at https://blog.0u0.moe.

## Development

Use Node.js 24 (see `.nvmrc`), then run:

```sh
npm ci
npm test
npm run build
npm run server
```

`npm run build` removes stale output before generating `public/`. Dependencies
are installed from `package-lock.json`. Commands use the site timezone
(`Asia/Hong_Kong`) so date parsing is consistent between local and CI builds. Tests build an isolated fixture site to
check archive ranges, ordering, pagination, hidden content, and metadata.

Markdown is rendered directly with `markdown-it` in `scripts/markdown.js`.
The adapter preserves heading IDs, hard line breaks, raw HTML, and automatic
links without depending on the legacy Hexo renderer's private parser APIs.
Tests also cover Markdown output and Mermaid code blocks. Mermaid and Tachyons
CDN versions are pinned in the site configuration and theme respectively.
The Stylus override keeps the compiler current until `hexo-renderer-stylus`
updates its dependency range; remove it when the plugin supports Stylus 0.64+.

## Publishing

Push source changes to the `source` branch. GitHub Actions runs tests, builds the
site, uploads `public/`, and deploys it using the GitHub Pages environment.
Pull requests run validation without deploying. The workflow can also be run
manually from the Actions tab. The repository Pages publishing source must be
set to **GitHub Actions**; its custom domain remains `blog.0u0.moe`.

The `master` branch contains historical generated output and is no longer used
for publishing. No deployment SSH key or force push is needed.

## Content conventions

- Set `lang: en` for English content; the default is `zh-CN`.
- Set `hidden: true` to keep a post accessible by direct URL while excluding it
  from home, archives, tags, categories, recent posts, feeds, and the sitemap.
  Tags/categories containing only hidden posts are omitted. Hidden pages receive
  `noindex, follow`; hiding is not access control and does not remove manual links.
- Set `updated` explicitly when revising content. Otherwise the publication date
  is used, so fresh CI checkouts do not mark every RSS entry as updated.
- Optional `description` overrides the excerpt/content fallback for search and
  social metadata. Optional `share_cover` supplies an image URL for sharing.
- `sitemap.xml` lists the homepage and public posts/pages. Aliases and archive
  pagination are omitted; canonical URLs use the configured site domain.
- Copyright uses the build year. A manual workflow run refreshes it when needed.
