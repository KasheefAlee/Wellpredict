import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TrendChart({ data, period }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No trend data available
      </div>
    );
  }

  const chartData = data.map((item) => ({
    label: period === 'week' 
      ? `Week ${item.week_number}` 
      : `${item.year}-${String(item.month_number).padStart(2, '0')}`,
    score: parseFloat(item.avg_burnout || 0).toFixed(1),
    checkins: item.checkin_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="score" 
          stroke="#3e9a94" 
          strokeWidth={2}
          name="Burnout Score"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

