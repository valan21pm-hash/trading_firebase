const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          </div>

          {/* Selezione Rapida Periodo */}`;

const replace = `          </div>

          {!isPeriodicDebriefCollapsed && (
            <>
          {/* Selezione Rapida Periodo */}`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
