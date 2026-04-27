import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#05080A",
        surface: "#1F242B",
        "surface-solid": "#10161B",
        "surface-2": "#0B1115",
        border: "#2E3A40",
        "text-primary": "#F4F7F5",
        "text-secondary": "#A7B0AD",
        "text-muted": "#73807C",
        brand: {
          DEFAULT: "#00652E",
          hover: "#007236",
          light: "#0A7F3D",
          soft: "#062015",
        },
        primary: {
          DEFAULT: "#00652E",
          hover: "#007236",
          light: "#0A7F3D",
        },
        accent: {
          DEFAULT: "#0A7F3D",
          hover: "#11894A",
        },
        success: "#0A7F3D",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      borderRadius: {
        xl: "0.875rem",
      },
      boxShadow: {
        premium: "0 22px 60px rgba(0, 0, 0, 0.38)",
        glow: "0 0 0 1px rgba(0, 101, 46, 0.28), 0 18px 55px rgba(0, 101, 46, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
