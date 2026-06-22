import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Eskale Box brand palette (from the logo).
        brand: {
          DEFAULT: "#1b2a4a", // navy
          dark: "#13203b",
        },
        accent: {
          DEFAULT: "#e8833a", // orange
          dark: "#d4722c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
