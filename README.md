# 🎮 Frybahn — Browser Gaming Portal

A lightweight, PlayStation-style browser gaming portal. No login required. Runs entirely as a static site via nginx in Docker. Features a smooth intermediate detail view, dynamic SEO, and responsive design.

---

## ⚡ Quick Start

### Docker Compose (recommended)

```bash
# Start (builds automatically on first run)
docker compose up -d --build

# Open in browser
open http://localhost:90

# View logs
docker compose logs -f

# Stop
docker compose down
```

---

## 📁 Project Structure

```
frybahn/
├── index.html              # Main SPA shell (Grid + Hero + Info)
├── about.html              # Static 'About Us' page
├── faq.html               # Static 'FAQ' page with FAQPage schema
├── developers.html        # Static 'For Developers' page
├── privacy.html           # Static 'Privacy Center' page (AdSense compliant)
├── robots.txt             # Search engine crawler instructions
├── sitemap.xml            # Search engine site map
├── posts/                  # Source blog posts in raw Markdown format
├── templates/              # Blog post and author profile master templates
├── styles/
│   ├── main.css            # Core UI styles + design tokens + detail view
│   └── animations.css      # All keyframes + entrance animations
├── scripts/
│   ├── app.js              # Entry point, overlay + routing coordination
│   ├── state.js            # Reactive state store (pub/sub)
│   ├── gameLoader.js       # Loads games.json, filter/sort logic
│   ├── router.js           # History API path-based clean router
│   ├── ui.js               # Card/grid rendering + keyboard nav + detail populate
│   ├── utils.js            # Shared helpers (changeTagName, stripHtml, etc.)
│   ├── build-blog.js       # Blog compiler: markdown parsing, E-E-A-T builder
│   └── generate-sitemap.js # Sitemap generator: dynamic compilation
├── data/
│   ├── games.json          # Game catalogue — the single source of truth
│   ├── authors.json        # E-E-A-T author profile database
│   └── icon.svg            # Brand logo
├── games/
│   └── ...                 # Sandboxed game directories
├── docker/
│   └── nginx.conf          # Custom nginx config with gzip + caching + SPA fallback
├── Dockerfile              # Multi-stage compilation and deploy configurations
└── README.md
```

---

## ✨ Key Features

- **Game Detail View:** An intermediate informational layer showing description, license, and source links before launching the game.
- **Dynamic SEO:** Page titles, meta descriptions, and social tags (OG/Twitter) update automatically when viewing game details.
- **Console-style UX:** Full keyboard navigation support (`arrows`, `Enter`, `Esc`, `/`).
- **SEO Optimized:** Semantic HTML, sitemaps, robots.txt, and JSON-LD structured data.
- **Zero-Code Scaling:** Add new games by simply updating a JSON file and adding a folder.

---

## ➕ How to Add a New Game

Adding a game requires **zero code changes** to the portal itself.

### Step 1 — Create the game folder

```
games/
└── mygame/
    ├── index.html    ← must be self-contained
    ├── style.css
    └── script.js
```

The `index.html` must be fully self-contained (no server-side dependencies). The portal loads it inside a sandboxed `<iframe>`.

### Step 2 — Add an entry to `data/games.json`

```json
{
  "id": "unique-uuid-here",
  "title": "My Awesome Game",
  "slug": "mygame",
  "category": "arcade",
  "thumbnail": "",
  "emoji": "🚀",
  "description": "A detailed description shown in the intermediate view.",
  "players": 1000,
  "rating": 4.5,
  "badge": "new",
  "path": "/games/mygame/index.html",
  "source": "https://github.com/user/mygame",
  "isPlayable": true,
  "license": "MIT"
}
```

### Step 3 — Rebuild Docker

```bash
docker compose up -d --build
```

---

## 🎮 Controls

### Portal Navigation
| Key              | Action                    |
|------------------|---------------------------|
| `← →`            | Navigate cards in a row   |
| `↑ ↓`            | Jump between category rows |
| `Enter`          | Open game details / Launch |
| `Esc`            | Close overlay (Back)      |
| `/`              | Focus search bar          |

---

## 🐳 Docker Details

- **Compilation Pipeline:** Uses Stage 1 builder (`node:20-alpine`) to automate blog builds, fallback checklists auto-syncing, and sitemap generation dynamically on container launch.
- **Serving Layer:** Uses Stage 2 runner (`nginx:1.25-alpine`) to host compiled static assets.
- **Port:** `90`
- **Gzip:** enabled for JS, CSS, JSON, fonts, SVG
- **SPA Fallback:** Nginx handles `try_files` to ensure static directories (like `/blog` or `/author`) and client-side SPA paths resolve together.
- **Health check:** `wget` ping every 30s

---

## 🏗️ Architecture Notes

- **Static Build step:** Compiles markdown files and templates to physical files on Docker creation or deploy commands, preserving zero-backend serving constraints.
- **Routing:** History API clean-url routing (`/game/:slug`, `/play/:slug`, `/category/:cat`) for SPA states, backed by Nginx fallbacks.
- **State management:** Pub/sub store (`state.js`) for reactive UI updates.
- **Isolation:** Game overlays use `<iframe sandbox="allow-scripts allow-same-origin">`.

---

## 📄 License

MIT — free to use, modify, and distribute.
