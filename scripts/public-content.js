'use strict';

const { full_url_for } = require('hexo-util');

const publicPosts = posts => posts.filter(post => !post.hidden);
const publicTerms = terms => terms.map(term => {
  const posts = publicPosts(term.posts);
  return { name: term.name, path: term.path, posts, length: posts.length };
}).filter(term => term.length);

hexo.extend.helper.register('public_posts', publicPosts);
hexo.extend.helper.register('public_terms', publicTerms);

// Filter before pagination, without removing directly accessible post pages.
let wrapped = false;
hexo.extend.filter.register('before_generate', function() {
  if (wrapped) return;
  wrapped = true;
  for (const name of ['index', 'archive', 'tag', 'category', 'atom', 'rss2']) {
    const generator = hexo.extend.generator.get(name);
    if (!generator) continue;
    hexo.extend.generator.register(name, function(locals) {
      return generator.call(this, {
        ...locals,
        posts: publicPosts(locals.posts),
        tags: publicTerms(locals.tags),
        categories: publicTerms(locals.categories)
      });
    });
  }
});

hexo.extend.generator.register('sitemap', function(locals) {
  const pages = [...publicPosts(locals.posts).toArray(), ...publicPosts(locals.pages).toArray()];
  const paths = ['', ...pages.map(page => page.path)];
  const urls = [...new Set(paths)].map(path => {
    const url = full_url_for.call(this, path.replace(/index\.html$/, ''));
    return `  <url><loc>${url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</loc></url>`;
  });
  return {
    path: 'sitemap.xml',
    data: '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n'
  };
});

hexo.extend.generator.register('robots', function() {
  return {
    path: 'robots.txt',
    data: `User-agent: *\nAllow: /\n\nSitemap: ${full_url_for.call(this, 'sitemap.xml')}\n`
  };
});
