import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { teamsAPI, authAPI, attendanceAPI, adminAPI } from '../lib/api';
import { isAuthenticated, removeAuthToken } from '../lib/auth';

export default function AdminPanel() {
  const router = useRouter();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teams');
  const [user, setUser] = useState(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userRoleToCreate, setUserRoleToCreate] = useState('manager');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [checkinsTotal, setCheckinsTotal] = useState(0);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [checkinsTeamId, setCheckinsTeamId] = useState('all');
  const [checkinsPage, setCheckinsPage] = useState({ limit: 20, offset: 0 });

  const [teamForm, setTeamForm] = useState({
    team_code: '',
    team_name: '',
    manager_id: '',
  });

  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
  });

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
      
      const userRes = await authAPI.getMe();
      setUser(userRes.data.user);

      if (userRes.data.user.role !== 'admin') {
        if (userRes.data.user.role === 'hr') router.push('/hr');
        else router.push('/dashboard');
        return;
      }

      const teamsRes = await teamsAPI.getAll();
      setTeams(teamsRes.data.teams);

      const managersRes = await adminAPI.listManagers();
      setManagers(managersRes.data.managers);

      const hrRes = await adminAPI.listHR();
      setHrUsers(hrRes.data.hr || []);
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

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        team_code: teamForm.team_code,
        team_name: teamForm.team_name,
      };
      // Only send manager_id if provided (backend expects int)
      if (teamForm.manager_id) {
        payload.manager_id = parseInt(teamForm.manager_id, 10);
      }

      await teamsAPI.create(payload);
      setShowTeamForm(false);
      setTeamForm({ team_code: '', team_name: '', manager_id: '' });
      loadData();
      alert('Team created successfully!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create team');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      if (userRoleToCreate === 'hr') {
        await adminAPI.createHR(userForm);
      } else {
        await adminAPI.createManager(userForm);
      }
      setShowUserForm(false);
      setUserForm({ email: '', password: '', full_name: '' });
      await loadData();
      alert(`${userRoleToCreate.toUpperCase()} user created successfully!`);
    } catch (error) {
      alert(error.response?.data?.error || `Failed to create ${userRoleToCreate} user`);
    }
  };

  const handleDeactivateHR = async (hr) => {
    if (!confirm(`Deactivate HR user "${hr.full_name}"?`)) return;
    try {
      await adminAPI.deactivateHR(hr.id);
      await loadData();
      alert('HR user deactivated');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to deactivate HR user');
    }
  };

  const handleDeleteUser = async (u) => {
    const ok = confirm(
      `Permanently delete ${u.role.toUpperCase()} user "${u.full_name}"?\n\nThis cannot be undone.`
    );
    if (!ok) return;

    try {
      await adminAPI.deleteUser(u.id);
      await loadData();
      alert('User deleted');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleGenerateToken = async (teamId) => {
    try {
      const response = await teamsAPI.generateToken(teamId);
      const url = response.data.checkin_url;
      
      // Copy to clipboard
      navigator.clipboard.writeText(url);
      alert(`Token generated! Check-in URL copied to clipboard:\n${url}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to generate token');
    }
  };

  const handleDeleteTeam = async (team) => {
    const ok = confirm(
      `Delete team "${team.team_name}" (${team.team_code})?\n\nThis will archive the team (remove it from the list) and deactivate its check-in links.`
    );
    if (!ok) return;

    try {
      await teamsAPI.delete(team.id);
      await loadData();
      alert('Team deleted');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete team');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a file');
      return;
    }

    try {
      setUploadStatus({ ok: true, message: 'Uploading...' });
      const response = await attendanceAPI.upload(uploadFile);
      setUploadStatus({
        ok: true,
        message: `Success! ${response.data.summary.inserted} records inserted.`,
        summary: response.data.summary,
        teams: response.data.teams_in_file,
      });
      setUploadFile(null);
    } catch (error) {
      setUploadStatus({
        ok: false,
        message: `Error: ${error.response?.data?.error || 'Upload failed'}`,
        errors: error.response?.data?.errors,
      });
    }
  };

  const handleRecalculateBurnout = async () => {
    const ok = confirm(
      'Recalculate burnout scores for ALL existing check-ins?\n\nUse this after a formula change. This may take a moment.'
    );
    if (!ok) return;

    try {
      const res = await adminAPI.recalculateBurnout();
      alert(`Done! Updated ${res.data.updated} check-ins.`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to recalculate burnout scores');
    }
  };

  const loadCheckins = async ({ resetOffset } = {}) => {
    try {
      setCheckinsLoading(true);
      const offset = resetOffset ? 0 : checkinsPage.offset;
      const params = { limit: checkinsPage.limit, offset };
      if (checkinsTeamId !== 'all') params.team_id = checkinsTeamId;
      const res = await adminAPI.listCheckins(params);
      setCheckins(res.data.checkins || []);
      setCheckinsTotal(res.data.total || 0);
      setCheckinsPage({ ...checkinsPage, offset });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load check-ins');
    } finally {
      setCheckinsLoading(false);
    }
  };

  const handleEditCheckin = async (c) => {
    const workload = prompt('Workload (0-4)', String(c.workload));
    if (workload === null) return;
    const stress = prompt('Stress (0-4)', String(c.stress));
    if (stress === null) return;
    const sleep = prompt('Sleep (0-4)', String(c.sleep));
    if (sleep === null) return;
    const engagement = prompt('Engagement (0-4)', String(c.engagement));
    if (engagement === null) return;
    const recovery = prompt('Recovery (0-4)', String(c.recovery));
    if (recovery === null) return;

    try {
      await adminAPI.updateCheckin(c.id, {
        workload: parseInt(workload, 10),
        stress: parseInt(stress, 10),
        sleep: parseInt(sleep, 10),
        engagement: parseInt(engagement, 10),
        recovery: parseInt(recovery, 10),
      });
      await loadCheckins();
      alert('Check-in updated');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update check-in');
    }
  };

  const handleDeleteCheckin = async (c) => {
    if (!confirm('Delete this check-in?')) return;
    try {
      await adminAPI.deleteCheckin(c.id);
      await loadCheckins();
      alert('Check-in deleted');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete check-in');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return null;
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
              Admin Dashboard
            </h1>

            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-primary-100">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('teams')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'teams'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/70 hover:text-white hover:border-white/40'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'attendance'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/70 hover:text-white hover:border-white/40'
              }`}
            >
              Attendance Upload
            </button>
          </nav>
        </div>

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Teams</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setUserRoleToCreate('manager');
                    setShowUserForm(!showUserForm || userRoleToCreate !== 'manager');
                  }}
                  className="btn-primary"
                >
                  {showUserForm && userRoleToCreate === 'manager' ? 'Cancel Manager' : 'Create Manager'}
                </button>
                <button
                  onClick={() => {
                    setUserRoleToCreate('hr');
                    setShowUserForm(!showUserForm || userRoleToCreate !== 'hr');
                  }}
                  className="btn-primary"
                >
                  {showUserForm && userRoleToCreate === 'hr' ? 'Cancel HR' : 'Create HR'}
                </button>
                <button
                  onClick={() => setShowTeamForm(!showTeamForm)}
                  className="btn-primary"
                >
                  {showTeamForm ? 'Cancel Team' : 'Create Team'}
                </button>
              </div>
            </div>

            {showUserForm && (
              <div className="card mb-6">
                <h3 className="text-lg font-semibold mb-4">Create User (Admin only)</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      Role
                    </label>
                    <select
                      value={userRoleToCreate}
                      onChange={(e) => setUserRoleToCreate(e.target.value)}
                      className="input-field bg-accent-100 text-primary-800"
                    >
                      <option value="manager">Manager</option>
                      <option value="hr">HR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={userForm.full_name}
                      onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                      required
                      className="input-field"
                      placeholder="Manager Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      required
                      className="input-field"
                      placeholder="manager@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      required
                      className="input-field"
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    Create {userRoleToCreate.toUpperCase()}
                  </button>
                </form>
              </div>
            )}

            {showTeamForm && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold text-primary-800 mb-4">Create New Team</h3>
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div>
                  <label className="block text-sm font-medium text-primary-700 mb-2">
                      Team Code
                    </label>
                    <input
                      type="text"
                      value={teamForm.team_code}
                      onChange={(e) => setTeamForm({ ...teamForm, team_code: e.target.value })}
                      required
                      className="input-field"
                      placeholder="TEAM-A"
                    />
                  </div>
                  <div>
                  <label className="block text-sm font-medium text-primary-700 mb-2">
                      Team Name
                    </label>
                    <input
                      type="text"
                      value={teamForm.team_name}
                      onChange={(e) => setTeamForm({ ...teamForm, team_name: e.target.value })}
                      required
                      className="input-field"
                      placeholder="Engineering Team"
                    />
                  </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manager (optional)
                </label>
                <select
                  value={teamForm.manager_id}
                  onChange={(e) => setTeamForm({ ...teamForm, manager_id: e.target.value })}
                  className="input-field bg-accent-100 text-primary-800"
                >
                  <option value="">Unassigned</option>
                  {managers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.full_name} ({mgr.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-primary-600 mt-1">
                  Only active managers are listed. Create managers below.
                </p>
              </div>
                  <button type="submit" className="btn-primary">
                    Create Team
                  </button>
                </form>
              </div>
            )}

            <div className="grid gap-4">
              {teams.map((team) => (
                <div key={team.id} className="card">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-primary-800">{team.team_name}</h3>
                      <p className="text-sm text-primary-600">Code: {team.team_code}</p>
                      <div className="mt-2">
                        <label className="block text-xs text-primary-600 mb-1">Manager</label>
                        <select
                          className="input-field bg-accent-100 text-primary-800"
                          value={team.manager_id || ''}
                          onChange={async (e) => {
                            const mgrId = e.target.value ? parseInt(e.target.value, 10) : null;
                            try {
                              await adminAPI.assignManagerToTeam(team.id, mgrId);
                              await loadData();
                              alert('Manager updated');
                            } catch (err) {
                              alert(err.response?.data?.error || 'Failed to update manager');
                            }
                          }}
                        >
                          <option value="">Unassigned</option>
                          {managers.map((mgr) => (
                            <option key={mgr.id} value={mgr.id}>
                              {mgr.full_name} ({mgr.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-end">
                      <button
                        onClick={() => handleGenerateToken(team.id)}
                        className="btn-primary text-sm"
                      >
                        Generate Check-in Link
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team)}
                        className="btn-danger text-sm"
                      >
                        Delete Team
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Managers list / deactivate */}
            <div className="card mt-6">
              <h3 className="text-lg font-semibold mb-4">Managers (active)</h3>
              {managers.length === 0 ? (
                <p className="text-sm text-gray-600">No managers yet.</p>
              ) : (
                <div className="space-y-3">
                  {managers.map((mgr) => (
                    <div key={mgr.id} className="flex justify-between items-center border rounded p-3">
                      <div>
                        <div className="font-semibold">{mgr.full_name}</div>
                        <div className="text-sm text-gray-600">{mgr.email}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-primary text-sm"
                          onClick={async () => {
                            if (!confirm('Deactivate this manager?')) return;
                            try {
                              await adminAPI.deactivateManager(mgr.id);
                              await loadData();
                              alert('Manager deactivated');
                            } catch (err) {
                              alert(err.response?.data?.error || 'Failed to deactivate manager');
                            }
                          }}
                        >
                          Deactivate
                        </button>
                        <button
                          className="btn-danger text-sm"
                          onClick={() => handleDeleteUser({ ...mgr, role: 'manager' })}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* HR users list */}
            <div className="card mt-6">
              <h3 className="text-lg font-semibold mb-4">HR Users (active)</h3>
              {hrUsers.length === 0 ? (
                <p className="text-sm text-gray-600">No HR users yet.</p>
              ) : (
                <div className="space-y-3">
                  {hrUsers.map((u) => (
                    <div key={u.id} className="flex justify-between items-center border rounded p-3">
                      <div>
                        <div className="font-semibold">{u.full_name}</div>
                        <div className="text-sm text-gray-600">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-primary-700 font-medium">hr</div>
                        <button className="btn-primary text-sm" onClick={() => handleDeactivateHR(u)}>
                          Deactivate
                        </button>
                        <button
                          className="btn-danger text-sm"
                          onClick={() => handleDeleteUser({ ...u, role: 'hr' })}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">Upload Attendance Data</h2>
            
            <div className="card mb-6">
              <h3 className="text-lg font-semibold text-primary-800 mb-4">Upload File</h3>
              <p className="text-sm text-primary-700 mb-4">
                Upload a CSV or Excel file with attendance data. Format:
              </p>
              <div className="bg-accent-50 p-4 rounded mb-4">
                <code className="text-sm">
                  employee_id,team_id,date,status<br />
                  E1,TEAM-A,2025-01-15,Present<br />
                  E2,TEAM-A,2025-01-15,Absent
                </code>
              </div>
              
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-2">
                    Select File (CSV or Excel)
                  </label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    required
                    className="input-field"
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Upload
                </button>
              </form>

              {uploadStatus && (
                <div
                  className={`mt-4 p-4 rounded ${
                    uploadStatus.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <div className="font-semibold">{uploadStatus.message}</div>
                  {uploadStatus.summary && (
                    <div className="text-sm mt-2 space-y-1">
                      <div>Total records: {uploadStatus.summary.total_records}</div>
                      <div>Inserted: {uploadStatus.summary.inserted}</div>
                      <div>Updated: {uploadStatus.summary.updated}</div>
                      <div>Skipped: {uploadStatus.summary.skipped}</div>
                      <div>Errors: {uploadStatus.summary.errors}</div>
                      {uploadStatus.teams && uploadStatus.teams.length > 0 && (
                        <div>Teams in file: {uploadStatus.teams.join(', ')}</div>
                      )}
                    </div>
                  )}
                  {uploadStatus.errors && uploadStatus.errors.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-sm">
                      {uploadStatus.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-primary-800 mb-2">Maintenance</h3>
              <p className="text-sm text-primary-700 mb-4">
                Use this after changing burnout scoring logic to update existing data.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button className="btn-secondary" onClick={handleRecalculateBurnout}>
                  Recalculate Burnout Scores
                </button>
              </div>
            </div>

            <div className="card mt-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary-800">Recent Check-ins</h3>
                  <p className="text-sm text-primary-700">
                    View and edit/delete check-ins for testing (admin only).
                  </p>
                </div>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => loadCheckins({ resetOffset: true })}
                  disabled={checkinsLoading}
                >
                  {checkinsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="sm:w-80">
                  <label className="block text-xs text-primary-600 mb-1">Team</label>
                  <select
                    className="input-field bg-accent-100 text-primary-800"
                    value={checkinsTeamId}
                    onChange={(e) => {
                      setCheckinsTeamId(e.target.value);
                      setCheckinsPage({ ...checkinsPage, offset: 0 });
                    }}
                  >
                    <option value="all">All teams</option>
                    {teams.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.team_name} ({t.team_code})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn-primary text-sm"
                  onClick={() => loadCheckins({ resetOffset: true })}
                  disabled={checkinsLoading}
                >
                  Load
                </button>
                <div className="text-sm text-primary-700 sm:ml-auto">
                  Showing {checkins.length} of {checkinsTotal}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-primary-700 border-b">
                      <th className="py-2 pr-4">Team</th>
                      <th className="py-2 pr-4">Submitted</th>
                      <th className="py-2 pr-4">Inputs</th>
                      <th className="py-2 pr-4">Score</th>
                      <th className="py-2 pr-4">Risk</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkins.length === 0 ? (
                      <tr>
                        <td className="py-4 text-primary-600" colSpan={6}>
                          No check-ins found. Click Load.
                        </td>
                      </tr>
                    ) : (
                      checkins.map((c) => (
                        <tr key={c.id} className="border-b">
                          <td className="py-2 pr-4">
                            <div className="font-medium">{c.team_name}</div>
                            <div className="text-xs text-gray-500">{c.team_code}</div>
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            {c.submitted_at ? new Date(c.submitted_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            W:{c.workload} S:{c.stress} Sl:{c.sleep} E:{c.engagement} R:{c.recovery}
                          </td>
                          <td className="py-2 pr-4 font-semibold">{c.burnout_score}</td>
                          <td className="py-2 pr-4">{c.risk_level}</td>
                          <td className="py-2 pr-4">
                            <div className="flex gap-2">
                              <button className="btn-secondary text-sm" onClick={() => handleEditCheckin(c)}>
                                Edit
                              </button>
                              <button className="btn-danger text-sm" onClick={() => handleDeleteCheckin(c)}>
                                Delete
                              </button>
                            </div>
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
                  disabled={checkinsLoading || checkinsPage.offset <= 0}
                  onClick={() => {
                    const nextOffset = Math.max(checkinsPage.offset - checkinsPage.limit, 0);
                    setCheckinsPage((p) => ({ ...p, offset: nextOffset }));
                    loadCheckins();
                  }}
                >
                  Prev
                </button>
                <div className="text-xs text-primary-600">
                  Page {Math.floor(checkinsPage.offset / checkinsPage.limit) + 1}
                </div>
                <button
                  className="btn-secondary text-sm"
                  disabled={checkinsLoading || checkinsPage.offset + checkinsPage.limit >= checkinsTotal}
                  onClick={() => {
                    const nextOffset = checkinsPage.offset + checkinsPage.limit;
                    setCheckinsPage((p) => ({ ...p, offset: nextOffset }));
                    loadCheckins();
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

