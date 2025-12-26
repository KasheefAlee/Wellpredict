import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function TeamBurnoutBarChart({ teams }) {
  if (!teams || teams.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No team data available
      </div>
    );
  }

  const data = teams
    .filter((t) => typeof t.burnout_score === 'number')
    .map((t) => ({
      name: t.name,
      score: t.burnout_score,
      risk: t.risk
    }))
    .slice(0, 15); // keep chart readable

  const colorForRisk = (risk) => {
    if (risk === 'Critical') return '#e45b6b';
    if (risk === 'High') return '#e59557';
    if (risk === 'Moderate') return '#e8b86c';
    if (risk === 'Low') return '#4fb08a';
    return '#6b7280';
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          interval={0}
          angle={-20}
          textAnchor="end"
          height={70}
        />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Bar dataKey="score" name="Burnout Score">
          {data.map((entry, idx) => (
            <Cell key={`cell-${idx}`} fill={colorForRisk(entry.risk)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}


