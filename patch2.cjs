const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `            )
          )}
        </div>

        {/* Daily Report Motivation */}`;

const replace = `            )
          )}
            </>
          )}
        </div>

        {/* Daily Report Motivation */}`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
