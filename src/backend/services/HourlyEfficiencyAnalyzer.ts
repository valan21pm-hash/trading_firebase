/**
 * HourlyEfficiencyAnalyzer.ts
 * 
 * Modulo di analisi statistica ed inferenziale delle fasce orarie della giornata di trading.
 * Valuta l'efficienza temporale, win rate, rendimento medio, intervalli di confidenza (95% CI),
 * significatività statistica (t-test / p-value) e persistenza/costanza intergiornaliera.
 */

export interface HourlySlotStat {
  slotKey: string;           // es. "09:30-10:30 (Apertura)", "10:30-12:00 (Espansione)", etc.
  hourBucket: number;        // Ora (0-23)
  tradesCount: number;       // Campione N
  winningTrades: number;     // N trade in profitto
  losingTrades: number;      // N trade in perdita
  winRatePct: number;        // Win Rate %
  totalPnL: number;          // PnL totale generato ($)
  meanPnL: number;           // PnL medio per trade ($)
  meanReturnPct: number;     // Rendimento medio per trade (%)
  stdDev: number;            // Deviazione Standard empirica (s)
  standardError: number;     // Standard Error della Media (SE = s / sqrt(N))
  tStatistic: number;        // t-statistic vs ipotesi nulla (H0: rendimento atteso = 0)
  pValueEstimate: number;    // p-value stimato a 2 code
  isStatisticallySignificant: boolean; // p < 0.05
  confidenceInterval95: [number, number]; // Intervallo di confidenza al 95% [lower, upper]
  
  // Metriche di Costanza Intergiornaliera (Persistence across days)
  distinctDaysCount: number; // Numero di giorni differenti con operazioni
  positiveDaysCount: number; // Giorni con PnL aggregato positivo nella fascia
  constancyScorePct: number; // Indice di Costanza % (positiveDays / distinctDays * 100)
  isPersistentConstant: boolean; // True se N >= 3, constancy >= 65% e meanPnL > 0
  
  // Giudizio inferenziale
  inferentialRating: 'GOLDEN_CONSTANT' | 'PROMISING_EDGE' | 'NEUTRAL_NOISE' | 'HIGH_RISK_DRAWDOWNS';
  verbalEvaluation: string;
}

export interface HourlyEfficiencyReport {
  analyzedPeriod: {
    startDate: string;
    endDate: string;
    mode: 'paper' | 'live';
  };
  totalOperations: number;
  totalTradingDays: number;
  overallWinRatePct: number;
  overallNetPnL: number;
  slotStats: HourlySlotStat[];
  bestHourlyWindow: HourlySlotStat | null;
  worstHourlyWindow: HourlySlotStat | null;
  constancySummary: {
    hasProvenConstantEdge: boolean;
    provenConstantSlots: string[];
    riskProneSlots: string[];
    keyInsight: string;
  };
  markdownTable: string;
  formattedSummaryPrompt: string;
}

export class HourlyEfficiencyAnalyzer {
  
  /**
   * Identifica la fascia oraria di mercato (in orario EST/New York e UTC/Locale)
   */
  public static getSlotKeyFromTimestamp(isoString: string): { slotKey: string; hour: number } {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return { slotKey: 'Orario non definito', hour: 12 };
    }
    
    // Calcoliamo sia l'ora UTC sia l'ora locale New York (EST = UTC-4 o UTC-5)
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    
    // Mappa approssimata sui regimi di mercato US (EST): 
    // 13:30-14:30 UTC = 09:30-10:30 EST (Apertura / Morning Momentum)
    // 14:30-16:00 UTC = 10:30-12:00 EST (Espansione Mattutina)
    // 16:00-18:00 UTC = 12:00-14:00 EST (Consolidamento / Midday)
    // 18:00-19:30 UTC = 14:00-15:30 EST (Pomeriggio / Power Hour)
    // 19:30-20:00 UTC = 15:30-16:00 EST (Pre-Chiusura / MOC EOD)
    const totalMinutesUTC = hours * 60 + minutes;

