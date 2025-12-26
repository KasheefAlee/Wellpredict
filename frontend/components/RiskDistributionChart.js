import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function RiskDistributionChart({ data }) {
  const levels = ['Low', 'Moderate', 'High', 'Critical'];
  const byLevel = new Map(
    (data || []).map((item) => [
      String(item.risk_level || '').toLowerCase(),
      {
        count: Number(item.count || 0),
        avgScore: Number.parseFloat(item.avg_score || 0),
      },
    ])
  );

  const chartData = levels.map((level) => {
    const v = byLevel.get(level.toLowerCase()) || { count: 0, avgScore: 0 };
    return {
      level,
      count: v.count,
      avgScore: Number.isFinite(v.avgScore) ? Number(v.avgScore.toFixed(1)) : 0,
    };
  });

  const getColor = (level) => {
    const colors = {
      Low: '#4fb08a',
      Moderate: '#e8b86c',
      High: '#e59557',
      Critical: '#e45b6b',
    };
    return colors[level] || '#6b7280';
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="level" />
        <YAxis allowDecimals={false} />
        <Tooltip
          formatter={(value, name, props) => {
            if (name === 'Number of Check-ins') return [value, name];
            return [value, name];
          }}
          labelFormatter={(label) => `Risk: ${label}`}
          contentStyle={{ borderRadius: 12 }}
        />
        <Legend />
        <Bar dataKey="count" name="Number of Check-ins">
          {chartData.map((entry) => (
            <Cell key={entry.level} fill={getColor(entry.level)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

