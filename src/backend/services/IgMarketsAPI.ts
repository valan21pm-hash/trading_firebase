import 'dotenv/config';

const SPREAD_BET_EPICS: Record<string, string[]> = {
  'EURUSD': ['IX.D.EURUSD.IFS.IP', 'IX.D.EURUSD.daily.IP', 'IX.D.EURUSD.CFD.IP'],
  'GBPUSD': ['IX.D.GBPUSD.IFS.IP', 'IX.D.GBPUSD.daily.IP', 'IX.D.GBPUSD.CFD.IP']
};

const CFD_EPICS: Record<string, string[]> = {
  'EURUSD': ['CS.D.EURUSD.CFD.IP', 'CS.D.EURUSD.daily.IP'],
  'GBPUSD': ['CS.D.GBPUSD.CFD.IP', 'CS.D.GBPUSD.daily.IP']
};

export class IgMarketsAPI {
  private static instance: IgMarketsAPI;
  private session: any = null;
  private credentials: any = null;
  private mode: string = 'demo';
  private accountType: string = 'CFD';
  
  private constructor() {}

  static getInstance() {
    if (!IgMarketsAPI.instance) {
      IgMarketsAPI.instance = new IgMarketsAPI();
    }
    return IgMarketsAPI.instance;
  }

  async getActiveAccountType(): Promise<string> {
    try {
      const accounts = await this.getAccounts();
      if (accounts && accounts.length > 0) {
        const preferredAcct = accounts.find((a: any) => a.preferred) || accounts[0];
        if (preferredAcct && preferredAcct.accountType) {
          this.accountType = preferredAcct.accountType.toUpperCase();
          console.log(`[IG API] Active Account Type determined: ${this.accountType}`);
          return this.accountType;
        }
      }
    } catch (e: any) {
      console.warn('[IG API] Could not determine active account type, defaulting to CFD. Error:', e.message || e);
    }
    return this.accountType;
  }

  setCredentials(creds: any, mode: string = 'demo') {
    this.credentials = creds;
    this.mode = mode;
    this.session = null; // Reset session when credentials change
  }

  getBaseUrl() {
    return this.mode === 'live' || this.mode === 'real' ? 'https://api.ig.com/gateway/deal' : 'https://demo-api.ig.com/gateway/deal';
  }

  getApiKey() {
    if (this.credentials) {
      return this.credentials.apiKey || '';
    }
    const mode = (process.env.IG_MODE || 'demo').toLowerCase();
    if (mode === 'live' || mode === 'real') {
      return process.env.IG_API_KEY || '';
    }
    return process.env.IG_DEMO_API_KEY || '';
  }

