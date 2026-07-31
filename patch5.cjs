const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `        {/* Feedback Form */}
        <div className="bg-gray-50 p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
           <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <MessageSquare className="w-5 h-5 text-gray-500" />
               Loop di Correzione (Invia Regole al Bot)
             </div>
           </h2>
           <form`;

const replace = `        {/* Feedback Form */}
        <div className="bg-gray-50 p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
           <div 
             className="cursor-pointer select-none hover:opacity-85 transition-opacity mb-3" 
             onClick={() => setIsFeedbackCollapsed(!isFeedbackCollapsed)}
           >
             <h2 className="text-lg font-medium text-gray-900 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <MessageSquare className="w-5 h-5 text-gray-500" />
                 <span>Loop di Correzione (Invia Regole al Bot)</span>
               </div>
               {isFeedbackCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-600" />}
             </h2>
           </div>
           
           {!isFeedbackCollapsed && (
             <>
           <form`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
