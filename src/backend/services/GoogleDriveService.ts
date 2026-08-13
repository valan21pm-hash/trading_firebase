import { google } from 'googleapis';
import fs from 'fs';

const DRIVE_FOLDER_ID = '1ZtwUz2SMUQg20nPWYf_KWHfljK5kya1_';
const STORIA_LOG_FILE = 'StoriaLOG.json';
const CHIAVI_API_FILE = 'ChiaviAPI.json';

export class GoogleDriveService {
  private static userAccessToken: string | null = null;

  public static getFolderId(): string {
    return DRIVE_FOLDER_ID;
  }

  public static setUserAccessToken(token: string | null) {
    if (token) {
      this.userAccessToken = token;
      try {
        fs.writeFileSync('drive_token.json', JSON.stringify({ token, updatedAt: new Date().toISOString() }));
      } catch (e) {}
    }
  }

  public static getUserAccessToken(): string | null {
    if (this.userAccessToken) return this.userAccessToken;
    try {
      if (fs.existsSync('drive_token.json')) {
        const data = JSON.parse(fs.readFileSync('drive_token.json', 'utf8'));
        if (data && data.token) {
          this.userAccessToken = data.token;
          return this.userAccessToken;
        }
      }
    } catch (e) {}
    return null;
  }

  private static getDriveClient() {
    const token = this.getUserAccessToken();
    if (token) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });
      return google.drive({ version: 'v3', auth: oauth2Client });
    }

    const auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Cerca un file per nome nella cartella Drive specificata (ID: 1ZtwUz2SMUQg20nPWYf_KWHfljK5kya1_)
   */
  public static async findFileByName(filename: string): Promise<string | null> {
    try {
      const drive = this.getDriveClient();
      const response = await drive.files.list({
        q: `'${DRIVE_FOLDER_ID}' in parents and name = '${filename}' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      const files = response.data.files;
      if (files && files.length > 0 && files[0].id) {
        return files[0].id;
      }
    } catch (err: any) {
      console.warn(`[GoogleDrive] Attenzione: ricerca file '${filename}' in Drive non riuscita:`, err.message);
    }
    return null;
  }

  /**
   * Legge il contenuto JSON di un file su Google Drive (con fallback automatico su backup locale)
   */
  public static async readJsonFile<T>(filename: string): Promise<T | null> {
    try {
      const fileId = await this.findFileByName(filename);
      if (fileId) {
        const drive = this.getDriveClient();
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media'
        }, { responseType: 'json' });

        if (response.data) {
          return response.data as T;
        }
      }
    } catch (err: any) {
      console.warn(`[GoogleDrive] Avviso lettura '${filename}' da Drive: ${err.message}. Verifico backup locale...`);
    }

    // Fallback su file di backup locale
    try {
      const localPath = `./data_backup/${filename}`;
      if (fs.existsSync(localPath)) {
        const raw = fs.readFileSync(localPath, 'utf8');
        return JSON.parse(raw) as T;
      }
    } catch (e: any) {
      console.warn(`[Local Backup] Impossibile leggere backup locale di '${filename}':`, e.message);
    }

    return null;
  }

  /**
   * Salva o sovrascrive un file JSON su Google Drive e mantiene una copia locale di sicurezza
   */
  public static async saveJsonFile(filename: string, content: any): Promise<boolean> {
    const jsonString = JSON.stringify(content, null, 2);

    // 1. Salva sempre la copia locale di backup
    try {
      if (!fs.existsSync('./data_backup')) {
        fs.mkdirSync('./data_backup', { recursive: true });
      }
      fs.writeFileSync(`./data_backup/${filename}`, jsonString);
    } catch (e: any) {
      console.warn(`[Local Backup] Impossibile scrivere copia locale di ${filename}:`, e.message);
    }

    // 2. Tenta il salvataggio su Google Drive
    try {
      const drive = this.getDriveClient();
      const existingFileId = await this.findFileByName(filename);

      if (existingFileId) {
        // Sovrascrivi file esistente
        await drive.files.update({
          fileId: existingFileId,
          media: {
            mimeType: 'application/json',
            body: jsonString
          }
        });
        console.log(`[GoogleDrive] File '${filename}' aggiornato con successo in Drive.`);
      } else {
        // Crea nuovo file nella cartella Drive target
        await drive.files.create({
          requestBody: {
            name: filename,
            parents: [DRIVE_FOLDER_ID],
            mimeType: 'application/json'
          },
          media: {
            mimeType: 'application/json',
            body: jsonString
          },
          fields: 'id'
        });
        console.log(`[GoogleDrive] File '${filename}' creato con successo nella cartella Drive (${DRIVE_FOLDER_ID}).`);
      }
      return true;
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('Google Drive API has not been used') || errMsg.includes('disabled')) {
        console.warn(`[GoogleDrive Avviso] Google Drive API non ancora attiva sul progetto Cloud. Il file '${filename}' è stato salvato in sicurezza nella memoria locale ('./data_backup/${filename}').`);
      } else {
        console.warn(`[GoogleDrive Avviso] Impossibile sincronizzare '${filename}' con Drive (${errMsg}). Copia di backup salvata in locale.`);
      }
      return false;
    }
  }

  /**
   * Aggiunge (append/merge) i nuovi log al file StoriaLOG.json presente in Drive.
   * Garantisce che nessun log passato venga mai sovrascritto.
   */
  public static async appendLogsToDrive(newLogs: Array<any>): Promise<boolean> {
    try {
      const existingData = await this.readJsonFile<any>(STORIA_LOG_FILE);
      let combinedLogs: Array<any> = [];

      if (existingData) {
        if (Array.isArray(existingData)) {
          combinedLogs = existingData;
        } else if (Array.isArray(existingData.logs)) {
          combinedLogs = existingData.logs;
        }
      }

      // Deduplicazione per evitare log duplicati
      const existingKeys = new Set(
        combinedLogs.map(item => {
          if (typeof item === 'string') return item;
          return `${item.timestamp || ''}_${item.message || ''}_${item.mode || ''}`;
        })
      );

      for (const log of newLogs) {
        const key = typeof log === 'string' ? log : `${log.timestamp || ''}_${log.message || ''}_${log.mode || ''}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          combinedLogs.push(log);
        }
      }

      const payload = {
        updatedAt: new Date().toISOString(),
        folderId: DRIVE_FOLDER_ID,
        totalLogsCount: combinedLogs.length,
        logs: combinedLogs
      };

      return await this.saveJsonFile(STORIA_LOG_FILE, payload);
    } catch (err: any) {
      console.warn('[GoogleDrive Avviso] Errore durante l\'append dei log su StoriaLOG.json:', err.message);
      return false;
    }
  }

  /**
   * Salva o aggiorna le credenziali API (Alpaca e LLM) su ChiaviAPI.json in Google Drive
   */
  public static async syncChiaviApiToDrive(credentialsPayload: any): Promise<boolean> {
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        folderId: DRIVE_FOLDER_ID,
        credentials: credentialsPayload
      };
      return await this.saveJsonFile(CHIAVI_API_FILE, payload);
    } catch (err: any) {
      console.warn('[GoogleDrive Avviso] Impossibile salvare ChiaviAPI.json:', err.message);
      return false;
    }
  }

  /**
   * Carica ChiaviAPI.json da Google Drive se presente
   */
  public static async loadChiaviApiFromDrive(): Promise<any | null> {
    try {
      const data = await this.readJsonFile<any>(CHIAVI_API_FILE);
      if (data && data.credentials) {
        return data.credentials;
      }
      return data;
    } catch (err: any) {
      console.warn('[GoogleDrive] Impossibile caricare ChiaviAPI.json all\'avvio:', err.message);
      return null;
    }
  }
}
