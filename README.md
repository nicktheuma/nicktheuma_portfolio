# React + TypeScript + Vite

## Admin Editing Mode

The site now supports a code-gated admin mode for editing:

- global site settings (brand and footer text)
- homepage text and homepage theme colors
- per-project title, summary, body, category, tags, and project theme colors

How it works:

1. Start the app (`npm run dev`).
2. Press `Esc` on the keyboard to open the centered admin popup.
3. Enter the admin code and click **Unlock**.
4. Use the fixed admin controls on the right side of the screen.
  - Click an icon to expand/collapse its settings panel over the page content.
  - On project pages, drag media cards to reposition them and drag the corner handle to resize tiles.
  - Grid controls let you set columns, row size, and spacing separately for Home and each Project page.
  - Tile resizing now supports more varied and larger tile sizes.
  - Theme fields now include a visual color picker (gradient), raw value input, and an eyedropper button.
  - Use eyedropper to pick a color directly from any media visible on the page (browser support required).
5. Changes save automatically to browser `localStorage`.

Admin code:

- Set `VITE_ADMIN_CODE` in your environment to define your own code.
- If not set, fallback code is `NT_ADMIN_2026`.

Persistence after media imports:

- Media generation still writes to `src/content/generated-projects.ts`.
- Admin edits are stored separately and merged at runtime by project slug.
- Importing new media does not remove existing admin overrides.

## Cloudflare R2 media hosting (GitHub Pages alternative to LFS)

This repo now supports serving all `/media/...` assets from Cloudflare R2 while keeping the site itself on GitHub Pages.

### 1) Create and expose an R2 bucket

1. In Cloudflare, create an R2 bucket (example: `nicktheuma-media`).
2. Add a public domain for that bucket (preferred custom domain like `media.yourdomain.com`, or `*.r2.dev`).
3. Configure CORS for browser access from your site origins. Example:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://<your-gh-username>.github.io",
      "https://<your-custom-site-domain>"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

### Cloudflare account + domain setup (one-time)

If your domain is not yet on Cloudflare:

1. Add your domain to Cloudflare.
2. Update nameservers at your registrar to the two nameservers Cloudflare gives you.
3. Wait for status to become **Active**.

If your site uses a custom domain (instead of `username.github.io`):

1. In GitHub Pages settings, set your custom domain (example: `nicktheuma.com`).
2. In Cloudflare DNS, create records for GitHub Pages:
  - `A` records for apex (`@`) to GitHub Pages IPs
  - `CNAME` for `www` to `<your-gh-username>.github.io`
3. Enable SSL/TLS in Cloudflare (`Full` or `Full (strict)` preferred).

For media hosting on Cloudflare R2:

1. Create a subdomain for media (example: `media.nicktheuma.com`).
2. Bind that subdomain to your R2 bucket public endpoint in Cloudflare R2 settings.
3. Set `VITE_MEDIA_BASE_URL=https://media.nicktheuma.com`.

### 2) Create API credentials for syncing

Create an R2 API token with read/write permissions for your media bucket, then note:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

### 3) Configure local env

Copy `.env.example` to `.env.local` (and optionally `.env.production`) and fill values.

Important runtime value:

- `VITE_MEDIA_BASE_URL` should be the public media origin, for example `https://media.yourdomain.com`

When set, all generated `/media/...` URLs are automatically rewritten to that origin at runtime.

### 4) Upload media to R2

Install dependencies, then sync your local `public/media` folder:

```bash
npm install
npm run sync:r2
```

Your current folder structure is uploaded as-is, recursively, from `public/media`.
No manual restructuring is required. Example mappings:

- `public/media/projects/Carisma_Gems/to post/1.png` -> `r2://<bucket>/media/projects/Carisma_Gems/to post/1.png`
- `public/media/projects/SAW/toPost/video.mp4` -> `r2://<bucket>/media/projects/SAW/toPost/video.mp4`

So you can keep adding files directly to your existing project folders and run `npm run sync:r2`.

Optional behavior:

- `R2_BUCKET_PREFIX` defaults to `media`
- `R2_DELETE_MISSING=true` will delete remote files that do not exist locally

### 5) Build/deploy site to GitHub Pages

Before building for production, ensure `VITE_MEDIA_BASE_URL` is set in your production environment.
That keeps the website on GitHub Pages while all heavy assets load from R2.

### 6) Automate with GitHub Actions

This repo includes two workflows:

- [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml): builds and deploys GitHub Pages on push to `main`
- [`.github/workflows/sync-r2-media.yml`](.github/workflows/sync-r2-media.yml): syncs media to R2 only when files under `public/media/**` change

`deploy-pages.yml` ignores `public/media/**` changes, so media-only commits do not rebuild/redeploy the site.

Set these in your GitHub repo:

Secrets:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Variables:

- `VITE_MEDIA_BASE_URL` (example: `https://media.yourdomain.com`)
- `R2_BUCKET_PREFIX` (optional, default `media`)
- `R2_DELETE_MISSING` (optional, `true`/`false`)

Also make sure GitHub Pages is configured to use **GitHub Actions** as its source.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
