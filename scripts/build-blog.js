const fs = require('fs');
const path = require('path');

// Constants
const POSTS_PER_PAGE = 20;
const BASE_URL = 'https://frybahn.com';

// Paths
const postsDir = path.resolve(__dirname, '../posts');
const dataDir = path.resolve(__dirname, '../data');
const templatesDir = path.resolve(__dirname, '../templates');
const blogPostsOutputDir = path.resolve(__dirname, '../blog/posts');
const authorOutputDir = path.resolve(__dirname, '../author');
const blogIndexOutputFile = path.resolve(__dirname, '../blog/index.html');

// Create output directories
fs.mkdirSync(blogPostsOutputDir, { recursive: true });
fs.mkdirSync(authorOutputDir, { recursive: true });
fs.mkdirSync(path.resolve(__dirname, '../blog/page'), { recursive: true });

// Load authors dataset
let authors = {};
try {
  authors = JSON.parse(fs.readFileSync(path.join(dataDir, 'authors.json'), 'utf8'));
} catch (err) {
  console.error('Failed to load authors.json:', err);
}

// -------------------------------------------------------------
// Markdown Parser
// -------------------------------------------------------------

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseInline(text) {
  let escaped = escapeHtml(text);
  // Bold: **text**
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline Code: `code`
  escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');
  // Links: [text](url) -> URL might contain & which gets escaped to &amp;, but that's fine.
  // We need to parse links correctly: match standard markdown link format
  escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  return escaped;
}

function convertMarkdownToHtml(md) {
  const normalized = md.replace(/\r\n/g, '\n').trim();
  const blocks = normalized.split(/\n\n+/);
  let html = [];
  let inList = false;
  let listItems = [];

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    // Check list context transition
    const isListItem = block.startsWith('- ') || block.startsWith('* ');
    if (inList && !isListItem) {
      html.push(`<ul>${listItems.join('')}</ul>`);
      listItems = [];
      inList = false;
    }

    // Code block
    if (block.startsWith('```')) {
      const lines = block.split('\n');
      const code = lines.slice(1, lines.length - (lines[lines.length - 1] === '```' ? 1 : 0)).join('\n');
      html.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      continue;
    }

    // Headers
    if (block.startsWith('# ')) {
      html.push(`<h1>${parseInline(block.slice(2))}</h1>`);
    } else if (block.startsWith('## ')) {
      html.push(`<h2>${parseInline(block.slice(3))}</h2>`);
    } else if (block.startsWith('### ')) {
      html.push(`<h3>${parseInline(block.slice(4))}</h3>`);
    }
    // Lists
    else if (isListItem) {
      inList = true;
      const lines = block.split('\n');
      for (const line of lines) {
        const itemText = line.replace(/^[-*]\s+/, '');
        listItems.push(`<li>${parseInline(itemText)}</li>`);
      }
    }
    // Standard Paragraph
    else {
      html.push(`<p>${parseInline(block)}</p>`);
    }
  }

  // Flush remaining list items
  if (inList && listItems.length > 0) {
    html.push(`<ul>${listItems.join('')}</ul>`);
  }

  return html.join('\n');
}

// -------------------------------------------------------------
// Parsing YAML Frontmatter
// -------------------------------------------------------------

function parsePostFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatterRegex = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    console.warn(`Warning: Post ${filePath} lacks valid frontmatter.`);
    return null;
  }

  const yamlLines = match[1].split('\n');
  const body = match[2];
  const metadata = {};

  for (const line of yamlLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    // Strip surrounding quotes if any
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    metadata[key] = value;
  }

  const slug = path.basename(filePath, '.md');
  return {
    slug,
    metadata,
    body,
    html: convertMarkdownToHtml(body)
  };
}

// -------------------------------------------------------------
// Read all posts
// -------------------------------------------------------------

if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

const postFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
const posts = [];

for (const file of postFiles) {
  const parsed = parsePostFile(path.join(postsDir, file));
  if (parsed) {
    posts.push(parsed);
  }
}

