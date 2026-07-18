import type { Config } from 'tailwindcss'

// Tailwind CSS v4 is configured primarily via `@import "tailwindcss"` in
// app/globals.css (see the `@theme` block there). This file is kept for
// editor/tooling support and to declare content globs explicitly.
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
}

export default config
