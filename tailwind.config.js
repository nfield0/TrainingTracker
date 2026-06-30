/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Explicit min-width steps used by the data tables / sticky columns.
      minWidth: {
        24: "6rem",
        36: "9rem",
        40: "10rem",
        52: "13rem",
      },
    },
  },
  plugins: [],
};
