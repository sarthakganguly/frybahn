# 🎮 GameVault — Browser Gaming Portal

A lightweight, PlayStation-style browser gaming portal. No login required. Runs entirely as a static site via nginx in Docker.

---

## ⚡ Quick Start

### Docker Compose (recommended)

```bash
# Start (builds automatically on first run)
docker compose up -d

# Open in browser
open http://localhost:90

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Docker CLI (alternative)

```bash
# Build
docker build -t game-portal .

# Run
docker run -p 90:90 game-portal

# Run detached
docker run -d -p 90:90 --name gamevault game-portal
```

---

## 📁 Project Structure

```
game-portal/
├── index.html              # Main SPA shell
├── styles/
│   ├── main.css            # Core UI styles + design tokens
│   └── animations.css      # All keyframes + entrance animations
├── scripts/
│   ├── app.js              # Entry point, overlay + search wiring
│   ├── state.js            # Reactive state store (pub/sub)
│   ├── gameLoader.js       # Loads games.json, filter/sort logic
│   ├── router.js           # Lightweight hash-based SPA router
│   ├── ui.js               # Card/grid rendering + keyboard nav
│   └── utils.js            # Shared helpers (debounce, DOM, etc.)
├── data/
│   └── games.json          # Game catalogue — the single source of truth
├── games/
│   ├── pacman/             # Pac-Man clone (vanilla JS + Canvas)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── tetris/             # Tetris clone (vanilla JS + Canvas)
│       ├── index.html
│       ├── style.css
│       └── script.js
├── assets/
│   ├── images/             # Game thumbnails (optional — emoji used as fallback)
│   └── icons/              # Favicon, PWA icons
├── docker/
│   └── nginx.conf          # Custom nginx config with gzip + caching
├── Dockerfile
└── README.md
```

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
  "description": "A short description shown on the card.",
  "players": 1000,
  "rating": 4.5,
  "badge": "new",
  "path": "/games/mygame/index.html",
  "isPlayable": true,
  "license": "MIT"
}
```

**Field reference:**

| Field        | Type    | Notes                                              |
|--------------|---------|----------------------------------------------------|
| `id`         | string  | Any unique identifier (UUID recommended)           |
| `title`      | string  | Display name                                       |
| `slug`       | string  | Matches the folder name in `/games/`               |
| `category`   | string  | Groups games into rows: `arcade`, `puzzle`, etc.   |
| `thumbnail`  | string  | Path to image, or `""` to use emoji fallback       |
| `emoji`      | string  | Shown when no thumbnail is provided                |
| `description`| string  | Shown in future detail view                        |
| `players`    | number  | Player count (display only)                        |
| `rating`     | number  | 0–5, one decimal place                             |
| `badge`      | string  | `"new"` \| `"trending"` \| `"popular"` \| `""`    |
| `path`       | string  | Absolute path to the game's `index.html`           |
| `isPlayable` | boolean | Set to `false` to show as "coming soon"            |
| `license`    | string  | For attribution                                    |

### Step 3 — Rebuild Docker

```bash
docker build -t game-portal . && docker run -p 90:90 game-portal
```

That's it. The new game appears automatically in the correct category row.

---

## 🎮 Controls

### Portal Navigation
| Key              | Action                    |
|------------------|---------------------------|
| `← →`            | Navigate cards in a row   |
| `↑ ↓`            | Jump between category rows |
| `Enter`          | Launch focused game       |
| `Esc`            | Close game overlay        |
| `/`              | Focus search bar          |

### In-Game (Pac-Man)
| Key              | Action     |
|------------------|------------|
| `Arrow keys`     | Move       |
| `W A S D`        | Move       |
| `Space`          | Start/retry|
| Swipe            | Mobile move|

### In-Game (Tetris)
| Key              | Action       |
|------------------|--------------|
| `← →`            | Move piece   |
| `↑`              | Rotate       |
| `↓`              | Soft drop    |
| `Space`          | Hard drop    |
| `P`              | Pause        |
| Tap              | Rotate (mobile) |
| Swipe ← →        | Move (mobile)   |
| Swipe ↓          | Hard drop (mobile) |

---

## 💰 Ad Placements

The portal has three ad slots, ready to swap in your ad network tags:

| Location            | Selector              | Size          |
|---------------------|-----------------------|---------------|
| Global top banner   | `.ad-banner`          | 728×90 leaderboard |
| Game overlay top    | `.overlay-ad-top`     | 728×90 leaderboard |
| Game overlay bottom | `.overlay-ad-bottom`  | Text / 320×50 mobile |

Replace the placeholder content inside each element with your ad network embed code.

---

## 🐳 Docker Details

- **Base image:** `nginx:1.25-alpine` (~25 MB)
- **Port:** `90`
- **Gzip:** enabled for JS, CSS, JSON, fonts, SVG
- **Caching:** 1 year for static assets, no-cache for HTML
- **Health check:** `wget` ping every 30s
- **Restart policy:** `unless-stopped` (survives reboots)

### Compose commands

```bash
docker compose up -d          # Start detached
docker compose down           # Stop and remove container
docker compose logs -f        # Stream logs
docker compose restart        # Restart container
docker compose up -d --build  # Rebuild after changes
```

### CLI commands

```bash
docker run -d -p 90:90 --name gamevault game-portal   # Run detached
docker logs -f gamevault                               # Stream logs
docker stop gamevault                                  # Stop
docker rm gamevault                                    # Remove
```

---

## 🏗️ Architecture Notes

- **No build step.** The project uses ES6 modules loaded directly by the browser. No bundler, no transpiler.
- **State management** is a tiny pub/sub store (`state.js`). All modules subscribe to keys they care about.
- **Game loading** is fully data-driven. The UI reads `games.json` at startup and renders everything from that data.
- **Keyboard navigation** mirrors PlayStation/Xbox console UIs: arrow keys move focus between cards; rows are navigated vertically.
- **The game overlay** uses a sandboxed `<iframe sandbox="allow-scripts allow-same-origin">` to isolate game code from the portal.

---

## 📄 License

MIT — free to use, modify, and distribute.
