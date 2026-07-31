const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Ensure that every time we load state, we don't accidentally overwrite the UI, but it's fine.