  async login() {
    const username = this.credentials?.username || process.env.IG_USERNAME;
    const password = this.credentials?.password || process.env.IG_PASSWORD;
    const apiKey = this.getApiKey();

    if (!username || !password || !apiKey) {
      const missing = [];
      if (!username) missing.push('Username');
      if (!password) missing.push('Password');
      if (!apiKey) missing.push('API Key');
      throw new Error(`Credenziali IG Markets mancanti: ${missing.join(', ')}.`);
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
      
      if (errMsg.includes("error.security.api-key-invalid") || response.status === 403) {
        throw new Error(`La chiave API non è valida per l'ambiente ${this.mode.toUpperCase()}.`);
      }
      
      if (errMsg.includes("error.security.invalid-details") || response.status === 401) {
        throw new Error(`Le credenziali inserite (username o password) non sono corrette (401).`);
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
    const response = await fetch(`${this.getBaseUrl()}/accounts`, { 
      headers: { ...headers, 'VERSION': '1' } 
    });
    if (!response.ok) {
      const err = await response.text();
      console.error(`Failed to fetch IG accounts: ${response.status} ${err}`);
      throw new Error('Failed to fetch IG accounts');
    }
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

  getSymbolFromEpic(epic: string): string {
    const clean = epic.toUpperCase();
    if (clean.includes('EURUSD')) return 'EURUSD';
    if (clean.includes('GBPUSD')) return 'GBPUSD';
    const match = clean.match(/([A-Z]{3})([A-Z]{3})/);
    if (match) return match[0];
    return 'EURUSD';
  }

  async searchMarket(searchTerm: string) {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.getBaseUrl()}/markets?searchTerm=${encodeURIComponent(searchTerm)}`, {
        headers: { ...headers, 'VERSION': '1' }
      });
      if (!response.ok) {
        console.error(`[IG API] Search market failed with status ${response.status}`);
        return null;
      }
      const data = await response.json();
      return data.markets || [];
    } catch (e) {
      console.error('[IG API] Error searching market:', e);
      return [];
    }
  }

  async getWorkingEpicForInstrument(instrumentName: string, defaultEpic: string): Promise<string> {
    const cleanSearchTerm = instrumentName.replace('_', ''); // E.g., EURUSD
    console.log(`[IG API] Searching tradeable markets for: ${cleanSearchTerm}`);
    const markets = await this.searchMarket(cleanSearchTerm);
    if (markets && markets.length > 0) {
      // Filter markets that are tradeable or OTC tradeable
      const tradeableMarkets = markets.filter((m: any) => m.marketStatus === 'TRADEABLE' || m.otcTradeable);
      if (tradeableMarkets.length > 0) {
        const cleanSymbol = cleanSearchTerm.toUpperCase();
        const base = cleanSymbol.substring(0, 3);
        const quote = cleanSymbol.substring(3, 6);
        
        // Find best match matching the base and quote pair in instrument name
        const bestMatch = tradeableMarkets.find((m: any) => {
          const name = m.instrumentName.toUpperCase();
          return name.includes(base) && name.includes(quote);
        });

        if (bestMatch) {
          console.log(`[IG API] Resolved tradeable Epic for ${instrumentName}: ${bestMatch.epic} (${bestMatch.instrumentName})`);
          return bestMatch.epic;
        }
        
        console.log(`[IG API] Using first available tradeable Epic: ${tradeableMarkets[0].epic} (${tradeableMarkets[0].instrumentName})`);
        return tradeableMarkets[0].epic;
      }
    }
    console.log(`[IG API] No alternative active epic found via search for ${instrumentName}. Falling back to default: ${defaultEpic}`);
    return defaultEpic;
  }

  async executeOrderRequest(epic: string, direction: 'BUY' | 'SELL', size: number, stopDistance?: number, limitDistance?: number) {
    const headers = await this.getHeaders();
    
    // Dynamically fetch the correct expiry for the epic
    let expiry = '-';
    try {
      const marketInfo = await this.getMarket(epic);
      if (marketInfo && marketInfo.instrument && marketInfo.instrument.expiry) {
        expiry = marketInfo.instrument.expiry;
      } else {
        // Fallbacks if getMarket fails or doesn't have expiry
        if (epic.toLowerCase().includes('daily') || epic.toLowerCase().includes('dfb')) {
          expiry = 'DFB';
        }
      }
    } catch (e) {
      console.warn(`[IG API] Could not fetch market info for expiry resolution of ${epic}. Defaulting to '-' or 'DFB'`);
      if (epic.toLowerCase().includes('daily') || epic.toLowerCase().includes('dfb')) {
        expiry = 'DFB';
      }
    }

    const body: any = {
      epic,
      expiry,
      direction,
      size,
      orderType: 'MARKET',
      guaranteedStop: false,
      forceOpen: true,
      currencyCode: 'EUR'
    };

    if (stopDistance) body.stopDistance = stopDistance;
    if (limitDistance) body.limitDistance = limitDistance;

    const response = await fetch(`${this.getBaseUrl()}/positions/otc`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(JSON.stringify(err));
    }

    return response.json();
  }

  async createOrder(epic: string, direction: 'BUY' | 'SELL', size: number, stopDistance?: number, limitDistance?: number) {
    const actType = await this.getActiveAccountType().catch(() => 'CFD');
    const symbol = this.getSymbolFromEpic(epic); // e.g. EURUSD
    
    let epicsToTry: string[] = [];

    if (actType === 'SPREADBET') {
      const sbEpics = SPREAD_BET_EPICS[symbol] || SPREAD_BET_EPICS[epic] || [];
      epicsToTry = [...sbEpics, epic];
    } else {
      const cfdEpics = CFD_EPICS[symbol] || CFD_EPICS[epic] || [];
      epicsToTry = [...cfdEpics, epic];
    }

    // De-duplicate the array of epics to try
    epicsToTry = Array.from(new Set(epicsToTry));

    console.log(`[IG API] Resolved order execution path for ${symbol} on ${actType} account:`, epicsToTry);

    let lastError: any = null;
    for (const currentEpic of epicsToTry) {
      try {
        console.log(`[IG API] Placing order for ${symbol} using Epic: ${currentEpic}`);
        const result = await this.executeOrderRequest(currentEpic, direction, size, stopDistance, limitDistance);
        console.log(`[IG API] Order placement SUCCESS for Epic: ${currentEpic}`);
        return result;
      } catch (e: any) {
        lastError = e;
        const errMsg = (e.message || '').toLowerCase();
        console.warn(`[IG API] Order placement failed for Epic ${currentEpic}: ${errMsg}`);
        
        // If it's a critical error like "insufficient funds", don't continue to other epics
        const isAccessOrEpicError = errMsg.includes('unauthorised') || 
                                    errMsg.includes('no access') || 
                                    errMsg.includes('access.to.equity') || 
                                    errMsg.includes('exchange') || 
                                    errMsg.includes('invalid epic') || 
                                    errMsg.includes('instrument.invalid') ||
                                    errMsg.includes('epic not found');
                                    
        if (!isAccessOrEpicError) {
          throw e;
        }
      }
    }

    // If we've exhausted all options, let's try a dynamic lookup as a last resort
    console.warn(`[IG API] All pre-mapped epics failed. Attempting dynamic lookup for ${symbol}...`);
    try {
      const resolvedEpic = await this.getWorkingEpicForInstrument(symbol, epic);
      if (resolvedEpic && !epicsToTry.includes(resolvedEpic)) {
        console.log(`[IG API] Dynamic lookup resolved alternative tradeable Epic: ${resolvedEpic}. Trying final placement...`);
        return await this.executeOrderRequest(resolvedEpic, direction, size, stopDistance, limitDistance);
      }
    } catch (e: any) {
      console.error(`[IG API] Dynamic lookup placement failed: ${e.message || e}`);
    }

    throw lastError || new Error(`Failed to place order on any tried epics for ${symbol}`);
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

  async updatePosition(dealId: string, body: { limitLevel?: number; stopLevel?: number; trailingStop?: boolean; trailingStopDistance?: number }) {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.getBaseUrl()}/positions/otc/${dealId}`, {
      method: 'PUT',
      headers: { ...headers, 'VERSION': '2' },
      body: JSON.stringify({
        limitLevel: body.limitLevel || null,
        stopLevel: body.stopLevel || null,
        trailingStop: body.trailingStop ?? false,
        trailingStopDistance: body.trailingStopDistance || null
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Update Position Failed: ${JSON.stringify(err)}`);
    }
    return response.json();
  }

}