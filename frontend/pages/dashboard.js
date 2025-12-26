import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { dashboardAPI, teamsAPI, exportAPI, managerAPI } from '../lib/api';
import { isAuthenticated, removeAuthToken } from '../lib/auth';
import BurnoutScoreCard from '../components/BurnoutScoreCard';
import TrendChart from '../components/TrendChart';
import RiskDistributionChart from '../components/RiskDistributionChart';
import ActivityHeatmap from '../components/ActivityHeatmap';
import CorrelationChart from '../components/CorrelationChart';

export default function Dashboard() {
  const router = useRouter();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [overview, setOverview] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [user, setUser] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [attendanceFile, setAttendanceFile] = useState(null);
  const [attendanceUploadStatus, setAttendanceUploadStatus] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);

  // Attendance records (manager portal)
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceTotal, setAttendanceTotal] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceTeamId, setAttendanceTeamId] = useState(null); // null => not set yet
  const [attendanceFilters, setAttendanceFilters] = useState({
    startDate: '',
    endDate: '',
  });
  const [attendancePage, setAttendancePage] = useState({ limit: 10, offset: 0 });

  const portalTitle =
    user?.role === 'admin' ? 'Admin Dashboard' : user?.role === 'manager' ? 'Manager Dashboard' : 'Dashboard';

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get user info
      const { authAPI } = await import('../lib/api');
      const userRes = await authAPI.getMe();
      setUser(userRes.data.user);

      if (userRes.data.user.role === 'hr') {
        router.push('/hr');
        return;
      }

      // Get teams
      const teamsRes = await teamsAPI.getAll();
      setTeams(teamsRes.data.teams);
      
      if (teamsRes.data.teams.length > 0) {
        setSelectedTeam(teamsRes.data.teams[0].id);
      }

      if (userRes.data.user.role === 'manager') {
        try {
          const uploadsRes = await managerAPI.getRecentAttendanceUploads({ limit: 5 });
          setRecentUploads(uploadsRes.data.uploads || []);
        } catch (e) {
          console.error('Failed to load recent uploads:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      if (error.response?.status === 401) {
        removeAuthToken();
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTeam) {
      loadTeamData();
    }
  }, [selectedTeam, period]);

  useEffect(() => {
    if (user?.role === 'manager' && selectedTeam) {
      // Default attendance slicer to current selected team (for charts) on first load
      if (attendanceTeamId === null) setAttendanceTeamId(selectedTeam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, selectedTeam]);

  useEffect(() => {
    if (user?.role === 'manager' && attendanceTeamId !== null) {
      loadAttendanceRecords({ resetOffset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, attendanceTeamId]);

  const loadAttendanceRecords = async ({ resetOffset, offsetOverride } = {}) => {
    if (user?.role !== 'manager' || attendanceTeamId === null) return;

    try {
      setAttendanceLoading(true);
      const offset =
        typeof offsetOverride === 'number'
          ? offsetOverride
          : resetOffset
          ? 0
          : attendancePage.offset;
      const params = {
        limit: attendancePage.limit,
        offset,
      };

      if (attendanceFilters.startDate && attendanceFilters.endDate) {
        params.startDate = attendanceFilters.startDate;
        params.endDate = attendanceFilters.endDate;
      }

      // Team slicer: "all" => all manager teams, otherwise filter by team_id
      if (String(attendanceTeamId) !== 'all') {
        params.team_id = attendanceTeamId;
      }

      const res = await managerAPI.getAttendanceRecords(params);
      setAttendanceRecords(res.data.records || []);
      setAttendanceTotal(res.data.total || 0);
      setAttendancePage({ ...attendancePage, offset });
    } catch (e) {
      console.error('Failed to load attendance records:', e);
      alert(e.response?.data?.error || 'Failed to load attendance records');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadTeamData = async () => {
    try {
      const params = { period };
      
      const [overviewRes, correlationRes, activityRes] = await Promise.all([
        dashboardAPI.getOverview(selectedTeam, params),
        dashboardAPI.getCorrelation(selectedTeam, params),
        dashboardAPI.getActivity(selectedTeam, params),
      ]);

      setOverview(overviewRes.data);
      setCorrelation(correlationRes.data);
      setActivity(activityRes.data);

      try {
        const recRes = await managerAPI.getRecommendations(selectedTeam, { period });
        setRecommendations(recRes.data);
      } catch (e) {
        // Only meaningful for managers/admin; ignore for others.
        setRecommendations(null);
      }
    } catch (error) {
      console.error('Failed to load team data:', error);
    }
  };

  const handleAttendanceUpload = async (e) => {
    e.preventDefault();
    if (!attendanceFile) return;

    try {
      setAttendanceUploadStatus({ ok: true, message: 'Uploading...' });
      const res = await managerAPI.uploadAttendance(attendanceFile);
      setAttendanceUploadStatus({
        ok: true,
        message: 'Attendance uploaded successfully',
        summary: res.data.summary,
        teams: res.data.teams_in_file,
      });
      setAttendanceFile(null);

      // Refresh correlation after upload
      const params = { period };
      const correlationRes = await dashboardAPI.getCorrelation(selectedTeam, params);
      setCorrelation(correlationRes.data);

      // Refresh recent uploads list
      if (user?.role === 'manager') {
        const uploadsRes = await managerAPI.getRecentAttendanceUploads({ limit: 5 });
        setRecentUploads(uploadsRes.data.uploads || []);
      }
    } catch (error) {
      setAttendanceUploadStatus({
        ok: false,
        message: `Error: ${error.response?.data?.error || 'Upload failed'}`,
        errors: error.response?.data?.errors,
      });
    }
  };

  const handleExport = async (format) => {
    if (!selectedTeam) return;

    try {
      let response;
      let filename;
      let mimeType;

      switch (format) {
        case 'csv':
          response = await exportAPI.exportCSV(selectedTeam);
          filename = 'burnout_data.csv';
          mimeType = 'text/csv';
          break;
        case 'excel':
          response = await exportAPI.exportExcel(selectedTeam);
          filename = 'wellbeing_report.xlsx';
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          response = await exportAPI.exportPDF(selectedTeam);
          filename = 'wellbeing_report.pdf';
          mimeType = 'application/pdf';
          break;
      }

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data');
    }
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
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-brand-bg p-8">
        <div className="max-w-7xl mx-auto">
          <div className="card text-center">
            <h2 className="text-2xl font-bold mb-4">No Teams Available</h2>
            <p className="text-primary-700 mb-6">
              {user?.role === 'admin' 
                ? 'Create a team to get started.'
                : 'Contact your administrator to assign you to a team.'}
            </p>
            {user?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="btn-primary"
              >
                Go to Admin Panel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
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
              {portalTitle}
            </h1>

            <div className="flex items-center gap-4">
              <span className="text-sm text-primary-700">
                {user?.full_name} ({user?.role})
              </span>
              <button onClick={handleLogout} className="btn-primary text-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Team Selector */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-white">Team:</label>
          <select
            value={selectedTeam || ''}
            onChange={(e) => setSelectedTeam(parseInt(e.target.value))}
            className="input-field w-64 bg-accent-100 text-primary-800"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.team_name} ({team.team_code})
              </option>
            ))}
          </select>

          <label className="text-sm font-medium text-white ml-4">Period:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-field w-32 bg-accent-100 text-primary-800"
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>

          <div className="ml-auto flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="btn-primary text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="btn-primary text-sm"
            >
              Export Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="btn-primary text-sm"
            >
              Export PDF
            </button>
          </div>
        </div>

        {overview && (
          <>
            {/* Burnout Score Card */}
            <BurnoutScoreCard overview={overview} />

            {/* Recommendations (managers) */}
            {recommendations && (
              <div
                className={`card mt-6 ${
                  recommendations.risk === 'Critical'
                    ? 'bg-rose-50 border border-rose-200'
                    : recommendations.risk === 'High'
                    ? 'bg-orange-50 border border-orange-200'
                    : 'bg-accent-50 border border-accent-200'
                }`}
              >
                <h3 className="text-lg font-semibold mb-2">Burnout Recommendations</h3>
                <p className="text-sm text-primary-700 mb-3">
                  Your team&apos;s average burnout score for this {period} is {recommendations.risk.toLowerCase()} ({recommendations.burnout_score}).
                  Consider these actions:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-primary-800">
                  {recommendations.recommendations.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Trend Chart */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Burnout Trend</h3>
                <TrendChart data={overview.trends} period={period} />
              </div>

              {/* Risk Distribution */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Risk Level Distribution</h3>
                <RiskDistributionChart data={overview.risk_distribution} />
              </div>
            </div>

            {/* Activity Heatmap */}
            {activity && (
              <div className="card mt-6">
                <h3 className="text-lg font-semibold mb-4">Check-in Activity</h3>
                <ActivityHeatmap data={activity.activity} />
              </div>
            )}

            {/* Correlation Chart */}
            {correlation && (
              <div className="card mt-6">
                <h3 className="text-lg font-semibold mb-4">Attendance vs Burnout Correlation</h3>
                <CorrelationChart data={correlation.weekly_correlation} />
              </div>
            )}

            {/* Attendance upload (managers) */}
            {user?.role === 'manager' && (
              <>
                <div className="card mt-6">
                  <h3 className="text-lg font-semibold mb-4">Upload Attendance Data</h3>
                  <p className="text-sm text-primary-700 mb-4">
                    Upload CSV/XLSX attendance data to compare attendance patterns with burnout.
                  </p>
                  <form onSubmit={handleAttendanceUpload} className="space-y-3">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => setAttendanceFile(e.target.files?.[0] || null)}
                      className="input-field"
                    />
                    <button type="submit" className="btn-primary" disabled={!attendanceFile}>
                      Upload
                    </button>
                  </form>

                  {attendanceUploadStatus && (
                    <div
                      className={`mt-4 p-4 rounded ${
                        attendanceUploadStatus.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      <div className="font-semibold">{attendanceUploadStatus.message}</div>
                      {attendanceUploadStatus.summary && (
                        <div className="text-sm mt-2 space-y-1">
                          <div>Total records: {attendanceUploadStatus.summary.total_records}</div>
                          <div>Inserted: {attendanceUploadStatus.summary.inserted}</div>
                          <div>Updated: {attendanceUploadStatus.summary.updated}</div>
                          <div>Skipped: {attendanceUploadStatus.summary.skipped}</div>
                          <div>Errors: {attendanceUploadStatus.summary.errors}</div>
                          {attendanceUploadStatus.teams && attendanceUploadStatus.teams.length > 0 && (
                            <div>Teams in file: {attendanceUploadStatus.teams.join(', ')}</div>
                          )}
                        </div>
                      )}
                      {attendanceUploadStatus.errors && attendanceUploadStatus.errors.length > 0 && (
                        <ul className="mt-2 list-disc list-inside text-sm">
                          {attendanceUploadStatus.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {recentUploads && recentUploads.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-primary-800 mb-2">Recent uploads</h4>
                      <div className="space-y-2 text-sm">
                        {recentUploads.map((u) => (
                          <div key={u.team_id} className="flex justify-between border rounded p-2 bg-white">
                            <div>
                              <div className="font-medium">{u.team_name}</div>
                              <div className="text-gray-600">{u.team_code}</div>
                            </div>
                            <div className="text-right text-gray-700">
                              <div>{u.records_uploaded} records</div>
                              <div className="text-xs text-gray-500">
                                {u.last_uploaded_at ? new Date(u.last_uploaded_at).toLocaleString() : '—'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="card mt-6">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Team Attendance (Manager)</h3>
                      <p className="text-sm text-primary-700">
                        View attendance records. Filter by team and date range.
                      </p>
                    </div>
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => loadAttendanceRecords({ resetOffset: true })}
                      disabled={attendanceLoading}
                    >
                      {attendanceLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-primary-600 mb-1">Team</label>
                      <select
                        className="input-field bg-accent-100 text-primary-800"
                        value={attendanceTeamId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAttendancePage({ ...attendancePage, offset: 0 });
                          setAttendanceTeamId(v === 'all' ? 'all' : parseInt(v, 10));
                        }}
                      >
                        <option value="all">All teams</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.team_name} ({t.team_code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-primary-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        className="input-field"
                        value={attendanceFilters.startDate}
                        onChange={(e) =>
                          setAttendanceFilters({ ...attendanceFilters, startDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-primary-600 mb-1">End Date</label>
                      <input
                        type="date"
                        className="input-field"
                        value={attendanceFilters.endDate}
                        onChange={(e) =>
                          setAttendanceFilters({ ...attendanceFilters, endDate: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <button
                        className="btn-primary text-sm"
                        onClick={() => loadAttendanceRecords({ resetOffset: true, offsetOverride: 0 })}
                        disabled={attendanceLoading}
                      >
                        Apply
                      </button>
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => {
                          setAttendanceFilters({ startDate: '', endDate: '' });
                          setAttendancePage({ ...attendancePage, offset: 0 });
                          setAttendanceTeamId('all');
                          // fetch with cleared filters
                          loadAttendanceRecords({ resetOffset: true, offsetOverride: 0 });
                        }}
                        disabled={attendanceLoading}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-primary-700">
                    Showing {attendanceRecords.length} of {attendanceTotal} records
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-primary-700 border-b">
                          {String(attendanceTeamId) === 'all' && <th className="py-2 pr-4">Team</th>}
                          <th className="py-2 pr-4">Employee</th>
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Uploaded At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.length === 0 ? (
                          <tr>
                            <td className="py-4 text-primary-600" colSpan={String(attendanceTeamId) === 'all' ? 5 : 4}>
                              No attendance records found for this team.
                            </td>
                          </tr>
                        ) : (
                          attendanceRecords.map((r) => (
                            <tr key={r.id} className="border-b">
                              {String(attendanceTeamId) === 'all' && (
                                <td className="py-2 pr-4 text-gray-700">
                                  <div className="font-medium">{r.team_name}</div>
                                  <div className="text-xs text-gray-500">{r.team_code}</div>
                                </td>
                              )}
                              <td className="py-2 pr-4 font-medium">{r.employee_id}</td>
                              <td className="py-2 pr-4">
                                {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-2 pr-4">{r.status}</td>
                              <td className="py-2 pr-4 text-gray-600">
                                {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <button
                      className="btn-secondary text-sm"
                      disabled={attendanceLoading || attendancePage.offset <= 0}
                      onClick={() => {
                        const nextOffset = Math.max(attendancePage.offset - attendancePage.limit, 0);
                        setAttendancePage((prev) => ({ ...prev, offset: nextOffset }));
                        loadAttendanceRecords({ offsetOverride: nextOffset });
                      }}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-primary-600">
                      Page {Math.floor(attendancePage.offset / attendancePage.limit) + 1}
                    </div>
                    <button
                      className="btn-secondary text-sm"
                      disabled={attendanceLoading || attendancePage.offset + attendancePage.limit >= attendanceTotal}
                      onClick={() => {
                        const nextOffset = attendancePage.offset + attendancePage.limit;
                        setAttendancePage((prev) => ({ ...prev, offset: nextOffset }));
                        loadAttendanceRecords({ offsetOverride: nextOffset });
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {user?.role === 'admin' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/admin')}
              className="btn-primary"
            >
              Admin Panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

