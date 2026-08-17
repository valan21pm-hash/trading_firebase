import { GoogleGenAI } from "@google/genai";

export type LLMProvider = 'gemini' | 'mistral' | 'deepseek' | 'groq' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
}

export interface LLMResponse {
  provider: LLMProvider;
  modelUsed: string;
  text: string;
  success: boolean;
  error?: string;
}

export interface LLMOptions {
  responseJson?: boolean;
  preferredProvider?: LLMProvider;
}

export class LLMProviderService {
  private static instance: LLMProviderService;
  
  // Default configurations using env variables as fallbacks
  private providerConfigs: Record<LLMProvider, LLMConfig> = {
    gemini: {
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-2.5-flash'
    },
    mistral: {
      provider: 'mistral',
      apiKey: process.env.MISTRAL_API_KEY || '',
      model: 'mistral-small-latest'
    },
    deepseek: {
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat'
    },
    groq: {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY || '',
      model: 'llama-3.1-8b-instant'
    },
    anthropic: {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-5-haiku-20241022'
    }
  };

  private activeProviderOrder: LLMProvider[] = ['gemini', 'mistral', 'groq', 'deepseek', 'anthropic'];
  private failoverEnabled: boolean = true;
  private customSystemPrompt: string = JSON.stringify({
    system_role: "Quantitative Trading Engine & Senior Financial Analyst (Alpaca API)",
    objective: "Capital preservation first, systematic risk management (1-2% max risk per trade), trend following, strict adherence to mathematical position-closing rules.",
    core_rules: {
      risk_management: "Max risk 1-2% per trade, mandatory stop-loss, risk-reward ratio >= 1:2 or 1:3.",
      anti_martingale: "Never average down on losing positions. Pyramid only in profit. Default to HOLD on conflicting macro/statistical signals.",
      rule_y1_execution: "Strictly evaluate position closure based on target thresholds: close at historical profits equal to 2 (up to a max of 3 units in account currency), or maintain position if conditions are unmet. Minimum stop-loss / break-even loss threshold set to 0.50 units for positions >= 2 units."
    },
    execution_directives: {
      input_parsing: "Analyze real-time market data, technical indicators (momentum, volatility, trend), macro indicators (CPI, UNRATE, Fed Funds Rate), and RSS news sentiment.",
      output_format: "Strict JSON object. No conversational filler, no markdown blocks if not required for raw parsing."
    }
  }, null, 2);

  private constructor() {}

  public static getInstance(): LLMProviderService {
    if (!LLMProviderService.instance) {
      LLMProviderService.instance = new LLMProviderService();
    }
    return LLMProviderService.instance;
  }

  /**
   * Imposta il System Prompt personalizzato o le istruzioni del Gem specializzato.
   */
  public setCustomSystemPrompt(prompt: string) {
    this.customSystemPrompt = prompt || '';
  }

  /**
   * Restituisce il System Prompt personalizzato attivo.
   */
  public getCustomSystemPrompt(): string {
    return this.customSystemPrompt || '';
  }

  /**
   * Aggiorna le chiavi API e i modelli attivi da database o preferenze utente.
   */
  public updateConfig(provider: LLMProvider, config: Partial<LLMConfig>) {
    if (this.providerConfigs[provider]) {
      this.providerConfigs[provider] = {
        ...this.providerConfigs[provider],
        ...config
      };
    }
  }

  /**
   * Restituisce la configurazione attuale di tutti i provider.
   */
  public getConfigs(): Record<LLMProvider, LLMConfig> {
    return { ...this.providerConfigs };
  }

  /**
   * Permette di impostare l'ordine dei provider preferiti per il failover.
   */
  public setProviderOrder(order: LLMProvider[]) {
    this.activeProviderOrder = order.filter(p => ['gemini', 'mistral', 'deepseek', 'groq', 'anthropic'].includes(p));
  }

