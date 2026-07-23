// Generate a simple placeholder logo SVG that will be replaced
// when the user provides their actual logo.
// Theme: deep emerald + warm gold, Arabic-elegant
const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1F5E4A"/>
      <stop offset="100%" stop-color="#143D2F"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E8C480"/>
      <stop offset="50%" stop-color="#C9974A"/>
      <stop offset="100%" stop-color="#A67935"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="80" fill="url(#bg)"/>
  <circle cx="200" cy="200" r="130" fill="none" stroke="url(#gold)" stroke-width="4"/>
  <text x="200" y="240" text-anchor="middle" font-family="Noto Naskh Arabic, Amiri, serif" font-size="140" font-weight="700" fill="url(#gold)">ب</text>
  <text x="200" y="320" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="22" font-weight="500" fill="#E8C480" letter-spacing="6">PLACEHOLDER</text>
</svg>`;

fs.writeFileSync('/home/z/my-project/public/logo.svg', svg);
console.log('Placeholder logo written to public/logo.svg');
