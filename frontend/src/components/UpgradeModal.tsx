/**
 * Upgrade modal showing pricing tiers and feature comparison
 */

import { useState } from 'react';
import { X, Check, Zap, Building2, Loader2 } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import api from '../utils/api';
import type { SubscriptionTier } from '../types';

interface TierFeature {
  key: string;
  label: string;
  format: (v: any) => string | number | boolean;
}

const TIER_FEATURES: TierFeature[] = [
  { key: 'max_groups', label: 'Groups per analysis', format: (v) => v === null ? 'Unlimited' : v },
  { key: 'max_analyses_per_day', label: 'Analyses per day', format: (v) => v === null ? 'Unlimited' : v },
  { key: 'max_words', label: 'Word limit', format: (v) => v === null ? 'Unlimited' : v },
  { key: 'max_file_size_mb', label: 'Max file size', format: (v) => `${v} MB` },
  { key: 'semantic_enabled', label: 'Semantic edges', format: (v) => v },
  { key: 'chat_enabled', label: 'GPT chat', format: (v) => v },
  { key: 'chat_messages_per_month', label: 'Chat messages/month', format: (v) => v === null ? 'Unlimited' : v === 0 ? '-' : v },
  { key: 'export_enabled', label: 'CSV export', format: (v) => v },
  { key: 'save_analyses_days', label: 'Save analyses', format: (v) => v === 0 ? '-' : `${v} days` },
  { key: 'api_access', label: 'API access', format: (v) => v },
];

const TIER_ORDER: SubscriptionTier[] = ['free', 'pro', 'enterprise'];

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const { tier: currentTier, allTierLimits, upgradeReason, refreshProfile } = useSubscription();
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === currentTier) return;

    setLoading(tier);
    setError(null);

    try {
      // Directly update tier (no payment for now)
      await api.post('/billing/update-tier', { tier });

      // Refresh profile to get new tier
      await refreshProfile();

      // Close modal on success
      onClose();
    } catch (err: any) {
      console.error('Upgrade error:', err);
      setError(err.response?.data?.detail || 'Failed to update plan. Please try again.');
      setLoading(null);
    }
  };

  const renderFeatureValue = (value: boolean | number | string | null) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-5 h-5 text-green-500 mx-auto" />
      ) : (
        <span className="text-gray-300">-</span>
      );
    }
    return <span className="font-medium">{value}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h2>
            {upgradeReason && (
              <p className="text-sm text-gray-500 mt-1">{upgradeReason}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {TIER_ORDER.map((tier) => {
              const pricing = allTierLimits?.pricing[tier];
              const limits = allTierLimits?.tiers[tier];
              const isCurrentTier = tier === currentTier;
              const isPopular = tier === 'pro';

              return (
                <div
                  key={tier}
                  className={`relative rounded-xl border-2 p-6 ${
                    isPopular
                      ? 'border-primary-500 shadow-lg'
                      : isCurrentTier
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {isCurrentTier && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                      {tier === 'free' && <Zap className="w-6 h-6 text-gray-600" />}
                      {tier === 'pro' && <Zap className="w-6 h-6 text-primary-600" />}
                      {tier === 'enterprise' && <Building2 className="w-6 h-6 text-purple-600" />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {pricing?.name || tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{pricing?.description}</p>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-gray-900">
                        {pricing?.price === 0 ? 'Free' : `$${pricing?.price}`}
                      </span>
                      {pricing?.price !== 0 && (
                        <span className="text-gray-500">/month</span>
                      )}
                    </div>
                  </div>

                  {/* Key features */}
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{limits?.max_groups === 5 ? 'Up to 5' : limits?.max_groups} group(s) per analysis</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>
                        {limits?.max_analyses_per_day === null
                          ? 'Unlimited analyses'
                          : `${limits?.max_analyses_per_day} analyses/day`}
                      </span>
                    </li>
                    {limits?.semantic_enabled && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>Semantic similarity edges</span>
                      </li>
                    )}
                    {limits?.chat_enabled && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>
                          {limits?.chat_messages_per_month === null
                            ? 'Unlimited GPT chat'
                            : `${limits?.chat_messages_per_month} chat messages/month`}
                        </span>
                      </li>
                    )}
                    {limits?.export_enabled && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>CSV export</span>
                      </li>
                    )}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(tier)}
                    disabled={isCurrentTier || loading !== null}
                    className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                      isCurrentTier
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : loading === tier
                        ? 'bg-primary-400 text-white cursor-wait'
                        : isPopular
                        ? 'bg-primary-500 text-white hover:bg-primary-600'
                        : tier === 'free'
                        ? 'bg-gray-500 text-white hover:bg-gray-600'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {loading === tier && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isCurrentTier ? 'Current Plan' : loading === tier ? 'Updating...' : tier === 'free' ? 'Downgrade' : 'Upgrade'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Feature Comparison Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Feature</th>
                  {TIER_ORDER.map((tier) => (
                    <th
                      key={tier}
                      className={`px-4 py-3 text-center text-sm font-semibold ${
                        tier === currentTier ? 'bg-green-100 text-green-900' : 'text-gray-900'
                      }`}
                    >
                      {allTierLimits?.pricing[tier]?.name || tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {TIER_FEATURES.map((feature) => (
                  <tr key={feature.key}>
                    <td className="px-4 py-3 text-sm text-gray-700">{feature.label}</td>
                    {TIER_ORDER.map((tier) => {
                      const limits = allTierLimits?.tiers[tier];
                      const value = limits?.[feature.key as keyof typeof limits];
                      const formattedValue = feature.format(value as any);

                      return (
                        <td
                          key={tier}
                          className={`px-4 py-3 text-sm text-center ${
                            tier === currentTier ? 'bg-green-50' : ''
                          }`}
                        >
                          {renderFeatureValue(formattedValue)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-sm text-gray-500 mt-6">
            All plans include secure authentication and data encryption.
            Questions? Contact support@example.com
          </p>
        </div>
      </div>
    </div>
  );
}
