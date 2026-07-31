const fs = require('fs');
let content = fs.readFileSync('src/backend/services/GoogleSheetsService.ts', 'utf8');
content = content.replace("const SHEET_ID = '1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU';",
`const SHEET_ID = '1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU';
const LOG_SHEET_ID = '1fPJP4OwOwRO92qadCARR62gfDOZTZlS47YouRY2_sxU';`);

const appendLogsMethod = `
  public static async appendLogsToSheet(payload: any): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      
      const sheetNameVal = payload.sheetName || (payload.data && payload.data.sheetName) || 'Logs';
      
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
        range: \`\${sheetNameVal}!A:F\`,
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
`;

content = content.replace("  public static async syncKeysFromSheet", appendLogsMethod + "\n  public static async syncKeysFromSheet");

fs.writeFileSync('src/backend/services/GoogleSheetsService.ts', content);
