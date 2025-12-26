import { useState } from 'react';
import { useRouter } from 'next/router';
import { authAPI, publicCheckinAPI } from '../lib/api';
import { setAuthToken } from '../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamCode, setTeamCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      setAuthToken(response.data.token);
      const role = response.data.user?.role;
      if (role === 'admin') router.push('/admin');
      else if (role === 'hr') router.push('/hr');
      else router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGetLinkByTeam = async () => {
    const code = teamCode.trim();
    if (!code) {
      setError('Enter a team code to continue');
      return;
    }
    setError('');
    try {
      const res = await publicCheckinAPI.getByTeam(code);
      const token = res.data.token;
      router.push(`/checkin/${token}`);
    } catch (err) {
      setError(err.response?.data?.error || 'No active link for this team');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-primary-50 p-8">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/wellpredict-logo.png"
            alt="WellPredict"
            className="h-20 w-auto mb-3"
          />
          <span className="sr-only">WellPredict</span>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="admin@company.com"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="Enter your password"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Access your check-in</h2>
          <p className="text-sm text-gray-600 mb-3">
            Enter your team code to get the latest active anonymous check-in link. No login required.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
              className="input-field flex-1"
              placeholder="Enter team code (e.g., TEAM-A)"
            />
            <button
              type="button"
              onClick={handleGetLinkByTeam}
              className="btn-primary"
            >
              Get Check-in Link
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Default admin: admin@company.com / admin123</p>
          <p className="text-xs mt-2 text-red-600">⚠️ Change password in production!</p>
        </div>
      </div>
    </div>
  );
}

