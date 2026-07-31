const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `        {/* Daily Report Motivation */}
        {status?.latestDailyReport && (
          <div className="bg-purple-50 p-6 rounded-2xl shadow-sm border border-purple-100 mt-6 mb-6">
            <h2 className="text-lg font-medium text-purple-900 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Report Motivazionale di Fine Giornata
            </h2>
            <div className="bg-white p-4 rounded-lg border border-purple-200 whitespace-pre-wrap font-sans text-sm text-purple-800 shadow-inner">
              {status.latestDailyReport}
            </div>
          </div>
        )}`;

const replace = `        {/* Daily Report Motivation */}
        {status?.latestDailyReport && (
          <div className="bg-purple-50 p-6 rounded-2xl shadow-sm border border-purple-100 mt-6 mb-6">
            <div
              className="cursor-pointer select-none hover:opacity-85 transition-opacity"
              onClick={() => setIsMotivationCollapsed(!isMotivationCollapsed)}
            >
              <h2 className="text-lg font-medium text-purple-900 mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <span className="flex-1">Report Motivazionale di Fine Giornata</span>
                {isMotivationCollapsed ? <ChevronDown className="w-4 h-4 text-purple-400" /> : <ChevronUp className="w-4 h-4 text-purple-600" />}
              </h2>
            </div>
            {!isMotivationCollapsed && (
              <div className="bg-white p-4 rounded-lg border border-purple-200 whitespace-pre-wrap font-sans text-sm text-purple-800 shadow-inner">
                {status.latestDailyReport}
              </div>
            )}
          </div>
        )}`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
