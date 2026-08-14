import { useEffect, useState, useMemo } from 'react';
import { Play, Square, Activity, Wallet, Clock, RotateCcw, BookOpen, MessageSquare, TrendingUp, BarChart2, X, Plus, Trash2, Copy, Check, Sparkles, Brain, ShieldAlert, Flame, Calendar, FileDown, AlertCircle, Info, ChevronDown, ChevronUp, Upload, Download, Search, CheckCircle2, FolderArchive, FileUp, Save, RefreshCw, Filter, Key, ShoppingCart } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import type { BotStateResponse, BotStatus, AccountData, GeminiSignal } from './types';
import { getAccessToken } from './auth';
import { AlpacaMonitorModule } from './components/AlpacaMonitorModule';
import { GeminiSignalsTicker } from './components/GeminiSignalsTicker';
import { LLMSettings } from './components/LLMSettings';
import { SystemRiskRulesManager } from './components/SystemRiskRulesManager';
import { ProTradingTerminal } from './components/ProTradingTerminal';
import { SentimentBadge } from './components/SentimentBadge';
import { ForceBuyModal } from './components/ForceBuyModal';

const formatDate = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${parts[2]} ${months[monthIdx]}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

const downloadPDF = (title: string, dateInfo: string, content: string, suggestedRule?: string) => {
  const doc = new jsPDF();
  
  // Header Accent bar
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, 210, 8, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(title, 14, 25);
  
  // Subtitle / Date Info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(dateInfo, 14, 32);
  
  // Divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 37, 196, 37);
  
  // Content styling
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85); // Slate 700
  
  // Split text to fit page width
  // A4 page width is 210mm. Margins are 14mm on each side. Printable width = 210 - 28 = 182mm
  const splitText = doc.splitTextToSize(content, 180);
  
  let y = 45;
  const pageHeight = doc.internal.pageSize.height; // 297mm
  
  // Loop through lines and handle page breaks
  for (let i = 0; i < splitText.length; i++) {
    if (y > pageHeight - 35) {
      doc.addPage();
      // Draw new page header bar
      doc.setFillColor(79, 70, 229); // Indigo 600
      doc.rect(0, 0, 210, 8, "F");
      y = 25; // reset y on new page
    }
    const line = splitText[i].trim();
    if (!line) {
      y += 4;
      continue;
    }
    
    // Formatting styles based on basic markdown indicators
    if (line.startsWith('##') || line.startsWith('###')) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(67, 56, 202); // Indigo 700
      const cleanLine = line.replace(/[\#\*]/g, '').trim();
      doc.text(cleanLine, 14, y);
      y += 8;
    } else if (line.startsWith('**') || line.match(/^[0-9]\./) || line.startsWith('-')) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59); // Slate 800
      const cleanLine = line.replace(/[\*]/g, '').trim();
      doc.text(cleanLine, 14, y);
      y += 6;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate 700
      const cleanLine = line.replace(/[\*]/g, '').trim();
      doc.text(cleanLine, 14, y);
      y += 6;
    }
  }
  
  // Suggested Rule section at the end
  if (suggestedRule) {
    y += 10;
    if (y > pageHeight - 50) {
      doc.addPage();
      // Draw header bar
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 8, "F");
      y = 25;
    }
    
    // Box for Suggested Rule
    doc.setDrawColor(129, 140, 248); // Indigo 400
    doc.setFillColor(243, 244, 246); // Gray 100
    doc.rect(14, y, 182, 32, "FD");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(67, 56, 202); // Indigo 700
    doc.text("REGOLA DI TRADING SUGGERITA DALL'AI:", 18, y + 10);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate 800
    const ruleText = doc.splitTextToSize(suggestedRule, 172);
    doc.text(ruleText, 18, y + 18);
  }
  
  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Alpaca AI Trading Bot - Generato automaticamente - Pagina ${page} di ${totalPages}`, 14, pageHeight - 12);
  }
  
  // Save the PDF
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${dateStr}.pdf`;
  doc.save(filename);
};

