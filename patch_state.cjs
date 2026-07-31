const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/const \[isOperationsCollapsed, setIsOperationsCollapsed\] = useState\(true\);/, 'const [isOperationsCollapsed, setIsOperationsCollapsed] = useState(false);');
content = content.replace(/const \[isAlpacaFillsCollapsed, setIsAlpacaFillsCollapsed\] = useState\(true\);/, 'const [isAlpacaFillsCollapsed, setIsAlpacaFillsCollapsed] = useState(false);');
content = content.replace(/const \[isMomentumCollapsed, setIsMomentumCollapsed\] = useState\(true\);/, 'const [isMomentumCollapsed, setIsMomentumCollapsed] = useState(false);');
content = content.replace(/const \[isClosedOperationsCollapsed, setIsClosedOperationsCollapsed\] = useState\(true\);/, 'const [isClosedOperationsCollapsed, setIsClosedOperationsCollapsed] = useState(false);');
content = content.replace(/const \[isDailyDebriefCollapsed, setIsDailyDebriefCollapsed\] = useState\(true\);/, 'const [isDailyDebriefCollapsed, setIsDailyDebriefCollapsed] = useState(false);');
content = content.replace(/const \[isPeriodicDebriefCollapsed, setIsPeriodicDebriefCollapsed\] = useState\(true\);/, 'const [isPeriodicDebriefCollapsed, setIsPeriodicDebriefCollapsed] = useState(false);');
content = content.replace(/const \[isMotivationCollapsed, setIsMotivationCollapsed\] = useState\(true\);/, 'const [isMotivationCollapsed, setIsMotivationCollapsed] = useState(false);');
content = content.replace(/const \[isFeedbackCollapsed, setIsFeedbackCollapsed\] = useState\(true\);/, 'const [isFeedbackCollapsed, setIsFeedbackCollapsed] = useState(false);');

fs.writeFileSync('src/App.tsx', content);
