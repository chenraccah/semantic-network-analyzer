/**
 * Authentication form component with email/password and OAuth support
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'signup';

interface SignUpData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  organization: string;
  role: string;
  useCase: string;
}

const initialSignUpData: SignUpData = {
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  organization: '',
  role: '',
  useCase: '',
};

export function AuthForm() {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUpData, setSignUpData] = useState<SignUpData>(initialSignUpData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Validation
    if (signUpData.password !== signUpData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (signUpData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    const { error } = await signUp(signUpData.email, signUpData.password, {
      full_name: signUpData.fullName,
      organization: signUpData.organization,
      role: signUpData.role,
      use_case: signUpData.useCase,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for the confirmation link!');
    }

    setLoading(false);
  };

  const handleOAuthLogin = async (provider: 'google') => {
    setLoading(true);
    setError(null);

    const { error } = await signInWithOAuth(provider);

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const updateSignUpData = (field: keyof SignUpData, value: string) => {
    setSignUpData(prev => ({ ...prev, [field]: value }));
  };

  // Sign In Form
  if (mode === 'login') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">
                Semantic Network Analyzer
              </h1>
              <p className="text-gray-500 mt-2">
                Sign in to your account
              </p>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-gray-700">Continue with Google</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Toggle Mode */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setError(null); }}
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sign Up Form - More professional with additional fields
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gray-900 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">
              Create Your Account
            </h1>
            <p className="text-gray-400 mt-1">
              Join researchers and analysts using Semantic Network Analyzer
            </p>
          </div>

          <div className="p-8">
            {/* Benefits */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-1">📊</div>
                <div className="text-xs text-gray-600">Advanced Analytics</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-1">🔗</div>
                <div className="text-xs text-gray-600">Network Visualization</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-1">🤖</div>
                <div className="text-xs text-gray-600">AI-Powered Insights</div>
              </div>
            </div>

            {/* OAuth Option */}
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 mb-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-gray-700 font-medium">Sign up with Google</span>
            </button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-500">Or register with email</span>
              </div>
            </div>

            {/* Sign Up Form */}
            <form onSubmit={handleSignUpSubmit} className="space-y-5">
              {/* Personal Information Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={signUpData.fullName}
                      onChange={(e) => updateSignUpData('fullName', e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="signupEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="signupEmail"
                      type="email"
                      value={signUpData.email}
                      onChange={(e) => updateSignUpData('email', e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Professional Information Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Professional Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">
                      Organization / Institution
                    </label>
                    <input
                      id="organization"
                      type="text"
                      value={signUpData.organization}
                      onChange={(e) => updateSignUpData('organization', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="University / Company"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                      Role / Position
                    </label>
                    <select
                      id="role"
                      value={signUpData.role}
                      onChange={(e) => updateSignUpData('role', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select your role</option>
                      <option value="researcher">Researcher</option>
                      <option value="professor">Professor / Academic</option>
                      <option value="student">Student (Graduate/PhD)</option>
                      <option value="data_scientist">Data Scientist</option>
                      <option value="analyst">Research Analyst</option>
                      <option value="consultant">Consultant</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Use Case */}
              <div>
                <label htmlFor="useCase" className="block text-sm font-medium text-gray-700 mb-1">
                  How do you plan to use this tool?
                </label>
                <textarea
                  id="useCase"
                  value={signUpData.useCase}
                  onChange={(e) => updateSignUpData('useCase', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="e.g., Analyzing qualitative research data, studying social media discourse..."
                />
              </div>

              {/* Password Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Security
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="signupPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="signupPassword"
                      type="password"
                      value={signUpData.password}
                      onChange={(e) => updateSignUpData('password', e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Min. 8 characters"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={signUpData.confirmPassword}
                      onChange={(e) => updateSignUpData('confirmPassword', e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {message && (
                <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                  <div className="font-medium">Almost there!</div>
                  <div className="text-sm mt-1">{message}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-500 to-purple-600 text-white font-semibold rounded-lg hover:from-primary-600 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            {/* Toggle Mode */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
