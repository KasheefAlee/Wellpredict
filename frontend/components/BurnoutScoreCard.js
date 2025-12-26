export default function BurnoutScoreCard({ overview }) {
  const score = parseFloat(overview.overview.average_burnout);
  
  const getRiskLevel = (score) => {
    if (score <= 30) return { level: 'Low', color: 'green' };
    if (score <= 60) return { level: 'Moderate', color: 'yellow' };
    if (score <= 80) return { level: 'High', color: 'orange' };
    return { level: 'Critical', color: 'red' };
  };

  const risk = getRiskLevel(score);
  const colorClasses = {
    green: 'bg-accent-100 text-accent-800 border-accent-300',
    yellow: 'bg-amber-100 text-amber-800 border-amber-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    red: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  return (
    <div className="card bg-primary-50/60">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-primary-700 mb-2">Team Average Burnout Score</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-primary-900">{score.toFixed(1)}</span>
            <span className="text-2xl text-primary-400">/ 100</span>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`inline-block px-4 py-2 rounded-lg border-2 ${colorClasses[risk.color]}`}>
            <span className="font-semibold">{risk.level} Risk</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-primary-600">Total Check-ins</p>
          <p className="text-2xl font-bold text-primary-900">{overview.overview.total_checkins}</p>
        </div>
        <div>
          <p className="text-sm text-primary-600">Active Days</p>
          <p className="text-2xl font-bold text-primary-900">{overview.overview.active_days}</p>
        </div>
        <div>
          <p className="text-sm text-primary-600">Team</p>
          <p className="text-lg font-semibold text-primary-900">{overview.team.team_name}</p>
        </div>
      </div>
    </div>
  );
}

