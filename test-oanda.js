const multiplier = 0.0005;
const basePrice = 1.08;
for (let i = 40; i < 50; i++) {
  const base = basePrice + Math.sin(i / 8) * multiplier + (Math.random() - 0.5) * (multiplier * 0.4);
  console.log(`i=${i} price=${base}`);
}
