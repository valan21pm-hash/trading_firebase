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

  private constructor() {}

  public static getInstance(): LLMProviderService {
    if (!LLMProviderService.instance) {
      LLMProviderService.instance = new LLMProviderService();
    }
    return LLMProviderService.instance;
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
    const body: any = {
      model: config.model || 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
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
    const body: any = {
      model: config.model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
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
    const body: any = {
      model: config.model || 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: finalPrompt }],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    return data?.content?.[0]?.text || '';
  }
}
