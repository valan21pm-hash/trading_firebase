import { RiskManagementService } from "./src/backend/services/RiskManagementService";

// This is just a test to make sure the logic is intact
const positionObj = {
  id: 'AAPL',
  asset: 'AAPL',
  currentValue: 99.6,
  openPrice: 100,
  currentPrice: 99.6,
  unrealizedProfit: -0.4,
  highestPrice: 100
};
const config = {
  y: 1,
  defaultSL: -0.4,
  defaultTP: 0.8,
  trailingStop: 0.3,
  targetTpPct: 0.8,
  slPct: -0.4,
  isAlpaca: true
};
const decision = RiskManagementService.evaluateClosure(positionObj, 0, config);
console.log('decision:', decision);
