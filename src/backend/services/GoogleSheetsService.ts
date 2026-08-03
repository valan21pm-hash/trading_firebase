import { google } from 'googleapis';
import fs from 'fs';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU';
const LOG_SHEET_ID = process.env.GOOGLE_LOG_SHEET_ID || '1fPJP4OwOwRO92qadCARR62gfDOZTZlS47YouRY2_sxU';
const FEEDBACK_SHEET_ID = process.env.GOOGLE_FEEDBACK_SHEET_ID || '1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc';

export class GoogleSheetsService {
  private static userAccessToken: string | null = null;

  public static setUserAccessToken(token: string | null) {
    if (token) {
      this.userAccessToken = token;
      try {
        fs.writeFileSync('sheets_token.json', JSON.stringify({ token, updatedAt: new Date().toISOString() }));
      } catch (e) {}
    }
  }

  public static getUserAccessToken(): string | null {
    if (this.userAccessToken) return this.userAccessToken;
    try {
      if (fs.existsSync('sheets_token.json')) {
        const data = JSON.parse(fs.readFileSync('sheets_token.json', 'utf8'));
        if (data && data.token) {
          this.userAccessToken = data.token;
          return this.userAccessToken;
        }
      }
    } catch (e) {}
    return null;
  }

  private static getSheetsClient() {
    const token = this.getUserAccessToken();
    if (token) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });
      return google.sheets({ version: 'v4', auth: oauth2Client });
    }

    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return google.sheets({ version: 'v4', auth });
  }

  private static async getFirstSheetName(spreadsheetId: string = SHEET_ID, preferredNames: string[] = []): Promise<string> {
    try {
      const sheets = this.getSheetsClient();
      const res = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetList = res.data.sheets || [];
      if (preferredNames.length > 0) {
        for (const pref of preferredNames) {
          const found = sheetList.find(s => s.properties?.title?.toLowerCase() === pref.toLowerCase());
          if (found?.properties?.title) return found.properties.title;
        }
      }
      return sheetList[0]?.properties?.title || '';
    } catch (e: any) {
      console.warn(`[GoogleSheetsService] Impossibile recuperare il nome del foglio per ${spreadsheetId}:`, e?.message || e);
      return '';
    }
  }

  private static formatError(err: any, sheetId: string = SHEET_ID): string {
    const msg = err?.message || String(err);
    if (msg.includes('Google Sheets API has not been used') || msg.includes('disabled')) {
      return `L'API Google Sheets è disabilitata per il progetto GCP. Visita https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=289516009831 per abilitarla.`;
    }
    if (msg.includes('The caller does not have permission') || msg.includes('403')) {
      return `Permessi insufficienti sul Foglio Google (${sheetId}). Assicurati che il foglio sia condiviso in lettura/scrittura o effettua il login con Google.`;
    }
    return msg;
  }

  public static async appendLogsToSheet(payload: any, targetSheetId: string = LOG_SHEET_ID): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      
      let sheetNameVal = payload.sheetName || (payload.data && payload.data.sheetName);
      if (!sheetNameVal) {
        sheetNameVal = await this.getFirstSheetName(targetSheetId, ['Logs', 'StoriaLOG', 'LOGS', 'Foglio1', 'Sheet1']);
      }
      
      const row = [
        new Date().toISOString(),
        payload.eventType || '',
        payload.mode || '',
        payload.symbol || '',
        payload.action || '',
        JSON.stringify(payload.data || {})
      ];

      const range = sheetNameVal ? `${sheetNameVal}!A:F` : 'A:F';

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row]
        }
      });
      return true;
    } catch (err: any) {
      console.error('[GoogleSheetsService] Errore in appendLogsToSheet:', this.formatError(err, targetSheetId));
      return false;
    }
  }

  public static async syncFeedbackRulesFromSheet(targetSheetId: string = FEEDBACK_SHEET_ID): Promise<string[] | null> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName(targetSheetId, ['LOOP', 'Regole', 'Feedback']);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A:B`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      const rules: string[] = [];
      const startIndex = (rows[0] && rows[0][0] && (rows[0][0].toLowerCase().includes('regol') || rows[0][0].toLowerCase().includes('loop'))) ? 1 : 0;
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row && row[0] && row[0].trim().length > 0) {
          rules.push(row[0].trim());
        }
      }
      return rules;
    } catch (err: any) {
      const errMsg = this.formatError(err, targetSheetId);
      console.error('[GoogleSheetsService] Errore in syncFeedbackRulesFromSheet:', errMsg);
      throw new Error(errMsg);
    }
  }

  private static derivePredicateFromRule(rule: string): string {
    const r = rule.toLowerCase();
    
    if (rule.includes('f(') && rule.includes('=')) {
      return rule;
    }

    const conds: string[] = [];

    if (r.includes('60 minut') || r.includes('dt < 60') || r.includes('holding period')) {
      if (r.includes('spy') || r.includes('voo')) {
        conds.push("dt < 60 per ['SPY', 'VOO']");
      } else {
        conds.push("dt < 60");
      }
    } else if (r.includes('minut') || r.includes('dt <')) {
      const match = r.match(/(\d+)\s*minut/);
      if (match) conds.push(`dt < ${match[1]}`);
    }

    if (r.includes('sentiment') && (r.includes('0.00') || r.includes('0') || r.includes('zero'))) {
      if (r.includes('sell') || r.includes('vendit')) {
        conds.push("(s == 0.00 and sig == 'SELL')");
      } else {
        conds.push("s == 0.00");
      }
    }

    if (r.includes('0.2') || r.includes('-0.2')) {
      conds.push("abs(s) <= 0.2");
    }

    if (conds.length > 0) {
      return `f(dt, s, sig) = 0 se ${conds.join(' or ')}; altrimenti 1`;
    }

    return 'f(dt, s, sig) = 1 (EXECUTE)';
  }

  public static async appendFeedbackRuleToSheet(rule: string, targetSheetId: string = FEEDBACK_SHEET_ID): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName(targetSheetId, ['LOOP', 'Regole', 'Feedback']);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A1:B1`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: targetSheetId,
          range: `${sheetName}!A1:B1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Regole di Feedback (Loops di Correzione)', 'Predicato di Esecuzione (Logica Operativa)']],
          },
        });
      }

      const predicate = this.derivePredicateFromRule(rule);

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A:B`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[rule, predicate]],
        },
      });

      return true;
    } catch (err: any) {
      const errMsg = this.formatError(err, targetSheetId);
      console.error('[GoogleSheetsService] Errore in appendFeedbackRuleToSheet:', errMsg);
      throw new Error(errMsg);
    }
  }

  public static async exportFeedbackRulesToSheet(rules: string[], targetSheetId: string = FEEDBACK_SHEET_ID): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName(targetSheetId, ['LOOP', 'Regole', 'Feedback']);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A:B`,
      });

      const rows = response.data.values || [];
      const existingRules = new Set<string>();

      if (rows.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: targetSheetId,
          range: `${sheetName}!A1:B1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Regole di Feedback (Loops di Correzione)', 'Predicato di Esecuzione (Logica Operativa)']],
          },
        });
      } else {
        const startIndex = (rows[0] && rows[0][0] && (rows[0][0].toLowerCase().includes('regol') || rows[0][0].toLowerCase().includes('loop'))) ? 1 : 0;
        for (let i = startIndex; i < rows.length; i++) {
          if (rows[i] && rows[i][0]) {
            existingRules.add(rows[i][0].trim());
          }
        }
      }

      const newRows: string[][] = [];
      for (const rule of rules) {
        if (rule && rule.trim().length > 0 && !existingRules.has(rule.trim())) {
          const predicate = this.derivePredicateFromRule(rule);
          newRows.push([rule.trim(), predicate]);
        }
      }

      if (newRows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: targetSheetId,
          range: `${sheetName}!A:B`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: newRows,
          },
        });
      }

      return true;
    } catch (err: any) {
      const errMsg = this.formatError(err, targetSheetId);
      console.error('[GoogleSheetsService] Errore in exportFeedbackRulesToSheet:', errMsg);
      throw new Error(errMsg);
    }
  }

  public static async syncKeysFromSheet(targetSheetId: string = SHEET_ID): Promise<Record<string, string> | null> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName(targetSheetId, ['Chiavi', 'Keys', 'Credentials']);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A:B`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return null;
      }

      const keys: Record<string, string> = {};
      const isHeaderRow = rows[0] && (
        (rows[0][0] || '').toLowerCase().includes('nome') || 
        (rows[0][0] || '').toLowerCase().includes('key') ||
        (rows[0][0] || '').toLowerCase().includes('chiave')
      );
      const startIndex = isHeaderRow ? 1 : 0;

      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row && row[0] && row[1]) {
          const rawKey = String(row[0]).trim();
          const rawVal = String(row[1]).trim();
          keys[rawKey] = rawVal;
        }
      }
      return keys;
    } catch (err: any) {
      const errMsg = this.formatError(err, targetSheetId);
      console.error('[GoogleSheetsService] Errore in syncKeysFromSheet:', errMsg);
      throw new Error(errMsg);
    }
  }

  public static async exportKeysToSheet(keysObj: Record<string, string>, targetSheetId: string = SHEET_ID): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName(targetSheetId, ['Chiavi', 'Keys', 'Credentials']);
      
      const values = [['Nome Chiave', 'Valore Chiave']];
      for (const [key, value] of Object.entries(keysObj)) {
        values.push([key, value]);
      }

      await sheets.spreadsheets.values.clear({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A:B`,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
      return true;
    } catch (err: any) {
      const errMsg = this.formatError(err, targetSheetId);
      console.error('[GoogleSheetsService] Errore in exportKeysToSheet:', errMsg);
      throw new Error(errMsg);
    }
  }
}

