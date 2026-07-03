const multiplier = 0.0005;
const basePrice = 1.08;
const nowHours = Date.now() / 3600000; // current time in hours

for (let i = 0; i < 10; i++) {
  // simulate 10 consecutive ticks (e.g. 5 seconds apart)
  const timeHours = nowHours + (i * 5) / 3600;
  const price = basePrice + Math.sin(timeHours) * multiplier * 10 + (Math.random() - 0.5) * multiplier;
  console.log(`tick ${i}, price=${price}`);
}
