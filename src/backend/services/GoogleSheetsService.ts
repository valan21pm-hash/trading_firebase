import { google } from 'googleapis';
import fs from 'fs';

const SHEET_ID = '1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU';

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

  private static async getFirstSheetName(): Promise<string> {
    const sheets = this.getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    return res.data.sheets?.[0]?.properties?.title || 'Foglio1';
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
