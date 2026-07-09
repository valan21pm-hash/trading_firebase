const fs = require('fs');
let code = fs.readFileSync('src/components/TradingModule.tsx', 'utf8');

// Replace state
code = code.replace(/const \[activeBroker, setActiveBroker\] = useState<'xtb' \| 'ig'>\('ig'\);/, "const activeBroker = 'xtb';");
code = code.replace(/const currentAutoStatus = activeBroker === 'xtb' \? xtbAutoStatus : igAutoStatus;/, "const currentAutoStatus = xtbAutoStatus;");
code = code.replace(/const currentPositions = activeBroker === 'xtb' \? xtbPositions : igPositions;/, "const currentPositions = xtbPositions;");

// Remove igAutoStatus and igPositions state
code = code.replace(/\/\/ Auto-Trading states \(IG\)[\s\S]*?const \[igPositions, setIgPositions\] = useState<any\[\]>\(\[\]\);/, "");

// Replace activeBroker ternary expressions
// We can use a regex to match `activeBroker === 'xtb' ? A : B`
// Since A and B might contain strings or numbers, we can carefully do a global replace
// Actually, it's safer to just replace 'activeBroker === "xtb" ? A : B' with A.
code = code.replace(/activeBroker === 'xtb' \? '([^']+)' : '([^']+)'/g, "'$1'");
code = code.replace(/activeBroker === 'xtb' \? ([^ ]+) : ([^ }]+)/g, "$1");
code = code.replace(/broker === 'xtb' \? '([^']+)' : '([^']+)'/g, "'$1'");

// Fix fetch functions
code = code.replace(/const fetchAutoStatus = async \(broker = activeBroker\) => \{[\s\S]*?const url = broker === 'xtb' \? '\/api\/trading\/xtb-status' : '\/api\/trading\/ig-status';[\s\S]*?const res = await fetch\(url\);[\s\S]*?if \(res.ok\) \{[\s\S]*?const contentType = res.headers.get\('content-type'\);[\s\S]*?if \(contentType && contentType.includes\('application\/json'\)\) \{[\s\S]*?const data = await res.json\(\);[\s\S]*?if \(broker === 'xtb'\) \{[\s\S]*?setXtbAutoStatus\(data.status\);[\s\S]*?setXtbPositions\(data.positions \|\| \[\]\);[\s\S]*?\} else \{[\s\S]*?setIgAutoStatus\(data.status\);[\s\S]*?setIgPositions\(data.positions \|\| \[\]\);[\s\S]*?\}[\s\S]*?\} else \{[\s\S]*?console.warn\(`Expected JSON response from \$\{url\}, received alternative content type.`\);[\s\S]*?\}[\s\S]*?\}[\s\S]*?\} catch \(err\) \{[\s\S]*?console.error\(`Errore caricamento stato automatico \$\{broker.toUpperCase\(\)\}:`, err\);[\s\S]*?\} finally \{[\s\S]*?setLoadingAutoStatus\(false\);[\s\S]*?\}[\s\S]*?\};/, `const fetchAutoStatus = async () => {
    setLoadingAutoStatus(true);
    try {
      const res = await fetch('/api/trading/xtb-status');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setXtbAutoStatus(data.status);
          setXtbPositions(data.positions || []);
        } else {
          console.warn('Expected JSON response from /api/trading/xtb-status, received alternative content type.');
        }
      }
    } catch (err) {
      console.error('Errore caricamento stato automatico XTB:', err);
    } finally {
      setLoadingAutoStatus(false);
    }
  };`);

code = code.replace(/const handleToggleAutoTrading = async \(\) => \{[\s\S]*?const url = activeBroker === 'xtb' \? '\/api\/trading\/xtb-status' : '\/api\/trading\/ig-status';[\s\S]*?const res = await fetch\(url, \{[\s\S]*?method: 'POST',[\s\S]*?headers: \{ 'Content-Type': 'application\/json' \},[\s\S]*?body: JSON.stringify\(\{ active: !currentAutoStatus.active \}\)[\s\S]*?\}\);[\s\S]*?if \(res.ok\) \{[\s\S]*?const data = await res.json\(\);[\s\S]*?if \(activeBroker === 'xtb'\) \{[\s\S]*?setXtbAutoStatus\(prev => prev \? \{ ...prev, active: data.active \} : null\);[\s\S]*?\} else \{[\s\S]*?setIgAutoStatus\(prev => prev \? \{ ...prev, active: data.active \} : null\);[\s\S]*?\}[\s\S]*?setSuccessMessage\(`Trading automatico \$\{activeBroker.toUpperCase\(\)\} \$\{data.active \? 'attivato' : 'disattivato'\} con successo!`\);[\s\S]*?fetchAutoStatus\(\);[\s\S]*?\}[\s\S]*?\} catch \(err: any\) \{[\s\S]*?setErrorMessage\(err.message \|\| 'Errore durante la modifica dello stato dell\\'auto-trading.'\);[\s\S]*?\} finally \{[\s\S]*?setSubmittingAutoToggle\(false\);[\s\S]*?\}[\s\S]*?\};/, `const handleToggleAutoTrading = async () => {
    if (!currentAutoStatus) return;
    setSubmittingAutoToggle(true);
    try {
      const res = await fetch('/api/trading/xtb-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentAutoStatus.active })
      });
      if (res.ok) {
        const data = await res.json();
        setXtbAutoStatus(prev => prev ? { ...prev, active: data.active } : null);
        setSuccessMessage(\`Trading automatico XTB \${data.active ? 'attivato' : 'disattivato'} con successo!\`);
        fetchAutoStatus();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante la modifica dello stato dell\\'auto-trading.');
    } finally {
      setSubmittingAutoToggle(false);
    }
  };`);

code = code.replace(/const handleTriggerAutoTrading = async \(\) => \{[\s\S]*?const url = activeBroker === 'xtb' \? '\/api\/trading\/xtb-trigger' : '\/api\/trading\/ig-trigger';[\s\S]*?const res = await fetch\(url, \{[\s\S]*?method: 'POST'[\s\S]*?\}\);[\s\S]*?const data = await res.json\(\);[\s\S]*?if \(!res.ok\) \{[\s\S]*?throw new Error\(data.error \|\| 'Errore sconosciuto'\);[\s\S]*?\}[\s\S]*?setSuccessMessage\(`Ciclo IA eseguito con successo! (\$\{data.message\})`\);[\s\S]*?fetchAutoStatus\(\);[\s\S]*?\} catch \(err: any\) \{[\s\S]*?setErrorMessage\(err.message \|\| 'Errore durante l\\'esecuzione del ciclo IA.'\);[\s\S]*?\} finally \{[\s\S]*?setTriggeringCycle\(false\);[\s\S]*?\}[\s\S]*?\};/, `const handleTriggerAutoTrading = async () => {
    setTriggeringCycle(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/trading/xtb-trigger', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore sconosciuto');
      }
      setSuccessMessage(\`Ciclo IA eseguito con successo! (\${data.message})\`);
      fetchAutoStatus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante l\\'esecuzione del ciclo IA.');
    } finally {
      setTriggeringCycle(false);
    }
  };`);

fs.writeFileSync('src/components/TradingModule.tsx.new', code);
