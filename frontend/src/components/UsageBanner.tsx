/**
 * Usage banner showing remaining analyses and upgrade CTA
 */

import { Zap, AlertTriangle, Crown } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';

export function UsageBanner() {
  const {
    tier,
    analysisStatus,
    chatStatus,
    limits,
    loading,
    openUpgradeModal
  } = useSubscription();

  if (loading) return null;

  // Don't show banner for unlimited tiers (enterprise)
  if (tier === 'enterprise') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">
        <Crown className="w-4 h-4" />
        <span className="font-medium">Enterprise</span>
      </div>
    );
  }

  const analysesRemaining = analysisStatus?.remaining;
  const analysesLimit = analysisStatus?.limit;
  const chatRemaining = chatStatus?.remaining;
  const chatLimit = chatStatus?.limit;

  // Determine warning state
  const isLow = analysesRemaining !== null && analysesRemaining !== undefined && analysesRemaining <= 1;
  const isExhausted = analysesRemaining !== null && analysesRemaining !== undefined && analysesRemaining === 0;

  return (
    <div className="flex items-center gap-3">
      {/* Tier Badge */}
      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
        tier === 'pro'
          ? 'bg-primary-100 text-primary-700'
          : 'bg-gray-100 text-gray-600'
      }`}>
        <Zap className="w-3 h-3" />
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </div>

      {/* Usage Info - Only show for free tier */}
      {tier === 'free' && analysesLimit !== null && analysesLimit !== undefined && (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${
          isExhausted
            ? 'bg-red-100 text-red-700'
            : isLow
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {isExhausted || isLow ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          <span>
            {isExhausted
              ? 'Daily limit reached'
              : `${analysesRemaining}/${analysesLimit} analyses left today`}
          </span>
        </div>
      )}

      {/* Chat usage for pro tier */}
      {tier === 'pro' && chatLimit !== null && chatLimit !== undefined && chatRemaining !== null && (
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
          <span>{chatRemaining}/{chatLimit} chats left</span>
        </div>
      )}

      {/* Upgrade Button */}
      {tier !== 'enterprise' && (
        <button
          onClick={() => openUpgradeModal('Unlock more features and higher limits')}
          className="px-3 py-1 bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-primary-600 hover:to-purple-600 transition-all"
        >
          Upgrade
        </button>
      )}
    </div>
  );
}

/**
 * Inline upgrade prompt for disabled features
 */
interface FeatureGateProps {
  feature: string;
  description: string;
  requiredTier?: 'pro' | 'enterprise';
}

export function FeatureGate({ feature, description, requiredTier = 'pro' }: FeatureGateProps) {
  const { openUpgradeModal } = useSubscription();

  return (
    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-lg">
      <div className="flex-shrink-0">
        <Crown className="w-5 h-5 text-primary-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{feature}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => openUpgradeModal(`Upgrade to ${requiredTier} to unlock ${feature}`)}
        className="flex-shrink-0 px-3 py-1.5 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 transition-colors"
      >
        Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
      </button>
    </div>
  );
}

/**
 * Small inline lock icon for disabled controls
 */
export function FeatureLock({ onClick }: { onClick?: () => void }) {
  const { openUpgradeModal } = useSubscription();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      openUpgradeModal('Upgrade to unlock this feature');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs hover:bg-gray-200 transition-colors"
      title="Pro feature - click to upgrade"
    >
      <Crown className="w-3 h-3" />
      Pro
    </button>
  );
}
