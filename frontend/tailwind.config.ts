import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        gold: {
          50: "var(--gold-50, #FEF7E6)",
          100: "var(--gold-100, #FCEBC2)",
          200: "var(--gold-200, #FADC8C)",
          300: "var(--gold-300, #F0C75E)",
          400: "var(--gold-400, #E0B042)",
          500: "var(--gold-500, #C9A030)",
          600: "var(--gold-600, #B0892A)",
          700: "var(--gold-700, #8B6B1F)",
          800: "var(--gold-800, #5E4A12)",
          900: "var(--gold-900, #312608)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["CS Avva Shenouda", "Georgia", "serif"],
        arabic: ["Noto Sans Arabic", "Inter", "sans-serif"],
        coptic: ["CS Avva Shenouda", "Noto Sans Coptic", "Antinoou", "serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      transitionTimingFunction: {
        'out-strong': 'var(--ease-out)',
        'in-out-strong': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addVariant }: { addVariant: (name: string, generator: string) => void }) {
      addVariant("rtl", '[dir="rtl"] &')
      addVariant("ltr", '[dir="ltr"] &')
    },
  ],
} satisfies Config

export default config