  public getProviderOrder(): LLMProvider[] {
    return this.activeProviderOrder;
  }

  public setFailoverEnabled(enabled: boolean) {
    this.failoverEnabled = enabled;
  }

  public isFailoverEnabled(): boolean {
    return this.failoverEnabled;
  }

  public getAvailableProviders(): LLMProvider[] {
    const available: LLMProvider[] = [];
    for (const provider of ['gemini', 'anthropic', 'deepseek', 'groq', 'mistral'] as const) {
      const config = this.providerConfigs[provider];
      if (provider === 'gemini') {
        if (config.apiKey || process.env.GEMINI_API_KEY) available.push('gemini');
      } else if (config.apiKey && config.apiKey.trim() !== '') {
        available.push(provider);
      }
    }
    return available;
  }

  public async querySingleProvider(provider: LLMProvider, prompt: string, options: LLMOptions = {}): Promise<string> {
    const config = this.providerConfigs[provider];
    if (provider !== 'gemini' && (!config.apiKey || config.apiKey.trim() === '')) {
      throw new Error(`API key per ${provider} non configurata.`);
    }

    switch (provider) {
      case 'gemini':
        return await this.queryGemini(prompt, config, options);
      case 'mistral':
        return await this.queryMistral(prompt, config, options);
      case 'deepseek':
        return await this.queryDeepSeek(prompt, config, options);
      case 'groq':
        return await this.queryGroq(prompt, config, options);
      case 'anthropic':
        return await this.queryAnthropic(prompt, config, options);
      default:
        throw new Error(`Provider non supportato: ${provider}`);
    }
  }

