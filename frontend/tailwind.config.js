// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Scoreboard-style dark palette
        ink: {
          950: "#07090d",
          900: "#0e1218",
          800: "#161c25",
          700: "#212935",
          600: "#2e3847",
          400: "#8c97a8",
          200: "#cbd3de",
        },
        accent: "#c6f432",
        live: "#ff3b3b",
      },
      keyframes: {
        flash: {
          "0%": { boxShadow: "0 0 0 0 rgba(255,255,255,0.85)" },
          "100%": { boxShadow: "0 0 0 16px rgba(255,255,255,0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        flash: "flash 0.45s ease-out",
        "toast-in": "toast-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
}
