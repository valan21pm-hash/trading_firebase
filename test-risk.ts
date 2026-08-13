import { RiskManagementService } from "./src/backend/services/RiskManagementService";

console.log("=== RUNNING RISK MANAGEMENT & AUTOMATED RULES TESTS ===");

// 1. Test Regola 1: P&L <= -0.80% e Sentiment < 0.20 -> Chiusura preventiva
const posRule1 = {
  id: 'AAPL',
  asset: 'AAPL',
  currentValue: 99.15,
  openPrice: 100,
  currentPrice: 99.15, // P&L = -0.85%
  unrealizedProfit: -0.85,
  sentimentScore: 0.10 // < 0.20
};
const config = {
  y: 1,
  defaultSL: -1.0,
  trailingStop: 0.5,
  slPct: -1.0
};

const decision1 = RiskManagementService.evaluateClosure(posRule1, 0, config);
console.log('Rule 1 Test Result:', decision1);
if (decision1 && decision1.reason.includes('Chiusura Preventiva P&L -0.80%')) {
  console.log("✅ RULE 1 PASSED!");
} else {
  console.error("❌ RULE 1 FAILED!");
}

// 2. Test Regola 2: Sentiment < 0.15 (senza calo VIX > 2%)
const posRule2_NoVixDrop = {
  id: 'NVDA',
  asset: 'NVDA',
  currentValue: 99.9,
  openPrice: 100,
  currentPrice: 99.9, // P&L = -0.10%
  unrealizedProfit: -0.10,
  sentimentScore: 0.10, // < 0.15
  vix24hChangePct: +1.2 // VIX in aumento
};

const decision2_A = RiskManagementService.evaluateClosure(posRule2_NoVixDrop, 0, config);
console.log('Rule 2 (No VIX drop) Result:', decision2_A);
if (decision2_A && decision2_A.reason.includes('Vendita Liquidità Sentiment < 0.15')) {
  console.log("✅ RULE 2 (VENDITA) PASSED!");
} else {
  console.error("❌ RULE 2 (VENDITA) FAILED!");
}

// 2b. Test Regola 2 con eccezione: VIX in calo > 2% (es. -2.5%)
const posRule2_WithVixDrop = {
  id: 'NVDA',
  asset: 'NVDA',
  currentValue: 99.9,
  openPrice: 100,
  currentPrice: 99.9, // P&L = -0.10%
  unrealizedProfit: -0.10,
  sentimentScore: 0.10, // < 0.15
  vix24hChangePct: -2.5 // VIX in calo > 2%
};

const decision2_B = RiskManagementService.evaluateClosure(posRule2_WithVixDrop, 0, config);
console.log('Rule 2 (With VIX drop > 2%) Result:', decision2_B);
if (!decision2_B || !decision2_B.reason.includes('Vendita Liquidità Sentiment < 0.15')) {
  console.log("✅ RULE 2 VIX EXCEPTION PASSED! (Position kept because VIX dropped > 2%)");
} else {
  console.error("❌ RULE 2 VIX EXCEPTION FAILED!");
}

console.log("=== ALL TESTS COMPLETED ===");