  /**
   * Esegue un debriefing di consenso interrogando simultaneamente le IA disponibili
   * (Gemini, Claude, DeepSeek, Groq, Mistral) a mercati chiusi, per poi sintetizzare
   * le migliori 3 correzioni strategiche.
   */
  public async generateEnsembleDebrief(
    sessionDataPrompt: string,
    targetDate: string,
    targetMode: string
  ): Promise<{
    analysis: string;
    suggestedRule: string;
    top3Corrections: string[];
    participatingProviders: string[];
  }> {
    const available = this.getAvailableProviders();
    console.log(`[Multi-LLM Ensemble] Avvio debriefing corale con i provider disponibili: ${available.join(', ')}`);

    const individualPrompt = `${sessionDataPrompt}

[ISTRUZIONI PER L'ANALISI INDIVIDUALE]
Fornisci la tua analisi critica indipendente e approfondita:
1. Identifica le 3 cause primarie di perdite o inefficienze registrate nella seduta.
2. Identifica eventuali pattern orari e correlazioni di mercato sfavorevoli.
3. Proponi la tua migliore Regola Correttiva formulata chiaramente per il trading engine.`;

    // 1. Interroga contemporaneamente tutti i provider disponibili
    const queryPromises = available.map(async (provider) => {
      try {
        const text = await this.querySingleProvider(provider, individualPrompt, { responseJson: false });
        return {
          provider,
          model: this.providerConfigs[provider].model || 'default',
          success: true,
          text: text.trim()
        };
      } catch (err: any) {
        console.warn(`[Multi-LLM Ensemble] Provider ${provider} ha fallito la chiamata parallela:`, err.message || err);
        return {
          provider,
          model: this.providerConfigs[provider].model || 'default',
          success: false,
          text: '',
          error: err.message || String(err)
        };
      }
    });

    const results = await Promise.all(queryPromises);
    const successfulResults = results.filter(r => r.success && r.text.length > 50);

    // Se nessun provider secondario o solo uno ha risposto, eseguiamo fallback sul generatore standard
    if (successfulResults.length === 0) {
      console.warn(`[Multi-LLM Ensemble] Nessun provider ha risposto con successo. Esecuzione fallback standard.`);
      const singleRes = await this.generateContent(sessionDataPrompt, { responseJson: true });
      if (!singleRes.success || !singleRes.text) {
        throw new Error(singleRes.error || "Errore nella generazione del debriefing.");
      }
      const parsed = JSON.parse(singleRes.text.replace(/```json|```/g, '').trim());
      return {
        analysis: parsed.analysis || singleRes.text,
        suggestedRule: parsed.suggestedRule || '',
        top3Corrections: [],
        participatingProviders: [singleRes.provider]
      };
    }

    // Se solo 1 ha risposto, usiamo direttamente la sua risposta
    if (successfulResults.length === 1) {
      const sole = successfulResults[0];
      console.log(`[Multi-LLM Ensemble] Solo 1 provider (${sole.provider}) disponibile. Sintetizzo direttamente.`);
    }

    // 2. Prepariamo la sintesi di consenso tra le varie IA
    const ensembleContext = successfulResults.map((r, i) => {
      const providerLabel = r.provider.toUpperCase();
      return `### 🧠 PARERE DELL'ANALISTA IA #${i + 1} (${providerLabel} - Modello: ${r.model}):\n${r.text}\n`;
    }).join('\n---\n\n');

    const synthesisPrompt = `Sei il Lead Quantitative Portfolio Manager e Chief Risk Officer.
Hai appena convocato una tavola rotonda strategica a mercati chiusi per la seduta del ${targetDate} (Conto ${targetMode.toUpperCase()}).
I tuoi analisti IA indipendenti (${successfulResults.map(r => r.provider.toUpperCase()).join(', ')}) hanno fornito i seguenti referti:

${ensembleContext}

DATI ORIGINALI DELLA SEDUTA:
${sessionDataPrompt}

[COMPITO DI SINTESI DI CONSENSO]:
Elabora un Debriefing Giornaliero di altissimo livello qualitativo in lingua italiana, strutturato come segue:

1. **🏛️ Tavola Rotonda Multi-IA (${successfulResults.map(r => r.provider.toUpperCase()).join(' + ')} Consensus)**:
   - Sintesi delle prospettive uniche e dei punti di accordo emersi dal confronto tra i diversi modelli di intelligenza artificiale.
2. **⚠️ Analisi Diagnostica degli Errori & Inefficienze della Seduta (${targetDate})**:
   - Cause radice delle perdite o del mancato alpha (esecuzioni nei momenti di rumore, timing, gestione drawdown).
3. **⏰ Analisi Statistica ed Inferenziale delle Fasce Orarie**:
   - Valutazione delle finestre orarie più redditizie vs quelle da filtrare con confidenza statistica.
4. **🎯 Le 3 Migliori Correzioni Strategiche di Consenso (Top 3 Consensual Fixes)**:
   - **Correzione #1 (Priorità Massima)**: Spiegazione e formula della regola.
   - **Correzione #2 (Priorità Media)**: Spiegazione e formula della regola.
   - **Correzione #3 (Priorità Operativa)**: Spiegazione e formula della regola.
5. **🤖 PROMPT PER GOOGLE AI STUDIO (COPIA & INCOLLA)**:
   Includi alla fine la sezione standard formattata con il blocco di codice per integrare direttamente la regola #1 migliore.

Restituisci la risposta ESCLUSIVAMENTE nel seguente formato JSON valido:
{
  "analysis": "Testo Markdown completo e professionale del Debriefing di Consenso Multi-IA...",
  "suggestedRule": "La regola #1 prioritaria formulata in modo chiaro e pronta da applicare",
  "top3Corrections": [
    "1. [Regola #1]: Descrizione breve...",
    "2. [Regola #2]: Descrizione breve...",
    "3. [Regola #3]: Descrizione breve..."
  ]
}`;

    // Per la sintesi usiamo il provider preferito o Gemini
    const primaryProvider = this.providerConfigs.gemini.apiKey || process.env.GEMINI_API_KEY ? 'gemini' : successfulResults[0].provider;
    const synthRes = await this.generateContent(synthesisPrompt, {
      responseJson: true,
      preferredProvider: primaryProvider
    });

    if (synthRes.success && synthRes.text) {
      try {
        const cleaned = synthRes.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          analysis: parsed.analysis || synthRes.text,
          suggestedRule: parsed.suggestedRule || '',
          top3Corrections: parsed.top3Corrections || [],
          participatingProviders: successfulResults.map(r => `${r.provider} (${r.model})`)
        };
      } catch (e) {
        console.warn('[Multi-LLM Ensemble] Errore nel parse JSON della sintesi:', e);
      }
    }

