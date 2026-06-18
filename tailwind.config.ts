import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        border: "var(--border)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        foreground: "var(--foreground)",
        input: "var(--input)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        ring: "var(--ring)",
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        tertiary: {
          DEFAULT: "var(--tertiary)",
          foreground: "var(--tertiary-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        "surface-container": "var(--surface-container)",
        "surface-container-low": "var(--surface-container-low)",
        "surface-container-highest": "var(--surface-container-highest)",
        "primary-container": "var(--primary-container)",
        "on-primary-container": "var(--on-primary-container)",
        "on-surface-variant": "var(--on-surface-variant)",
      },
      boxShadow: {
        candy: "0 20px 42px -30px rgba(115, 58, 101, 0.28)",
        panel: "0 24px 55px -36px rgba(90, 44, 80, 0.3)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 0.125rem)",
        sm: "calc(var(--radius) - 0.25rem)",
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        mono: ["var(--font-geist-mono)"],
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
}
export default config
