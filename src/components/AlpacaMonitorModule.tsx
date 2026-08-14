import React, { useEffect, useState } from 'react';

interface LivePosition {
  symbol: string;
  currentValue: number;
  unrealizedPL: number;
  quantity: number;
  status: string;
}

export const AlpacaMonitorModule: React.FC = () => {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPositions = async () => {
      try {
        const res = await fetch('/api/alpaca-positions');
        if (res.ok && isMounted) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data) && isMounted) {
              setPositions(data);
            }
          }
        }
      } catch (e) {
        // Silently handle transient network errors
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchPositions();
    const interval = setInterval(fetchPositions, 15000); // Polling ultra-veloce

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) return <div className="text-white p-4">Caricamento posizioni real-time...</div>;

  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg mt-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white tracking-wide">Monitor Posizioni Alpaca (Risk Management)</h2>
        <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded border border-green-500/20">Live Sync</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="text-xs uppercase bg-slate-800/50 text-slate-300">
            <tr>
              <th className="p-3">Asset</th>
              <th className="p-3">Quantità</th>
              <th className="p-3">Valore Posizione</th>
              <th className="p-3">PnL Corrente (€)</th>
              <th className="p-3">Stato Rischio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {positions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-center text-slate-500">Nessuna posizione aperta rilevata su Alpaca.</td>
              </tr>
            ) : (
              positions.map((pos) => {
                return (
                  <tr key={pos.symbol} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white">{pos.symbol}</td>
                    <td className="p-3">{pos.quantity ?? 0}</td>
                    <td className="p-3">{(pos.currentValue ?? 0).toFixed(2)}€</td>
                    <td className={`p-3 font-mono font-bold ${(pos.unrealizedPL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(pos.unrealizedPL ?? 0) >= 0 ? `+${(pos.unrealizedPL ?? 0).toFixed(2)}` : (pos.unrealizedPL ?? 0).toFixed(2)}€
                    </td>
                    <td className="p-3">
                      <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">In Osservazione</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
