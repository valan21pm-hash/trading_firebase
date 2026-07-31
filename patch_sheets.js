const fs = require('fs');
let content = fs.readFileSync('src/backend/services/GoogleSheetsService.ts', 'utf8');

content = content.replace(/range: 'Foglio1!A:B',/g, "range: sheetName + '!A:B',");
content = content.replace(/range: 'Foglio1!A1',/g, "range: sheetName + '!A1',");

const getSheetCode = `
  private static async getFirstSheetName(): Promise<string> {
    const sheets = this.getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    return res.data.sheets?.[0]?.properties?.title || 'Foglio1';
  }
`;

content = content.replace('  public static async syncKeysFromSheet', getSheetCode + '\n  public static async syncKeysFromSheet');
content = content.replace(/const sheets = this.getSheetsClient\(\);/g, "const sheets = this.getSheetsClient();\n      const sheetName = await this.getFirstSheetName();");
fs.writeFileSync('src/backend/services/GoogleSheetsService.ts', content);
