# OFFSIDE – PlayStation shop manager (iOS + Android + Desktop)

An installable offline web app (PWA). No App Store / Google Play, no paid server, no build step.
All data stays on the device (localStorage, same schema as the old `offside.html`).

## Put it on your phones (one time, free)

The phone must open the app once from an **https** link to install it. Free static hosting is enough:

**GitHub Pages (free, permanent)**
1. Create a free GitHub account → New repository (e.g. `offside`) → upload everything inside this folder.
2. Repo **Settings → Pages → Branch: main / root → Save**.
3. Your link: `https://<username>.github.io/offside/`

(Alternative: drag this folder onto https://app.netlify.com/drop.)

**Install**
- **iPhone**: open the link in **Safari** → Share ⬆ → **Add to Home Screen**.
- **Android**: open in **Chrome** → ⋮ → **Install app** (or Settings screen → "تثبيت الآن").
- **Desktop**: open in Chrome/Edge → install icon in the address bar.

After that it opens full-screen like a native app and works with no internet.

## Move your old data
Old desktop file → Settings → backup → copy. New app → الإعدادات → 💾 → paste / import file.
Each device keeps its own data; use the backup file to move it between devices.

## Updating
Change files, bump `VERSION` in `sw.js`, re-upload. Phones get the update on the next open (online).

## Architecture (Clean Architecture, dependencies point inward)

```
src/
  core/           pure helpers & labels (no dependencies)
  domain/         business rules: pricing, period, inventory, cash, customers (pure functions)
  data/           persistence: defaults, migrations, LocalStorageRepository (+ auto snapshot)
  application/    Store (single commit/persist point) + use-case services (DI via createServices)
  presentation/   views per screen, dialogs, event delegation, 1-second partial-update ticker
  main.js         composition root
```

- `presentation` → `application` → `domain` → `core`; `data` is injected into the Store.
- No inline `onclick` / globals: all UI events go through `data-act` / `data-change` / `data-input`.
- Timers patch only the changing text every second instead of re-rendering the whole page.

Local test: `python -m http.server 8765` in this folder → http://localhost:8765
