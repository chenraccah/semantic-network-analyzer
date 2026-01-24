/**
 * Billing page for subscription management
 */

import { useState } from 'react';
import { CreditCard, Zap, Building2, Check, Loader2 } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import api from '../utils/api';
import type { SubscriptionTier } from '../types';

interface BillingPageProps {
  onClose: () => void;
}

export function BillingPage({ onClose }: BillingPageProps) {
  const {
    tier,
    limits,
    allTierLimits,
    analysisStatus,
    chatStatus,
    refreshProfile
  } = useSubscription();

  const [upgradeLoading, setUpgradeLoading] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangeTier = async (targetTier: SubscriptionTier) => {
    if (targetTier === tier) return;

    setUpgradeLoading(targetTier);
    setError(null);

    try {
      await api.post('/billing/update-tier', { tier: targetTier });
      await refreshProfile();
      onClose();
    } catch (err: any) {
      console.error('Tier change error:', err);
      setError(err.response?.data?.detail || 'Failed to update plan. Please try again.');
      setUpgradeLoading(null);
    }
  };

  const pricing = allTierLimits?.pricing;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-primary-500" />
            <h2 className="text-xl font-bold text-gray-900">Billing & Subscription</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Plan */}
          <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Plan</p>
                <div className="flex items-center gap-2 mt-1">
                  {tier === 'enterprise' ? (
                    <Building2 className="w-6 h-6 text-purple-600" />
                  ) : (
                    <Zap className={`w-6 h-6 ${tier === 'pro' ? 'text-primary-600' : 'text-gray-600'}`} />
                  )}
                  <span className="text-2xl font-bold text-gray-900">
                    {pricing?.[tier]?.name || tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {pricing?.[tier]?.description}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {pricing?.[tier]?.price === 0 ? 'Free' : `$${pricing?.[tier]?.price}`}
                </p>
                {pricing?.[tier]?.price !== 0 && (
                  <p className="text-sm text-gray-500">per month</p>
                )}
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="border rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Usage This Period</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Analyses Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analysisStatus?.used ?? 0}
                  {analysisStatus?.limit && (
                    <span className="text-lg text-gray-500 font-normal">
                      {' '}/ {analysisStatus.limit}
                    </span>
                  )}
                  {!analysisStatus?.limit && tier !== 'free' && (
                    <span className="text-lg text-gray-500 font-normal"> / Unlimited</span>
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Chat Messages This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {chatStatus?.used ?? 0}
                  {chatStatus?.limit && (
                    <span className="text-lg text-gray-500 font-normal">
                      {' '}/ {chatStatus.limit}
                    </span>
                  )}
                  {!chatStatus?.limit && limits?.chat_enabled && (
                    <span className="text-lg text-gray-500 font-normal"> / Unlimited</span>
                  )}
                  {!limits?.chat_enabled && (
                    <span className="text-lg text-gray-500 font-normal"> (Not available)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Plan Features */}
          <div className="border rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Your Plan Features</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-700">
                  {limits?.max_groups} group(s) per analysis
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-700">
                  {limits?.max_analyses_per_day === null ? 'Unlimited' : limits?.max_analyses_per_day} analyses/day
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-700">
                  {limits?.max_words === null ? 'Unlimited' : limits?.max_words?.toLocaleString()} word limit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-700">
                  {limits?.max_file_size_mb} MB file size
                </span>
              </div>
              {limits?.semantic_enabled && (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-700">Semantic similarity</span>
                </div>
              )}
              {limits?.chat_enabled && (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-700">GPT chat analysis</span>
                </div>
              )}
              {limits?.export_enabled && (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-700">CSV export</span>
                </div>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {/* Change plan options */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleChangeTier('free')}
                disabled={tier === 'free' || upgradeLoading !== null}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  tier === 'free'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                {upgradeLoading === 'free' && <Loader2 className="w-4 h-4 animate-spin" />}
                {tier === 'free' ? 'Current' : 'Free'}
              </button>
              <button
                onClick={() => handleChangeTier('pro')}
                disabled={tier === 'pro' || upgradeLoading !== null}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  tier === 'pro'
                    ? 'bg-primary-100 text-primary-400 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                }`}
              >
                {upgradeLoading === 'pro' && <Loader2 className="w-4 h-4 animate-spin" />}
                {tier === 'pro' ? 'Current' : 'Pro'}
              </button>
              <button
                onClick={() => handleChangeTier('enterprise')}
                disabled={tier === 'enterprise' || upgradeLoading !== null}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  tier === 'enterprise'
                    ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {upgradeLoading === 'enterprise' && <Loader2 className="w-4 h-4 animate-spin" />}
                {tier === 'enterprise' ? 'Current' : 'Enterprise'}
              </button>
            </div>
            <p className="text-center text-xs text-gray-400">
              Payment integration coming soon. Tiers can be changed freely for now.
            </p>
          </div>

          {/* Help text */}
          <p className="text-center text-sm text-gray-500">
            Need help with billing? Contact support@example.com
          </p>
        </div>
      </div>
    </div>
  );
}