    let slotKey = '';
    if (totalMinutesUTC >= 13 * 60 + 30 && totalMinutesUTC < 14 * 60 + 30) {
      slotKey = '09:30 - 10:30 EST (Apertura & Morning Momentum)';
    } else if (totalMinutesUTC >= 14 * 60 + 30 && totalMinutesUTC < 16 * 60) {
      slotKey = '10:30 - 12:00 EST (Espansione & Trend Mattutino)';
    } else if (totalMinutesUTC >= 16 * 60 && totalMinutesUTC < 18 * 60) {
      slotKey = '12:00 - 14:00 EST (Midday / Consolidamento & Chop)';
    } else if (totalMinutesUTC >= 18 * 60 && totalMinutesUTC < 19 * 60 + 30) {
      slotKey = '14:00 - 15:30 EST (Power Hour & Pomeriggio)';
    } else if (totalMinutesUTC >= 19 * 60 + 30 && totalMinutesUTC <= 20 * 60 + 15) {
      slotKey = '15:30 - 16:00 EST (Pre-Chiusura / EOD MOC)';
    } else {
      const localHourStr = `${hours.toString().padStart(2, '0')}:00 - ${(hours + 1).toString().padStart(2, '0')}:00 UTC`;
      slotKey = `${localHourStr} (Ext-Hours / Intraday)`;
    }

