import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          400: "#697383",
        },
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
          50: "rgb(var(--gold-50) / <alpha-value>)",
          100: "rgb(var(--gold-100) / <alpha-value>)",
          200: "rgb(var(--gold-200) / <alpha-value>)",
          300: "rgb(var(--gold-300) / <alpha-value>)",
          400: "rgb(var(--gold-400) / <alpha-value>)",
          500: "rgb(var(--gold-500) / <alpha-value>)",
          600: "rgb(var(--gold-600) / <alpha-value>)",
          700: "rgb(var(--gold-700) / <alpha-value>)",
          800: "rgb(var(--gold-800) / <alpha-value>)",
          900: "rgb(var(--gold-900) / <alpha-value>)",
        },
        burgundy: {
          50: "rgb(var(--burgundy-50) / <alpha-value>)",
          100: "rgb(var(--burgundy-100) / <alpha-value>)",
          200: "rgb(var(--burgundy-200) / <alpha-value>)",
          300: "rgb(var(--burgundy-300) / <alpha-value>)",
          400: "rgb(var(--burgundy-400) / <alpha-value>)",
          500: "rgb(var(--burgundy-500) / <alpha-value>)",
          600: "rgb(var(--burgundy-600) / <alpha-value>)",
          700: "rgb(var(--burgundy-700) / <alpha-value>)",
          800: "rgb(var(--burgundy-800) / <alpha-value>)",
          900: "rgb(var(--burgundy-900) / <alpha-value>)",
        },
        success: {
          50: "rgb(var(--success-50) / <alpha-value>)",
          100: "rgb(var(--success-100) / <alpha-value>)",
          200: "rgb(var(--success-200) / <alpha-value>)",
          300: "rgb(var(--success-300) / <alpha-value>)",
          400: "rgb(var(--success-400) / <alpha-value>)",
          500: "rgb(var(--success-500) / <alpha-value>)",
          600: "rgb(var(--success-600) / <alpha-value>)",
          700: "rgb(var(--success-700) / <alpha-value>)",
          800: "rgb(var(--success-800) / <alpha-value>)",
          900: "rgb(var(--success-900) / <alpha-value>)",
        },
        warning: {
          50: "rgb(var(--warning-50) / <alpha-value>)",
          100: "rgb(var(--warning-100) / <alpha-value>)",
          200: "rgb(var(--warning-200) / <alpha-value>)",
          300: "rgb(var(--warning-300) / <alpha-value>)",
          400: "rgb(var(--warning-400) / <alpha-value>)",
          500: "rgb(var(--warning-500) / <alpha-value>)",
          600: "rgb(var(--warning-600) / <alpha-value>)",
          700: "rgb(var(--warning-700) / <alpha-value>)",
          800: "rgb(var(--warning-800) / <alpha-value>)",
          900: "rgb(var(--warning-900) / <alpha-value>)",
        },
        critical: {
          50: "rgb(var(--critical-50) / <alpha-value>)",
          100: "rgb(var(--critical-100) / <alpha-value>)",
          200: "rgb(var(--critical-200) / <alpha-value>)",
          300: "rgb(var(--critical-300) / <alpha-value>)",
          400: "rgb(var(--critical-400) / <alpha-value>)",
          500: "rgb(var(--critical-500) / <alpha-value>)",
          600: "rgb(var(--critical-600) / <alpha-value>)",
          700: "rgb(var(--critical-700) / <alpha-value>)",
          800: "rgb(var(--critical-800) / <alpha-value>)",
          900: "rgb(var(--critical-900) / <alpha-value>)",
        },
        semantic: {
          "gender-male": "hsl(var(--semantic-gender-male-text))",
          "gender-male-bg": "hsl(var(--semantic-gender-male-bg))",
          "gender-female": "hsl(var(--semantic-gender-female-text))",
          "gender-female-bg": "hsl(var(--semantic-gender-female-bg))",
          "status-active": "hsl(var(--semantic-status-active-text))",
          "status-active-bg": "hsl(var(--semantic-status-active-bg))",
          "status-inactive": "hsl(var(--semantic-status-inactive-text))",
          "status-inactive-bg": "hsl(var(--semantic-status-inactive-bg))",
          "status-graduated": "hsl(var(--semantic-status-graduated-text))",
          "status-graduated-bg": "hsl(var(--semantic-status-graduated-bg))",
          "role-servant": "hsl(var(--semantic-role-servant-text))",
          "role-servant-bg": "hsl(var(--semantic-role-servant-bg))",
          "role-group-leader": "hsl(var(--semantic-role-group-leader-text))",
          "role-group-leader-bg": "hsl(var(--semantic-role-group-leader-bg))",
          "role-level-leader": "hsl(var(--semantic-role-level-leader-text))",
          "role-level-leader-bg": "hsl(var(--semantic-role-level-leader-bg))",
          "activity-create": "hsl(var(--semantic-activity-create-bg))",
          "activity-update": "hsl(var(--semantic-activity-update-bg))",
          "activity-delete": "hsl(var(--semantic-activity-delete-bg))",
          "toolbar": "hsl(var(--semantic-toolbar-bg))",
          "toolbar-border": "hsl(var(--semantic-toolbar-border))",
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
        "slideUp": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slideUp": "slideUp 150ms ease-out",
      },
      transitionTimingFunction: {
        'out-strong': 'var(--ease-out)',
        'in-out-strong': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addVariant, addUtilities }: { addVariant: (name: string, generator: string) => void; addUtilities: (utilities: any) => void }) {
      addVariant("rtl", '[dir="rtl"] &')
      addVariant("ltr", '[dir="ltr"] &')
      addVariant("motion-safe", "@media (prefers-reduced-motion: no-preference)")
      addVariant("motion-reduce", "@media (prefers-reduced-motion: reduce)")

      // Disable animations when motion is reduced
      addUtilities({
        "@media (prefers-reduced-motion: reduce)": {
          "*": {
            "animation-duration": "0.01ms !important",
            "animation-iteration-count": "1 !important",
            "transition-duration": "0.01ms !important",
          },
        },
      })
    },
  ],
} satisfies Config

export default config
