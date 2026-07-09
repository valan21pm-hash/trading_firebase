const multiplier = 0.0005;
const basePrice = 1.08;
const now = Date.now();

for (let i = 0; i < 10; i++) {
  const t = now + i * 5000; // 5 seconds step
  const timePhase1 = t / (2 * 60 * 60 * 1000); // 2 hour period
  const timePhase2 = t / (15 * 60 * 1000);     // 15 min period
  const timePhase3 = t / (60 * 1000);          // 1 min period
  
  // Sum of sines creates a complex but smooth curve
  const curve = Math.sin(timePhase1) + 0.5 * Math.sin(timePhase2) + 0.25 * Math.sin(timePhase3);
  
  const price = basePrice + curve * multiplier * 10;
  console.log(`tick ${i}, price=${price}`);
}
