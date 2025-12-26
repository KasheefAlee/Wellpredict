import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { authAPI, hrAPI, dashboardAPI } from '../lib/api';
import { isAuthenticated, removeAuthToken } from '../lib/auth';
import TrendChart from '../components/TrendChart';
import TeamBurnoutBarChart from '../components/TeamBurnoutBarChart';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function HRDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [corrTeamId, setCorrTeamId] = useState('');
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrValue, setCorrValue] = useState(null);
  const [corrPoints, setCorrPoints] = useState(0);
  const [corrSeries, setCorrSeries] = useState([]);

  const formatTimeAgo = (date) => {
    if (!date) return '—';
    const diffMs = Date.now() - new Date(date).getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  };

  const riskPillClass = (risk) => {
    switch (risk) {
      case 'Low':
        return 'pill pill-low';
      case 'Moderate':
        return 'pill pill-moderate';
      case 'High':
        return 'pill pill-high';
      case 'Critical':
        return 'pill pill-critical';
      default:
        return 'pill pill-low';
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (user && (user.role === 'hr' || user.role === 'admin')) {
      loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, user?.role]);

  const load = async () => {
    try {
      setLoading(true);
      const me = await authAPI.getMe();
      setUser(me.data.user);

      if (me.data.user.role === 'admin') {
        // Admins already have a dedicated panel; keep HR dashboard available too.
      } else if (me.data.user.role !== 'hr') {
        router.push('/dashboard');
        return;
      }

      await loadDashboard();
    } catch (err) {
      console.error('Failed to load HR dashboard:', err);
      removeAuthToken();
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await hrAPI.getDashboard({ period });
      setData(res.data);

      // Default correlation team to first team with data
      const firstTeam = (res.data.teams || [])[0];
      if (firstTeam && !corrTeamId) {
        setCorrTeamId(String(firstTeam.id));
      }
    } catch (err) {
      console.error('Failed to load HR dashboard data:', err);
    }
  };

  const computePearson = (pairs) => {
    const n = pairs.length;
    if (n < 2) return null;
    const xs = pairs.map((p) => p[0]);
    const ys = pairs.map((p) => p[1]);
    const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      const vx = xs[i] - mx;
      const vy = ys[i] - my;
      num += vx * vy;
      dx += vx * vx;
      dy += vy * vy;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  };

  const loadCorrelation = async (teamId) => {
    if (!teamId) return;
    try {
      setCorrLoading(true);

      // Align correlation window with the selected period (Week/Month)
      const end = new Date();
      const start = new Date();
      if (period === 'week') start.setDate(end.getDate() - 7);
      else start.setDate(end.getDate() - 30);

      const fmt = (d) => d.toISOString().slice(0, 10);
      const res = await dashboardAPI.getCorrelation(teamId, { startDate: fmt(start), endDate: fmt(end) });
      const rows = res.data.weekly_correlation || [];
      const series = rows
        .slice()
        .reverse()
        .map((r) => ({
          label: r.week_start ? new Date(r.week_start).toLocaleDateString() : '',
          absenceRate: r.absence_rate !== null && r.absence_rate !== undefined ? Number(r.absence_rate) : 0,
          burnout: r.avg_burnout !== null && r.avg_burnout !== undefined ? Number(r.avg_burnout) : null,
        }))
        .filter((p) => p.label);

      setCorrSeries(series);

      const apiR = res.data?.correlation?.r;
      const apiPoints = res.data?.correlation?.points ?? 0;
      setCorrPoints(apiPoints);

      if (apiR !== null && apiR !== undefined) {
        setCorrValue(Math.round(Number(apiR) * 100) / 100);
      } else {
        // Fallback: compute client-side if backend returned null
        const pairs = series
          .filter((p) => Number.isFinite(p.absenceRate) && Number.isFinite(p.burnout))
          .map((p) => [p.absenceRate, p.burnout]);

        const r = computePearson(pairs);
        setCorrValue(r === null ? null : Math.round(r * 100) / 100);
        setCorrPoints(pairs.length);
      }
    } catch (err) {
      console.error('Failed to load correlation:', err);
      setCorrValue(null);
      setCorrPoints(0);
      setCorrSeries([]);
    } finally {
      setCorrLoading(false);
    }
  };

  const atRiskTeams = useMemo(() => {
    const list = data?.at_risk_teams || [];
    return list.slice(0, 10);
  }, [data]);

  const orgOverview = data?.organizational_overview;
  const summary = data?.summary;

  const orgDaily = (orgOverview?.daily_series || []).map((d) => ({
    label: d.day ? new Date(d.day).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }) : '',
    score: d.avg_burnout !== null && d.avg_burnout !== undefined ? Number(d.avg_burnout) : 0,
  }));

  const orgRiskLabel = (score) => {
    const v = Number(score || 0);
    if (v <= 30) return 'Low';
    if (v <= 60) return 'Moderate';
    if (v <= 80) return 'High';
    return 'Critical';
  };

  const handleLogout = () => {
    removeAuthToken();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading HR dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="bg-white shadow-md border-b border-primary-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="relative flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img
                src="/wellpredict-logo.png"
                alt="WellPredict"
                className="h-14 sm:h-16 w-auto"
              />
            </div>

            <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold text-primary-800">
              HR Dashboard
            </h1>

            <div className="flex items-center gap-4">
              <span className="text-sm text-primary-700">
                {user?.full_name} ({user?.role})
              </span>
              {user?.role === 'admin' && (
                <button onClick={() => router.push('/admin')} className="btn-primary text-sm">
                  Admin Panel
                </button>
              )}
              <button onClick={handleLogout} className="btn-primary text-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-white">Period:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-field w-32 bg-accent-100 text-primary-800"
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>

        {/* Top line: Organizational overview */}
        <div className="card mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="w-full lg:w-1/3 bg-accent-50 rounded-2xl p-6 border border-accent-100">
              <div className="text-sm font-medium text-primary-700 mb-2">Organizational Burnout Overview</div>
              <div className="flex items-baseline gap-2">
                <div className="text-5xl font-bold text-primary-900">{orgOverview?.overall_average ?? 0}</div>
                <div className="text-2xl text-primary-400">/ 100</div>
              </div>
              <div className="mt-2">
                <span className={riskPillClass(orgRiskLabel(orgOverview?.overall_average))}>
                  {orgRiskLabel(orgOverview?.overall_average)}
                </span>
              </div>
            </div>

            <div className="flex-1 hidden lg:block">
              <div className="flex justify-between text-sm text-primary-700 mb-2">
                <div className="font-medium">Overall average</div>
                <div className="text-gray-600">
                  Last activity{' '}
                  {orgOverview?.last_activity_at ? formatTimeAgo(orgOverview.last_activity_at) : '—'}
                </div>
              </div>
              {orgDaily.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
                  No trend data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={orgDaily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#3e9a94" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-between items-end mt-2">
                <div className="text-sm text-primary-700">Total check-ins this {period}</div>
                <div className="text-3xl font-bold text-primary-900">{orgOverview?.total_checkins_in_period ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Organizational Burnout Trend</h3>
            <TrendChart data={data?.organizational_trend} period={period} />
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Team Burnout Scores (Top 15)</h3>
            <TeamBurnoutBarChart teams={data?.teams || []} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-start">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Team Burnout Scores</h3>
              <div className="text-primary-400 text-xl leading-none">…</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-primary-700 border-b">
                    <th className="py-2 pr-4">Team</th>
                    <th className="py-2 pr-4">Avg.</th>
                    <th className="py-2 pr-4">Risk</th>
                    <th className="py-2 pr-4">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.teams || []).map((t) => (
                    <tr key={t.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 font-medium text-primary-900">{t.name}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">{t.burnout_score ?? '—'}</span>
                          {/* Simple trend glyph to match the widget style (no per-team trend computed yet) */}
                          {typeof t.burnout_score === 'number' && t.burnout_score > 0 && (
                            <span className="text-rose-500 text-xs">↗</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={riskPillClass(t.risk)}>{t.risk}</span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{t.last_checkin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">At-risk Teams</h3>
            {atRiskTeams.length === 0 ? (
              <div className="text-sm text-gray-600">No at-risk teams found.</div>
            ) : (
              <ul className="space-y-3">
                {atRiskTeams.map((t) => (
                  <li key={t.id} className="border rounded p-3 bg-rose-50 border-rose-200">
                    <div className="font-semibold text-rose-900">{t.name}</div>
                    <div className="text-sm text-rose-800">
                      Score: {t.burnout_score ?? '—'} • {t.risk} • {t.last_checkin}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* New HR widgets (moved to last row) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="card lg:col-span-1">
            <h3 className="text-lg font-semibold mb-1">Attendance vs. Burnout</h3>
            <p className="text-sm text-primary-700 mb-4">
              Upload attendance for a team to compute correlation.
            </p>

            <label className="block text-xs text-primary-600 mb-1">Team</label>
            <select
              className="input-field bg-accent-100 text-primary-800 mb-4"
              value={corrTeamId}
              onChange={(e) => {
                const v = e.target.value;
                setCorrTeamId(v);
                loadCorrelation(v);
              }}
            >
              {(data?.teams || []).map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>

            <div className="border rounded-xl p-4 bg-white">
              <div className="text-xs text-primary-600">Correlation</div>
              <div className="text-2xl font-bold text-primary-900">
                {corrLoading ? '…' : corrValue ?? '—'}
              </div>
              {!corrLoading && (corrValue === null || corrValue === undefined) && (
                <div className="text-xs text-gray-600 mt-1">
                  Need at least 2 weeks with both attendance + check-ins (matched weeks: {corrPoints})
                </div>
              )}
            </div>

            <div className="mt-4">
              {corrSeries.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
                  No correlation data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={corrSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" hide />
                    <YAxis yAxisId="left" domain={[0, 100]} hide />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
                    <Tooltip />
                    <Bar yAxisId="right" dataKey="absenceRate" fill="#bfe3e0" name="Absence Rate %" />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="burnout"
                      stroke="#e45b6b"
                      strokeWidth={2}
                      dot={false}
                      name="Burnout"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card lg:col-span-2 flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="border rounded-2xl p-6 bg-primary-50 flex flex-col items-center justify-center text-center gap-2">
                <div className="text-sm text-primary-700 font-medium">Total Teams</div>
                <div className="text-5xl font-bold text-primary-900 tabular-nums">
                  {summary?.total_teams ?? 0}
                </div>
              </div>
              <div className="border rounded-2xl p-6 bg-primary-50 flex flex-col items-center justify-center text-center gap-2">
                <div className="text-sm text-primary-700 font-medium">Total Employees</div>
                <div className="text-5xl font-bold text-primary-900 tabular-nums">
                  {summary?.total_employees ?? 0}
                </div>
              </div>
              <div className="border rounded-2xl p-6 bg-primary-50 flex flex-col items-center justify-center text-center gap-2">
                <div className="text-sm text-primary-700 font-medium">This Week&apos;s Check-ins</div>
                <div className="text-5xl font-bold text-primary-900 tabular-nums">
                  {summary?.this_week_checkins ?? 0}
                </div>
              </div>
              <div className="border rounded-2xl p-6 bg-primary-50 flex flex-col items-center justify-center text-center gap-2">
                <div className="text-sm text-primary-700 font-medium">Last 6 weeks avg</div>
                <div className="text-5xl font-bold text-primary-900 tabular-nums">
                  {summary?.last_6_weeks_avg ?? '0.0'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


