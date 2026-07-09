import 'dotenv/config';

interface IgSession {
  accountId: string;
  cst: string;
  securityToken: string;
  expiresAt: number;
}

export class IgAuthService {
  private static instance: IgAuthService;
  private session: IgSession | null = null;
  
  private constructor() {}

  static getInstance(): IgAuthService {
    if (!IgAuthService.instance) {
      IgAuthService.instance = new IgAuthService();
    }
    return IgAuthService.instance;
  }

  getBaseUrl(): string {
    const mode = process.env.IG_MODE || 'demo';
    return mode === 'live' || mode === 'real' 
      ? 'https://api.ig.com/gateway/deal' 
      : 'https://demo-api.ig.com/gateway/deal';
  }

  getApiKey(): string {
    return process.env.IG_API_KEY || process.env.IG_DEMO_API_KEY || '';
  }

  async login(): Promise<IgSession> {
    const username = process.env.IG_USERNAME;
    const password = process.env.IG_PASSWORD;
    const apiKey = this.getApiKey();

    if (!username || !password || !apiKey) {
      throw new Error('Credenziali IG Markets mancanti (IG_USERNAME, IG_PASSWORD, API_KEY).');
    }

    try {
      const response = await fetch(`${this.getBaseUrl()}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IG-API-KEY': apiKey,
          'VERSION': '2'
        },
        body: JSON.stringify({ identifier: username, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Auth failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      this.session = {
        accountId: data.accountId,
        cst: response.headers.get('CST') || '',
        securityToken: response.headers.get('X-SECURITY-TOKEN') || '',
        expiresAt: Date.now() + 9 * 60 * 60 * 1000 // Scadenza prudenziale (9 ore)
      };
      
      console.log(`[IG Auth] Autenticazione riuscita. Account ID: ${this.session.accountId}`);
      return this.session;
    } catch (error) {
      console.error('[IG Auth] Errore di connessione:', error);
      throw error;
    }
  }

  async getHeaders(version: string = '2'): Promise<Record<string, string>> {
    if (!this.session || this.session.expiresAt < Date.now()) {
      await this.login();
    }
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json; charset=UTF-8',
      'X-IG-API-KEY': this.getApiKey(),
      'CST': this.session!.cst,
      'X-SECURITY-TOKEN': this.session!.securityToken,
      'VERSION': version
    };
  }
}
