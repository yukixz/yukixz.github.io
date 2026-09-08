'use strict';

const MarkdownIt = require('markdown-it');
const { slugize } = require('hexo-util');

const parser = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
  quotes: '“”‘’'
});

// Preserve automatic bare-domain links from the previous renderer.
parser.linkify.set({ fuzzyLink: true, fuzzyEmail: true });

// Keep existing heading URLs, including duplicate-heading suffixes.
parser.core.ruler.push('heading_ids', state => {
  const counts = new Map();
  for (let index = 0; index < state.tokens.length; index++) {
    const token = state.tokens[index];
    if (token.type !== 'heading_open' || Number(token.tag.slice(1)) < 2) continue;
    const title = state.tokens[index + 1].children.map(child => child.content).join('');
    const slug = slugize(title, { transform: 0, separator: '-' });
    const count = (counts.get(slug) || 0) + 1;
    counts.set(slug, count);
    token.attrSet('id', count === 1 ? slug : `${slug}-${count}`);
  }
});

function render(data, options) {
  return options && options.inline
    ? parser.renderInline(data.text)
    : parser.render(data.text);
}

for (const extension of ['md', 'markdown', 'mkd', 'mkdn', 'mdwn', 'mdtxt', 'mdtext']) {
  hexo.extend.renderer.register(extension, 'html', render, true);
}
