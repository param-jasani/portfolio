// Color palettes from user's provided images
const palettes = [
  ['rgba(232, 249, 87, 0.08)', 'rgba(82, 0, 255, 0.08)'],    // Gargantua & Ultraviolet
  ['rgba(253, 155, 183, 0.08)', 'rgba(38, 203, 209, 0.08)'], // Cotton Candy & Strong Cyan
  ['rgba(254, 126, 60, 0.08)', 'rgba(171, 210, 250, 0.08)'], // Burnt Orange & Icy Blue
  ['rgba(134, 208, 253, 0.08)', 'rgba(22, 0, 41, 0.08)'],    // Celestial Blue & Midnight Violet
];

let currentPalette = 0;
const bgGradient = document.getElementById('bg-gradient');

function cycleGradients() {
  currentPalette = (currentPalette + 1) % palettes.length;
  const [color1, color2] = palettes[currentPalette];
  
  bgGradient.style.background = `radial-gradient(circle at 50% 50%, ${color1}, ${color2}, var(--canvas-black) 70%)`;
  bgGradient.style.backgroundSize = '200% 200%';
}

// Cycle every 8 seconds
setInterval(cycleGradients, 8000);

// Initialize first palette
cycleGradients();

