// tailwind.config.ts
// ============================================================
// THE LONDON PROTOCOL — Design Tokens
// ============================================================

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'protocol-ink':          '#1a1a18',
        'protocol-muted':        '#5a5a56',
        'protocol-faint':        '#9a9a94',
        'protocol-cream':        '#f7f4ee',
        'protocol-cream-dark':   '#ede9e0',
        'protocol-gold':         '#b8860b',
        'protocol-gold-light':   '#f0e8c8',
        'protocol-teal':         '#1D9E75',
        'protocol-teal-light':   '#E1F5EE',
        'protocol-teal-dark':    '#0f6e56',
        'protocol-border':       'rgba(26,26,24,0.12)',
        'protocol-border-strong':'rgba(26,26,24,0.22)',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        mono:    ['DM Mono', 'monospace'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '3px',
      },
      keyframes: {
        cardIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        chipIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        cardIn: 'cardIn 0.3s ease forwards',
        chipIn: 'chipIn 0.2s ease forwards',
      },
    },
  },
  plugins: [],
}

export default config


// ── app/globals.css additions ─────────────────────────────────
/*
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

body {
  background-color: #f7f4ee;
  color: #1a1a18;
}
*/


// ── Usage in app/page.tsx ─────────────────────────────────────
/*
import { NLConcierge } from '@/components/concierge/NLConcierge'

export default function HomePage() {
  return (
    <main>
      <header className="bg-protocol-ink px-7 py-4 flex items-center gap-4">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/90">
          The London Protocol
        </span>
        <span className="w-1 h-1 rounded-full bg-protocol-teal" />
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-white/35">
          Zero-Commission Stays
        </span>
      </header>

      <div className="px-4 py-12 max-w-3xl mx-auto">
        <NLConcierge />
      </div>
    </main>
  )
}
*/
