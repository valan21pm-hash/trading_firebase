import { google } from 'googleapis';
import fs from 'fs';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU';

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
      return sheetList[0]?.properties?.title || 'Foglio1';
    } catch (e: any) {
      console.warn(`[GoogleSheetsService] Impossibile recuperare il nome del foglio per ${spreadsheetId}:`, e?.message || e);
      return preferredNames[0] || 'Foglio1';
    }
  }

  private static formatError(err: any): string {
    const msg = err?.message || String(err);
    if (msg.includes('Google Sheets API has not been used') || msg.includes('disabled')) {
      return `L'API Google Sheets è disabilitata per il progetto GCP. Visita https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=289516009831 per abilitarla.`;
    }
    if (msg.includes('The caller does not have permission') || msg.includes('403')) {
      return `Permessi insufficienti sul Foglio Google (1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU). Assicurati che il foglio sia condiviso in lettura/scrittura o effettua il login con Google.`;
    }
    return msg;
  }

  public static async appendLogsToSheet(payload: any, targetSheetId: string = SHEET_ID): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      
      let sheetNameVal = payload.sheetName || (payload.data && payload.data.sheetName);
      if (!sheetNameVal) {
        sheetNameVal = await this.getFirstSheetName(targetSheetId, ['Logs', 'StoriaLOG', 'LOGS']);
      }
      
      const row = [
        new Date().toISOString(),
        payload.eventType || '',
        payload.mode || '',
        payload.symbol || '',
        payload.action || '',
        JSON.stringify(payload.data || {})
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: `${sheetNameVal}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row]
        }
      });
      return true;
    } catch (err: any) {
      console.error('[GoogleSheetsService] Errore in appendLogsToSheet:', this.formatError(err));
      return false;
    }
  }

  public static async syncFeedbackRulesFromSheet(targetSheetId: string = SHEET_ID): Promise<string[] | null> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName(targetSheetId, ['LOOP', 'Regole', 'Feedback']);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A:A`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      const rules: string[] = [];
      const startIndex = (rows[0] && rows[0][0] && rows[0][0].toLowerCase().includes('regol')) ? 1 : 0;
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row && row[0] && row[0].trim().length > 0) {
          rules.push(row[0].trim());
        }
      }
      return rules;
    } catch (err: any) {
      const errMsg = this.formatError(err);
      console.error('[GoogleSheetsService] Errore in syncFeedbackRulesFromSheet:', errMsg);
      throw new Error(errMsg);
    }
  }

  public static async exportFeedbackRulesToSheet(rules: string[], targetSheetId: string = SHEET_ID): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName(targetSheetId, ['LOOP', 'Regole', 'Feedback']);
      
      const values = [['Regole di Feedback (Loops di Correzione)']];
      for (const rule of rules) {
        values.push([rule]);
      }

      await sheets.spreadsheets.values.clear({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!A:A`,
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
      const errMsg = this.formatError(err);
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
      const errMsg = this.formatError(err);
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
      const errMsg = this.formatError(err);
      console.error('[GoogleSheetsService] Errore in exportKeysToSheet:', errMsg);
      throw new Error(errMsg);
    }
  }
}

