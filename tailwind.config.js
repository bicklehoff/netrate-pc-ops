/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Design System (locked April 2026) ───────────────────────
        // brand  = primary interactive accent (blue #0071CE)
        // accent = CTA / highlight accent (yellow #FFC220)
        // ink    = primary text / dark fill (#1A1F2E)
        // surface / surface-alt = cards / subtle panels
        brand: {
          DEFAULT: '#2E6BA8',
          dark:    '#24578C',
          light:   '#E6EEF7',
        },
        // "go" — primary forward-motion CTA (Apply Now, Submit, See My Rate, Send, etc.)
        go: {
          DEFAULT: '#059669',
          dark:    '#047857',
          light:   '#D1FAE5',
        },
        // yellow accent — highlights, "Live Rates" chip, featured-row tag
        // Not used for primary CTAs anymore — that's "go" green.
        accent: {
          DEFAULT: '#FFC220',
          dark:    '#FFD04A',
          light:   'rgba(255,194,32,0.10)',
        },
        ink: {
          DEFAULT: '#1A1F2E',
          mid:     '#4A5C6E',
          subtle:  '#7A8E9E',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt:     '#F5F4F1',
          page:    '#FAFAF7',
        },
        // Legacy tokens kept for components not yet migrated.
        // Mapped to new-system equivalents so unmigrated code still renders coherently.
        deep: '#1A1F2E',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        // Design system radius scale — additive, does not clobber Tailwind defaults
        'nr-xs': '2px',
        'nr-sm': '4px',
        'nr-md': '6px',
        'nr-lg': '8px',
        'nr-xl': '12px',
      },
      boxShadow: {
        'nr-sm': '0 1px 3px rgba(26,31,46,0.05)',
        'nr-md': '0 1px 6px rgba(26,31,46,0.07), 0 2px 12px rgba(26,31,46,0.05)',
        'nr-lg': '0 2px 8px rgba(26,31,46,0.08), 0 4px 24px rgba(26,31,46,0.06)',
      },
    },
  },
  plugins: [],
};
