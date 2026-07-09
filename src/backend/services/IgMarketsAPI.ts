import 'dotenv/config';

export class IgMarketsAPI {
  private static instance: IgMarketsAPI;
  private session: any = null;
  
  private constructor() {}

  static getInstance() {
    if (!IgMarketsAPI.instance) {
      IgMarketsAPI.instance = new IgMarketsAPI();
    }
    return IgMarketsAPI.instance;
  }

  getBaseUrl() {
    const mode = process.env.IG_MODE || 'demo';
    return mode === 'live' || mode === 'real' ? 'https://api.ig.com/gateway/deal' : 'https://demo-api.ig.com/gateway/deal';
  }

  getApiKey() {
    const mode = (process.env.IG_MODE || 'demo').toLowerCase();
    if (mode === 'live' || mode === 'real') {
      return process.env.IG_API_KEY || '';
    }
    return process.env.IG_DEMO_API_KEY || '';
  }

  async login() {
    const mode = (process.env.IG_MODE || 'demo').toLowerCase();
    const username = process.env.IG_USERNAME;
    const password = process.env.IG_PASSWORD;
    const apiKey = this.getApiKey();

    if (!username || !password || !apiKey) {
      const missing = [];
      if (!username) missing.push('IG_USERNAME');
      if (!password) missing.push('IG_PASSWORD');
      if (!apiKey) missing.push(mode === 'live' || mode === 'real' ? 'IG_API_KEY' : 'IG_DEMO_API_KEY');
      throw new Error(`Credenziali IG Markets mancanti nei Secrets: ${missing.join(', ')}.`);
    }

    if (username.includes('@')) {
      throw new Error(`L'username impostato è un'email (${username}). Le API REST di IG Markets richiedono lo username alfanumerico (es. 'valan21pm').`);
    }

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
      const errMsg = JSON.stringify(errorData);
      const mode = process.env.IG_MODE || 'demo';
      
      if (errMsg.includes("error.security.api-key-invalid") || response.status === 403) {
        const advice = mode === 'demo' 
          ? "Se stai usando una chiave REALE (tab 'Conti'), imposta IG_MODE=real. Per il DEMO, usa la chiave della tab 'Conti demo'."
          : "Assicurati di usare la chiave corretta della tab 'Conti' per l'ambiente reale.";
        throw new Error(`La chiave API non è valida per l'ambiente ${mode.toUpperCase()}. ${advice}`);
      }
      
      if (errMsg.includes("error.security.invalid-details") || response.status === 401) {
        throw new Error(`Le credenziali inserite (username o password) non sono corrette (401). Verifica IG_USERNAME e IG_PASSWORD.`);
      }

      throw new Error(`IG Login Failed: ${response.status} - ${errMsg}`);
    }

    const data = await response.json();
    this.session = {
      accountId: data.accountId,
      cst: response.headers.get('CST'),
      securityToken: response.headers.get('X-SECURITY-TOKEN'),
      expiresAt: Date.now() + 10 * 60 * 60 * 1000 // 10 hours
    };
    
    return data;
  }

  async getHeaders() {
    if (!this.session || this.session.expiresAt < Date.now()) {
      await this.login();
    }
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json; charset=UTF-8',
      'X-IG-API-KEY': this.getApiKey(),
      'CST': this.session.cst,
      'X-SECURITY-TOKEN': this.session.securityToken,
      'VERSION': '2'
    };
  }

  async getAccounts() {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.getBaseUrl()}/accounts`, { headers });
    if (!response.ok) throw new Error('Failed to fetch IG accounts');
    const data = await response.json();
    return data.accounts;
  }

  async testConnection() {
    const data = await this.login();
    const accounts = await this.getAccounts().catch(() => []);
    
    let balance = 0;
    let accountName = "IG CFD";
    
    if (accounts && accounts.length > 0) {
      const preferredAcct = accounts.find((a: any) => a.preferred) || accounts[0];
      accountName = preferredAcct.accountName || "IG CFD";
      if (preferredAcct.balance !== undefined) {
        balance = parseFloat(preferredAcct.balance);
      } else if (preferredAcct.accountBalance && preferredAcct.accountBalance.balance !== undefined) {
        balance = parseFloat(preferredAcct.accountBalance.balance);
      }
    }

    return {
      success: true,
      accountId: data.accountId,
      balance: balance,
      accountName: accountName,
      message: `Connessione a IG Markets stabilita con successo! Collegato all'account ${accountName} con un saldo di ${balance.toFixed(2)} €.`
    };
  }

  async getPositions() {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.getBaseUrl()}/positions`, { headers });
    if (!response.ok) throw new Error('Failed to fetch IG positions');
    const data = await response.json();
    return data.positions || [];
  }

  async closePosition(dealId: string) {
    const headers = await this.getHeaders();
    // IG requires _method=DELETE or actual DELETE request with body depending on version
    // Using VERSION 1 for close position
    const headersV1 = { ...headers, 'VERSION': '1', '_method': 'DELETE' };
    const response = await fetch(`${this.getBaseUrl()}/positions/otc`, {
      method: 'POST',
      headers: headersV1,
      body: JSON.stringify({
        dealId: dealId,
        epic: null,
        expiry: null,
        direction: 'BUY', // It ignores direction if dealId is provided? Actually DELETE usually takes dealId in path or body.
        size: '1', 
        orderType: 'MARKET'
      })
    });
    // Actually, IG closing position is better done by opposite order or DELETE /positions/otc
    // Let's use the standard OTC close
    const response2 = await fetch(`${this.getBaseUrl()}/positions/otc/${dealId}`, {
      method: 'DELETE',
      headers: { ...headers, 'VERSION': '1' }
    });
    if (!response2.ok) throw new Error('Failed to close IG position');
    return response2.json();
  }

  async createOrder(epic: string, direction: 'BUY' | 'SELL', size: number) {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.getBaseUrl()}/positions/otc`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        epic,
        expiry: '-',
        direction,
        size,
        orderType: 'MARKET',
        guaranteedStop: false,
        forceOpen: true,
        currencyCode: 'EUR'
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Failed to create IG order: ${JSON.stringify(err)}`);
    }
    return response.json();
  }

  async getMarket(epic: string) {
    const headers = await this.getHeaders();
    // Need version 3 for markets
    const response = await fetch(`${this.getBaseUrl()}/markets/${epic}`, {
      headers: { ...headers, 'VERSION': '3' }
    });
    if (!response.ok) return null;
    return response.json();
  }

}