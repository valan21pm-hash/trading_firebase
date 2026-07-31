const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                 ))}
               </ul>
             </div>
        </div>

        {/* Panic Button Confirmation Modal */}`;

const replace = `                 ))}
               </ul>
             </div>
             </>
           )}
        </div>

        {/* Panic Button Confirmation Modal */}`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
