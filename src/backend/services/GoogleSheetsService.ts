import { google } from 'googleapis';
import fs from 'fs';

const SHEET_ID = '1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU';
const LOG_SHEET_ID = '1fPJP4OwOwRO92qadCARR62gfDOZTZlS47YouRY2_sxU';

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

  private static async getFirstSheetName(spreadsheetId: string = SHEET_ID): Promise<string> {
    const sheets = this.getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    return res.data.sheets?.[0]?.properties?.title || 'Foglio1';
  }

  public static async appendLogsToSheet(payload: any): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      
      let sheetNameVal = payload.sheetName || (payload.data && payload.data.sheetName);
      if (!sheetNameVal) {
        sheetNameVal = await this.getFirstSheetName(LOG_SHEET_ID);
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
        spreadsheetId: LOG_SHEET_ID,
        range: `${sheetNameVal}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row]
        }
      });
      return true;
    } catch (err: any) {
      console.error('[GoogleSheetsService] Errore in appendLogsToSheet:', err.message);
      return false;
    }
  }

  public static async syncFeedbackRulesFromSheet(): Promise<string[] | null> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName('1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc');
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: '1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc',
        range: `${sheetName}!A:A`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      const rules: string[] = [];
      // Skip header
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0] && row[0].trim().length > 0) {
          rules.push(row[0].trim());
        }
      }
      return rules;
    } catch (err: any) {
      console.error('[GoogleSheetsService] Errore in syncFeedbackRulesFromSheet:', err.message);
      return null;
    }
  }

  public static async exportFeedbackRulesToSheet(rules: string[]): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName('1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc');
      
      const values = [['Regole di Feedback (Loops di Correzione)']];
      for (const rule of rules) {
        values.push([rule]);
      }

      // Clear existing content
      await sheets.spreadsheets.values.clear({
        spreadsheetId: '1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc',
        range: `${sheetName}!A:A`,
      });

      // Update with new content
      await sheets.spreadsheets.values.update({
        spreadsheetId: '1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc',
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
      return true;
    } catch (err: any) {
      console.error('[GoogleSheetsService] Errore in exportFeedbackRulesToSheet:', err.message);
      return false;
    }
  }

  public static async syncKeysFromSheet(): Promise<Record<string, string> | null> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A:B`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return null;
      }

      const keys: Record<string, string> = {};
      // Skip header (assuming row 0 is header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0] && row[1]) {
          keys[row[0]] = row[1];
        }
      }
      return keys;
    } catch (err: any) {
      console.error('[GoogleSheetsService] Errore in syncKeysFromSheet:', err.message);
      return null;
    }
  }

  public static async exportKeysToSheet(keysObj: Record<string, string>): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName();
      
      const values = [['Nome Chiave', 'Valore Chiave']];
      for (const [key, value] of Object.entries(keysObj)) {
        values.push([key, value]);
      }

      // Clear existing content
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A:B`,
      });

      // Update with new content
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
      return true;
    } catch (err: any) {
      console.error('[GoogleSheetsService] Errore in exportKeysToSheet:', err.message);
      return false;
    }
  }
}
