import { useEffect, useState, useMemo } from 'react';
import { Play, Square, Activity, Wallet, Clock, RotateCcw, BookOpen, MessageSquare, TrendingUp, BarChart2, X, Plus, Trash2, Copy, Check, Sparkles, Brain, ShieldAlert, Flame, Calendar, FileDown, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import type { BotStateResponse, BotStatus, AccountData } from './types';
import TradingModule from './components/TradingModule';

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

      const qty = parseFloat(pos.qty).toFixed(4);
      const avgPrice = parseFloat(pos.avg_entry_price).toFixed(2);
      const currentPrice = parseFloat(pos.current_price).toFixed(2);
      const mktVal = parseFloat(pos.market_value).toFixed(2);
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
      const dateText = new Date(log.timestamp).toLocaleTimeString('it-IT');
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

      const qty = parseFloat(pos.qty).toFixed(4);
      const avgPrice = parseFloat(pos.avg_entry_price).toFixed(2);
      const currentPrice = parseFloat(pos.current_price).toFixed(2);
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
            <span className={`font-mono font-semibold ${item.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.value >= 0 ? '+' : ''}{item.value.toFixed(2)}$
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function AccountPanel({ 
  account, 
  title, 
  isActive, 
  type, 
  onToggle,
  onClosePosition,
  closingSymbols,
  confirmCloseSymbol,
  setConfirmCloseSymbol
}: { 
  account: AccountData; 
  title: string; 
  isActive: boolean; 
  type: 'paper' | 'live'; 
  onToggle: (type: 'paper' | 'live') => void;
  onClosePosition: (symbol: string, type: 'paper' | 'live') => Promise<void>;
  closingSymbols: string[];
  confirmCloseSymbol: { symbol: string; type: 'paper' | 'live' } | null;
  setConfirmCloseSymbol: (state: { symbol: string; type: 'paper' | 'live' } | null) => void;
}) {
  if (!account) return null;

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
      <div className={`p-4 border-b ${type === 'live' ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'} flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center`}>
        <div className="flex items-center gap-3">
            <h2 className={`font-semibold ${type === 'live' ? 'text-emerald-800' : 'text-indigo-800'} flex items-center gap-2`}>
              {type === 'live' ? <TrendingUp className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
              {title}
            </h2>
            <span className={`px-2 py-1 text-xs font-bold rounded-md ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {isActive ? 'ATTIVO' : 'FERMO'}
            </span>
        </div>
        <button
            onClick={() => onToggle(type)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            isActive
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : type === 'live' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
        >
            {isActive ? (
            <><Square className="w-4 h-4 fill-current" /> Ferma Bot {type === 'live' ? 'Live' : 'Paper'}</>
            ) : (
            <><Play className="w-4 h-4 fill-current" /> Avvia Bot {type === 'live' ? 'Live' : 'Paper'}</>
            )}
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">Saldo Equity</div>
          <div className="text-2xl font-bold text-gray-900">${(account.balance ?? 0).toFixed(2)}</div>
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="text-gray-500">Broker</div>
          <div className={`font-medium ${account.isConfigured ? 'text-green-600' : 'text-amber-600'}`}>
            {account.modeLabel}
          </div>
        </div>

        {/* Grafico P&L Realizzato e Non Realizzato */}
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-gray-500" />
                Andamento Storico P&L
              </h3>
              <p className="text-[11px] text-gray-500">Confronto tra profitti/perdite realizzati e posizioni aperte</p>
            </div>
            {/* Legenda personalizzata */}
            <div className="flex gap-4 text-[10px] font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                <span className="text-gray-600">Realizzato</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-sky-400 inline-block"></span>
                <span className="text-gray-600">Non Realizzato</span>
              </div>
            </div>
          </div>

          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={account.dailyPnL || []}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUnrealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(val) => `${val >= 0 ? '+' : ''}${val}$`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="realized" 
                  name="P&L Realizzato"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRealized)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="unrealized" 
                  name="P&L Non Realizzato"
                  stroke="#0ea5e9" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorUnrealized)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics */}
          {account.dailyPnL && account.dailyPnL.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100/80 text-center">
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Realizzato</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${(account.dailyPnL[account.dailyPnL.length - 1].realized ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1].realized ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1].realized ?? 0).toFixed(2)}$
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Non Realizzato</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${(account.dailyPnL[account.dailyPnL.length - 1].unrealized ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1].unrealized ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1].unrealized ?? 0).toFixed(2)}$
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Totale Netto</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${(account.dailyPnL[account.dailyPnL.length - 1].pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1].pnl ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1].pnl ?? 0).toFixed(2)}$
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Asset in Gestione */}
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1 flex items-center justify-between">
              <span>Indici Gestiti</span>
              <span className="text-xs text-gray-500 font-normal">CASH - Stato</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {['SPY', 'VOO', 'IVV', 'VTI', 'QQQ'].map(symbol => {
                const hasPosition = account.positions?.some(pos => pos.symbol === symbol);
                const latestLog = account.dailyLogicLogs ? [...account.dailyLogicLogs].reverse().find(l => l.symbol === symbol) : null;
                return (
                  <div key={symbol} className="p-2 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-between gap-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">{symbol}</span>
                      <span className="px-1 text-[9px] font-semibold bg-gray-200 text-gray-600 rounded">CASH</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${hasPosition ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {hasPosition ? 'Attivo' : 'In attesa'}
                      </span>
                    </div>
                    {latestLog && (
                      <div className="text-[9px] text-gray-500 mt-1 border-t border-gray-200/60 pt-1">
                        <span className={`font-semibold ${latestLog.action === 'BUY' ? 'text-green-600' : latestLog.action === 'SKIP' ? 'text-amber-600' : 'text-gray-500'}`}>
                          {latestLog.action}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1 flex items-center justify-between">
              <span>Materie Prime Gestite</span>
              <span className="text-xs text-gray-500 font-normal">CASH - Stato</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'].map(symbol => {
                const hasPosition = account.positions?.some(pos => pos.symbol === symbol);
                const latestLog = account.dailyLogicLogs ? [...account.dailyLogicLogs].reverse().find(l => l.symbol === symbol) : null;
                return (
                  <div key={symbol} className="p-2 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-between gap-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">{symbol}</span>
                      <span className="px-1 text-[9px] font-semibold bg-gray-200 text-gray-600 rounded">CASH</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${hasPosition ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {hasPosition ? 'Attivo' : 'In attesa'}
                      </span>
                    </div>
                    {latestLog && (
                      <div className="text-[9px] text-gray-500 mt-1 border-t border-gray-200/60 pt-1">
                        <span className={`font-semibold ${latestLog.action === 'BUY' ? 'text-green-600' : latestLog.action === 'SKIP' ? 'text-amber-600' : 'text-gray-500'}`}>
                          {latestLog.action}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Positions */}
        {account.positions && account.positions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1">Posizioni Aperte</h3>
            <div className="space-y-2">
              {account.positions.map((pos, i) => {
                const qtyNum = parseFloat(pos.qty);
                const formattedQty = qtyNum % 1 === 0 ? qtyNum.toString() : qtyNum.toFixed(4);
                const avgPrice = parseFloat(pos.avg_entry_price || '0');
                const currPrice = parseFloat(pos.current_price || '0');
                return (
                  <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 gap-2 sm:gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div>
                        <span className="font-bold text-gray-900 text-base">{pos.symbol}</span>
                        <span className="text-gray-500 text-xs block sm:inline sm:ml-2">({formattedQty} quote)</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600 mt-1 sm:mt-0">
                        <div>
                          <span className="text-gray-400 block sm:inline">Prezzo acq: </span>
                          <span className="font-mono font-medium text-gray-800">${avgPrice.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block sm:inline">Quot. attuale: </span>
                          <span className="font-mono font-medium text-gray-800">${currPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className={`font-semibold flex items-center gap-1.5 ${parseFloat(pos.unrealized_pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{parseFloat(pos.unrealized_pl) >= 0 ? '+' : ''}{parseFloat(pos.unrealized_pl).toFixed(2)}$</span>
                        {pos.unrealized_plpc !== undefined && (
                          <span className="text-xs font-semibold opacity-95 px-1.5 py-0.5 rounded bg-current/10">
                            ({parseFloat(pos.unrealized_plpc) >= 0 ? '+' : ''}{(parseFloat(pos.unrealized_plpc) * 100).toFixed(2)}%)
                          </span>
                        )}
                      </div>

                      {confirmCloseSymbol?.symbol === pos.symbol && confirmCloseSymbol?.type === type ? (
                        <div className="flex items-center gap-1.5 ml-2 bg-red-50 p-1 rounded-md border border-red-200">
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
                          className="ml-2 p-1 text-xs font-semibold rounded text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="Chiudi Posizione"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Chiudi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Logic Logs */}
        {account.dailyLogicLogs && account.dailyLogicLogs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1">Ultimi Ragionamenti</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {[...account.dailyLogicLogs].reverse().slice(0, 10).map((log, i) => (
                <div key={i} className="text-xs border-l-2 border-blue-400 pl-2 py-1">
                  <div className="flex justify-between text-gray-500 mb-1">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="font-bold">{log.symbol} ({log.action})</span>
                  </div>
                  <div className="text-gray-700">{log.reasoning}</div>
                </div>
              ))}
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
  const [mainView, setMainView] = useState<'alpaca' | 'oanda'>('alpaca');

  const [closingSymbols, setClosingSymbols] = useState<string[]>([]);
  const [confirmCloseSymbol, setConfirmCloseSymbol] = useState<{ symbol: string; type: 'paper' | 'live' } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [copiedDebriefRule, setCopiedDebriefRule] = useState(false);
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);
  const [panicLoading, setPanicLoading] = useState(false);

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

  const [isOperationsCollapsed, setIsOperationsCollapsed] = useState(true);
  const [isAlpacaFillsCollapsed, setIsAlpacaFillsCollapsed] = useState(true);
  const [isMomentumCollapsed, setIsMomentumCollapsed] = useState(true);

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
    } catch (err) {
      console.error('Error fetching operations:', err);
    } finally {
      if (!silent) setOperationsLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, [selectedTab]);

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
    } catch (error) {
      console.error('Error fetching bot status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchMomentumAssets();
    const interval = setInterval(fetchStatus, 5000);
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
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Navigazione Globale Piattaforma */}
        <div className="flex gap-4 border-b border-gray-200 pb-2">
          <button
            onClick={() => setMainView('alpaca')}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer bg-transparent px-1 border-none ${
              mainView === 'alpaca'
                ? 'border-solid border-indigo-600 text-indigo-600 font-bold'
                : 'border-solid border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Alpaca AI Trading Bot
          </button>
          <button
            onClick={() => setMainView('oanda')}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer bg-transparent px-1 border-none ${
              mainView === 'oanda'
                ? 'border-solid border-indigo-600 text-indigo-600 font-bold'
                : 'border-solid border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            OANDA AI Market & Trade
          </button>
        </div>

        {mainView === 'oanda' ? (
          <TradingModule />
        ) : (
          <>
            {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Pannello di Controllo Trading
            </h1>
            <p className="text-sm text-gray-500 mt-1">Gestisci separatamente i conti Simulazione (Paper) e Reale (Live)</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Bottone di Panico / Panic Button */}
            <button
              onClick={() => setShowPanicConfirm(true)}
              className="flex items-center gap-2 px-4.5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-red-700 active:scale-95 transition-all cursor-pointer border-none"
            >
              <Flame className="w-4 h-4 animate-pulse" />
              PANIC BUTTON (LIQUIDA TUTTO)
            </button>

            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
             <button
               onClick={() => setSelectedTab('paper')}
               className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                 selectedTab === 'paper' 
                   ? 'bg-white text-indigo-700 shadow-sm' 
                   : 'text-gray-500 hover:text-gray-700'
               }`}
             >
               Simulazione (Paper)
             </button>
             <button
               onClick={() => setSelectedTab('live')}
               className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
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

        {/* Selected Panel */}
        <div>
          {selectedTab === 'paper' && status?.paper && (
            <AccountPanel 
              account={status.paper} 
              title="Conto Simulazione (Paper)" 
              isActive={!!status.paperActive} 
              type="paper" 
              onToggle={toggleBot} 
              onClosePosition={handleClosePosition}
              closingSymbols={closingSymbols}
              confirmCloseSymbol={confirmCloseSymbol}
              setConfirmCloseSymbol={setConfirmCloseSymbol}
            />
          )}
          {selectedTab === 'live' && status?.live && (
            <AccountPanel 
              account={status.live} 
              title="Conto Reale (Live)" 
              isActive={!!status.liveActive} 
              type="live" 
              onToggle={toggleBot} 
              onClosePosition={handleClosePosition}
              closingSymbols={closingSymbols}
              confirmCloseSymbol={confirmCloseSymbol}
              setConfirmCloseSymbol={setConfirmCloseSymbol}
            />
          )}
        </div>

        {/* Operazioni, Performance & Fills */}
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
              <button
                onClick={() => {
                  if (operationsData) {
                    downloadOperationsPDF(
                      selectedTab,
                      operationsData.positions || [],
                      operationsData.activities || [],
                      operationsData.dailyLogicLogs || []
                    );
                  }
                }}
                disabled={!operationsData || operationsLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-3.5 h-3.5" />
                Scarica PDF Operazioni
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
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                          <th className="p-3">Simbolo</th>
                          <th className="p-3 text-right">Quantità</th>
                          <th className="p-3 text-right">Pzo Carico</th>
                          <th className="p-3 text-right">Pzo Corrente</th>
                          <th className="p-3 text-right">Val. Mercato</th>
                          <th className="p-3 text-right">Gain / Loss Latente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {operationsData.positions.map((pos, idx) => {
                          const pl = parseFloat(pos.unrealized_pl || '0');
                          const plpc = parseFloat(pos.unrealized_plpc || '0') * 100;
                          return (
                            <tr key={idx} className="hover:bg-slate-100/30 text-slate-700">
                              <td className="p-3 font-bold text-slate-900">{pos.symbol}</td>
                              <td className="p-3 text-right font-mono">{parseFloat(pos.qty).toFixed(4)}</td>
                              <td className="p-3 text-right font-mono">${parseFloat(pos.avg_entry_price).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono">${parseFloat(pos.current_price).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono font-semibold">${parseFloat(pos.market_value).toFixed(2)}</td>
                              <td className={`p-3 text-right font-mono font-bold ${
                                pl > 0 ? 'text-green-600' : pl < 0 ? 'text-red-600' : 'text-slate-500'
                              }`}>
                                {pl > 0 ? '+' : ''}${pl.toFixed(2)} ({pl > 0 ? '+' : ''}{plpc.toFixed(2)}%)
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
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                          <th className="p-3">Data / Ora</th>
                          <th className="p-3">Simbolo</th>
                          <th className="p-3">Azione</th>
                          <th className="p-3 text-right">Quantità</th>
                          <th className="p-3 text-right">Prezzo Eseguito</th>
                          <th className="p-3 text-right">Controvalore</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {operationsData.activities
                          .filter((act: any) => act.activity_type === 'FILL' || act.type === 'fill')
                          .slice(0, 10)
                          .map((fill, idx) => {
                            const isBuy = (fill.side || '').toUpperCase() === 'BUY';
                            const amt = (parseFloat(fill.qty) * parseFloat(fill.price)).toFixed(2);
                            return (
                              <tr key={idx} className="hover:bg-slate-100/30">
                                <td className="p-3 text-slate-500 font-mono">
                                  {new Date(fill.transaction_time || fill.timestamp).toLocaleString('it-IT')}
                                </td>
                                <td className="p-3 font-bold text-slate-900">{fill.symbol}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {isBuy ? 'ACQUISTO' : 'VENDITA'}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono">{parseFloat(fill.qty).toFixed(4)}</td>
                                <td className="p-3 text-right font-mono">${parseFloat(fill.price).toFixed(2)}</td>
                                <td className="p-3 text-right font-mono font-semibold">${amt}</td>
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
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                  <Brain className="w-4 h-4 text-indigo-500" />
                  Log Logica Decisionale del Bot (Ultimi Segnali)
                </h3>
                {operationsData.dailyLogicLogs && operationsData.dailyLogicLogs.length > 0 ? (
                  <div className="overflow-x-auto bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-inner">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                          <th className="p-3">Ora</th>
                          <th className="p-3">Simbolo</th>
                          <th className="p-3">Decisione</th>
                          <th className="p-3 text-right">Prezzo</th>
                          <th className="p-3">Motivazione Sentiment LLM</th>
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
                                <td className="p-3 text-slate-500 font-mono">
                                  {new Date(log.timestamp).toLocaleTimeString('it-IT')}
                                </td>
                                <td className="p-3 font-bold text-slate-900">{log.symbol}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                                <td className="p-3 text-right font-mono">
                                  {log.price ? `$${parseFloat(log.price).toFixed(2)}` : 'N/D'}
                                </td>
                                <td className="p-3 text-slate-500 max-w-xs truncate" title={log.reasoning}>
                                  {log.reasoning}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs bg-slate-50/30 border border-dashed border-slate-200 rounded-xl">
                    Nessuna decisione o segnale recente registrato in memoria.
                  </div>
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

        {/* Debriefing Giornaliero AI */}
        <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200 mt-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Debriefing Giornaliero Assistito da AI
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simula una riunione di fine giornata con Gemini 3.5 per analizzare decisioni, correlazioni e ottenere regole ottimizzate.
              </p>
            </div>
            <button
              onClick={handleGenerateDebrief}
              disabled={debriefLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer ${
                debriefLoading 
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed animate-pulse' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${debriefLoading ? 'animate-spin' : ''}`} />
              {debriefLoading ? 'Analisi in corso...' : 'Avvia Riunione & Debriefing'}
            </button>
          </div>

          {status?.latestDailyDebrief ? (
            <div className="space-y-4">
              {/* Output Analisi */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-inner">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-slate-400" />
                    Rapporto della Riunione di Fine Giornata
                  </h3>
                  <button
                    onClick={() => downloadPDFWithOperations(
                      'Rapporto Debriefing Giornaliero AI',
                      `Analizzato il: ${new Date(status.latestDailyDebrief!.timestamp).toLocaleString('it-IT')}`,
                      status.latestDailyDebrief!.analysis,
                      status.latestDailyDebrief!.suggestedRule,
                      operationsData?.positions || [],
                      operationsData?.activities || [],
                      operationsData?.dailyLogicLogs || []
                    )}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Esporta PDF</span>
                  </button>
                </div>
                <div className="markdown-body text-sm text-slate-700 leading-relaxed space-y-2">
                  <ReactMarkdown>{status.latestDailyDebrief.analysis}</ReactMarkdown>
                </div>
                {status.latestDailyDebrief.timestamp && (
                  <div className="text-right text-[10px] text-slate-400 mt-3 flex items-center justify-end gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    Analizzato il: {new Date(status.latestDailyDebrief.timestamp).toLocaleString('it-IT')}
                  </div>
                )}
              </div>

              {/* Regola Ottimizzata da Copiare */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Regola Ottimizzata Proposta per il Bot
                  </h3>
                  <button
                    onClick={() => {
                      if (status.latestDailyDebrief) {
                        navigator.clipboard.writeText(status.latestDailyDebrief.suggestedRule);
                        setCopiedDebriefRule(true);
                        setTimeout(() => setCopiedDebriefRule(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition shadow-sm cursor-pointer"
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
                    className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm font-mono text-indigo-950 focus:outline-none resize-none shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-indigo-700 font-sans italic leading-normal">
                  💡 <strong>Suggerimento:</strong> Copia questa regola e incollala nel "Loop di Correzione" sottostante per addestrare il bot a migliorare le performance future.
                </p>
              </div>
            </div>
          ) : (
            !debriefLoading && (
              <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                Nessun debriefing generato per oggi. Clicca su "Avvia Riunione & Debriefing" per avviare l'analisi assistita da AI.
              </div>
            )
          )}
        </div>

        {/* Valutazioni su Periodi Multi-giorno con Selezione Intervalli */}
        <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200 mt-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Valutazione & Ottimizzazione Periodica (AI)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Valuta le performance e ottimizza la strategia su intervalli di tempo superiori al singolo giorno. Seleziona date e conto di riferimento.
              </p>
            </div>
          </div>

          {/* Selezione Rapida Periodo */}
          <div className="flex flex-wrap gap-2 mb-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Data Inizio
              </label>
              <input
                type="date"
                value={rangeStartDate}
                onChange={(e) => setRangeStartDate(e.target.value)}
                className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <button
                onClick={handleGenerateRangeDebrief}
                disabled={rangeLoading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm cursor-pointer ${
                  rangeLoading 
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed animate-pulse' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${rangeLoading ? 'animate-spin' : ''}`} />
                {rangeLoading ? 'Generando Analisi...' : 'Analizza Periodo'}
              </button>
            </div>
          </div>

          {/* PANNELLO DI RIEPILOGO METRICHE DI PERFORMANCE AGGREGATE */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-sans">
                  <BarChart2 className="w-4 h-4 text-indigo-600" />
                  Riepilogo Performance Aggregate ({selectedTab === 'live' ? 'Reale' : 'Simulazione'})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Statistiche calcolate in tempo reale per l'intervallo dal <strong className="text-slate-700">{rangeStartDate}</strong> al <strong className="text-slate-700">{rangeEndDate}</strong>.
                </p>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                {performanceMetrics.totalTrades} Trade Chiusi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CARD 1: WIN RATE */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Win Rate</span>
                    <span className="p-1 bg-green-50 text-green-700 rounded-lg">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold text-slate-900 font-mono">
                      {performanceMetrics.winRate.toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">successo</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {/* Piccolo Grafico a barre per Win Rate */}
                  <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden flex">
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
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      {performanceMetrics.winningTrades} Vincenti
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                      {performanceMetrics.losingTrades} Perdenti
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 2: PROFIT FACTOR */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Profit Factor</span>
                    <span className={`p-1 rounded-lg text-xs font-bold font-mono ${
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
                    <span className="text-2xl font-bold text-slate-900 font-mono">
                      {performanceMetrics.profitFactor === 99.9 ? '∞' : performanceMetrics.profitFactor.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">rapporto G/P</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {/* Grafico di confronto a barre per Profitto Lordo vs Perdita Lorda */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-semibold text-slate-400 font-mono">
                      <span>PROFITTO LORDO</span>
                      <span className="text-emerald-600">+${performanceMetrics.grossProfit.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        style={{ 
                          width: `${
                            performanceMetrics.grossProfit === 0 && performanceMetrics.grossLoss === 0 ? 0 :
                            (performanceMetrics.grossProfit / (Math.max(performanceMetrics.grossProfit, performanceMetrics.grossLoss) || 1)) * 100
                          }%` 
                        }} 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-semibold text-slate-400 font-mono">
                      <span>PERDITA LORDA</span>
                      <span className="text-rose-600">-${performanceMetrics.grossLoss.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        style={{ 
                          width: `${
                            performanceMetrics.grossProfit === 0 && performanceMetrics.grossLoss === 0 ? 0 :
                            (performanceMetrics.grossLoss / (Math.max(performanceMetrics.grossProfit, performanceMetrics.grossLoss) || 1)) * 100
                          }%` 
                        }} 
                        className="bg-rose-500 h-full transition-all duration-500" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: MASSIMO DRAWDOWN */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Max Drawdown</span>
                    <span className="p-1 bg-rose-50 text-rose-700 rounded-lg">
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-rose-600 font-mono">
                      -{performanceMetrics.maxDrawdownPercent.toFixed(2)}%
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      (-${performanceMetrics.maxDrawdownAmount.toFixed(2)})
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  {/* Istogramma a barre per il PnL dei singoli giorni dell'intervallo (se disponibile) o barra di esposizione */}
                  {performanceMetrics.pnlHistory.length > 1 ? (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-semibold text-slate-400 font-mono uppercase tracking-wider">
                        Trend PnL Giornaliero ({performanceMetrics.pnlHistory.length}gg)
                      </div>
                      <div className="flex items-end justify-between h-9 gap-1 bg-slate-100/50 p-1 rounded-lg">
                        {performanceMetrics.pnlHistory.map((day: any, dIdx: number) => {
                          const maxAbsPnL = Math.max(...performanceMetrics.pnlHistory.map((x: any) => Math.abs(x.pnl))) || 1;
                          const heightPercent = Math.max(15, Math.min(100, (Math.abs(day.pnl) / maxAbsPnL) * 100));
                          const isPositive = day.pnl >= 0;
                          return (
                            <div 
                              key={dIdx}
                              style={{ height: `${heightPercent}%` }}
                              className={`flex-1 rounded-sm transition-all duration-300 ${
                                isPositive ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-rose-400 hover:bg-rose-500'
                              }`}
                              title={`${day.date}: ${isPositive ? '+' : ''}$${day.pnl.toFixed(2)}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-semibold text-slate-400 font-mono">
                        <span>LIVELLO RISCHIO DRAWDOWN</span>
                        <span>{performanceMetrics.maxDrawdownPercent > 5 ? 'ELEVATO' : 'CONTENUTO'}</span>
                      </div>
                      <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, (performanceMetrics.maxDrawdownPercent / 10) * 100)}%` }} 
                          className={`h-full transition-all duration-500 ${
                            performanceMetrics.maxDrawdownPercent > 5 ? 'bg-rose-500' :
                            performanceMetrics.maxDrawdownPercent > 2 ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <div className="text-[9px] text-slate-400 italic text-right">
                        Soglia allerta: 10%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Riepilogo Profitto/Perdita Netto */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium font-sans">
              <span className="text-slate-500">Risultato Netto Realizzato nel Periodo:</span>
              <span className={`font-mono font-bold text-sm ${
                performanceMetrics.netPnL > 0 ? 'text-emerald-600' :
                performanceMetrics.netPnL < 0 ? 'text-rose-600' : 'text-slate-500'
              }`}>
                {performanceMetrics.netPnL > 0 ? '+' : ''}${performanceMetrics.netPnL.toFixed(2)}
              </span>
            </div>
          </div>

          {rangeDebrief ? (
            <div className="space-y-4">
              {/* Output Analisi Periodica */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-inner">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Activity className="w-4 h-4 text-slate-400" />
                    Rapporto Valutazione Periodica ({rangeStartDate} / {rangeEndDate})
                  </h3>
                  <button
                    onClick={() => downloadPDFWithOperations(
                      'Rapporto Valutazione Periodica AI',
                      `Periodo: dal ${rangeStartDate} al ${rangeEndDate}`,
                      rangeDebrief.analysis,
                      rangeDebrief.suggestedRule,
                      operationsData?.positions || [],
                      operationsData?.activities || [],
                      operationsData?.dailyLogicLogs || []
                    )}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Esporta PDF</span>
                  </button>
                </div>
                <div className="markdown-body text-sm text-slate-700 leading-relaxed space-y-2">
                  <ReactMarkdown>{rangeDebrief.analysis}</ReactMarkdown>
                </div>
              </div>

              {/* Regola Ottimizzata da Copiare */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Regola di Trading Suggerita per il Periodo
                  </h3>
                  <button
                    onClick={() => {
                      if (rangeDebrief) {
                        navigator.clipboard.writeText(rangeDebrief.suggestedRule);
                        setCopiedRangeRule(true);
                        setTimeout(() => setCopiedRangeRule(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition shadow-sm cursor-pointer"
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
                    className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm font-mono text-indigo-950 focus:outline-none resize-none shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-indigo-700 font-sans italic leading-normal">
                  💡 <strong>Suggerimento:</strong> Copia questa regola di medio periodo e inseriscila nel "Loop di Correzione" sottostante per addestrare il bot a ottimizzare la sua operatività futura.
                </p>
              </div>
            </div>
          ) : (
            !rangeLoading && (
              <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                Seleziona un intervallo di date e clicca su "Analizza Periodo" per generare l'analisi del periodo e ottenere nuove regole ottimizzate.
              </div>
            )
          )}
        </div>

        {/* Daily Report Motivation */}
        {status?.latestDailyReport && (
          <div className="bg-purple-50 p-6 rounded-2xl shadow-sm border border-purple-100 mt-6 mb-6">
            <h2 className="text-lg font-medium text-purple-900 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Report Motivazionale di Fine Giornata
            </h2>
            <div className="bg-white p-4 rounded-lg border border-purple-200 whitespace-pre-wrap font-sans text-sm text-purple-800 shadow-inner">
              {status.latestDailyReport}
            </div>
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
                  <span 
                    key={sym} 
                    className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 pl-3 pr-1.5 py-1 rounded-full text-xs font-bold font-mono text-indigo-300"
                  >
                    {sym}
                    <button 
                      onClick={() => handleToggleWatchlist(sym, true)}
                      className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition cursor-pointer"
                      title="Rimuovi dal monitoraggio"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Feedback Form */}
        <div className="bg-gray-50 p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
           <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-gray-500" />
             Loop di Correzione (Invia Regole al Bot)
           </h2>
           <form onSubmit={async (e) => {
             e.preventDefault();
             const formData = new FormData(e.currentTarget);
             const rule = formData.get('rule') as string;
             if (!rule) {
                showToast('Inserisci prima una regola correttiva valida!', 'warning', 'Invio Regola');
                return;
              }
              try {
                const res = await fetch('/api/feedback', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
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
           {status?.userFeedbackRules && status.userFeedbackRules.length > 0 && (
             <div className="mt-4">
               <h3 className="text-sm font-medium text-gray-700 mb-2">Regole Attive:</h3>
               <ul className="space-y-2 text-xs text-gray-600">
                 {status.userFeedbackRules.map((r, i) => (
                   <li key={i} className="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                     <span className="flex-1 break-words mr-2">{r}</span>
                     <button
                       onClick={async () => {
                         try {
                           const res = await fetch('/api/feedback/delete', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
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

          </>
        )}

        {/* Sistema Notifiche Toast in Tempo Reale */}
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
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

      </div>
    </div>
  );
}
