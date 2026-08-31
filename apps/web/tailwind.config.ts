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
        // Core Light Foundation Neutrals
        canvas: "#F8FAFC",
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F1F5F9",
          subtle: "#F8FAFC",
          elevated: "#FFFFFF",
        },
        border: {
          DEFAULT: "#E2E8F0",
          strong: "#CBD5E1",
        },
        txt: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#64748B",
          disabled: "#94A3B8",
        },

        // Primary Brand / Action Blue
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#2563EB",
          600: "#1D4ED8",
          700: "#1E40AF",
          DEFAULT: "#2563EB",
        },

        // Supporting Biomedical Teal Accent
        accent: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          400: "#14B8A6",
          500: "#0D9488",
          600: "#0F766E",
          DEFAULT: "#0D9488",
        },

        // Semantic Role-Based Status Colors
        status: {
          success: {
            DEFAULT: "#15803D",
            100: "#DCFCE7",
            50: "#F0FDF4",
          },
          warning: {
            DEFAULT: "#B45309",
            100: "#FEF3C7",
            50: "#FFFBEB",
          },
          danger: {
            DEFAULT: "#DC2626",
            100: "#FEE2E2",
            50: "#FEF2F2",
          },
          info: {
            DEFAULT: "#2563EB",
            100: "#DBEAFE",
            50: "#EFF6FF",
          },
          neutral: {
            DEFAULT: "#64748B",
            100: "#F1F5F9",
            50: "#F8FAFC",
          },
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
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
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        elevated:
          "0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
