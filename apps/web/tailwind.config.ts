import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Canonical NeuroMove Status Language Tokens
        neuro: {
          safe: {
            DEFAULT: "#10b981", // Emerald 500
            light: "#d1fae5",
            dark: "#065f46",
          },
          warning: {
            DEFAULT: "#f59e0b", // Amber 500
            light: "#fef3c7",
            dark: "#92400e",
          },
          critical: {
            DEFAULT: "#ef4444", // Red 500
            light: "#fee2e2",
            dark: "#991b1b",
          },
          info: {
            DEFAULT: "#3b82f6", // Blue 500
            light: "#dbeafe",
            dark: "#1e40af",
          },
          neutral: {
            DEFAULT: "#64748b", // Slate 500
            light: "#f1f5f9",
            dark: "#1e293b",
          },
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
