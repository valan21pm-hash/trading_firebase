import React, { useEffect, useState } from 'react';
import { Globe, ExternalLink, RefreshCw, Newspaper, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export interface RssNewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  snippet: string;
  sentimentScore?: number;
}

export function RssNewsWidget() {
  const [news, setNews] = useState<RssNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string>('');

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rss-news');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNews(data);
          setLastFetched(new Date().toLocaleTimeString());
        }
      }
    } catch (e) {
      console.error('Errore nel recupero notizie RSS:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // Polling ogni minuto
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Notizie Finanziarie RSS (Fonti Autorevoli)</h2>
            <p className="text-xs text-slate-400">
              Yahoo Finance, MarketWatch, CNBC e Investing.com in tempo reale per alimentare il sentiment dell'IA.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Aggiornato: {lastFetched}</span>}
          <button
            onClick={fetchNews}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {loading && news.length === 0 ? (
        <div className="p-8 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
          <p className="text-xs">Download ed elaborazione feed RSS dalle principali agenzie finanziarie...</p>
        </div>
      ) : news.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-xs">
          Nessuna notizia RSS trovata al momento. Clicca su "Aggiorna" per riprovare.
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
          {news.map((item) => {
            const score = item.sentimentScore ?? 0;
            const isPositive = score > 0.05;
            const isNegative = score < -0.05;

            return (
              <div
                key={item.id || item.link}
                className="bg-[#090D16] border border-slate-800/90 hover:border-indigo-500/40 p-4 rounded-xl transition space-y-2 group"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {item.source}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isPositive && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" /> +{score.toFixed(2)}
                      </span>
                    )}
                    {isNegative && (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <TrendingDown className="w-3 h-3" /> {score.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-white group-hover:text-indigo-300 transition flex items-start justify-between gap-2"
                >
                  <span>{item.title}</span>
                  <ExternalLink className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition text-indigo-400" />
                </a>

                {item.snippet && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                    {item.snippet}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
