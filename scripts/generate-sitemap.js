const fs = require('fs');
const path = require('path');

// Resolve file paths relative to script location
const gamesJsonPath = path.resolve(__dirname, '../data/games.json');
const sitemapXmlPath = path.resolve(__dirname, '../sitemap.xml');

// Load games dataset
let games = [];
try {
  const fileContent = fs.readFileSync(gamesJsonPath, 'utf8');
  games = JSON.parse(fileContent);
} catch (err) {
  console.error('Error loading games.json:', err);
  process.exit(1);
}

// Current date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0];

// Portal baseline URL
const BASE_URL = 'https://frybahn.com';

// Define core pages matching the URL rules (no extension)
const corePages = [
  { route: '', priority: '1.0', changefreq: 'daily' },
  { route: '/about', priority: '0.8' },
  { route: '/faq', priority: '0.8' },
  { route: '/developers', priority: '0.8' },
  { route: '/privacy', priority: '0.5' },
  { route: '/blog', priority: '0.8' }
];

// Define standard catalog category endpoints
const categories = ['arcade', 'puzzle', 'action', 'racing', 'strategy'];

// Begin sitemap XML schema construction
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

// 1. Core pages node list
xml += '  <!-- Core Pages -->\n';
for (const page of corePages) {
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}${page.route}</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  if (page.changefreq) {
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
  }
  xml += `    <priority>${page.priority}</priority>\n`;
  xml += '  </url>\n';
}

// 2. Category endpoints node list
xml += '\n  <!-- Categories -->\n';
for (const cat of categories) {
  xml += `  <url><loc>${BASE_URL}/category/${cat}</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>\n`;
}

// 3. Dynamic game-details deep link endpoints node list
xml += '\n  <!-- Games -->\n';
for (const game of games) {
  if (game.isPlayable && game.slug) {
    xml += `  <url><loc>${BASE_URL}/game/${game.slug}</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>\n`;
  }
}

// 4. Dynamic blog post deep link endpoints node list
const blogPostsDir = path.resolve(__dirname, '../blog/posts');
if (fs.existsSync(blogPostsDir)) {
  const posts = fs.readdirSync(blogPostsDir).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5));
  if (posts.length > 0) {
    xml += '\n  <!-- Blog Posts -->\n';
    for (const post of posts) {
      xml += `  <url><loc>${BASE_URL}/blog/posts/${post}</loc><lastmod>${today}</lastmod><priority>0.6</priority></url>\n`;
    }
  }
}

// 5. Dynamic author profile endpoints node list
const authorDir = path.resolve(__dirname, '../author');
if (fs.existsSync(authorDir)) {
  const authorsList = fs.readdirSync(authorDir).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5));
  if (authorsList.length > 0) {
    xml += '\n  <!-- Author Profiles -->\n';
    for (const author of authorsList) {
      xml += `  <url><loc>${BASE_URL}/author/${author}</loc><lastmod>${today}</lastmod><priority>0.5</priority></url>\n`;
    }
  }
}

xml += '</urlset>\n';

// Write target build output
try {
  fs.writeFileSync(sitemapXmlPath, xml, 'utf8');
  console.log(`Sitemap generated successfully at ${sitemapXmlPath} with ${games.length} games.`);
} catch (err) {
  console.error('Error writing sitemap.xml:', err);
  process.exit(1);
}
