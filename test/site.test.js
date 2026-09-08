'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Hexo = require('hexo');

const root = path.resolve(__dirname, '..');

test('generated pages respect visibility, archive ranges, pagination and metadata', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-test-'));
  const hexo = new Hexo(base, { silent: true });
  try {
    for (const file of ['package.json', '_config.yml', 'themes', 'scripts']) {
      fs.cpSync(path.join(root, file), path.join(base, file), { recursive: true });
    }
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(base, 'node_modules'), 'dir');
    fs.mkdirSync(path.join(base, 'source/_posts'), { recursive: true });
    fs.mkdirSync(path.join(base, 'source/tags'), { recursive: true });
    fs.mkdirSync(path.join(base, 'source/categories'), { recursive: true });
    fs.mkdirSync(path.join(base, 'source/about'), { recursive: true });
    fs.writeFileSync(path.join(base, 'source/tags/index.md'), '---\ntitle: Tags\ntype: tags\n---\n');
    fs.writeFileSync(path.join(base, 'source/categories/index.md'), '---\ntitle: Categories\ntype: categories\n---\n');
    fs.writeFileSync(path.join(base, 'source/about/index.md'), '---\ntitle: About\nlang: en\n---\nAbout this blog.');
    const fixtures = [
      ['old', '2016-03-01', false],
      ['middle', '2019-04-01', false],
      ['new', '2019-04-02', false],
      ['hidden-mixed', '2019-04-03', true],
      ['hidden-only', '2020-01-01', true]
    ];
    for (const [slug, date, hidden] of fixtures) {
      const term = slug === 'hidden-only' ? 'Private' : 'Shared';
      fs.writeFileSync(path.join(base, `source/_posts/${slug}.md`),
        `---\ntitle: ${slug}\ndate: ${date}\nhidden: ${hidden}\ntags: [${term}]\ncategories: [${term}]\n` +
        (slug === 'new' ? 'description: \'A "quoted" & useful description\'\nshare_cover: /cover.png\n' : '') +
        '---\nArticle content.\n\n' +
        (slug === 'new' ? [
          '## Stable Heading', '## Stable Heading', '## 中文标题',
          'First line\nSecond line',
          'Visit example.com or https://example.org.',
          '![An image](/cover.png)',
          '<span class="raw-html">Raw HTML</span>',
          '| Name | Value |\n| --- | --- |\n| Test | 1 |',
          '```js\nconst answer = 42;\n```',
          '```mermaid\ngraph LR\nA[Start] --> B[End]\n```'
        ].join('\n\n') : ''));
    }
    await hexo.init();
    hexo.config.index_generator.per_page = 2;
    for (const type of ['archive', 'tag', 'category']) hexo.config[`${type}_generator`].per_page = 2;
    await hexo.call('generate');
    const output = path.join(base, 'public');
    const read = file => fs.readFileSync(path.join(output, file), 'utf8');
    const absent = file => assert(!fs.existsSync(path.join(output, file)), file);
    const links = file => [...read(file).matchAll(/<a[^>]+href="\/(old|middle|new|hidden-mixed|hidden-only)\/"/g)].map(match => match[1]);

    for (const file of ['index.html', 'archives/index.html', 'tags/Shared/index.html', 'categories/Shared/index.html']) {
      assert.deepEqual(links(file), ['new', 'middle'], file);
      assert.match(read(file), /page\/2\//);
    }
    for (const file of ['page/2/index.html', 'archives/page/2/index.html', 'tags/Shared/page/2/index.html', 'categories/Shared/page/2/index.html']) {
      assert.deepEqual(links(file), ['old'], file);
    }
    assert.deepEqual(links('archives/2016/index.html'), ['old']);
    assert.deepEqual(links('archives/2016/03/index.html'), ['old']);
    assert.deepEqual(links('archives/2019/index.html'), ['new', 'middle']);
    assert.deepEqual(links('archives/2019/04/index.html'), ['new', 'middle']);
    for (const file of ['page/3/index.html', 'archives/page/3/index.html', 'archives/2020/index.html', 'tags/Private/index.html', 'categories/Private/index.html']) absent(file);

    for (const file of fs.readdirSync(output, { recursive: true }).filter(file => file.endsWith('.html'))) {
      const html = read(file);
      assert(!html.includes('href="/hidden-mixed/"') && !html.includes('href="/hidden-only/"'), file);
      assert(!html.includes('href="/tags/Private/"') && !html.includes('href="/categories/Private/"'), file);
      assert.match(html, /© \d{4} Dazzy Ding\./);
      assert.match(html, /<link rel="canonical" href="https:\/\/blog\.0u0\.moe\//);
      assert.match(html, /<meta name="description" content="[^"]+">/);
    }
    assert.match(read('hidden-mixed/index.html'), /name="robots" content="noindex, follow"/);
    assert.match(read('hidden-only/index.html'), /Article content/);
    for (const file of ['atom.xml', 'sitemap.xml']) {
      assert(!read(file).includes('hidden-'), file);
      for (const slug of ['old', 'middle', 'new']) assert(read(file).includes(`https://blog.0u0.moe/${slug}/`), file);
    }
    assert.match(read('atom.xml'), /<updated>2019-04-01T16:00:00\.000Z<\/updated>/);
    assert.match(read('robots.txt'), /Sitemap: https:\/\/blog\.0u0\.moe\/sitemap.xml/);
    assert.match(read('about/index.html'), /<html lang="en">/);
    assert.match(read('new/index.html'), /<html lang="zh-CN">/);
    for (const file of ['index.html', 'about/index.html', 'tags/index.html']) {
      assert.match(read(file), /property="og:type" content="website"/);
    }
    const article = read('new/index.html');
    assert.match(article, /<h2 id="Stable-Heading">Stable Heading<\/h2>/);
    assert.match(article, /<h2 id="Stable-Heading-2">Stable Heading<\/h2>/);
    assert.match(article, /<h2 id="中文标题">中文标题<\/h2>/);
    assert.match(article, /First line<br>\nSecond line/);
    assert.match(article, /href="http:\/\/example.com"/);
    assert.match(article, /href="https:\/\/example.org"/);
    assert.match(article, /<img src="\/cover.png" alt="An image">/);
    assert.match(article, /<span class="raw-html">Raw HTML<\/span>/);
    assert.match(article, /<table>/);
    assert.match(article, /answer/);
    assert.match(article, /<pre class="mermaid">graph LR\nA\[Start\] --> B\[End\]<\/pre>/);
    assert.match(article, /property="og:type" content="article"/);
    assert.match(article, /name="description" content="A &#34;quoted&#34; &amp; useful description"/);
    assert.match(article, /property="og:image" content="https:\/\/blog\.0u0\.moe\/cover.png"/);
    assert.match(read('page/2/index.html'), /rel="canonical" href="https:\/\/blog\.0u0\.moe\/page\/2\/"/);
  } finally {
    await hexo.exit();
    fs.rmSync(base, { recursive: true, force: true });
  }
});
