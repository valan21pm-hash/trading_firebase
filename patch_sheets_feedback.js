const fs = require('fs');
let content = fs.readFileSync('src/backend/services/GoogleSheetsService.ts', 'utf8');

const feedbackMethods = `
  public static async syncFeedbackRulesFromSheet(): Promise<string[] | null> {
    try {
      const sheets = this.getSheetsClient();
      const sheetName = await this.getFirstSheetName('1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc');
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: '1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc',
        range: \`\${sheetName}!A:A\`,
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
        range: \`\${sheetName}!A:A\`,
      });

      // Update with new content
      await sheets.spreadsheets.values.update({
        spreadsheetId: '1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc',
        range: \`\${sheetName}!A1\`,
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
`;

content = content.replace("  public static async syncKeysFromSheet", feedbackMethods + "\n  public static async syncKeysFromSheet");
fs.writeFileSync('src/backend/services/GoogleSheetsService.ts', content);
