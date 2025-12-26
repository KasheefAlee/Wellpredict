import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { publicCheckinAPI } from '../../lib/api';

export default function CheckInForm() {
  const router = useRouter();
  const { teamCode: teamToken } = router.query;
  const [teamInfo, setTeamInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    workload: '',
    stress: '',
    sleep: '',
    engagement: '',
    recovery: '',
  });

  useEffect(() => {
    if (teamToken) {
      verifyToken();
    }
  }, [teamToken]);

  const verifyToken = async () => {
    try {
      const response = await publicCheckinAPI.validate(teamToken);
      if (response.data.valid) {
        setTeamInfo(response.data.team);
      } else {
        setError('Invalid or expired check-in link');
      }
    } catch (err) {
      setError('Invalid or expired check-in link');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: parseInt(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await publicCheckinAPI.submit(teamToken, {
        ...formData,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !teamInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-primary-50 p-8 text-center">
          <img
            src="/wellpredict-logo.png"
            alt="WellPredict"
            className="h-16 w-auto mx-auto mb-4"
          />
          <div className="text-amber-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4 text-primary-900">Invalid Link</h2>
          <p className="text-primary-700">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-primary-50 p-8 text-center">
          <img
            src="/wellpredict-logo.png"
            alt="WellPredict"
            className="h-16 w-auto mx-auto mb-4"
          />
          <div className="text-primary-600 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-4 text-primary-900">Thank You!</h2>
          <p className="text-primary-700 mb-6">
            Your check-in has been submitted anonymously. Your responses help us understand team wellbeing.
          </p>
          <p className="text-sm text-primary-600">
            This form is completely anonymous. No personal information is stored.
          </p>
        </div>
      </div>
    );
  }

  const scaleOptions = [
    { value: 0, label: '0 - Very Low' },
    { value: 1, label: '1 - Low' },
    { value: 2, label: '2 - Moderate' },
    { value: 3, label: '3 - High' },
    { value: 4, label: '4 - Very High' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-primary-50 p-8">
        <div className="text-center mb-8">
          <img
            src="/wellpredict-logo.png"
            alt="WellPredict"
            className="h-20 w-auto mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-primary-900 mb-2">Weekly Check-in</h1>
          {teamInfo && (
            <p className="text-primary-700">
              Team: <span className="font-semibold">{teamInfo.name}</span>
            </p>
          )}
          <p className="text-sm text-primary-600 mt-2">
            This check-in is completely anonymous. Your responses are confidential.
          </p>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2">
              Workload (0-4)
            </label>
            <p className="text-xs text-primary-600 mb-3">
              How manageable is your current workload?
            </p>
            <select
              value={formData.workload}
              onChange={(e) => handleChange('workload', e.target.value)}
              required
              className="input-field"
            >
              <option value="">Select...</option>
              {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2">
              Stress Level (0-4)
            </label>
            <p className="text-xs text-primary-600 mb-3">
              How stressed do you feel at work?
            </p>
            <select
              value={formData.stress}
              onChange={(e) => handleChange('stress', e.target.value)}
              required
              className="input-field"
            >
              <option value="">Select...</option>
              {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2">
              Sleep Quality (0-4)
            </label>
            <p className="text-xs text-primary-600 mb-3">
              How well are you sleeping?
            </p>
            <select
              value={formData.sleep}
              onChange={(e) => handleChange('sleep', e.target.value)}
              required
              className="input-field"
            >
              <option value="">Select...</option>
              {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2">
              Engagement (0-4)
            </label>
            <p className="text-xs text-primary-600 mb-3">
              How engaged and motivated do you feel?
            </p>
            <select
              value={formData.engagement}
              onChange={(e) => handleChange('engagement', e.target.value)}
              required
              className="input-field"
            >
              <option value="">Select...</option>
              {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2">
              Recovery (0-4)
            </label>
            <p className="text-xs text-primary-600 mb-3">
              How well are you recovering from work demands?
            </p>
            <select
              value={formData.recovery}
              onChange={(e) => handleChange('recovery', e.target.value)}
              required
              className="input-field"
            >
              <option value="">Select...</option>
              {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
            <p className="text-sm text-primary-700">
              <strong>Privacy Notice:</strong> Your responses are completely anonymous. 
              No personal information, IP addresses, or identifying data is stored. 
              Only aggregated team statistics are visible to managers.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Check-in'}
          </button>
        </form>
      </div>
    </div>
  );
}