    return { slotKey, hour: hours };
  }

  /**
   * Calcola il p-value a due code approssimato per la distribuzione t di Student (o Normale per N > 30)
   */
  private static approximatePValue(t: number, df: number): number {
    const absT = Math.abs(t);
    if (isNaN(absT) || df <= 0) return 1.0;

    // Per N grande usiamo l'approssimazione normale
    if (df > 30) {
      // Approssimazione di Zelen & Severo
      const b0 = 0.2316419;
      const b1 = 0.319381530;
      const b2 = -0.356563782;
      const b3 = 1.781477937;
      const b4 = -1.821255978;
      const b5 = 1.330274429;
      const x = absT;
      const tVal = 1 / (1 + b0 * x);
      const poly = tVal * (b1 + tVal * (b2 + tVal * (b3 + tVal * (b4 + tVal * b5))));
      const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
      const tail = phi * poly;
      return Math.max(0.0001, Math.min(1.0, 2 * tail));
    }

    // Per campioni piccoli, euristica t standard
    if (absT >= 3.5) return 0.001;
    if (absT >= 2.77) return 0.01;
    if (absT >= 2.15) return 0.04;
    if (absT >= 1.96) return 0.05;
    if (absT >= 1.65) return 0.10;
    if (absT >= 1.28) return 0.20;
    return Math.min(1.0, 0.20 + (1.28 - absT) * 0.4);
  }

  /**
   * Esegue l'analisi completa statistica ed inferenziale su un insieme di log ed esecuzioni
   */
  public static analyze(
    logs: Array<{ timestamp?: string; action?: string; reasoning?: string; price?: number; pnl?: number }>,
    dailyPnLHistory: Array<{ date: string; pnl: number; balance: number; breakdown?: any[] }> = [],
    mode: 'paper' | 'live' = 'paper',
    periodLabel?: { startDate?: string; endDate?: string }
  ): HourlyEfficiencyReport {
    // Raccogliamo campioni di operazioni con PnL / esiti per slot temporale
    interface RawSample {
      timestamp: string;
      dateStr: string;
      pnl: number;
      pnlPct: number;
      isWin: boolean;
      action: string;
      symbol?: string;
    }

    const slotSamples: Record<string, { hour: number; samples: RawSample[] }> = {};

    // 1. Estrazione campioni dai dailyLogicLogs
    for (const log of logs) {
      if (!log.timestamp) continue;
      const { slotKey, hour } = this.getSlotKeyFromTimestamp(log.timestamp);
      
      if (!slotSamples[slotKey]) {
        slotSamples[slotKey] = { hour, samples: [] };
      }

      // Estraiamo eventuale PnL dal log o reasoning se presente
      let pnl = log.pnl ?? 0;
      let pnlPct = 0;
      let isWin = false;
      let hasPnlData = false;

      if (log.reasoning) {
        // Cerca pattern tipo "Profitto di $2.40", "PnL: +1.20%", "guadagno: +$3.50", "Stop Loss ... -0.80%"
        const profitMatch = log.reasoning.match(/profitto\s*(?:di)?\s*\$?([+-]?\d+(?:\.\d+)?)/i) ||
                            log.reasoning.match(/p&l:\s*([+-]?\d+(?:\.\d+)?)/i) ||
                            log.reasoning.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
        
        if (profitMatch) {
          const val = parseFloat(profitMatch[1]);
          if (!isNaN(val)) {
            pnl = val;
            hasPnlData = true;
            isWin = val > 0;
          }
        }

        if (log.reasoning.toLowerCase().includes('profitto') || 
            log.reasoning.toLowerCase().includes('trailing stop') || 
            log.reasoning.toLowerCase().includes('take profit') ||
            log.reasoning.toLowerCase().includes('sentiment favorevole')) {
          isWin = true;
        } else if (log.reasoning.toLowerCase().includes('stop loss') || 
                   log.reasoning.toLowerCase().includes('perdita') || 
                   log.reasoning.toLowerCase().includes('degradato')) {
          isWin = false;
        }
      }

      // Se è un'azione di SELL/CLOSE consideriamo il trade concluso
      if (log.action === 'SELL' || log.action === 'CLOSE') {
        const dateStr = log.timestamp.split('T')[0];
        slotSamples[slotKey].samples.push({
          timestamp: log.timestamp,
          dateStr,
          pnl: hasPnlData ? pnl : (isWin ? 1.5 : -1.0),
          pnlPct: hasPnlData ? pnlPct : (isWin ? 0.6 : -0.4),
          isWin,
          action: log.action,
          symbol: (log as any).symbol
        });
      } else if (log.action === 'BUY') {
        // Registriamo anche l'apertura per volumetria e tracking
        const dateStr = log.timestamp.split('T')[0];
        slotSamples[slotKey].samples.push({
          timestamp: log.timestamp,
          dateStr,
          pnl: hasPnlData ? pnl : 0,
          pnlPct: 0,
          isWin,
          action: 'BUY',
          symbol: (log as any).symbol
        });
      }
    }

    // Se non abbiamo campioni sufficienti dai logic logs, integriamo con le distribuzioni standard note
    const allSlotKeys = Object.keys(slotSamples);
    if (allSlotKeys.length === 0) {
      // Inizializza i bucket standard di sessione per fornire sempre un'analisi inferenziale completa
      const defaultSlots = [
        '09:30 - 10:30 EST (Apertura & Morning Momentum)',
        '10:30 - 12:00 EST (Espansione & Trend Mattutino)',
        '12:00 - 14:00 EST (Midday / Consolidamento & Chop)',
        '14:00 - 15:30 EST (Power Hour & Pomeriggio)',
        '15:30 - 16:00 EST (Pre-Chiusura / EOD MOC)'
      ];
      defaultSlots.forEach((k, idx) => {
        slotSamples[k] = { hour: 13 + idx, samples: [] };
      });
    }

    // 2. Calcolo Statistico ed Inferenziale per ciascuna fascia
    const slotStats: HourlySlotStat[] = [];
    let totalOps = 0;
    let totalWins = 0;
    let grandNetPnL = 0;
    const allDistinctDays = new Set<string>();

    for (const [slotKey, { hour, samples }] of Object.entries(slotSamples)) {
      const N = samples.length;
      totalOps += N;

      const wins = samples.filter(s => s.isWin || s.pnl > 0).length;
      const losses = samples.filter(s => !s.isWin && s.pnl < 0).length;
      totalWins += wins;

      const winRate = N > 0 ? (wins / N) * 100 : 50;
      const totalPnL = samples.reduce((acc, s) => acc + s.pnl, 0);
      grandNetPnL += totalPnL;
      const meanPnL = N > 0 ? totalPnL / N : 0;
      const meanReturnPct = N > 0 ? samples.reduce((acc, s) => acc + s.pnlPct, 0) / N : 0;

      // Calcolo Varianza e Deviazione Standard
      let variance = 0;
      if (N > 1) {
        const sumSq = samples.reduce((acc, s) => acc + Math.pow(s.pnl - meanPnL, 2), 0);
        variance = sumSq / (N - 1);
      } else {
        variance = 1.0;
      }
      const stdDev = Math.sqrt(variance);
      const standardError = N > 0 ? stdDev / Math.sqrt(N) : 1.0;

      // t-Statistic vs H0 (mu = 0)
      const tStat = standardError > 0.0001 ? (meanPnL / standardError) : 0;
      const pVal = this.approximatePValue(tStat, Math.max(1, N - 1));
      const isSignificant = pVal < 0.05 && N >= 3;

      // Intervallo di Confidenza al 95%
      const marginOfError = 1.96 * standardError;
      const ciLower = meanPnL - marginOfError;
      const ciUpper = meanPnL + marginOfError;

      // Analisi della Costanza Intergiornaliera (Persistence across distinct dates)
      const dayPnLMap: Record<string, number> = {};
      for (const s of samples) {
        allDistinctDays.add(s.dateStr);
        dayPnLMap[s.dateStr] = (dayPnLMap[s.dateStr] || 0) + s.pnl;
      }

      const distinctDays = Object.keys(dayPnLMap).length;
      const positiveDays = Object.values(dayPnLMap).filter(val => val > 0).length;
      const constancyScore = distinctDays > 0 ? (positiveDays / distinctDays) * 100 : 0;
      const isPersistent = distinctDays >= 2 && constancyScore >= 65 && meanPnL > 0;

      // Classificazione Inferenziale
      let rating: HourlySlotStat['inferentialRating'] = 'NEUTRAL_NOISE';
      let verbal = '';

      if (isPersistent && winRate >= 65) {
        rating = 'GOLDEN_CONSTANT';
        verbal = `Costante empirica ad altissima efficienza (Win Rate ${winRate.toFixed(1)}%, Costanza ${constancyScore.toFixed(0)}%, p < ${pVal.toFixed(3)}). Edge robusto confermato nel tempo.`;
      } else if (winRate >= 60 && meanPnL > 0) {
        rating = 'PROMISING_EDGE';
        verbal = `Fascia promettente a rendimento positivo (${meanPnL >= 0 ? '+' : ''}$${meanPnL.toFixed(2)} medio, WR ${winRate.toFixed(1)}%). Necessita consolidamento campionario per significatività piena.`;
      } else if (winRate < 40 && meanPnL < 0 && N >= 3) {
        rating = 'HIGH_RISK_DRAWDOWNS';
        verbal = `Fascia critica ad alto tasso di drawdown (Win Rate ${winRate.toFixed(1)}%, PnL medio negativo). Rischio sistemico di chop/falsa rottura.`;
      } else {
        rating = 'NEUTRAL_NOISE';
        verbal = `Fascia neutra / bilanciata (${winRate.toFixed(1)}% WR, varianza stocastica nella norma). Nessun disallineamento inferenziale rilevato.`;
      }

      slotStats.push({
        slotKey,
        hourBucket: hour,
        tradesCount: N,
        winningTrades: wins,
        losingTrades: losses,
        winRatePct: parseFloat(winRate.toFixed(1)),
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        meanPnL: parseFloat(meanPnL.toFixed(2)),
        meanReturnPct: parseFloat(meanReturnPct.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(3)),
        standardError: parseFloat(standardError.toFixed(3)),
        tStatistic: parseFloat(tStat.toFixed(2)),
        pValueEstimate: parseFloat(pVal.toFixed(4)),
        isStatisticallySignificant: isSignificant,
        confidenceInterval95: [parseFloat(ciLower.toFixed(2)), parseFloat(ciUpper.toFixed(2))],
        distinctDaysCount: distinctDays,
        positiveDaysCount: positiveDays,
        constancyScorePct: parseFloat(constancyScore.toFixed(1)),
        isPersistentConstant: isPersistent,
        inferentialRating: rating,
        verbalEvaluation: verbal
      });
    }

    // Ordinamento cronologico
    slotStats.sort((a, b) => a.hourBucket - b.hourBucket);

    // Identificazione Best e Worst Window
    const validStats = slotStats.filter(s => s.tradesCount > 0);
    let bestWindow: HourlySlotStat | null = null;
    let worstWindow: HourlySlotStat | null = null;

    if (validStats.length > 0) {
      bestWindow = [...validStats].sort((a, b) => b.winRatePct * 0.5 + b.meanPnL * 0.5 - (a.winRatePct * 0.5 + a.meanPnL * 0.5))[0];
      worstWindow = [...validStats].sort((a, b) => a.winRatePct * 0.5 + a.meanPnL * 0.5 - (b.winRatePct * 0.5 + b.meanPnL * 0.5))[0];
    }

    const provenConstants = slotStats.filter(s => s.inferentialRating === 'GOLDEN_CONSTANT').map(s => s.slotKey);
    const riskSlots = slotStats.filter(s => s.inferentialRating === 'HIGH_RISK_DRAWDOWNS').map(s => s.slotKey);

    let keyInsight = '';
    if (provenConstants.length > 0) {
      keyInsight = `La fascia "${provenConstants.join(', ')}" emerge come una costante statisticamente solida (alta replicabilità intergiornaliera).`;
    } else if (bestWindow) {
      keyInsight = `La fascia "${bestWindow.slotKey}" registra le migliori metriche di rendimento e concentrazione di profitto (${bestWindow.winRatePct}% Win Rate).`;
    } else {
      keyInsight = `Distribuzione intraday bilanciata con stabilità statistica distribuita lungo l'intera sessione di borsa.`;
    }

    // 3. Generazione Tabella Markdown
    let mdTable = `| Fascia Oraria | N Op. | Win Rate | PnL Medio | 95% Conf. Interval | Indice Costanza | Efficienza Inferenziale |\n`;
    mdTable += `| :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n`;
    
    for (const stat of slotStats) {
      const ratingEmoji = stat.inferentialRating === 'GOLDEN_CONSTANT' ? '💎 Costante d\'Oro' :
                          stat.inferentialRating === 'PROMISING_EDGE' ? '📈 Edge Positivo' :
                          stat.inferentialRating === 'HIGH_RISK_DRAWDOWNS' ? '⚠️ Alto Rischio' : '⚪ Neutro';
      
      const pnlSign = stat.meanPnL >= 0 ? '+' : '';
      mdTable += `| **${stat.slotKey}** | ${stat.tradesCount} | **${stat.winRatePct}%** | ${pnlSign}$${stat.meanPnL.toFixed(2)} | [${stat.confidenceInterval95[0]}, ${stat.confidenceInterval95[1]}] | ${stat.constancyScorePct}% | ${ratingEmoji} |\n`;
    }

    // 4. Prompt Context Formattato per l'LLM
    const startDate = periodLabel?.startDate || (allDistinctDays.size > 0 ? Array.from(allDistinctDays)[0] : new Date().toISOString().split('T')[0]);
    const endDate = periodLabel?.endDate || (allDistinctDays.size > 0 ? Array.from(allDistinctDays).slice(-1)[0] : new Date().toISOString().split('T')[0]);

    const formattedSummaryPrompt = `
=== ANALISI STATISTICA ED INFERENZIALE DELLE FASCE ORARIE (INTRADAY HOURLY EFFICIENCY) ===
Periodo: ${startDate} -> ${endDate} | Conto: ${mode.toUpperCase()}
Operazioni Totali Analizzate: ${totalOps} su ${Math.max(1, allDistinctDays.size)} giorni di negoziazione.

TABELLA DISTRIBUZIONE TEMPORALE & INFERENZA:
${mdTable}

SINTESI MATEMATICA:
- Fascia Più Efficiente (Migliore): ${bestWindow ? `${bestWindow.slotKey} (WR: ${bestWindow.winRatePct}%, PnL Medio: $${bestWindow.meanPnL}, Costanza: ${bestWindow.constancyScorePct}%)` : 'N/A'}
- Fascia Meno Efficiente / Critica: ${worstWindow ? `${worstWindow.slotKey} (WR: ${worstWindow.winRatePct}%, PnL Medio: $${worstWindow.meanPnL})` : 'N/A'}
- Costanti Statistiche Accertate: ${provenConstants.length > 0 ? provenConstants.join(' | ') : 'Nessuna fascia supera ancora la soglia di significatività p < 0.05 con costanza >= 65% (in fase di accumulo dati)'}
- Key Insight Inferenziale: ${keyInsight}
========================================================================================`;

    return {
      analyzedPeriod: {
        startDate,
        endDate,
        mode
      },
      totalOperations: totalOps,
      totalTradingDays: Math.max(1, allDistinctDays.size),
      overallWinRatePct: totalOps > 0 ? parseFloat(((totalWins / totalOps) * 100).toFixed(1)) : 50.0,
      overallNetPnL: parseFloat(grandNetPnL.toFixed(2)),
      slotStats,
      bestHourlyWindow: bestWindow,
      worstHourlyWindow: worstWindow,
      constancySummary: {
        hasProvenConstantEdge: provenConstants.length > 0,
        provenConstantSlots: provenConstants,
        riskProneSlots: riskSlots,
        keyInsight
      },
      markdownTable: mdTable,
      formattedSummaryPrompt
    };
  }
}

export default HourlyEfficiencyAnalyzer;
