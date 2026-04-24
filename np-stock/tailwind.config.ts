import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#141414",
        "surface-2": "#1c1c1c",
        border: "#2a2a2a",
        "text-primary": "#ffffff",
        "text-secondary": "#a1a1aa",
        "text-muted": "#71717a",
        primary: {
          DEFAULT: "#006730",
          hover: "#00803d",
          light: "#00a84f",
        },
        accent: {
          DEFAULT: "#f97316",
          hover: "#fb923c",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