    // Fallback se il JSON di sintesi fallisce
    return {
      analysis: synthRes.text || 'Debriefing multi-modello completato con successo.',
      suggestedRule: 'Ottimizza la gestione del rischio integrando i filtri di consenso multi-IA.',
      top3Corrections: [],
      participatingProviders: successfulResults.map(r => `${r.provider} (${r.model})`)
    };
  }

  /**
   * Esegue la generazione di contenuto provando il provider primario.
   * Se fallisce e il failover è attivo, prova gli altri in cascata.
   */
  public async generateContent(prompt: string, options: LLMOptions = {}): Promise<LLMResponse> {
    const preferredProvider = options.preferredProvider;
    const orderToTry = [...this.activeProviderOrder];
    
    if (preferredProvider && orderToTry.includes(preferredProvider)) {
      // Sposta il provider preferito in testa alla lista
      const index = orderToTry.indexOf(preferredProvider);
      orderToTry.splice(index, 1);
      orderToTry.unshift(preferredProvider);
    }

    const errors: string[] = [];

    for (const provider of orderToTry) {
      const config = this.providerConfigs[provider];
      
      // Salta il provider se manca la API key (a meno che non sia Gemini, che può usare la default caricata nel server)
      if (provider !== 'gemini' && (!config.apiKey || config.apiKey.trim() === '')) {
        continue;
      }

      console.log(`[Multi-LLM] Tentativo generazione con provider: ${provider} (modello: ${config.model})`);

      try {
        let text = '';
        switch (provider) {
          case 'gemini':
            text = await this.queryGemini(prompt, config, options);
            break;
          case 'mistral':
            text = await this.queryMistral(prompt, config, options);
            break;
          case 'deepseek':
            text = await this.queryDeepSeek(prompt, config, options);
            break;
          case 'groq':
            text = await this.queryGroq(prompt, config, options);
            break;
          case 'anthropic':
            text = await this.queryAnthropic(prompt, config, options);
            break;
        }

        if (text && text.trim() !== '') {
          // Se l'utente ha richiesto JSON, verifichiamo che la risposta sia un JSON valido
          if (options.responseJson) {
            try {
              const cleaned = text.replace(/```json|```/g, '').trim();
              JSON.parse(cleaned);
            } catch (jsonErr) {
              throw new Error('La risposta generata non è in formato JSON valido');
            }
          }

          console.log(`[Multi-LLM] Risposta generata con successo usando ${provider}.`);
          return {
            provider,
            modelUsed: config.model || 'default',
            text,
            success: true
          };
        } else {
          throw new Error('Risposta vuota o non valida');
        }

      } catch (err: any) {
        const errMsg = err.message || String(err);
        console.warn(`[Multi-LLM Warning] Fallito tentativo con ${provider}: ${errMsg}`);
        errors.push(`${provider}: ${errMsg}`);

        if (!this.failoverEnabled && preferredProvider === provider) {
          // Se il failover è disabilitato e abbiamo fallito col prescelto, esce subito
          break;
        }
      }
    }

    return {
      provider: preferredProvider || 'gemini',
      modelUsed: this.providerConfigs[preferredProvider || 'gemini']?.model || 'default',
      text: '',
      success: false,
      error: `Tutti i provider LLM configurati hanno fallito. Dettagli errori: ${errors.join(' | ')}`
    };
  }

  // --- QUERY IMPLEMENTATIONS USING LIGHTWEIGHT METHODS ---

  private async queryGemini(prompt: string, config: LLMConfig, options: LLMOptions): Promise<string> {
    const key = config.apiKey || process.env.GEMINI_API_KEY || '';
    if (!key) {
      throw new Error('Chiave API Gemini mancante');
    }
    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const configuredModel = config.model && config.model.trim() !== '' ? config.model : 'gemini-2.5-flash';
    const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    const candidateModels = Array.from(new Set([configuredModel, ...fallbackModels]));

    const requestConfig: any = {};
    if (options.responseJson) {
      requestConfig.responseMimeType = 'application/json';
    }
    if (this.customSystemPrompt && this.customSystemPrompt.trim() !== '') {
      requestConfig.systemInstruction = this.customSystemPrompt.trim();
    }

    let lastError: any = null;

    for (const modelToUse of candidateModels) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelToUse,
            contents: prompt,
            config: requestConfig
          });

          if (response.text && response.text.trim() !== '') {
            return response.text;
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          const isTransient = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('500');

          if (isTransient && attempt < 3) {
            console.warn(`[Gemini Retry] Modello ${modelToUse} in forte domanda (tentativo ${attempt}/3). Attesa ${attempt * 1000}ms...`);
            await new Promise(r => setTimeout(r, attempt * 1000));
            continue;
          }

          if (isTransient) {
            console.warn(`[Gemini Fallback] Modello ${modelToUse} temporaneamente non disponibile. Passaggio al modello successivo...`);
            break;
          }

          throw err;
        }
      }
    }

    throw lastError || new Error('Tutti i tentativi con i modelli Gemini hanno fallito.');
  }

  private async queryMistral(prompt: string, config: LLMConfig, options: LLMOptions): Promise<string> {
    const messages: any[] = [];
    if (this.customSystemPrompt && this.customSystemPrompt.trim() !== '') {
      messages.push({ role: 'system', content: this.customSystemPrompt.trim() });
    }
    messages.push({ role: 'user', content: prompt });

    const body: any = {
      model: config.model || 'mistral-small-latest',
      messages,
      temperature: 0.1
    };

    if (options.responseJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  private async queryDeepSeek(prompt: string, config: LLMConfig, options: LLMOptions): Promise<string> {
    const messages: any[] = [];
    if (this.customSystemPrompt && this.customSystemPrompt.trim() !== '') {
      messages.push({ role: 'system', content: this.customSystemPrompt.trim() });
    }
    messages.push({ role: 'user', content: prompt });

    const body: any = {
      model: config.model || 'deepseek-chat',
      messages,
      temperature: 0.1
    };

    if (options.responseJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  private async queryGroq(prompt: string, config: LLMConfig, options: LLMOptions): Promise<string> {
    const messages: any[] = [];
    if (this.customSystemPrompt && this.customSystemPrompt.trim() !== '') {
      messages.push({ role: 'system', content: this.customSystemPrompt.trim() });
    }
    messages.push({ role: 'user', content: prompt });

    const body: any = {
      model: config.model || 'llama-3.1-8b-instant',
      messages,
      temperature: 0.1
    };

    if (options.responseJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  private async queryAnthropic(prompt: string, config: LLMConfig, options: LLMOptions): Promise<string> {
    const finalPrompt = options.responseJson 
      ? `${prompt}\n\nIMPORTANT: Respond ONLY with a valid JSON block. Do not include any explanations.`
      : prompt;

    const requestBody: any = {
      model: config.model || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.1
    };

    if (this.customSystemPrompt && this.customSystemPrompt.trim() !== '') {
      requestBody.system = this.customSystemPrompt.trim();
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    return data?.content?.[0]?.text || '';
  }
}
