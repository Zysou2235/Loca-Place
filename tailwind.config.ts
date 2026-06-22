import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "var(--font-inter)", "sans-serif"],
      },
      colors: {
        // Eskale Box brand palette (from the logo).
        brand: {
          DEFAULT: "#1b2a4a", // navy
          dark: "#13203b",
          light: "#2c4373",
        },
        accent: {
          DEFAULT: "#e8833a", // orange
          dark: "#d4722c",
          light: "#f4a261",
        },
        cream: "#fbf7f1",
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(20, 33, 61, 0.18)",
        card: "0 4px 24px -8px rgba(20, 33, 61, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