const downloadOperationsPDF = (mode: 'paper' | 'live', positions: any[], activities: any[], dailyLogicLogs: any[]) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height; // 297
  
  // Header Accent bar
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 8, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text("REPORT OPERAZIONI E PERFORMANCE", 14, 25);
  
  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  const labelTipoConto = mode === 'live' ? 'Conto Reale (Live)' : 'Conto di Simulazione (Paper)';
  doc.text(`Generato il: ${new Date().toLocaleString('it-IT')} | Conto: ${labelTipoConto}`, 14, 32);
  
  // Divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 36, 196, 36);

  let y = 45;

  // 1. ACTIVE POSITIONS SECTION
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text("1. POSIZIONI ATTIVE (PROFITTI/PERDITE LATENTI)", 14, y);
  y += 6;

  if (positions && positions.length > 0) {
    // Header for positions table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(14, y, 182, 7, "F");
    
    doc.text("SIMBOLO", 16, y + 5);
    doc.text("QUANTITÀ", 40, y + 5);
    doc.text("PREZZO CARICO", 70, y + 5);
    doc.text("PREZZO CORRENTE", 110, y + 5);
    doc.text("VALORE MERCATO", 145, y + 5);
    doc.text("PROFITTO/PERDITA", 175, y + 5);
    
    y += 7;

    positions.forEach((pos: any) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 8, "F");
        y = 20;
      }

      // Draw bottom line for each row
      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6, 196, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      const qty = parseFloat(pos.qty || '0').toFixed(4);
      const avgPrice = parseFloat(pos.avg_entry_price || '0').toFixed(2);
      const currentPrice = parseFloat(pos.current_price || '0').toFixed(2);
      const mktVal = parseFloat(pos.market_value || '0').toFixed(2);
      const pl = parseFloat(pos.unrealized_pl || '0');
      const plpc = parseFloat(pos.unrealized_plpc || '0') * 100;

      doc.text(pos.symbol, 16, y + 4);
      doc.text(qty, 40, y + 4);
      doc.text(`$${avgPrice}`, 70, y + 4);
      doc.text(`$${currentPrice}`, 110, y + 4);
      doc.text(`$${mktVal}`, 145, y + 4);

      // Color profit/loss
      if (pl > 0) {
        doc.setTextColor(21, 128, 61); // Green 700
        doc.text(`+$${pl.toFixed(2)} (+${plpc.toFixed(2)}%)`, 175, y + 4);
      } else if (pl < 0) {
        doc.setTextColor(185, 28, 28); // Red 700
        doc.text(`-$${Math.abs(pl).toFixed(2)} (${plpc.toFixed(2)}%)`, 175, y + 4);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text(`$0.00 (0.00%)`, 175, y + 4);
      }

      y += 8;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Nessuna posizione attualmente aperta.", 14, y + 4);
    y += 10;
  }

  y += 6;

  // 2. EXECUTED OPERATIONS SECTION
  if (y > pageHeight - 35) {
    doc.addPage();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 8, "F");
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(79, 70, 229);
  doc.text("2. REGISTRO ESECUZIONI DI MERCATO (ALPACA FILLS)", 14, y);
  y += 6;

  const fills = activities.filter((act: any) => act.activity_type === 'FILL' || act.type === 'fill');

  if (fills && fills.length > 0) {
    // Header for fills table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    
    doc.text("DATA / ORA", 16, y + 5);
    doc.text("SIMBOLO", 55, y + 5);
    doc.text("AZIONE", 80, y + 5);
    doc.text("QUANTITÀ", 110, y + 5);
    doc.text("PREZZO", 140, y + 5);
    doc.text("NOTIONALE", 170, y + 5);
    
    y += 7;

    fills.forEach((fill: any) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 8, "F");
        y = 20;
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6, 196, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      const dateText = new Date(fill.transaction_time || fill.timestamp).toLocaleString('it-IT');
      const side = (fill.side || '').toUpperCase();
      const qty = parseFloat(fill.qty).toFixed(4);
      const price = parseFloat(fill.price).toFixed(2);
      const notional = (parseFloat(fill.qty) * parseFloat(fill.price)).toFixed(2);

      doc.text(dateText, 16, y + 4);
      doc.text(fill.symbol, 55, y + 4);

      if (side === 'BUY') {
        doc.setTextColor(21, 128, 61); // Green 700
        doc.setFont("helvetica", "bold");
        doc.text("ACQUISTO (BUY)", 80, y + 4);
      } else {
        doc.setTextColor(185, 28, 28); // Red 700
        doc.setFont("helvetica", "bold");
        doc.text("VENDITA (SELL)", 80, y + 4);
      }

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(qty, 110, y + 4);
      doc.text(`$${price}`, 140, y + 4);
      doc.text(`$${notional}`, 170, y + 4);

      y += 8;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Nessuna esecuzione registrata recentemente.", 14, y + 4);
    y += 10;
  }

  y += 6;

  // 3. BOT DECISION LOGS SECTION
  if (y > pageHeight - 35) {
    doc.addPage();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 8, "F");
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(79, 70, 229);
  doc.text("3. LOG LOGICA DECISIONALE DEL BOT (LLM SENTIMENT)", 14, y);
  y += 6;

  if (dailyLogicLogs && dailyLogicLogs.length > 0) {
    // Header for logic logs table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    
    doc.text("ORA", 16, y + 5);
    doc.text("SIMBOLO", 40, y + 5);
    doc.text("AZIONE", 65, y + 5);
    doc.text("PREZZO", 90, y + 5);
    doc.text("MOTIVAZIONE / RAGIONAMENTO SENTIMENT", 115, y + 5);
    
    y += 7;

    const recentDecisions = dailyLogicLogs.slice(-25).reverse();

    recentDecisions.forEach((log: any) => {
      const dateText = new Date(log.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const reasoningText = log.reasoning || '';
      
      const splitReasoning = doc.splitTextToSize(reasoningText, 78);
      const rowHeight = Math.max(splitReasoning.length * 4 + 2, 7);

      if (y > pageHeight - rowHeight - 10) {
        doc.addPage();
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 8, "F");
        y = 20;
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + rowHeight - 1, 196, y + rowHeight - 1);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      doc.text(dateText, 16, y + 4);
      doc.text(log.symbol, 40, y + 4);

      const act = (log.action || '').toUpperCase();
      if (act === 'BUY') {
        doc.setTextColor(21, 128, 61);
        doc.setFont("helvetica", "bold");
        doc.text("ACQUISTO (BUY)", 65, y + 4);
      } else if (act === 'SELL') {
        doc.setTextColor(185, 28, 28);
        doc.setFont("helvetica", "bold");
        doc.text("CHIUSURA (SELL)", 65, y + 4);
      } else if (act === 'HOLD') {
        doc.setTextColor(79, 70, 229);
        doc.setFont("helvetica", "bold");
        doc.text("MANTIENI (HOLD)", 65, y + 4);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text("SALTA (SKIP)", 65, y + 4);
      }

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(log.price ? `$${parseFloat(log.price).toFixed(2)}` : 'N/D', 90, y + 4);

      doc.setTextColor(71, 85, 105);
      doc.text(splitReasoning, 115, y + 4);

      y += rowHeight;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Nessun log decisionale registrato in memoria.", 14, y + 4);
    y += 10;
  }

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Alpaca AI Trading Bot - Registro Operazioni - Pagina ${page} di ${totalPages}`, 14, pageHeight - 12);
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `registro_operazioni_${mode}_${dateStr}.pdf`;
  doc.save(filename);
};

const downloadPDFWithOperations = (
  title: string, 
  dateInfo: string, 
  content: string, 
  suggestedRule?: string, 
  positions: any[] = [], 
  activities: any[] = [], 
  dailyLogicLogs: any[] = []
) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height; // 297mm
  
  // Header Accent bar
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, 210, 8, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(title, 14, 25);
  
  // Subtitle / Date Info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(dateInfo, 14, 32);
  
  // Divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 37, 196, 37);
  
  // Content styling
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85); // Slate 700
  
  const splitText = doc.splitTextToSize(content, 180);
  
  let y = 45;
  
  // Loop through lines and handle page breaks
  for (let i = 0; i < splitText.length; i++) {
    if (y > pageHeight - 35) {
      doc.addPage();
      doc.setFillColor(79, 70, 229); // Indigo 600
      doc.rect(0, 0, 210, 8, "F");
      y = 25; // reset y on new page
    }
    const line = splitText[i].trim();
    if (!line) {
      y += 4;
      continue;
    }
    
    if (line.startsWith('##') || line.startsWith('###')) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(67, 56, 202); // Indigo 700
      const cleanLine = line.replace(/[\#\*]/g, '').trim();
      doc.text(cleanLine, 14, y);
      y += 8;
    } else if (line.startsWith('**') || line.match(/^[0-9]\./) || line.startsWith('-')) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59); // Slate 800
      const cleanLine = line.replace(/[\*]/g, '').trim();
      doc.text(cleanLine, 14, y);
      y += 6;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate 700
      const cleanLine = line.replace(/[\*]/g, '').trim();
      doc.text(cleanLine, 14, y);
      y += 6;
    }
  }
  
  // Suggested Rule section
  if (suggestedRule) {
    y += 10;
    if (y > pageHeight - 50) {
      doc.addPage();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 8, "F");
      y = 25;
    }
    
    doc.setDrawColor(129, 140, 248); // Indigo 400
    doc.setFillColor(243, 244, 246); // Gray 100
    doc.rect(14, y, 182, 32, "FD");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(67, 56, 202); // Indigo 700
    doc.text("REGOLA DI TRADING SUGGERITA DALL'AI:", 18, y + 10);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate 800
    const ruleText = doc.splitTextToSize(suggestedRule, 172);
    doc.text(ruleText, 18, y + 18);
    y += 38;
  }

  // APPEND ACTIVE POSITIONS TABLE
  if (positions && positions.length > 0) {
    y += 10;
    if (y > pageHeight - 45) {
      doc.addPage();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 8, "F");
      y = 25;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("APPENDICE A: POSIZIONI ATTIVE AL MOMENTO DEL DEBRIEFING", 14, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    
    doc.text("SIMBOLO", 16, y + 5);
    doc.text("QUANTITÀ", 45, y + 5);
    doc.text("PREZZO CARICO", 80, y + 5);
    doc.text("PREZZO CORRENTE", 115, y + 5);
    doc.text("PROFITTO/PERDITA LATENTE", 150, y + 5);
    
    y += 7;

    positions.forEach((pos: any) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, 210, 8, "F");
        y = 25;
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6, 196, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      const qty = parseFloat(pos.qty || '0').toFixed(4);
      const avgPrice = parseFloat(pos.avg_entry_price || '0').toFixed(2);
      const currentPrice = parseFloat(pos.current_price || '0').toFixed(2);
      const pl = parseFloat(pos.unrealized_pl || '0');
      const plpc = parseFloat(pos.unrealized_plpc || '0') * 100;

      doc.text(pos.symbol, 16, y + 4);
      doc.text(qty, 45, y + 4);
      doc.text(`$${avgPrice}`, 80, y + 4);
      doc.text(`$${currentPrice}`, 115, y + 4);

      if (pl > 0) {
        doc.setTextColor(21, 128, 61); // Green 700
        doc.text(`+$${pl.toFixed(2)} (+${plpc.toFixed(2)}%)`, 150, y + 4);
      } else if (pl < 0) {
        doc.setTextColor(185, 28, 28); // Red 700
        doc.text(`-$${Math.abs(pl).toFixed(2)} (${plpc.toFixed(2)}%)`, 150, y + 4);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text(`$0.00 (0.00%)`, 150, y + 4);
      }

      doc.setTextColor(30, 41, 59);
      y += 8;
    });
  }

  // APPEND EXECUTED TRANSACTIONS TABLE
  const fills = activities.filter((act: any) => act.activity_type === 'FILL' || act.type === 'fill');
  if (fills && fills.length > 0) {
    y += 10;
    if (y > pageHeight - 45) {
      doc.addPage();
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 8, "F");
      y = 25;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("APPENDICE B: REGISTRO RECENTE OPERAZIONI DI MERCATO (FILLS)", 14, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    
    doc.text("DATA / ORA", 16, y + 5);
    doc.text("SIMBOLO", 55, y + 5);
    doc.text("AZIONE", 85, y + 5);
    doc.text("QUANTITÀ", 120, y + 5);
    doc.text("PREZZO ESECUZIONE", 150, y + 5);
    
    y += 7;

    // Limit to 15 recent fills in debriefing appendix for clean page layout
    fills.slice(0, 15).forEach((fill: any) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, 210, 8, "F");
        y = 25;
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6, 196, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      const dateText = new Date(fill.transaction_time || fill.timestamp).toLocaleString('it-IT');
      const side = (fill.side || '').toUpperCase();
      const qty = parseFloat(fill.qty).toFixed(4);
      const price = parseFloat(fill.price).toFixed(2);

      doc.text(dateText, 16, y + 4);
      doc.text(fill.symbol, 55, y + 4);

      if (side === 'BUY') {
        doc.setTextColor(21, 128, 61);
        doc.setFont("helvetica", "bold");
        doc.text("ACQUISTO", 85, y + 4);
      } else {
        doc.setTextColor(185, 28, 28);
        doc.setFont("helvetica", "bold");
        doc.text("VENDITA", 85, y + 4);
      }

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(qty, 120, y + 4);
      doc.text(`$${price}`, 150, y + 4);

      y += 8;
    });
  }

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Alpaca AI Trading Bot - Report Completo - Pagina ${page} di ${totalPages}`, 14, pageHeight - 12);
  }
  
  // Save the PDF
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_completo_${dateStr}.pdf`;
  doc.save(filename);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 backdrop-blur-xs text-white p-3 rounded-lg border border-gray-800 shadow-xl text-xs">
        <p className="font-semibold text-gray-400 mb-1.5">{formatDate(label)}</p>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between gap-6 py-0.5">
            <span className="flex items-center gap-1.5 font-medium text-gray-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.stroke || item.color }} />
              {item.name}:
            </span>
            <span className={`font-mono font-semibold ${(item.value ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(item.value ?? 0) >= 0 ? '+' : ''}{(item.value ?? 0).toFixed(2)}$
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function AccountPanel({ 
  status,
  account, 
  title, 
  isActive, 
  type, 
  onToggle,
  onClosePosition,
  closingSymbols,
  confirmCloseSymbol,
  setConfirmCloseSymbol,
  fetchStatus,
  onOpenForceBuy
}: { 
  status: BotStatus | null;
  account: AccountData; 
  title: string; 
  isActive: boolean; 
  type: 'paper' | 'live'; 
  onToggle: (type: 'paper' | 'live') => void;
  onClosePosition: (symbol: string, type: 'paper' | 'live') => Promise<void>;
  closingSymbols: string[];
  confirmCloseSymbol: { symbol: string; type: 'paper' | 'live' } | null;
  setConfirmCloseSymbol: (state: { symbol: string; type: 'paper' | 'live' } | null) => void;
  fetchStatus: () => Promise<void>;
  onOpenForceBuy?: (symbol?: string) => void;
}) {
  if (!account) return null;

  const [isAccountCollapsed, setIsAccountCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(`alpaca_${type}_isAccountCollapsed`);
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem(`alpaca_${type}_isAccountCollapsed`, String(isAccountCollapsed));
  }, [isAccountCollapsed, type]);

  const initialCapital = (account.dailyPnL && account.dailyPnL.length > 0) ? account.dailyPnL[0].balance : (type === 'paper' ? 100.00 : 50.00);
  const currentBalance = account.balance ?? 0;
  const pnlDiff = currentBalance - initialCapital;
  const pnlPercent = initialCapital > 0 ? (pnlDiff / initialCapital) * 100 : 0;
  
  const investedCapital = account.positions ? account.positions.reduce((sum: any, pos: any) => sum + Math.abs(parseFloat(pos.market_value || '0')), 0) : 0;
  const cashCapital = typeof account.cash === 'number' ? account.cash : Math.max(0, currentBalance - investedCapital);

  const [wrapLogs, setWrapLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem(`alpaca_${type}_wrapLogs`);
    return saved !== null ? saved === 'true' : true;
  });
  const [reverseLogs, setReverseLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem(`alpaca_${type}_reverseLogs`);
    return saved !== null ? saved === 'true' : true;
  });
  const [showTimestamps, setShowTimestamps] = useState<boolean>(() => {
    const saved = localStorage.getItem(`alpaca_${type}_showTimestamps`);
    return saved !== null ? saved === 'true' : true;
  });

  const [showAlpacaCredsForm, setShowAlpacaCredsForm] = useState(false);
  const [alpacaApiKey, setAlpacaApiKey] = useState('');
  const [alpacaSecretKey, setAlpacaSecretKey] = useState('');
  const [savingAlpacaCreds, setSavingAlpacaCreds] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Stati per le nuove impostazioni di rischio e bot
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [showLlmSettings, setShowLlmSettings] = useState(false);
  const [maxPos, setMaxPos] = useState<number>(10);
  const [tf, setTf] = useState<number>(15);
  const [risk, setRisk] = useState<number>(10);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Sincronizza i parametri correnti recuperati dal server
  useEffect(() => {
    if (status) {
      setMaxPos(status.maxConcurrentPositions ?? 10);
      setTf(status.timeframe ?? 15);
      setRisk(status.riskPercentage ?? 95);
    }
  }, [status]);

  const handleUpdateStrategy = async (symbol: string, strategy: 'Prudente' | 'Conservativa' | 'Aggressiva') => {
    try {
      const response = await fetch('/api/trading/position-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: type, symbol, strategy })
      });
      if (response.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Error updating strategy:', err);
    }
  };

  const handleOpenCredsForm = async () => {
    setShowAlpacaCredsForm(!showAlpacaCredsForm);
    setShowSettingsForm(false);
    setShowLlmSettings(false);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/trading/credentials');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const alpacaCreds = data.config?.alpaca?.[type === 'live' ? 'real' : 'paper'] || data.config?.alpaca?.[type === 'live' ? 'live' : 'paper'] || {};
        setAlpacaApiKey(alpacaCreds.apiKey || alpacaCreds.username || '');
        setAlpacaSecretKey(alpacaCreds.secretKey || alpacaCreds.password || '');
      }
    } catch (e) {
      console.error('Errore durante il recupero delle credenziali:', e);
    }
  };

  const handleOpenSettingsForm = () => {
    setShowSettingsForm(!showSettingsForm);
    setShowAlpacaCredsForm(false);
    setShowLlmSettings(false);
    setSettingsStatus(null);
  };

  const handleSaveAlpacaCreds = async () => {
    setSavingAlpacaCreds(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/trading/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: 'alpaca',
          env: type === 'live' ? 'real' : 'paper',
          credentials: {
            apiKey: alpacaApiKey.trim(),
            secretKey: alpacaSecretKey.trim()
          }
        })
      });
      if (res.ok) {
        setSaveStatus({ success: true, message: 'Credenziali salvate con successo!' });
        if (fetchStatus) {
          await fetchStatus();
        }
        setTimeout(() => setShowAlpacaCredsForm(false), 1500);
      } else {
        setSaveStatus({ success: false, message: 'Errore durante il salvataggio.' });
      }
    } catch (e: any) {
      setSaveStatus({ success: false, message: e.message || 'Errore di rete.' });
    } finally {
      setSavingAlpacaCreds(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsStatus(null);
    try {
      const res = await fetch('/api/trading/alpaca-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConcurrentPositions: Number(maxPos),
          timeframe: Number(tf),
          riskPercentage: Number(risk)
        })
      });
      if (res.ok) {
        setSettingsStatus({ success: true, message: 'Parametri del bot e del rischio salvati con successo!' });
        if (fetchStatus) {
          await fetchStatus();
        }
        setTimeout(() => setShowSettingsForm(false), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setSettingsStatus({ success: false, message: data.message || 'Errore nel salvataggio dei parametri.' });
      }
    } catch (e: any) {
      setSettingsStatus({ success: false, message: e.message || 'Errore di rete.' });
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(`alpaca_${type}_wrapLogs`, String(wrapLogs));
  }, [wrapLogs, type]);

  useEffect(() => {
    localStorage.setItem(`alpaca_${type}_reverseLogs`, String(reverseLogs));
  }, [reverseLogs, type]);

  useEffect(() => {
    localStorage.setItem(`alpaca_${type}_showTimestamps`, String(showTimestamps));
  }, [showTimestamps, type]);

  return (
    <div className={`flex-1 border rounded-xl overflow-hidden ${type === 'live' ? 'border-emerald-200' : 'border-indigo-200'} bg-white shadow-sm`}>
      <div 
        className={`p-3 sm:p-4 border-b ${type === 'live' ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'} flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center cursor-pointer select-none`}
        onClick={() => setIsAccountCollapsed(!isAccountCollapsed)}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2 className={`font-semibold text-sm sm:text-base ${type === 'live' ? 'text-emerald-800' : 'text-indigo-800'} flex items-center gap-2`}>
              {type === 'live' ? <TrendingUp className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
              {title}
              {isAccountCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4" />}
            </h2>
            <span className={`px-2 py-0.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-md ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {isActive ? 'ATTIVO' : 'FERMO'}
            </span>
        </div>
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-slate-600 flex items-center gap-1.5 sm:gap-2">
            <span>Iniziale: <strong className="text-slate-900">${initialCapital.toFixed(2)}</strong></span>
            <span className={`px-1.5 py-0.5 rounded font-bold ${pnlPercent >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </span>
          </div>
          <button
              onClick={() => onToggle(type)}
              className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
              isActive
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : type === 'live' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
          >
              {isActive ? (
              <><Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> Ferma Bot {type === 'live' ? 'Live' : 'Paper'}</>
              ) : (
              <><Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> Avvia Bot {type === 'live' ? 'Live' : 'Paper'}</>
              )}
          </button>
        </div>
      </div>

      <div className={`p-3 sm:p-4 space-y-4 sm:space-y-6 ${isAccountCollapsed ? 'hidden' : ''}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="text-xs sm:text-sm text-gray-500">Saldo Equity & Performance</div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="text-xs text-gray-500">Iniziale: <span className="font-semibold text-gray-800">${initialCapital.toFixed(2)}</span></div>
              <div className={`text-xs font-bold px-2 py-1 rounded-md ${pnlPercent >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}% ({(pnlDiff >= 0 ? '+' : '') + '$' + pnlDiff.toFixed(2)})
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">${currentBalance.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Capitale Investito</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-base sm:text-lg font-bold text-slate-950 font-mono">${investedCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-400 font-medium font-mono">({(currentBalance > 0 ? (investedCapital / currentBalance) * 100 : 0).toFixed(1)}% NAV)</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Capitale Residuo</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-base sm:text-lg font-bold text-emerald-600 font-mono">${cashCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-400 font-medium font-mono">({(currentBalance > 0 ? (cashCapital / currentBalance) * 100 : 0).toFixed(1)}% NAV)</span>
              </div>
            </div>
          </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm gap-1 sm:gap-2">
          <div className="text-gray-500 font-medium">Broker</div>
          <div className="flex flex-col sm:items-end">
            <div className={`font-medium ${account.isConfigured && !account.errorAlpaca ? 'text-green-600' : 'text-rose-600'}`}>
              {account.modeLabel}
            </div>
            {account.errorAlpaca && (
              <div className="text-[10px] text-rose-500 font-semibold text-left sm:text-right mt-0.5 max-w-[250px] leading-tight">
                ⚠️ Autenticazione Fallita
              </div>
            )}
            <div className="flex gap-2 justify-start sm:justify-end mt-1 flex-wrap">
              <button
                onClick={() => {
                  setShowLlmSettings(!showLlmSettings);
                  setShowSettingsForm(false);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline bg-transparent border-none cursor-pointer p-0"
              >
                [Configura Chiavi & LLM]
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleOpenSettingsForm}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline bg-transparent border-none cursor-pointer p-0"
              >
                [Parametri Bot & Rischio]
              </button>
            </div>
          </div>
        </div>

        {showSettingsForm && (
          <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-4 mt-2 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-indigo-400 uppercase">Parametri di Rischio & Gestione Operazioni</h4>
              <span className="text-[10px] text-slate-400">Salvate nel Cloud</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-left">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Max Operazioni Contemporanee</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={maxPos}
                  onChange={(e) => setMaxPos(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                />
                <span className="text-[9px] text-slate-500 mt-0.5 block">N. massimo di posizioni aperte in parallelo.</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Timeframe di Ciclo (Minuti)</label>
                <select
                  value={tf}
                  onChange={(e) => setTf(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                >
                  <option value={5}>5 Minuti</option>
                  <option value={15}>15 Minuti</option>
                  <option value={30}>30 Minuti</option>
                  <option value={60}>60 Minuti (1 Ora)</option>
                </select>
                <span className="text-[9px] text-slate-500 mt-0.5 block">Intervallo per il ricalcolo del sentiment via LLM.</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Target Allocazione Capitale (%)</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={risk}
                  onChange={(e) => setRisk(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                />
                <span className="text-[9px] text-slate-500 mt-0.5 block">Quota totale dell'equity distribuita sul mercato (fino al 95%).</span>
              </div>
            </div>

            {/* Regole Attive Automatiche */}
            <div className="mt-3 p-3 bg-slate-800/80 border border-indigo-500/30 rounded-lg space-y-1.5 text-[11px] text-slate-300">
              <div className="font-semibold text-indigo-300 text-xs flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Regole Automatiche di Rischio & Liquidità Attive:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                <li><strong className="text-amber-300">Chiusura Preventiva P&L (-0.80%):</strong> Se un asset in portafoglio raggiunge un P&L ≤ -0.80% e sentiment &lt; 0.20, viene chiuso per liberare slot ad asset con sentiment &gt; 0.40.</li>
                <li><strong className="text-rose-300">Protezione Liquidità (&lt; 0.15):</strong> Vendita immediata se il sentiment scende &lt; 0.15, a meno che il VIX non sia in calo &gt; 2% nelle ultime 24 ore.</li>
                <li><strong className="text-indigo-300">Filtro Acquisti EOD (&lt; 30m):</strong> Nuovi acquisti bloccati se il Sentiment aggregato mostra un trend decrescente per 2 scansioni consecutive e mancano &lt; 30 min alla chiusura.</li>
                <li><strong className="text-emerald-300">Stagnazione Temporale (60m / 30m):</strong> Chiusura automatica in stasi (P&L ≤ +0.10%): stasi di 60 min per sentiment &gt; 0.30, 30 min per sentiment tra 0.20 e 0.29.</li>
              </ul>
            </div>

            {settingsStatus && (
              <div className={`p-2.5 rounded-lg text-xs font-sans ${settingsStatus.success ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-200' : 'bg-rose-950/40 border border-rose-800 text-rose-200'}`}>
                {settingsStatus.message}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer border-none"
              >
                {savingSettings ? 'Salvataggio...' : 'SALVA IMPOSTAZIONI'}
              </button>
              <button
                onClick={() => setShowSettingsForm(false)}
                disabled={savingSettings}
                className="flex-1 bg-slate-800 text-slate-400 font-bold py-2 rounded-lg text-xs hover:bg-slate-700 transition cursor-pointer border-none"
              >
                CHIUDI
              </button>
            </div>
          </div>
        )}

        {showLlmSettings && <LLMSettings />}

        {/* Positions */}
        {account.positions && account.positions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2 border-b pb-1">
              <h3 className="text-sm font-medium text-gray-900">Posizioni Aperte</h3>
              <button
                onClick={() => onOpenForceBuy && onOpenForceBuy()}
                className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shadow-sm flex items-center gap-1 cursor-pointer"
                title="Forza l'acquisto di quote a mercato su Alpaca"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Forza Acquisto</span>
              </button>
            </div>
            <div className="space-y-2">
              {account.positions.map((pos, i) => {
                const qtyNum = parseFloat(pos.qty);
                const formattedQty = qtyNum % 1 === 0 ? qtyNum.toString() : qtyNum.toFixed(4);
                const avgPrice = parseFloat(pos.avg_entry_price || '0');
                const currPrice = parseFloat(pos.current_price || '0');
                return (
                  <div key={i} className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100 gap-2.5">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center text-sm gap-2 sm:gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-base">{pos.symbol}</span>
                          <SentimentBadge symbol={pos.symbol} signals={status?.geminiSignals} showReasoning={true} />
                          <span className="text-gray-500 text-xs block sm:inline">({formattedQty} quote)</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <div>
                            <span className="text-gray-400">Prezzo acq: </span>
                            <span className="font-mono font-medium text-gray-800">${avgPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Quot. attuale: </span>
                            <span className="font-mono font-medium text-gray-800">${currPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Investimento nominale: </span>
                            <span className="font-mono font-bold text-slate-800">${(pos.nominalInvestment || (avgPrice * qtyNum)).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <div className={`font-semibold flex items-center gap-1.5 ${parseFloat(pos.unrealized_pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <span>{parseFloat(pos.unrealized_pl) >= 0 ? '+' : ''}{parseFloat(pos.unrealized_pl).toFixed(2)}$</span>
                          {pos.unrealized_plpc !== undefined && (
                            <span className="text-xs font-semibold opacity-95 px-1.5 py-0.5 rounded bg-current/10">
                              ({parseFloat(pos.unrealized_plpc) >= 0 ? '+' : ''}{(parseFloat(pos.unrealized_plpc) * 100).toFixed(2)}%)
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => onOpenForceBuy && onOpenForceBuy(pos.symbol)}
                          className="px-2 py-1 text-xs font-bold rounded text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
                          title="Forza l'acquisto di ulteriori quote"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Acquista</span>
                        </button>

                        {confirmCloseSymbol?.symbol === pos.symbol && confirmCloseSymbol?.type === type ? (
                          <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-md border border-red-200">
                            <button
                              onClick={() => onClosePosition(pos.symbol, type)}
                              disabled={closingSymbols.includes(pos.symbol)}
                              className="px-2 py-0.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {closingSymbols.includes(pos.symbol) ? '...' : 'Chiudi'}
                            </button>
                            <button
                              onClick={() => setConfirmCloseSymbol(null)}
                              disabled={closingSymbols.includes(pos.symbol)}
                              className="p-0.5 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer disabled:opacity-50"
                              title="Annulla"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmCloseSymbol({ symbol: pos.symbol, type })}
                            disabled={closingSymbols.includes(pos.symbol)}
                            className="p-1 px-2 text-xs font-semibold rounded text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            title="Chiudi Posizione"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Chiudi</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Selector per le 3 Strategie consigliate ed editabili in real-time */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-1">Strategia di Gestione:</span>
                        {(['Prudente', 'Conservativa', 'Aggressiva'] as const).map((strat) => {
                          const isSelected = pos.activeStrategy === strat;
                          return (
                            <button
                              key={strat}
                              onClick={() => handleUpdateStrategy(pos.symbol, strat)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded transition duration-200 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-sm font-bold scale-[1.02]'
                                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 hover:text-gray-900'
                              }`}
                            >
                              {strat === 'Prudente' ? '🛡️ Prudente' : strat === 'Conservativa' ? '⚖️ Conservativa' : '🚀 Aggressiva'}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono italic">
                        {pos.activeStrategy === 'Prudente' && 'Stop Loss: -0.40% | Target Attivazione: +0.80% | Trailing: 0.30%'}
                        {pos.activeStrategy === 'Conservativa' && 'Stop Loss: -0.75% | Target Attivazione: +1.50% | Trailing: 1.00%'}
                        {pos.activeStrategy === 'Aggressiva' && 'Stop Loss: -1.00% | Target Attivazione: +2.50% | Trailing: 0.50%'}
                      </div>
                    </div>

                    {/* Real-time Take Profit & Trailing Stop Level Indicator */}
                    <div className="mt-1.5 p-2 bg-white rounded-md border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${pos.isTrailingActive ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-blue-50 text-blue-700'}`}>
                          {pos.isTrailingActive ? '🚀 Trailing Stop Attivo!' : '🎯 In attesa Target Attivazione'}
                        </span>
                        <span className="text-gray-700">
                          {pos.isTrailingActive ? (
                            <>Soglia Trailing (Picco: <strong className="font-mono text-gray-900">${pos.highestPrice?.toFixed(2)}</strong>): <strong className="font-mono text-emerald-600 font-bold">${pos.trailingStopPrice?.toFixed(2)}</strong> (-{pos.strategyParams?.tsPct || 0}%)</>
                          ) : (
                            <>Target Attivazione (+{pos.strategyParams?.tpPct || 2.5}%): <strong className="font-mono text-blue-600 font-bold">${pos.targetActivationPrice?.toFixed(2)}</strong></>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-gray-500">
                        Stop Loss: <span className="text-red-600 font-semibold">${pos.stopLossPrice?.toFixed(2)}</span> ({pos.strategyParams?.slPct || -1.0}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* System Logs */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-1 mb-2">
            <h3 className="text-sm font-medium text-gray-900">Log Operativi</h3>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={wrapLogs}
                  onChange={(e) => setWrapLogs(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer"
                />
                <span>A capo automatico</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reverseLogs}
                  onChange={(e) => setReverseLogs(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer"
                />
                <span>Ordine inverso</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer"
                />
                <span>Mostra timestamp</span>
              </label>
            </div>
          </div>
          <div className="bg-gray-900 text-gray-300 p-3 rounded-lg text-xs font-mono h-40 overflow-y-auto flex flex-col gap-1">
            {(() => {
              const rawLogs = account.logs || [];
              const processedLogs = reverseLogs ? rawLogs : [...rawLogs].reverse();
              
              if (processedLogs.length === 0) {
                return <div className="text-gray-500">Nessun log disponibile...</div>;
              }

              const formatLogMsg = (msg: string) => {
                const timestampRegex = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]\s*/;
                const match = msg.match(timestampRegex);
                if (match) {
                  const rawMsg = msg.replace(timestampRegex, '');
                  if (showTimestamps) {
                    const date = new Date(match[1]);
                    const formatted = isNaN(date.getTime()) ? match[1] : date.toLocaleString('it-IT');
                    return `[${formatted}] ${rawMsg}`;
                  } else {
                    return rawMsg;
                  }
                }
                return msg;
              };

              return processedLogs.map((log, i) => {
                const formattedText = formatLogMsg(log);
                return (
                  <div
                    key={i}
                    className={`${
                      log.includes('Acquistato') || log.includes('ACQUISTO') ? 'text-green-400' : 
                      log.includes('Venduto') || log.includes('VENDITA') ? 'text-red-400' : 
                      log.includes('Errore') ? 'text-red-500 font-bold' :
                      'text-gray-400'
                    } ${wrapLogs ? 'break-words whitespace-pre-wrap' : 'whitespace-nowrap overflow-x-auto truncate'}`}
                  >
                    {formattedText}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title?: string;
    duration?: number;
  }

  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', title?: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type, title, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'paper' | 'live'>('paper');

  const [closingSymbols, setClosingSymbols] = useState<string[]>([]);
  const [confirmCloseSymbol, setConfirmCloseSymbol] = useState<{ symbol: string; type: 'paper' | 'live' } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [copiedDebriefRule, setCopiedDebriefRule] = useState(false);
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);
  const [panicLoading, setPanicLoading] = useState(false);
  const [showProTerminal, setShowProTerminal] = useState(false);
  const [forceBuyModalOpen, setForceBuyModalOpen] = useState(false);
  const [forceBuySymbol, setForceBuySymbol] = useState('');

  const handleOpenForceBuy = (sym?: string) => {
    setForceBuySymbol(sym || '');
    setForceBuyModalOpen(true);
  };

  // Valutazioni su periodi superiori al giorno con scelta degli intervalli di tempo
  const [rangeStartDate, setRangeStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [rangeEndDate, setRangeEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [rangeDebrief, setRangeDebrief] = useState<{ analysis: string, suggestedRule: string } | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [copiedRangeRule, setCopiedRangeRule] = useState(false);

  // Momentum discovery states and handlers
  interface MomentumAsset {
    symbol: string;
    name: string;
    momentumScore: number;
    recentPerformance: string;
    reasoning: string;
    catalyst: string;
    isAlreadyMonitored: boolean;
  }
  const [momentumAssets, setMomentumAssets] = useState<MomentumAsset[]>([]);
  const [momentumLoading, setMomentumLoading] = useState(false);

  const [isOperationsCollapsed, setIsOperationsCollapsed] = useState(false);
  const [isAlpacaFillsCollapsed, setIsAlpacaFillsCollapsed] = useState(false);
  const [isMomentumCollapsed, setIsMomentumCollapsed] = useState(false);
  const [isClosedOperationsCollapsed, setIsClosedOperationsCollapsed] = useState(false);
  const [isDailyDebriefCollapsed, setIsDailyDebriefCollapsed] = useState(false);
  const [isPeriodicDebriefCollapsed, setIsPeriodicDebriefCollapsed] = useState(false);
  const [isMotivationCollapsed, setIsMotivationCollapsed] = useState(false);
  const [isFeedbackCollapsed, setIsFeedbackCollapsed] = useState(false);
  const [isLogicLogsCollapsed, setIsLogicLogsCollapsed] = useState(false);
  const [isApiSettingsCollapsed, setIsApiSettingsCollapsed] = useState(false);

  // Stato per la Sezione Operazioni Chiuse con Filtro Data
  const [closedTrades, setClosedTrades] = useState<any[]>([]);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedStartDate, setClosedStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [closedEndDate, setClosedEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [closedSymbolFilter, setClosedSymbolFilter] = useState('');
  const [closedPnlFilter, setClosedPnlFilter] = useState<'all' | 'profit' | 'loss'>('all');

  const exportClosedTradesCSV = () => {
    if (!closedTrades || closedTrades.length === 0) return;
    const headers = ['ID', 'DataOra', 'Simbolo', 'Azione', 'PnL', 'Quantita', 'PrezzoUscita', 'Controvalore', 'Motivazione', 'Origine'];
    const rows = closedTrades.map(t => [
      t.id || '',
      t.timestamp || '',
      t.symbol || '',
      t.action || '',
      t.pnl || 0,
      t.qty || 0,
      t.price || 0,
      t.totalValue || 0,
      `"${(t.reason || '').replace(/"/g, '""')}"`,
      t.source || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `operazioni_chiuse_${selectedTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchClosedPositions = async () => {
    setClosedLoading(true);
    try {
      const params = new URLSearchParams({
        mode: selectedTab,
        startDate: closedStartDate,
        endDate: closedEndDate,
        symbol: closedSymbolFilter
      });
      const res = await fetch(`/api/closed-positions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setClosedTrades(data.closedTrades || []);
        }
      }
    } catch (err: any) {
      console.error("Errore recupero operazioni chiuse:", err);
    } finally {
      setClosedLoading(false);
    }
  };

  const handleImportBackupJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('Caricamento ed elaborazione del file di backup in corso...', 'info', 'Backup JSON');
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });

      if (res.ok) {
        const data = await res.json();
        showToast('Backup completo (Chiavi API, Loop, Stato e Log) importato con successo!', 'success', 'Ripristino Backup');
        fetchStatus();
        fetchOperations();
        fetchClosedPositions();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Errore durante l'importazione: ${err.message || 'File non valido'}`, 'error', 'Ripristino Backup');
      }
    } catch (err: any) {
      showToast(`File JSON non valido: ${err.message}`, 'error', 'Ripristino Backup');
    } finally {
      e.target.value = '';
    }
  };

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);

  const handleDownloadCustomReport = () => {
    window.location.href = `/api/report/download?startDate=${reportStartDate}&endDate=${reportEndDate}`;
    setShowReportModal(false);
  };

  const fetchMomentumAssets = async () => {
    setMomentumLoading(true);
    try {
      const res = await fetch('/api/momentum-assets');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMomentumAssets(data.assets || []);
        }
      }
    } catch (err: any) {
      console.error("Errore nel caricamento degli asset con momentum:", err);
    } finally {
      setMomentumLoading(false);
    }
  };

  const handleToggleWatchlist = async (symbol: string, isAlreadyMonitored: boolean) => {
    try {
      const endpoint = isAlreadyMonitored ? '/api/watchlist/remove' : '/api/watchlist/add';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          showToast(
            isAlreadyMonitored 
              ? `Asset ${symbol} rimosso con successo dal monitoraggio del Bot.`
              : `Asset ${symbol} aggiunto al monitoraggio del Bot! Verrà analizzato e scambiato automaticamente.`,
            'success',
            'Watchlist Bot'
          );
          fetchStatus();
          setMomentumAssets(prev => prev.map(asset => {
            if (asset.symbol === symbol) {
              return { ...asset, isAlreadyMonitored: !isAlreadyMonitored };
            }
            return asset;
          }));
        } else {
          showToast(`Errore: ${data.message || 'Operazione fallita'}`, 'error', 'Watchlist Bot');
        }
      }
    } catch (err: any) {
      showToast(`Errore di rete: ${err.message}`, 'error', 'Watchlist Bot');
    }
  };

  // Operations and performance states
  const [operationsData, setOperationsData] = useState<{
    activities: any[];
    positions: any[];
    dailyLogicLogs: any[];
    isAlpacaConfigured: boolean;
  } | null>(null);
  const [operationsLoading, setOperationsLoading] = useState(false);

  // Funzione per impostare rapidamente l'intervallo temporale selezionato
  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setRangeStartDate(start.toISOString().split('T')[0]);
    setRangeEndDate(end.toISOString().split('T')[0]);
  };

  // Calcolo dinamico delle metriche di performance aggregate (Win Rate, Profit Factor, Max Drawdown)
  const performanceMetrics = useMemo(() => {
    const activities = operationsData?.activities || [];
    const dailyPnL = status?.[selectedTab]?.dailyPnL || [];

    // 1. Trova tutti i closed trades tramite abbinamento FIFO (First-In, First-Out) dei fill Alpaca
    const symbols = Array.from(new Set(activities.map((a: any) => a.symbol).filter(Boolean)));
    let closedTrades: { symbol: string; pnl: number; cost: number; return: number; date: string; side: string }[] = [];

    symbols.forEach((sym: any) => {
      const symbolFills = activities
        .filter((act: any) => (act.activity_type === 'FILL' || act.type === 'fill') && act.symbol === sym)
        .sort((a: any, b: any) => new Date(a.transaction_time || a.timestamp).getTime() - new Date(b.transaction_time || b.timestamp).getTime());

      let buyQueue: { qty: number; price: number; date: string }[] = [];
      let sellQueue: { qty: number; price: number; date: string }[] = [];

      symbolFills.forEach((fill: any) => {
        const qty = parseFloat(fill.qty || '0');
        const price = parseFloat(fill.price || '0');
        const isBuy = (fill.side || '').toUpperCase() === 'BUY';
        const date = fill.transaction_time || fill.timestamp;

        if (qty <= 0 || price <= 0) return;

        if (isBuy) {
          if (sellQueue.length > 0) {
            let remainingQty = qty;
            while (remainingQty > 0 && sellQueue.length > 0) {
              const firstSell = sellQueue[0];
              const matchedQty = Math.min(remainingQty, firstSell.qty);
              const pnl = matchedQty * (firstSell.price - price);
              closedTrades.push({
                symbol: sym,
                pnl,
                cost: matchedQty * price,
                return: matchedQty * firstSell.price,
                date,
                side: 'SHORT_CLOSE'
              });
              remainingQty -= matchedQty;
              firstSell.qty -= matchedQty;
              if (firstSell.qty <= 0) sellQueue.shift();
            }
            if (remainingQty > 0) buyQueue.push({ qty: remainingQty, price, date });
          } else {
            buyQueue.push({ qty, price, date });
          }
        } else {
          if (buyQueue.length > 0) {
            let remainingQty = qty;
            while (remainingQty > 0 && buyQueue.length > 0) {
              const firstBuy = buyQueue[0];
              const matchedQty = Math.min(remainingQty, firstBuy.qty);
              const pnl = matchedQty * (price - firstBuy.price);
              closedTrades.push({
                symbol: sym,
                pnl,
                cost: matchedQty * firstBuy.price,
                return: matchedQty * price,
                date,
                side: 'LONG_CLOSE'
              });
              remainingQty -= matchedQty;
              firstBuy.qty -= matchedQty;
              if (firstBuy.qty <= 0) buyQueue.shift();
            }
            if (remainingQty > 0) sellQueue.push({ qty: remainingQty, price, date });
          } else {
            sellQueue.push({ qty, price, date });
          }
        }
      });
    });

    // Filtriamo i trade chiusi per l'intervallo temporale selezionato
    const filteredTrades = closedTrades.filter(t => {
      const d = (t.date || '').substring(0, 10);
      return d >= rangeStartDate && d <= rangeEndDate;
    });

    // Calcolo del Win Rate
    const totalTrades = filteredTrades.length;
    const winningTrades = filteredTrades.filter(t => t.pnl > 0).length;
    const losingTrades = filteredTrades.filter(t => t.pnl < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Calcolo del Profit Factor
    const grossProfit = filteredTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(filteredTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99.9 : 1.0);
    const netPnL = grossProfit - grossLoss;

    // Calcolo del Drawdown Massimo basato sulla cronologia dei saldi del periodo selezionato
    const pnlHistory = dailyPnL
      .filter((d: any) => {
        const cleanDate = (d.date || '').substring(0, 10);
        return cleanDate >= rangeStartDate && cleanDate <= rangeEndDate;
      })
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    let maxBalance = 0;
    let maxDrawdownPercent = 0;
    let maxDrawdownAmount = 0;

    pnlHistory.forEach((day: any) => {
      const bal = day.balance;
      if (bal > maxBalance) {
        maxBalance = bal;
      }
      if (maxBalance > 0) {
        const ddAmount = maxBalance - bal;
        const ddPercent = (ddAmount / maxBalance) * 100;
        if (ddPercent > maxDrawdownPercent) {
          maxDrawdownPercent = ddPercent;
          maxDrawdownAmount = ddAmount;
        }
      }
    });

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      grossProfit,
      grossLoss,
      profitFactor,
      netPnL,
      maxDrawdownPercent,
      maxDrawdownAmount,
      pnlHistory,
      filteredTrades
    };
  }, [operationsData, status, selectedTab, rangeStartDate, rangeEndDate]);

  const fetchOperations = async (silent = false) => {
    try {
      if (!silent) setOperationsLoading(true);
      const res = await fetch(`/api/operations?mode=${selectedTab}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data.success) {
            setOperationsData({
              activities: data.activities || [],
              positions: data.positions || [],
              dailyLogicLogs: data.dailyLogicLogs || [],
              isAlpacaConfigured: data.isAlpacaConfigured
            });
          }
        } else {
          console.warn('Expected JSON response from /api/operations, received alternative content type.');
        }
      }
    } catch (err: any) {
      if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        console.warn('[Network Notice] Connessione al server in corso, prossimo ripristino in automatico...');
      } else {
        console.error('Error fetching operations:', err);
      }
    } finally {
      if (!silent) setOperationsLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
    fetchClosedPositions();
  }, [selectedTab, closedStartDate, closedEndDate]);

  const handleGenerateRangeDebrief = async () => {
    setRangeLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/generate-range-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: rangeStartDate,
          endDate: rangeEndDate,
          mode: selectedTab
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRangeDebrief({
            analysis: data.analysis,
            suggestedRule: data.suggestedRule
          });
          const successMsg = 'Valutazione di periodo generata con successo!';
          setSuccessMessage(successMsg);
          showToast(successMsg, 'success', 'Analisi Periodo');
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          const errMsg = `Impossibile generare la valutazione di periodo: ${data.error || 'Errore sconosciuto'}`;
          setErrorMessage(errMsg);
          showToast(errMsg, 'error', 'Analisi Periodo');
        }
      } else {
        const errData = await res.json().catch(() => ({ error: 'Errore generico del server' }));
        const errMsg = `Errore del server: ${errData.error || 'Generazione fallita'}`;
        setErrorMessage(errMsg);
        showToast(errMsg, 'error', 'Analisi Periodo');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = `Errore di rete: ${err.message}`;
      setErrorMessage(errMsg);
      showToast(errMsg, 'error', 'Analisi Periodo');
    } finally {
      setRangeLoading(false);
    }
  };

  const handlePanicLiquidate = async () => {
    setPanicLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/panic-liquidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({ success: false, message: 'Errore di risposta del server.' }));
      if (res.ok && data.success) {
        const msg = '💥 LIQUIDAZIONE DI EMERGENZA COMPLETATA! Tutti i conti sono stati azzerati ed il bot è stato arrestato.';
        setSuccessMessage(msg);
        showToast(msg, 'success', 'Liquidazione d\'Emergenza', 8000);
        setTimeout(() => setSuccessMessage(null), 10000);
        setShowPanicConfirm(false);
        fetchStatus();
      } else {
        const errMsg = `Errore durante la liquidazione di emergenza: ${data.message || 'Errore sconosciuto'}`;
        setErrorMessage(errMsg);
        showToast(errMsg, 'error', 'Liquidazione d\'Emergenza', 8000);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = `Errore di rete durante la liquidazione di emergenza: ${err.message}`;
      setErrorMessage(errMsg);
      showToast(errMsg, 'error', 'Liquidazione d\'Emergenza', 8000);
    } finally {
      setPanicLoading(false);
    }
  };

  const handleGenerateDebrief = async () => {
    setDebriefLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/generate-daily-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.debrief) {
          setStatus(prev => prev ? { ...prev, latestDailyDebrief: data.debrief } : null);
          const msg = 'Debriefing Giornaliero AI generato con successo!';
          setSuccessMessage(msg);
          showToast(msg, 'success', 'AI Debriefing');
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          const errMsg = `Impossibile generare il debriefing: ${data.error || 'Errore sconosciuto'}`;
          setErrorMessage(errMsg);
          showToast(errMsg, 'error', 'AI Debriefing');
        }
      } else {
        const errData = await res.json().catch(() => ({ error: 'Errore generico del server' }));
        const errMsg = `Errore del server: ${errData.error || 'Generazione fallita'}`;
        setErrorMessage(errMsg);
        showToast(errMsg, 'error', 'AI Debriefing');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = `Errore di rete: ${err.message}`;
      setErrorMessage(errMsg);
      showToast(errMsg, 'error', 'AI Debriefing');
    } finally {
      setDebriefLoading(false);
    }
  };

  const handleClosePosition = async (symbol: string, type: 'paper' | 'live') => {
    setClosingSymbols(prev => [...prev, symbol]);
    setConfirmCloseSymbol(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: type, symbol })
      });
      if (res.ok) {
        const msg = `Chiusura della posizione di ${symbol} avviata con successo su Alpaca.`;
        setSuccessMessage(msg);
        showToast(msg, 'success', 'Posizione Chiusa');
        setTimeout(() => setSuccessMessage(null), 5000);
        fetchStatus();
      } else {
        const data = await res.json().catch(() => ({ message: 'Errore durante la chiusura.' }));
        const errMsg = `Impossibile chiudere la posizione di ${symbol}: ${data.message}`;
        setErrorMessage(errMsg);
        showToast(errMsg, 'error', 'Chiusura Posizione');
        setTimeout(() => setErrorMessage(null), 6000);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = `Errore di rete: ${err.message}`;
      setErrorMessage(errMsg);
      showToast(errMsg, 'error', 'Chiusura Posizione');
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setClosingSymbols(prev => prev.filter(s => s !== symbol));
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data: BotStateResponse = await res.json();
          setStatus(data.status);
        } else {
          console.warn('Expected JSON response from /api/status, received alternative content type.');
        }
      }
      // Silently fetch operations data to keep lists updated in real-time
      fetchOperations(true);
    } catch (error: any) {
      if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
        console.warn('[Network Notice] Aggiornamento stato bot temporaneamente in attesa del server...');
      } else {
        console.error('Error fetching bot status:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchMomentumAssets();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleBot = async (target?: 'paper' | 'live' | 'both') => {
    try {
      const res = await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        const data: BotStateResponse = await res.json();
        setStatus(data.status);
        
        const label = target === 'live' ? 'Reale' : (target === 'paper' ? 'Simulazione' : 'Bot');
        const isActiveNow = target === 'live' ? data.status.liveActive : (target === 'paper' ? data.status.paperActive : (data.status.paperActive || data.status.liveActive));
        showToast(
          `Stato del Bot (${label}) aggiornato con successo: ora è ${isActiveNow ? 'ATTIVO' : 'FERMO'}.`,
          isActiveNow ? 'success' : 'warning',
          'Stato Bot'
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(
          `Impossibile cambiare lo stato del Bot: ${errData.message || 'Errore del server.'}`,
          'error',
          'Stato Bot'
        );
      }
    } catch (error: any) {
      console.error('Error toggling bot:', error);
      showToast(
        `Errore di rete durante la modifica dello stato del Bot: ${error.message}`,
        'error',
        'Stato Bot'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Inizializzazione del motore di trading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-3 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              Pannello di Controllo Trading
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Gestisci separatamente i conti Simulazione (Paper) e Reale (Live)</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">

            {/* Bottone di Panico / Panic Button */}
            <button
              onClick={() => setShowPanicConfirm(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-red-600 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-md hover:bg-red-700 active:scale-95 transition-all cursor-pointer border-none flex-1 sm:flex-none"
            >
              <Flame className="w-3.5 h-3.5 animate-pulse" />
              PANIC BUTTON
            </button>

            {/* Versione Nuova / Pro Terminal Button */}
            <button
              onClick={() => setShowProTerminal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-md hover:from-indigo-700 hover:to-violet-700 active:scale-95 transition-all cursor-pointer border-none flex-1 sm:flex-none"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Versione Nuova
            </button>

            {/* Bottone Forza Acquisto Manuale */}
            <button
              onClick={() => handleOpenForceBuy()}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-md hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer border-none flex-1 sm:flex-none"
              title="Forza l'acquisto di quote su uno strumento"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Forza Acquisto
            </button>

            <div className="flex gap-1.5 sm:gap-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
             <button
               onClick={() => setSelectedTab('paper')}
               className={`flex-1 sm:flex-initial px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all text-center ${
                 selectedTab === 'paper' 
                   ? 'bg-white text-indigo-700 shadow-sm' 
                   : 'text-gray-500 hover:text-gray-700'
               }`}
             >
               Simulazione (Paper)
             </button>
             <button
               onClick={() => setSelectedTab('live')}
               className={`flex-1 sm:flex-initial px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all text-center ${
                 selectedTab === 'live' 
                   ? 'bg-white text-emerald-700 shadow-sm' 
                   : 'text-gray-500 hover:text-gray-700'
               }`}
             >
               Reale (Live)
             </button>
          </div>
         </div>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="p-4 bg-green-50 text-green-800 border border-green-200 rounded-xl text-sm font-medium flex justify-between items-center shadow-sm animate-pulse">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-medium flex justify-between items-center shadow-sm">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Pannello Conto (Comprimibile, default chiuso) */}
        <div>
          {selectedTab === 'paper' && status?.paper && (
            <AccountPanel 
              status={status}
              account={status.paper} 
              title="Conto Simulazione (Paper)" 
              isActive={!!status.paperActive} 
              type="paper" 
              onToggle={toggleBot} 
              onClosePosition={handleClosePosition}
              closingSymbols={closingSymbols}
              confirmCloseSymbol={confirmCloseSymbol}
              setConfirmCloseSymbol={setConfirmCloseSymbol}
              fetchStatus={fetchStatus}
              onOpenForceBuy={handleOpenForceBuy}
            />
          )}
          {selectedTab === 'live' && status?.live && (
            <AccountPanel 
              status={status}
              account={status.live} 
              title="Conto Reale (Live)" 
              isActive={!!status.liveActive} 
              type="live" 
              onToggle={toggleBot} 
              onClosePosition={handleClosePosition}
              closingSymbols={closingSymbols}
              confirmCloseSymbol={confirmCloseSymbol}
              setConfirmCloseSymbol={setConfirmCloseSymbol}
              fetchStatus={fetchStatus}
              onOpenForceBuy={handleOpenForceBuy}
            />
          )}
        </div>

        {/* 3. Analisi Sentiment & Segnali Gemini AI (Comprimibile) */}
        <GeminiSignalsTicker onOpenForceBuy={handleOpenForceBuy} />

        {/* 5. Operazioni, Performance & Fills (Comprimibile) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div 
              className="cursor-pointer select-none hover:opacity-85 transition-opacity flex-1" 
              onClick={() => setIsOperationsCollapsed(!isOperationsCollapsed)}
            >
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <span>Operazioni, Performance & Fills</span>
                {isOperationsCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-indigo-600" />}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitora in tempo reale le posizioni attive (profitti e perdite latenti), gli ordini eseguiti sul mercato e i log decisionali del bot. Clicca per espandere/comprimere.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchOperations()}
                disabled={operationsLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${operationsLoading ? 'animate-spin' : ''}`} />
                Aggiorna
              </button>

            </div>
          </div>

          {!isOperationsCollapsed && (
            <>
              {operationsLoading && !operationsData ? (
            <div className="text-center py-12 text-slate-400 text-sm animate-pulse flex flex-col items-center gap-2">
              <RotateCcw className="w-6 h-6 animate-spin text-indigo-500" />
              Caricamento operazioni in corso...
            </div>
          ) : operationsData ? (
            <div className="space-y-6">
              {/* 1. POSIZIONI ATTIVE */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Posizioni Attive (Profitti/Perdite Latenti)
                </h3>
                {operationsData.positions && operationsData.positions.length > 0 ? (
                  <div className="overflow-x-auto bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-inner">
                    <table className="w-full min-w-[540px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                          <th className="p-2 sm:p-3">Simbolo</th>
                          <th className="p-2 sm:p-3 text-right">Quantità</th>
                          <th className="p-2 sm:p-3 text-right">Pzo Carico</th>
                          <th className="p-2 sm:p-3 text-right">Pzo Corrente</th>
                          <th className="p-2 sm:p-3 text-right">Val. Mercato</th>
                          <th className="p-2 sm:p-3">Sentiment IA</th>
                          <th className="p-2 sm:p-3 text-right">Gain / Loss Latente</th>
                          <th className="p-2 sm:p-3 text-right">Azione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {operationsData.positions.map((pos, idx) => {
                          const qtyVal = parseFloat(pos.qty || '0');
                          const avgVal = parseFloat(pos.avg_entry_price || '0');
                          const currVal = parseFloat(pos.current_price || '0');
                          const mktVal = parseFloat(pos.market_value || '0');
                          const pl = parseFloat(pos.unrealized_pl || '0');
                          const plpc = parseFloat(pos.unrealized_plpc || '0') * 100;
                          return (
                            <tr key={idx} className="hover:bg-slate-100/30 text-slate-700">
                              <td className="p-2 sm:p-3 font-bold text-slate-900">{pos.symbol}</td>
                              <td className="p-2 sm:p-3 text-right font-mono">{qtyVal.toFixed(4)}</td>
                              <td className="p-2 sm:p-3 text-right font-mono">${avgVal.toFixed(2)}</td>
                              <td className="p-2 sm:p-3 text-right font-mono">${currVal.toFixed(2)}</td>
                              <td className="p-2 sm:p-3 text-right font-mono font-semibold">${mktVal.toFixed(2)}</td>
                              <td className="p-2 sm:p-3">
                                <SentimentBadge symbol={pos.symbol} signals={status?.geminiSignals} showReasoning={true} />
                              </td>
                              <td className={`p-2 sm:p-3 text-right font-mono font-bold ${
                                pl > 0 ? 'text-green-600' : pl < 0 ? 'text-red-600' : 'text-slate-500'
                              }`}>
                                {pl > 0 ? '+' : ''}${pl.toFixed(2)} ({pl > 0 ? '+' : ''}{plpc.toFixed(2)}%)
                              </td>
                              <td className="p-2 sm:p-3 text-right">
                                <button
                                  onClick={() => handleOpenForceBuy(pos.symbol)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                  title="Forza l'acquisto di ulteriori quote"
                                >
                                  <Plus className="w-3 h-3" />
                                  Acquista
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs bg-slate-50/30 border border-dashed border-slate-200 rounded-xl">
                    Nessuna posizione aperta. Il bot attualmente detiene solo liquidità.
                  </div>
                )}
              </div>

              {/* 2. REGISTRO ESECUZIONI DI MERCATO (ALPACA FILLS) */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <h3 
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono cursor-pointer select-none hover:text-slate-700 transition-colors"
                  onClick={() => setIsAlpacaFillsCollapsed(!isAlpacaFillsCollapsed)}
                >
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span>Registro Esecuzioni di Mercato (Alpaca Fills)</span>
                  {isAlpacaFillsCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-green-600" />}
                </h3>
                {!isAlpacaFillsCollapsed && (
                  <>
                    {operationsData.activities && operationsData.activities.filter((act: any) => act.activity_type === 'FILL' || act.type === 'fill').length > 0 ? (
                      <div className="overflow-x-auto bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-inner">
                    <table className="w-full min-w-[580px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                          <th className="p-2 sm:p-3">Data / Ora</th>
                          <th className="p-2 sm:p-3">Simbolo</th>
                          <th className="p-2 sm:p-3">Azione</th>
                          <th className="p-2 sm:p-3 text-right">Quantità</th>
                          <th className="p-2 sm:p-3 text-right">Prezzo Eseguito</th>
                          <th className="p-2 sm:p-3 text-right">Controvalore</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {operationsData.activities
                          .filter((act: any) => act.activity_type === 'FILL' || act.type === 'fill')
                          .slice(0, 10)
                          .map((fill, idx) => {
                            const isBuy = (fill.side || '').toUpperCase() === 'BUY';
                            const fillQty = parseFloat(fill.qty || '0');
                            const fillPrice = parseFloat(fill.price || '0');
                            const amt = (fillQty * fillPrice).toFixed(2);
                            return (
                              <tr key={idx} className="hover:bg-slate-100/30">
                                <td className="p-2 sm:p-3 text-slate-500 font-mono">
                                  {new Date(fill.transaction_time || fill.timestamp).toLocaleString('it-IT')}
                                </td>
                                <td className="p-2 sm:p-3 font-bold text-slate-900">{fill.symbol}</td>
                                <td className="p-2 sm:p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {isBuy ? 'ACQUISTO' : 'VENDITA'}
                                  </span>
                                </td>
                                <td className="p-2 sm:p-3 text-right font-mono">{fillQty.toFixed(4)}</td>
                                <td className="p-2 sm:p-3 text-right font-mono">${fillPrice.toFixed(2)}</td>
                                <td className="p-2 sm:p-3 text-right font-mono font-semibold">${amt}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs bg-slate-50/30 border border-dashed border-slate-200 rounded-xl">
                    Nessun ordine eseguito recentemente registrato su Alpaca.
                  </div>
                )}
                  </>
                )}
              </div>

              {/* 3. LOG LOGICA DECISIONALE DEL BOT */}
              <div className="border-t border-slate-100 pt-3 mt-3">
                <h3 
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono cursor-pointer select-none hover:text-slate-700 transition-colors"
                  onClick={() => setIsLogicLogsCollapsed(!isLogicLogsCollapsed)}
                >
                  <Brain className="w-4 h-4 text-indigo-500" />
                  <span>Log Logica Decisionale del Bot (Ultimi Segnali)</span>
                  {isLogicLogsCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />}
                </h3>
                {!isLogicLogsCollapsed && (
                  <>
                    {operationsData.dailyLogicLogs && operationsData.dailyLogicLogs.length > 0 ? (
                      <div className="overflow-x-auto bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-inner">
                        <table className="w-full min-w-[500px] text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                              <th className="py-1 px-2">Data / Ora</th>
                              <th className="py-1 px-2">Simbolo</th>
                              <th className="py-1 px-2">Decisione</th>
                              <th className="py-1 px-2 text-right">Prezzo</th>
                              <th className="py-1 px-2">Motivazione Sentiment LLM</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {operationsData.dailyLogicLogs
                              .slice(-10)
                              .reverse()
                              .map((log, idx) => {
                                const act = (log.action || '').toUpperCase();
                                return (
                                  <tr key={idx} className="hover:bg-slate-100/30">
                                    <td className="py-1 px-2 text-slate-500 font-mono whitespace-nowrap">
                                      {new Date(log.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </td>
                                    <td className="py-1 px-2 font-bold text-slate-900">{log.symbol}</td>
                                    <td className="py-1 px-2">
                                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                        act === 'BUY' 
                                          ? 'bg-green-100 text-green-700' 
                                          : act === 'SELL' 
                                          ? 'bg-red-100 text-red-700' 
                                          : act === 'HOLD' 
                                          ? 'bg-indigo-100 text-indigo-700' 
                                          : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {act === 'BUY' ? 'BUY' : act === 'SELL' ? 'SELL' : act === 'HOLD' ? 'HOLD' : 'SKIP'}
                                      </span>
                                    </td>
                                    <td className="py-1 px-2 text-right font-mono">
                                      {log.price ? `$${parseFloat(log.price).toFixed(2)}` : 'N/D'}
                                    </td>
                                    <td className="py-1 px-2 text-slate-500 max-w-xs truncate" title={log.reasoning}>
                                      {log.reasoning}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-slate-400 text-xs bg-slate-50/30 border border-dashed border-slate-200 rounded-xl">
                        Nessuna decisione o segnale recente registrato in memoria.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
              In attesa di dati sulle operazioni. Verifica che il bot o l'interfaccia sia correttamente inizializzata.
            </div>
          )}
            </>
          )}
        </div>

        {/* SEZIONE OPERAZIONI CHIUSE (CON FILTRO PER DATA) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <div 
              className="cursor-pointer select-none hover:opacity-85 transition-opacity flex-1" 
              onClick={() => setIsClosedOperationsCollapsed(!isClosedOperationsCollapsed)}
            >
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Storico Operazioni Chiuse</span>
                {isClosedOperationsCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-emerald-600" />}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualizza e analizza tutte le posizioni liquidate e le vendite eseguite dal Bot con motivazione dettagliata e filtro temporale. Clicca per espandere/comprimere.
              </p>
            </div>

            {/* Controlli Filtro Data e Simbolo */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-full sm:w-auto">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium">Da:</span>
                <input 
                  type="date" 
                  value={closedStartDate} 
                  onChange={(e) => setClosedStartDate(e.target.value)}
                  className="bg-transparent border-none text-slate-800 font-semibold focus:outline-none cursor-pointer"
                />
                <span className="text-slate-500 font-medium ml-1">A:</span>
                <input 
                  type="date" 
                  value={closedEndDate} 
                  onChange={(e) => setClosedEndDate(e.target.value)}
                  className="bg-transparent border-none text-slate-800 font-semibold focus:outline-none cursor-pointer"
                />
              </div>

              {/* Preset Rapidi Date */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs justify-between sm:justify-start w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setClosedStartDate(today);
                    setClosedEndDate(today);
                  }}
                  className="px-2.5 py-1 bg-white rounded-lg font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs flex-1 sm:flex-none text-center"
                >
                  Oggi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - 7);
                    setClosedStartDate(start.toISOString().split('T')[0]);
                    setClosedEndDate(end.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1 bg-white rounded-lg font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs flex-1 sm:flex-none text-center"
                >
                  7G
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - 30);
                    setClosedStartDate(start.toISOString().split('T')[0]);
                    setClosedEndDate(end.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1 bg-white rounded-lg font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs flex-1 sm:flex-none text-center"
                >
                  30G
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClosedStartDate('');
                    setClosedEndDate('');
                  }}
                  className="px-2.5 py-1 bg-white rounded-lg font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs flex-1 sm:flex-none text-center"
                >
                  Tutti
                </button>
              </div>

              {/* Input Ricerca Simbolo */}
              <div className="relative w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Simbolo (es. AAPL)..."
                  value={closedSymbolFilter}
                  onChange={(e) => setClosedSymbolFilter(e.target.value.toUpperCase())}
                  className="w-full sm:w-auto pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="button"
                onClick={fetchClosedPositions}
                disabled={closedLoading}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50 w-full sm:w-auto"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${closedLoading ? 'animate-spin' : ''}`} />
                Filtra
              </button>
            </div>
          </div>
          {!isClosedOperationsCollapsed && (() => {
            const periodSaldoPnL = closedTrades.reduce((acc, t) => {
              const val = typeof t.pnl === 'number' ? t.pnl : (t.pnl ? parseFloat(t.pnl) : 0);
              return acc + val;
            }, 0);

            const winningCount = closedTrades.filter(t => {
              const v = typeof t.pnl === 'number' ? t.pnl : (t.pnl ? parseFloat(t.pnl) : 0);
              return v > 0;
            }).length;

            const winRate = closedTrades.length > 0 ? ((winningCount / closedTrades.length) * 100).toFixed(1) : '0.0';

            const bestTradeVal = closedTrades.reduce((max, t) => {
              const v = typeof t.pnl === 'number' ? t.pnl : (t.pnl ? parseFloat(t.pnl) : 0);
              return v > max ? v : max;
            }, 0);

            const worstTradeVal = closedTrades.reduce((min, t) => {
              const v = typeof t.pnl === 'number' ? t.pnl : (t.pnl ? parseFloat(t.pnl) : 0);
              return v < min ? v : min;
            }, 0);

            const filteredTrades = closedTrades.filter(t => {
              const pnlVal = typeof t.pnl === 'number' ? t.pnl : (t.pnl ? parseFloat(t.pnl) : 0);
              if (closedPnlFilter === 'profit' && pnlVal <= 0) return false;
              if (closedPnlFilter === 'loss' && pnlVal > 0) return false;
              return true;
            });

            return (
            <>
          {/* Sommario Metriche Avanzato (Stile Trading Platform) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Operazioni Chiuse</span>
              <p className="text-xl font-bold font-mono mt-1 text-slate-100">{closedTrades.length}</p>
            </div>
            <div className={`p-3 rounded-xl border shadow-sm flex flex-col justify-between ${periodSaldoPnL >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">PnL Netto Periodo</span>
              <p className={`text-lg font-bold font-mono mt-1 ${periodSaldoPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {periodSaldoPnL >= 0 ? '+' : ''}${periodSaldoPnL.toFixed(2)}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Win Rate</span>
              <p className="text-lg font-bold font-mono text-indigo-700 mt-1">{winRate}%</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Miglior Trade</span>
              <p className="text-lg font-bold font-mono text-emerald-600 mt-1">+{bestTradeVal.toFixed(2)}$</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Peggior Trade</span>
              <p className="text-lg font-bold font-mono text-rose-600 mt-1">{worstTradeVal.toFixed(2)}$</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Azioni / Controlli</span>
              <div className="mt-1 flex gap-1 items-center">
                <button
                  type="button"
                  onClick={exportClosedTradesCSV}
                  disabled={closedTrades.length === 0}
                  className="w-full py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Esporta storico in CSV"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* Barriera Filtro PnL rapido */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 bg-slate-100/80 p-2 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Filtro Esito:</span>
              <button
                type="button"
                onClick={() => setClosedPnlFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${closedPnlFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Tutti ({closedTrades.length})
              </button>
              <button
                type="button"
                onClick={() => setClosedPnlFilter('profit')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${closedPnlFilter === 'profit' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-emerald-700 hover:bg-slate-50'}`}
              >
                In Profitto ({closedTrades.filter(t => (typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0')) > 0).length}) 🟢
              </button>
              <button
                type="button"
                onClick={() => setClosedPnlFilter('loss')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${closedPnlFilter === 'loss' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-white text-rose-700 hover:bg-slate-50'}`}
              >
                In Perdita ({closedTrades.filter(t => (typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0')) < 0).length}) 🔴
              </button>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Visualizzati {filteredTrades.length} di {closedTrades.length} record
            </div>
          </div>

          {/* Tabella Dati Operazioni Chiuse (Stile Trading Terminal) */}
          {closedLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-2">
              <RotateCcw className="w-5 h-5 animate-spin text-emerald-600" />
              Caricamento operazioni chiuse nel periodo selezionato...
            </div>
          ) : filteredTrades.length > 0 ? (
            <div className="overflow-x-auto bg-slate-900 text-slate-200 rounded-xl border border-slate-800 shadow-xl">
              <table className="w-full min-w-[680px] text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                    <th className="p-3">Data / Ora</th>
                    <th className="p-3">Simbolo</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-right">Profitto / Perdita</th>
                    <th className="p-3 text-right">Q.tà</th>
                    <th className="p-3 text-right">Prezzo Uscita</th>
                    <th className="p-3 text-right">Controvalore</th>
                    <th className="p-3">Motivazione & Origine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredTrades.map((trade, idx) => {
                    const pnlVal = typeof trade.pnl === 'number' ? trade.pnl : (trade.pnl ? parseFloat(trade.pnl) : 0);
                    const isPos = pnlVal >= 0;
                    return (
                    <tr key={trade.id || idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(trade.timestamp).toLocaleString('it-IT')}
                      </td>
                      <td className="p-3 font-bold text-white text-sm">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                          {trade.symbol}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-900/60">
                          {trade.action || 'VENDITA'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-bold inline-flex items-center gap-1 ${
                          isPos 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/80' 
                            : 'bg-rose-950 text-rose-400 border border-rose-900/80'
                        }`}>
                          {isPos ? '+' : ''}${pnlVal.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-300">
                        {trade.qty > 0 ? trade.qty.toFixed(4) : 'N/D'}
                      </td>
                      <td className="p-3 text-right text-slate-100 font-semibold">
                        {trade.price > 0 ? `$${trade.price.toFixed(2)}` : 'N/D'}
                      </td>
                      <td className="p-3 text-right text-slate-100 font-bold">
                        {trade.totalValue > 0 ? `$${parseFloat(trade.totalValue).toFixed(2)}` : 'N/D'}
                      </td>
                      <td className="p-3 font-sans">
                        <div className="flex flex-col gap-0.5 max-w-sm">
                          <span className="text-slate-200 font-semibold text-xs leading-tight">
                            {trade.reason || 'Chiusura posizione'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Origine: {trade.source || 'Sistema'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50/30 border border-dashed border-slate-200 rounded-xl font-mono">
              Nessuna operazione chiusa trovata con i filtri selezionati ({closedStartDate || 'Inizio'} - {closedEndDate || 'Oggi'}).
            </div>
          )}
            </>
            );
          })()}
        </div>

        {/* 7 & 8. Debriefing & Valutazione Periodica AI (Unificate e Comprimibili) */}
        <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200 mt-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div
              className="cursor-pointer select-none hover:opacity-85 transition-opacity flex-1"
              onClick={() => setIsDailyDebriefCollapsed(!isDailyDebriefCollapsed)}
            >
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                <span>Debriefing & Valutazione Periodica (AI)</span>
                {isDailyDebriefCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-indigo-600" />}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Analizza performance, decisioni e ottieni regole ottimizzate sia per la singola giornata che su intervalli multi-giorno. Clicca per espandere/comprimere.
              </p>
            </div>
            {!isDailyDebriefCollapsed && (
              <button
                onClick={handleGenerateDebrief}
                disabled={debriefLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer ${
                  debriefLoading 
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed animate-pulse' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${debriefLoading ? 'animate-spin' : ''}`} />
                {debriefLoading ? 'Analisi in corso...' : 'Avvia Riunione Giornaliera'}
              </button>
            )}
          </div>

          {!isDailyDebriefCollapsed && (
            <div className="space-y-6">
              {/* Sotto-sezione 1: Debriefing Giornaliero */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Debriefing Giornaliero di Fine Seduta
                  </h3>
                  {status?.latestDailyDebrief?.timestamp && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(status.latestDailyDebrief.timestamp).toLocaleString('it-IT')}
                    </div>
                  )}
                </div>

                {status?.latestDailyDebrief ? (
                  <div className="space-y-4">
                    <div className="markdown-body text-sm text-slate-700 leading-relaxed space-y-2">
                      <ReactMarkdown>{status.latestDailyDebrief.analysis}</ReactMarkdown>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-indigo-600" />
                          Regola Ottimizzata Proposta per la Giornata
                        </h4>
                        <button
                          onClick={() => {
                            if (status.latestDailyDebrief) {
                              navigator.clipboard.writeText(status.latestDailyDebrief.suggestedRule);
                              setCopiedDebriefRule(true);
                              setTimeout(() => setCopiedDebriefRule(false), 2000);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition shadow-sm cursor-pointer"
                        >
                          {copiedDebriefRule ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-700">Copiata!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copia Regola</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="relative">
                        <textarea
                          readOnly
                          value={status.latestDailyDebrief.suggestedRule}
                          rows={2}
                          className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-xs font-mono text-indigo-950 focus:outline-none resize-none shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  !debriefLoading && (
                    <div className="text-center py-4 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      Nessun debriefing generato per oggi. Clicca su "Avvia Riunione Giornaliera" in alto a destra per analizzare la giornata.
                    </div>
                  )
                )}
              </div>

              {/* Sotto-sezione 2: Valutazione & Ottimizzazione su Periodi Multi-giorno */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Analisi & Valutazione su Periodi Personalizzati
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Seleziona l'intervallo temporale per calcolare le metriche aggregate e generare la strategia di medio periodo.
                  </p>
                </div>

                {/* Selezione Rapida Periodo */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-slate-500 self-center mr-2 uppercase tracking-wider font-mono">Periodo Rapido:</span>
                  {[
                    { label: 'Ultimi 7 Giorni', days: 7 },
                    { label: 'Ultimi 15 Giorni', days: 15 },
                    { label: 'Ultimo Mese', days: 30 },
                    { label: 'Ultimi 3 Mesi', days: 90 },
                  ].map((btn, idx) => {
                    const startTest = new Date();
                    startTest.setDate(startTest.getDate() - btn.days);
                    const startStr = startTest.toISOString().split('T')[0];
                    const isSelected = rangeStartDate === startStr;
                    return (
                      <button
                        key={idx}
                        onClick={() => setQuickRange(btn.days)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition border cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      value={rangeStartDate}
                      onChange={(e) => setRangeStartDate(e.target.value)}
                      className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      value={rangeEndDate}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <button
                      onClick={handleGenerateRangeDebrief}
                      disabled={rangeLoading}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer ${
                        rangeLoading 
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed animate-pulse' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                      }`}
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${rangeLoading ? 'animate-spin' : ''}`} />
                      {rangeLoading ? 'Generando Analisi...' : 'Analizza Periodo'}
                    </button>
                  </div>
                </div>

                {/* PANNELLO DI RIEPILOGO METRICHE DI PERFORMANCE AGGREGATE */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-3">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                      <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
                      Riepilogo Performance Aggregate ({selectedTab === 'live' ? 'Reale' : 'Simulazione'})
                    </h4>
                    <span className="text-[10px] bg-white text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono border border-slate-200">
                      {performanceMetrics.totalTrades} Trade Chiusi
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* CARD 1: WIN RATE */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Win Rate</span>
                          <span className="p-1 bg-green-50 text-green-700 rounded-lg">
                            <TrendingUp className="w-3 h-3" />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-slate-900 font-mono">
                            {performanceMetrics.winRate.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">successo</span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden flex">
                          {performanceMetrics.totalTrades > 0 ? (
                            <>
                              <div 
                                style={{ width: `${performanceMetrics.winRate}%` }} 
                                className="bg-emerald-500 h-full transition-all duration-500" 
                                title={`Vincenti: ${performanceMetrics.winRate.toFixed(1)}%`}
                              />
                              <div 
                                style={{ width: `${100 - performanceMetrics.winRate}%` }} 
                                className="bg-rose-400 h-full transition-all duration-500" 
                                title={`Perdenti: ${(100 - performanceMetrics.winRate).toFixed(1)}%`}
                              />
                            </>
                          ) : (
                            <div className="w-full bg-slate-200 h-full" title="Nessun trade" />
                          )}
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-medium font-mono">
                          <span>{performanceMetrics.winningTrades} Vincenti</span>
                          <span>{performanceMetrics.losingTrades} Perdenti</span>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: PROFIT FACTOR */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Profit Factor</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            performanceMetrics.profitFactor >= 2.0 ? 'bg-emerald-50 text-emerald-700' :
                            performanceMetrics.profitFactor >= 1.5 ? 'bg-blue-50 text-blue-700' :
                            performanceMetrics.profitFactor >= 1.0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {performanceMetrics.profitFactor >= 2.0 ? 'Ottimo' :
                             performanceMetrics.profitFactor >= 1.5 ? 'Buono' :
                             performanceMetrics.profitFactor >= 1.0 ? 'Moderato' : 'Perdente'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-slate-900 font-mono">
                            {performanceMetrics.profitFactor === 99.9 ? '∞' : performanceMetrics.profitFactor.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">rapporto G/P</span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-[9px] font-mono">
                        <div className="flex justify-between text-slate-500">
                          <span>Profitto Lordo:</span>
                          <span className="text-emerald-600 font-bold">+${performanceMetrics.grossProfit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Perdita Lorda:</span>
                          <span className="text-rose-600 font-bold">-${performanceMetrics.grossLoss.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* CARD 3: MASSIMO DRAWDOWN */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Max Drawdown</span>
                          <span className="p-1 bg-rose-50 text-rose-700 rounded-lg">
                            <ShieldAlert className="w-3 h-3" />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-rose-600 font-mono">
                            -{performanceMetrics.maxDrawdownPercent.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            (-${performanceMetrics.maxDrawdownAmount.toFixed(2)})
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[10px]">Risultato Netto:</span>
                        <span className={`font-mono font-bold text-xs ${
                          performanceMetrics.netPnL > 0 ? 'text-emerald-600' :
                          performanceMetrics.netPnL < 0 ? 'text-rose-600' : 'text-slate-500'
                        }`}>
                          {performanceMetrics.netPnL > 0 ? '+' : ''}${performanceMetrics.netPnL.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {rangeDebrief ? (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                        Rapporto Valutazione Periodica ({rangeStartDate} / {rangeEndDate})
                      </h4>
                      <div className="markdown-body text-sm text-slate-700 leading-relaxed space-y-2">
                        <ReactMarkdown>{rangeDebrief.analysis}</ReactMarkdown>
                      </div>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-indigo-600" />
                          Regola di Trading Suggerita per il Periodo
                        </h4>
                        <button
                          onClick={() => {
                            if (rangeDebrief) {
                              navigator.clipboard.writeText(rangeDebrief.suggestedRule);
                              setCopiedRangeRule(true);
                              setTimeout(() => setCopiedRangeRule(false), 2000);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition shadow-sm cursor-pointer"
                        >
                          {copiedRangeRule ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-700">Copiata!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copia Regola</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="relative">
                        <textarea
                          readOnly
                          value={rangeDebrief.suggestedRule}
                          rows={2}
                          className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-xs font-mono text-indigo-950 focus:outline-none resize-none shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  !rangeLoading && (
                    <div className="text-center py-4 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      Seleziona un intervallo di date e clicca su "Analizza Periodo" per generare l'analisi del periodo e ottenere nuove regole ottimizzate.
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Daily Report Motivation */}
        {status?.latestDailyReport && (
          <div className="bg-purple-50 p-6 rounded-2xl shadow-sm border border-purple-100 mt-6 mb-6">
            <div
              className="cursor-pointer select-none hover:opacity-85 transition-opacity"
              onClick={() => setIsMotivationCollapsed(!isMotivationCollapsed)}
            >
              <h2 className="text-lg font-medium text-purple-900 mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <span className="flex-1">Report Motivazionale di Fine Giornata</span>
                {isMotivationCollapsed ? <ChevronDown className="w-4 h-4 text-purple-400" /> : <ChevronUp className="w-4 h-4 text-purple-600" />}
              </h2>
            </div>
            {!isMotivationCollapsed && (
              <div className="bg-white p-4 rounded-lg border border-purple-200 whitespace-pre-wrap font-sans text-sm text-purple-800 shadow-inner">
                {status.latestDailyReport}
              </div>
            )}
          </div>
        )}

        {/* Modulo di Scoperta Asset con Momentum Elevato */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl mt-6 mb-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
            <div 
              className="cursor-pointer select-none hover:opacity-85 transition-opacity flex-1"
              onClick={() => setIsMomentumCollapsed(!isMomentumCollapsed)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live AI Discovery
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Opportunità ad Alto Momentum</span>
                {isMomentumCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-indigo-400" />}
              </h2>
              <p className="text-xs text-slate-400 max-w-xl mt-1">
                Analisi giornaliera degli asset USA con forte accelerazione e catalizzatori macro/notizie. Clicca per espandere/comprimere.
              </p>
            </div>
            
            <button
              onClick={() => fetchMomentumAssets()}
              disabled={momentumLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition disabled:opacity-50 h-fit cursor-pointer animate-pulse-glow"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${momentumLoading ? 'animate-spin' : ''}`} />
              Aggiorna Scanner
            </button>
          </div>

          {!isMomentumCollapsed && (
            <>
              {momentumLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 animate-pulse">
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-2">
                      <div className="h-5 bg-slate-800 rounded w-16" />
                      <div className="h-3 bg-slate-800 rounded w-32" />
                    </div>
                    <div className="h-6 bg-slate-800 rounded-full w-12" />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-3 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-5/6" />
                  </div>
                  <div className="h-8 bg-slate-800 rounded-xl w-full" />
                </div>
              ))}
            </div>
          ) : momentumAssets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
              <p className="text-sm">Nessun suggerimento di momentum disponibile al momento.</p>
              <button 
                onClick={() => fetchMomentumAssets()} 
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Clicca per avviare la scansione
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {momentumAssets.map((asset) => {
                const scoreColor = asset.momentumScore >= 85 
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                  : asset.momentumScore >= 70 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';

                return (
                  <div 
                    key={asset.symbol} 
                    className="bg-slate-950/40 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-lg tracking-wider text-white">{asset.symbol}</span>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${scoreColor}`}>
                              Score: {asset.momentumScore}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 font-medium">{asset.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                            {asset.recentPerformance}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {asset.reasoning}
                        </p>
                        {asset.catalyst && (
                          <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800 text-[11px] flex gap-2">
                            <span className="text-indigo-400 font-bold uppercase tracking-wider flex-shrink-0">Catalyst:</span>
                            <span className="text-slate-400 leading-relaxed">{asset.catalyst}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleWatchlist(asset.symbol, asset.isAlreadyMonitored)}
                      className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        asset.isAlreadyMonitored 
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' 
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {asset.isAlreadyMonitored ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Monitorato dal Bot
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Monitora con il Bot
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Sezione per visualizzare gli asset custom monitorati attivi */}
          {status?.monitoredSymbols && status.monitoredSymbols.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-800/80 relative z-10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-emerald-400" />
                Asset Personalizzati Monitorati Attivamente ({status.monitoredSymbols.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {status.monitoredSymbols.map((sym) => (
                  <div 
                    key={sym} 
                    className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold font-mono text-indigo-300"
                  >
                    <span>{sym}</span>
                    <SentimentBadge symbol={sym} signals={status?.geminiSignals} />
                    <button
                      onClick={() => handleOpenForceBuy(sym)}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded font-bold transition flex items-center gap-0.5 cursor-pointer"
                      title="Forza acquisto manuale di quote"
                    >
                      <Plus className="w-2.5 h-2.5" /> Acquista
                    </button>
                    <button 
                      onClick={() => handleToggleWatchlist(sym, true)}
                      className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition cursor-pointer"
                      title="Rimuovi dal monitoraggio"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* System Risk Rules Manager */}
        <div className="mt-6">
          <SystemRiskRulesManager
            initialRules={status?.systemRiskRules}
            onRulesUpdated={fetchStatus}
            showToast={showToast}
          />
        </div>

        {/* Feedback Form */}
        <div className="bg-gray-50 p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
           <div 
             className="cursor-pointer select-none hover:opacity-85 transition-opacity mb-3" 
             onClick={() => setIsFeedbackCollapsed(!isFeedbackCollapsed)}
           >
             <h2 className="text-lg font-medium text-gray-900 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <MessageSquare className="w-5 h-5 text-gray-500" />
                 <span>Loop di Correzione (Invia Regole al Bot)</span>
               </div>
               {isFeedbackCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-600" />}
             </h2>
           </div>
           
           {!isFeedbackCollapsed && (
             <>
           <form onSubmit={async (e) => {
             e.preventDefault();
             const formData = new FormData(e.currentTarget);
             const rule = formData.get('rule') as string;
             if (!rule) {
                showToast('Inserisci prima una regola correttiva valida!', 'warning', 'Invio Regola');
                return;
              }
              try {
                const token = await getAccessToken();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch('/api/feedback', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ rule })
                });
             if (res.ok) {
                  showToast('Nuova regola correttiva salvata ed attiva con successo!', 'success', 'Regole AI');
                  e.currentTarget.reset();
                  fetchStatus();
                } else {
                  const data = await res.json().catch(() => ({}));
                  showToast(`Impossibile inviare la regola: ${data.message || 'Errore del server'}`, 'error', 'Regole AI');
                }
              } catch (err: any) {
                showToast(`Errore di rete: ${err.message}`, 'error', 'Regole AI');
              }
           }} className="flex flex-col gap-3">
             <textarea 
               name="rule" 
               rows={2} 
               placeholder="Es. 'Sei stato troppo aggressivo sull'oro in fase di incertezza, sii più cauto.'"
               className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
             ></textarea>
             <button type="submit" className="self-end bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
               Invia Regola
             </button>
           </form>
           <div className="mt-4">
             <div className="flex items-center justify-between mb-2">
               <h3 className="text-sm font-medium text-gray-700">Regole Attive:</h3>
               <div className="flex gap-2">
                   <button
                     onClick={async () => {
                       try {
                         const token = await getAccessToken();
                         const headers: Record<string, string> = {};
                         if (token) headers['Authorization'] = `Bearer ${token}`;
                         const res = await fetch('/api/feedback/sync-sheets', { method: 'POST', headers });
                         const data = await res.json();
                         if (data.success) {
                           showToast(data.message, 'success', 'Google Sheets');
                           fetchStatus();
                         } else {
                           showToast(`Errore: ${data.error}`, 'error', 'Google Sheets');
                         }
                       } catch (err: any) {
                         showToast(`Errore di rete: ${err.message}`, 'error', 'Google Sheets');
                       }
                     }}
                     className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
                   >
                     <RefreshCw className="w-3 h-3" /> Sincronizza da Sheets
                   </button>
                   <button
                     onClick={async () => {
                       try {
                         const token = await getAccessToken();
                         const headers: Record<string, string> = {};
                         if (token) headers['Authorization'] = `Bearer ${token}`;
                         const res = await fetch('/api/feedback/export-sheets', { method: 'POST', headers });
                         const data = await res.json();
                         if (data.success) {
                           showToast(data.message, 'success', 'Google Sheets');
                         } else {
                           showToast(`Errore: ${data.error}`, 'error', 'Google Sheets');
                         }
                       } catch (err: any) {
                         showToast(`Errore di rete: ${err.message}`, 'error', 'Google Sheets');
                       }
                     }}
                     className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
                   >
                     <Save className="w-3 h-3" /> Esporta su Sheets
                   </button>
                 </div>
               </div>
               <ul className="space-y-2 text-xs text-gray-600">
                 {(status?.userFeedbackRules || []).map((r, i) => (
                   <li key={i} className="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                     <span className="flex-1 break-words mr-2">{r}</span>
                     <button
                       onClick={async () => {
                         try {
                           const token = await getAccessToken();
                           const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                           if (token) headers['Authorization'] = `Bearer ${token}`;
                           const res = await fetch('/api/feedback/delete', {
                             method: 'POST',
                             headers,
                             body: JSON.stringify({ index: i })
                           });
                           if (res.ok) {
                             showToast('Regola eliminata con successo!', 'success', 'Regole AI');
                             fetchStatus();
                           } else {
                             const data = await res.json().catch(() => ({}));
                             showToast(`Errore eliminazione: ${data.message}`, 'error', 'Regole AI');
                           }
                         } catch (err: any) {
                           showToast(`Errore di rete: ${err.message}`, 'error', 'Regole AI');
                         }
                       }}
                       className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                       title="Elimina regola"
                     >
                       <X className="w-3.5 h-3.5" />
                     </button>
                   </li>
                 ))}
               </ul>
             </div>
             </>
           )}
        </div>

        {/* Panic Button Confirmation Modal */}
        {showPanicConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl border border-red-200 max-w-md w-full p-6 overflow-hidden relative animate-scale-in">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <ShieldAlert className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                    ATTIVAZIONE PANIC BUTTON
                  </h3>
                  <p className="text-xs text-red-500 font-medium font-mono">LIQUIDAZIONE DI EMERGENZA</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-600 mb-6 leading-relaxed">
                <p className="font-semibold text-slate-800">
                  Questa è una procedura distruttiva irreversibile. Se confermi:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>Il bot di trading verrà <strong>immediatamente arrestato</strong> su tutti i conti (Paper e Live).</li>
                  <li>Tutti gli ordini pendenti su Alpaca verranno <strong>cancellati</strong>.</li>
                  <li>Tutte le posizioni aperte su <strong>ENTRAMBI</strong> i conti (Paper e Live) verranno <strong>liquidate immediatamente al prezzo di mercato</strong>.</li>
                </ul>
                <p className="text-xs text-red-600 font-bold bg-red-50 p-2.5 rounded-lg border border-red-100 italic">
                  ⚠ Attenzione: l'operazione interagirà direttamente con le API reali di Alpaca se configurate.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPanicConfirm(false)}
                  disabled={panicLoading}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handlePanicLiquidate}
                  disabled={panicLoading}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition cursor-pointer ${
                    panicLoading 
                      ? 'bg-red-400 cursor-not-allowed animate-pulse' 
                      : 'bg-red-600 hover:bg-red-700 active:scale-95 shadow-md shadow-red-200'
                  }`}
                >
                  {panicLoading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      LIQUIDAZIONE IN CORSO...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" />
                      CONFERMA E LIQUIDA ORA
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Scarica Report */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 relative">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileDown className="w-5 h-5 text-indigo-600" />
                Scarica Report Log per Periodo
              </h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Il report includerà tutti i log operativi e decisionali (Alpaca) nel periodo selezionato.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDownloadCustomReport}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-all cursor-pointer"
                >
                  Scarica (TXT)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sistema Notifiche Toast in Tempo Reale */}
        <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-[100] flex flex-col gap-2 max-w-[calc(100vw-24px)] sm:max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {toasts.map((toast) => {
              const typeStyles = {
                success: {
                  bg: 'bg-emerald-50 border-emerald-100 text-emerald-800',
                  icon: <Check className="w-5 h-5 text-emerald-600" />,
                  titleColor: 'text-emerald-900',
                  accent: 'bg-emerald-500'
                },
                error: {
                  bg: 'bg-rose-50 border-rose-100 text-rose-800',
                  icon: <ShieldAlert className="w-5 h-5 text-rose-600" />,
                  titleColor: 'text-rose-900',
                  accent: 'bg-rose-500'
                },
                warning: {
                  bg: 'bg-amber-50 border-amber-100 text-amber-800',
                  icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
                  titleColor: 'text-amber-900',
                  accent: 'bg-amber-500'
                },
                info: {
                  bg: 'bg-blue-50 border-blue-100 text-blue-800',
                  icon: <Info className="w-5 h-5 text-blue-600" />,
                  titleColor: 'text-blue-900',
                  accent: 'bg-blue-500'
                }
              }[toast.type];

              return (
                <motion.div
                  key={toast.id}
                  layout
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                  className={`pointer-events-auto flex gap-3 p-4 rounded-xl border shadow-lg ${typeStyles.bg} relative overflow-hidden`}
                >
                  {/* Barra d'accento visiva a sinistra */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${typeStyles.accent}`} />
                  
                  <div className="flex-shrink-0 mt-0.5">
                    {typeStyles.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-4">
                    {toast.title && (
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${typeStyles.titleColor}`}>
                        {toast.title}
                      </h4>
                    )}
                    <p className="text-xs font-medium leading-relaxed">
                      {toast.message}
                    </p>
                  </div>

                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="flex-shrink-0 absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-lg hover:bg-black/5 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Pro Trading Terminal Overlay / Modal */}
        {showProTerminal && (
          <ProTradingTerminal
            onClose={() => setShowProTerminal(false)}
            botStatus={status}
          />
        )}

        {/* Force Buy Modal */}
        <ForceBuyModal
          isOpen={forceBuyModalOpen}
          onClose={() => setForceBuyModalOpen(false)}
          initialSymbol={forceBuySymbol}
          initialMode={selectedTab}
          onSuccess={fetchStatus}
          showToast={showToast}
        />

      </div>
    </div>
  );
}
