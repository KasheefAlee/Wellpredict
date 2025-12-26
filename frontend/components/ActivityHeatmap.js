import { format, parseISO } from 'date-fns';

export default function ActivityHeatmap({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No activity data available
      </div>
    );
  }

  const getIntensity = (count) => {
    if (count === 0) return 'bg-primary-50';
    if (count <= 2) return 'bg-accent-200';
    if (count <= 5) return 'bg-amber-200';
    if (count <= 10) return 'bg-orange-300';
    return 'bg-rose-400';
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {data.slice(0, 30).map((item, index) => {
          const date = parseISO(item.date);
          const count = item.checkin_count || 0;
          
          return (
            <div
              key={index}
              className="flex flex-col items-center"
              title={`${format(date, 'MMM dd')}: ${count} check-ins`}
            >
              <div
                className={`w-8 h-8 rounded ${getIntensity(count)} border border-gray-300`}
              />
              <span className="text-xs text-gray-600 mt-1">
                {format(date, 'MMM dd')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-primary-50 border border-gray-300 rounded"></div>
          <div className="w-4 h-4 bg-accent-200 border border-gray-300 rounded"></div>
          <div className="w-4 h-4 bg-amber-200 border border-gray-300 rounded"></div>
          <div className="w-4 h-4 bg-orange-300 border border-gray-300 rounded"></div>
          <div className="w-4 h-4 bg-rose-400 border border-gray-300 rounded"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

