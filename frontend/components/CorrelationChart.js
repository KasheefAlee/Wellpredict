import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

export default function CorrelationChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No correlation data available. Upload attendance data to see correlation.
      </div>
    );
  }

  const chartData = data.map((item) => {
    const weekStart = parseISO(item.week_start);

    // New API provides absence_rate directly (percent). Fallback to legacy fields.
    const absenceRate =
      item.absence_rate !== undefined && item.absence_rate !== null
        ? parseFloat(item.absence_rate)
        : item.total_days > 0
        ? (item.absent_days / item.total_days) * 100
        : 0;
    
    return {
      week: format(weekStart, 'MMM dd'),
      absenceRate: Number.isFinite(absenceRate) ? absenceRate : 0,
      burnout: parseFloat(item.avg_burnout || 0),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" />
        <YAxis yAxisId="left" domain={[0, 100]} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line 
          yAxisId="left"
          type="monotone" 
          dataKey="burnout" 
          stroke="#3e9a94" 
          strokeWidth={2}
          name="Burnout Score"
        />
        <Line 
          yAxisId="right"
          type="monotone" 
          dataKey="absenceRate" 
          stroke="#e8b86c" 
          strokeWidth={2}
          name="Absence Rate %"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