// Sort posts chronologically (ascending) for next/prev calculations
posts.sort((a, b) => new Date(a.metadata.date) - new Date(b.metadata.date));

// -------------------------------------------------------------
// Build individual post pages
// -------------------------------------------------------------

const postTemplate = fs.readFileSync(path.join(templatesDir, 'blog-post-template.html'), 'utf8');

posts.forEach((post, index) => {
  const authorSlug = post.metadata.author;
  const author = authors[authorSlug] || {
    name: "Frybahn Editor",
    slug: "editor",
    avatar: "👾",
    bio: "Frybahn editorial team member delivering retro-gaming and technology engineering content.",
    role: "Editor"
  };

  // Compile Navigation Links
  const prevPost = index > 0 ? posts[index - 1] : null;
  const nextPost = index < posts.length - 1 ? posts[index + 1] : null;

  const prevLink = prevPost
    ? `<a href="/blog/posts/${prevPost.slug}" class="back-home" style="margin-bottom: 0;">← ${escapeHtml(prevPost.metadata.title)}</a>`
    : '';
  const nextLink = nextPost
    ? `<a href="/blog/posts/${nextPost.slug}" class="back-home" style="margin-bottom: 0; float: right;">${escapeHtml(nextPost.metadata.title)} →</a>`
    : '';

  // JSON-LD Structured Data Schema
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.metadata.title,
    "description": post.metadata.description,
    "datePublished": post.metadata.date,
    "author": {
      "@type": "Person",
      "name": author.name,
      "url": `${BASE_URL}/author/${author.slug}`
    },
    "publisher": {
      "@type": "Organization",
      "name": "Frybahn",
      "logo": {
        "@type": "ImageObject",
        "url": `${BASE_URL}/data/icon.svg`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/posts/${post.slug}`
    }
  };

  // Compile individual post output HTML
  let htmlOutput = postTemplate
    .replace(/{{TITLE}}/g, escapeHtml(post.metadata.title))
    .replace(/{{DESCRIPTION}}/g, escapeHtml(post.metadata.description))
    .replace(/{{SLUG}}/g, escapeHtml(post.slug))
    .replace(/{{CATEGORY}}/g, escapeHtml(post.metadata.category))
    .replace(/{{DATE}}/g, escapeHtml(post.metadata.date))
    .replace(/{{{CONTENT}}}/g, post.html)
    .replace(/{{AUTHOR_SLUG}}/g, escapeHtml(author.slug))
    .replace(/{{AUTHOR_NAME}}/g, escapeHtml(author.name))
    .replace(/{{AUTHOR_AVATAR}}/g, escapeHtml(author.avatar))
    .replace(/{{AUTHOR_BIO}}/g, escapeHtml(author.bio))
    .replace(/{{{PREV_POST_LINK}}}/g, prevLink)
    .replace(/{{{NEXT_POST_LINK}}}/g, nextLink)
    .replace(/{{{SCHEMA_JSON}}}/g, JSON.stringify(schema));

  fs.writeFileSync(path.join(blogPostsOutputDir, `${post.slug}.html`), htmlOutput, 'utf8');
  console.log(`Compiled blog post: /blog/posts/${post.slug}`);
});

// -------------------------------------------------------------
// Build Author Pages
// -------------------------------------------------------------

const authorTemplate = fs.readFileSync(path.join(templatesDir, 'author-template.html'), 'utf8');

Object.values(authors).forEach(author => {
  const authorPosts = posts.filter(p => p.metadata.author === author.slug);
  
  // Sort author posts descending (newest first)
  authorPosts.sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date));

  // Build posts list markup
  const postsListMarkup = authorPosts.map(p => `
    <article class="blog-post-item">
      <div class="post-meta">${p.metadata.date} · ${p.metadata.category}</div>
      <h3><a href="/blog/posts/${p.slug}">${escapeHtml(p.metadata.title)}</a></h3>
      <p class="post-summary">${escapeHtml(p.metadata.description)}</p>
    </article>
  `).join('\n');

  // Build social links markup
  const socialLinksMarkup = Object.entries(author.socials || {}).map(([platform, url]) => {
    return `<a href="${url}" target="_blank" rel="noopener">${platform.toUpperCase()}</a>`;
  }).join(' · ');

  // ProfilePage schema
  const schema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": author.name,
      "jobTitle": author.role,
      "description": author.bio,
      "url": `${BASE_URL}/author/${author.slug}`
    }
  };

  const htmlOutput = authorTemplate
    .replace(/{{AUTHOR_NAME}}/g, escapeHtml(author.name))
    .replace(/{{AUTHOR_ROLE}}/g, escapeHtml(author.role))
    .replace(/{{AUTHOR_BIO}}/g, escapeHtml(author.bio))
    .replace(/{{AUTHOR_AVATAR}}/g, escapeHtml(author.avatar))
    .replace(/{{AUTHOR_SLUG}}/g, escapeHtml(author.slug))
    .replace(/{{{AUTHOR_SOCIAL_LINKS}}}/g, socialLinksMarkup)
    .replace(/{{{POSTS_LIST}}}/g, postsListMarkup)
    .replace(/{{{SCHEMA_JSON}}}/g, JSON.stringify(schema));

  fs.writeFileSync(path.join(authorOutputDir, `${author.slug}.html`), htmlOutput, 'utf8');
  console.log(`Compiled author profile: /author/${author.slug}`);
});

// -------------------------------------------------------------
// Build Blog Index Pages (Paginated blog.html)
// -------------------------------------------------------------

// Sort posts descending for listings (newest first)
const listingPosts = [...posts].sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date));
const totalPages = Math.max(1, Math.ceil(listingPosts.length / POSTS_PER_PAGE));

for (let i = 1; i <= totalPages; i++) {
  const startIndex = (i - 1) * POSTS_PER_PAGE;
  const pagePosts = listingPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);

  // Compute rel link relation tags for pagination
  let paginationHeaderTags = '';
  if (i > 1) {
    const prevUrl = i === 2 ? '/blog' : `/blog/page/${i - 1}`;
    paginationHeaderTags += `  <link rel="prev" href="${BASE_URL}${prevUrl}" />\n`;
  }
  if (i < totalPages) {
    paginationHeaderTags += `  <link rel="next" href="${BASE_URL}/blog/page/${i + 1}" />\n`;
  }

  // Generate cards
  const postsCardsMarkup = pagePosts.map(p => {
    const author = authors[p.metadata.author] || { name: "Frybahn Editor", slug: "editor" };
    return `
      <article class="blog-post">
        <div class="post-meta">${p.metadata.date} · ${p.metadata.category}</div>
        <h2><a href="/blog/posts/${p.slug}" style="color: var(--text-primary); text-decoration: none; transition: color var(--transition-fast);">${escapeHtml(p.metadata.title)}</a></h2>
        <div class="post-content">
          <p>${escapeHtml(p.metadata.description)}</p>
          <p style="margin-top: 16px; font-size: 14px; font-weight: 600; color: var(--accent-blue);">
            By <a href="/author/${author.slug}" style="color: var(--accent-blue); text-decoration: none; border-bottom: 1px dashed rgba(64,156,255,0.4);">${escapeHtml(author.name)}</a>
          </p>
        </div>
      </article>
    `;
  }).join('\n');

  // Pagination navigation block
  let paginationMarkup = '';
  if (totalPages > 1) {
    paginationMarkup = '<div class="blog-pagination" style="display:flex; justify-content:center; gap:16px; margin-top:40px; font-family:var(--font-display);">';
    if (i > 1) {
      const prevUrl = i === 2 ? '/blog' : `/blog/page/${i - 1}`;
      paginationMarkup += `<a href="${prevUrl}" style="color:var(--accent-blue); text-decoration:none; font-weight:600;">← Previous Page</a>`;
    }
    paginationMarkup += `<span style="color:var(--text-secondary);">Page ${i} of ${totalPages}</span>`;
    if (i < totalPages) {
      paginationMarkup += `<a href="/blog/page/${i + 1}" style="color:var(--accent-blue); text-decoration:none; font-weight:600;">Next Page →</a>`;
    }
    paginationMarkup += '</div>';
  }

  // Master shell for blog index (based on the original structure)
  const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Developer Blog — Page ${i} — Frybahn</title>
  <meta name="description" content="Read our developer blog detailing our thoughts on Unity WebGL alternatives, lightweight browser gaming, and coding constraints. Page ${i}." />
  <link rel="canonical" href="https://frybahn.com/blog${i === 1 ? '' : `/page/${i}`}" />
${paginationHeaderTags}

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://frybahn.com/blog${i === 1 ? '' : `/page/${i}`}" />
  <meta property="og:title" content="Developer Blog — Page ${i} — Frybahn" />
  <meta property="og:description" content="Read our developer blog detailing our thoughts on lightweight browser gaming and dynamic SEO." />
  <meta property="og:image" content="https://frybahn.com/data/icon.svg" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Developer Blog — Page ${i} — Frybahn" />
  <meta name="twitter:description" content="Read our developer blog detailing our thoughts on lightweight browser gaming." />
  <meta name="twitter:image" content="https://frybahn.com/data/icon.svg" />

  <!-- Icons -->
  <link rel="icon" type="image/svg+xml" href="/data/icon.svg" />
  <link rel="apple-touch-icon" href="/data/icon.svg" />

  <link rel="stylesheet" href="/styles/main.css" />
  <style>
    .static-page { padding: 80px 32px; max-width: 800px; margin: 0 auto; }
    .static-page h1 { font-family: var(--font-display); font-size: 42px; margin-bottom: 40px; background: linear-gradient(90deg, var(--accent-blue), var(--accent-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    
    .back-home { display: inline-flex; align-items: center; margin-bottom: 40px; color: var(--accent-blue); text-decoration: none; font-family: var(--font-display); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; transition: color var(--transition-fast), transform var(--transition-fast); }
    .back-home:hover { color: var(--accent-cyan); transform: translateX(-4px); }

    .blog-post { margin-bottom: 56px; background: var(--glass); padding: 32px; border-radius: var(--radius-md); border: 1px solid var(--glass-border); transition: transform var(--transition-fast), border-color var(--transition-fast); }
    .blog-post:hover { border-color: var(--accent-blue); transform: translateY(-2px); }
    .post-meta { font-family: var(--font-display); font-size: 13px; font-weight: 600; color: var(--accent-pink); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .blog-post h2 { font-family: var(--font-display); font-size: 28px; color: var(--text-primary); margin-bottom: 16px; font-weight: 600; }
    .post-content { color: var(--text-secondary); line-height: 1.8; font-size: 15.5px; }
    .post-content p { margin-bottom: 16px; }
    .post-content p:last-child { margin-bottom: 0; }
    .post-content strong { color: var(--text-primary); }
    
    .blog-pagination a { transition: color var(--transition-fast); }
    .blog-pagination a:hover { color: var(--accent-cyan) !important; }
  </style>

  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2987113216122318"
     crossorigin="anonymous"></script>
</head>
<body>
  <div class="static-page">
    <a href="/" class="back-home">← Back to Games</a>
    <h1>Developer Blog</h1>
    
    <div class="blog-posts-list">
      ${postsCardsMarkup}
    </div>

    ${paginationMarkup}
  </div>

  <!-- ── FOOTER ── -->
  <footer class="site-footer" role="contentinfo">
    <div class="footer-container">
      
      <div class="footer-brand-wrap">
        <div class="footer-logo-box">
          <img src="/data/icon.svg" alt="Frybahn Logo" class="footer-icon">
          <span class="footer-name">Frybahn</span>
        </div>
        <div class="footer-socials">
          <a href="#" class="social-link" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c.796 0 1.441.645 1.441 1.44s-.645 1.44-1.441 1.44-1.44-.645-1.44-1.44.645-1.44 1.441-1.44z"/></svg>
          </a>
          <a href="https://www.facebook.com/thecodepost" class="social-link" aria-label="Facebook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
          </a>
          <a href="https://x.com/thecodepost" class="social-link" aria-label="Twitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
          </a>
        </div>
      </div>

      <div class="footer-nav-groups">
        <div class="footer-nav-group">
          <h4>Game Lists</h4>
          <ul>
            <li><a href="/category/action">Action Games</a></li>
            <li><a href="/category/arcade">Arcade Games</a></li>
            <li><a href="/category/puzzle">Puzzle Games</a></li>
            <li><a href="/category/racing">Racing Games</a></li>
            <li><a href="/category/strategy">Strategy Games</a></li>
          </ul>
        </div>
        <div class="footer-nav-group">
          <h4>Pages</h4>
          <ul>
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/about">About us</a></li>
            <li><a href="/developers">Developers</a></li>
            <li><a href="/privacy">Privacy Center</a></li>
            <li><a href="/blog">Dev Blog</a></li>
          </ul>
        </div>
      </div>

    </div>
    <div class="footer-bottom">
      <span>© 2026 Frybahn — All rights reserved. By <a href="https://thecodepost.org/" target="_blank" rel="noopener">The Code Post</a>.</span>
    </div>
  </footer>
</body>
</html>`;

  if (i === 1) {
    fs.writeFileSync(blogIndexOutputFile, indexHtmlContent, 'utf8');
    console.log(`Compiled main blog index page at ${blogIndexOutputFile}`);
  } else {
    fs.writeFileSync(path.resolve(__dirname, `../blog/page/${i}.html`), indexHtmlContent, 'utf8');
    console.log(`Compiled paginated blog page ${i} at /blog/page/${i}.html`);
  }
}

// -------------------------------------------------------------
// Auto-Sync Noscript Fallback List in index.html
// -------------------------------------------------------------

function syncIndexNoscriptFallback() {
  const gamesJsonPath = path.resolve(__dirname, '../data/games.json');
  const indexHtmlPath = path.resolve(__dirname, '../index.html');
  
  if (!fs.existsSync(gamesJsonPath) || !fs.existsSync(indexHtmlPath)) return;
  
  const games = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
  
  const categoryLabels = {
    arcade: "Arcade Games",
    puzzle: "Puzzle Games",
    racing: "Racing Games",
    action: "Action Games",
    strategy: "Strategy Games"
  };
  
  const grouped = {};
  for (const game of games) {
    const cat = game.category || 'arcade';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(game);
  }
  
  let noscriptHtml = '        <noscript>\n';
  noscriptHtml += '          <div class="noscript-fallback">\n';
  noscriptHtml += '            <h2>All Available Games (No-JS Fallback List)</h2>\n';
  
  const categoriesOrder = ['arcade', 'puzzle', 'racing', 'action', 'strategy'];
  for (const cat of categoriesOrder) {
    const catGames = grouped[cat] || [];
    if (catGames.length === 0) continue;
    
    const label = categoryLabels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1) + " Games");
    noscriptHtml += `            <h3>${label}</h3>\n`;
    noscriptHtml += '            <ul>\n';
    for (const game of catGames) {
      noscriptHtml += `              <li><a href="/game/${game.slug}">${game.emoji} ${game.title}</a></li>\n`;
    }
    noscriptHtml += '            </ul>\n';
  }
  
  noscriptHtml += '          </div>\n';
  noscriptHtml += '        </noscript>';
  
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const noscriptRegex = /<noscript>[\s\S]*?<\/noscript>/;
  if (noscriptRegex.test(indexHtml)) {
    indexHtml = indexHtml.replace(noscriptRegex, noscriptHtml);
    fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
    console.log('Successfully auto-synchronized games <noscript> fallback in index.html');
  } else {
    console.warn('Warning: Could not find <noscript> block in index.html to sync.');
  }
}

// Run sync
syncIndexNoscriptFallback();

console.log('Blog compilation build completed successfully!');
