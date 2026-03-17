/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0E7490",
        background: "#0F172A",
        surface: "#1E293B",
        accent: "#22D3EE",
        success: "#10B981",
        danger: "#EF4444"
      },
      fontFamily: {
        heading: ["\"Instrument Serif\"", "serif"],
        body: ["\"DM Sans\"", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.25), 0 20px 70px rgba(0,0,0,0.45)"
      }
    }
  },
  plugins: []
};

