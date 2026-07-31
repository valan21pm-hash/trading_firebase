const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace('                    </tr>\n                  })}', '                    </tr>\n                    );\n                  })}');

fs.writeFileSync('src/App.tsx', content);
