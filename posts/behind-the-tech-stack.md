---
title: "Behind the Tech Stack: Dynamic SEO in a Single Page App"
date: "2026-05-28"
category: "Technical"
author: "sarthak-ganguly"
description: "Building a Single Page Application (SPA) usually comes with a major SEO tradeoff. Crawlers often struggle with dynamically loaded content. Here is how we solved it in Frybahn."
---

Building a Single Page Application (SPA) usually comes with a major SEO tradeoff. Crawlers often struggle with dynamically loaded content, leading to poor page ranking. In building Frybahn's game details overlay, we wanted a seamless path-based router that feels like an instant navigation overlay but remains completely friendly to search engines.

We solved this by pairing Nginx's fallback directive (`try_files`) with a custom ES6 router. When a user or crawler accesses a path like `/game/pacman` directly, Nginx transparently serves our main shell, and our routing module updates the document title, meta descriptions, and Open Graph tags. Finally, we dynamically append a JSON-LD structured data block to the document head to ensure search engines recognize the software configuration. The result is a clean, instant transition for users and indexable structured pages for bots.
