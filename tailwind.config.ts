import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2530",
        slate: "#4B5A68",
        mist: "#F4F6F8",
        line: "#E1E6EA",
        accent: "#0F5B4C",
        accentSoft: "#DDEFE9",
        warn: "#B45309",
        warnSoft: "#FCEDD9",
        danger: "#B3261E",
        dangerSoft: "#FBE4E2",
      },
      fontFamily: {
        display: ["'IBM Plex Serif'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
