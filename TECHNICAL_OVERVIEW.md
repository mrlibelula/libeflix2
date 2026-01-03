# Technical Overview

This repo is a Laravel 12 + Inertia React app built with PHP 8.2 and Vite. Below is a concise inventory of the stack, tooling, and scripts to feed into AI tooling for blog generation.

## Backend (composer.json)
- Core: PHP ^8.2, Laravel framework 12.*
- Inertia bridge: inertiajs/inertia-laravel ^2.0
- Payments: laravel/cashier ^15.7 (Stripe)
- Auth/OAuth: laravel/socialite ^5.21
- Permissions/RBAC: spatie/laravel-permission ^6.20
- OpenAI integration: openai-php/laravel ^0.11.0
- Routing helpers: tightenco/ziggy ^2.4
- CLI/dev tooling: laravel/tinker ^2.10.1

### Backend dev tooling
- Testing: phpunit ^11.5.3, pestphp/pest ^3.0, pestphp/pest-plugin-laravel ^3.0, mockery ^1.6
- Debug/logging: nunomaduro/collision ^8.6, laravel/pail ^1.2.2
- Formatting: laravel/pint ^1.18
- Local env: laravel/sail ^1.41
- Fixtures: fakerphp/faker ^1.23

### Composer scripts
- post-create: key generation, sqlite bootstrap, migrations
- post-update: publish laravel assets (forced)
- dev (concurrently): `php artisan serve`, `php artisan queue:listen --tries=1`, `npm run dev`
- dev:ssr (concurrently): adds `php artisan pail --timeout=0` and `php artisan inertia:start-ssr`

### Autoload
- PSR-4 roots: `App\` (app/), `Database\Factories\`, `Database\Seeders\`

## Frontend (package.json)
- Framework: React ^19, React DOM ^19, TypeScript ^5.7.2
- Bundler/dev server: Vite ^6.0, @vitejs/plugin-react ^4.3.4, laravel-vite-plugin ^1.0
- Styling: Tailwind CSS ^4.0.0, tailwindcss-animate ^1.0.7, tailwind-merge ^3.0.1, @tailwindcss/vite ^4.0.6
- UI kits: @headlessui/react ^2.2.0, Radix UI primitives (avatar/checkbox/collapsible/dialog/dropdown-menu/label/navigation-menu/select/separator/slot/tabs/toggle/toggle-group/tooltip)
- Themes: next-themes ^0.4.6
- Icons: lucide-react ^0.475.0
- HTTP: axios ^1.13.2
- Forms/utilities: class-variance-authority ^0.7.1, clsx ^2.1.1
- Charts: apexcharts ^5.3.6, react-apexcharts ^1.8.0
- Media/UI extras: embla-carousel-react ^8.5.2 + autoplay, react-lazy-load-image-component ^1.6.3, react-window ^1.8.11, sonner ^2.0.1
- Payments: @stripe/react-stripe-js ^3.7.0, @stripe/stripe-js ^7.3.1

### Frontend dev tooling
- Linting: eslint ^9.17.0, @eslint/js ^9.19.0, eslint-plugin-react ^7.37.3, eslint-plugin-react-hooks ^5.1.0, typescript-eslint ^8.23.0
- Formatting: prettier ^3.4.2 with plugins (organize-imports, tailwindcss)
- Types: @types/node ^22.13.5, @types/react ^19.0.3, @types/react-dom ^19.0.2

### Optional native binaries
- @rollup/rollup-linux-x64-gnu 4.9.5
- @tailwindcss/oxide-linux-x64-gnu ^4.0.1
- lightningcss-linux-x64-gnu ^1.29.1

### NPM scripts
- `dev`: Vite dev server
- `build`: clean then `vite build`
- `build:ssr`: clean, client build, then SSR build
- `clean`: delete `public/hot` (Windows-friendly)
- `format` / `format:check`: Prettier on `resources/`
- `lint`: `eslint . --fix`
- `types`: `tsc --noEmit`

## Runtime shape
- Full-stack delivery via Inertia: Laravel renders + React front-end with shared routing (Ziggy) and Vite bundling.
- Payments via Cashier/Stripe; OAuth via Socialite; permissions via Spatie.
- Background/SSR support: queue listener in dev script, optional Inertia SSR start command.
- AI hooks available through openai-php/laravel.

Use this file as a structured prompt source for AI to draft a blog post about how the app was built and the stack choices involved.
