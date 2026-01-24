/**
 * Subscription context for managing user tier, limits, and usage
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { UserProfile, TierLimits, SubscriptionTier, UsageStatus, AllTierLimits } from '../types';
import api from '../utils/api';

interface SubscriptionContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  tier: SubscriptionTier;
  limits: TierLimits | null;
  allTierLimits: AllTierLimits | null;
  // Usage status
  analysisStatus: UsageStatus | null;
  chatStatus: UsageStatus | null;
  // Feature checks
  isFeatureEnabled: (feature: keyof TierLimits) => boolean;
  canAnalyze: () => boolean;
  canChat: () => boolean;
  canExport: () => boolean;
  canUseSemantic: () => boolean;
  canSaveAnalyses: () => boolean;
  getMaxGroups: () => number;
  // Refresh
  refreshProfile: () => Promise<void>;
  // Upgrade modal
  showUpgradeModal: boolean;
  upgradeReason: string | null;
  openUpgradeModal: (reason: string) => void;
  closeUpgradeModal: () => void;
}

const defaultLimits: TierLimits = {
  max_groups: 1,
  max_analyses_per_day: 3,
  max_words: 100,
  max_file_size_mb: 5,
  semantic_enabled: false,
  chat_enabled: false,
  chat_messages_per_month: 0,
  export_enabled: false,
  save_analyses_days: 0,
  api_access: false,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allTierLimits, setAllTierLimits] = useState<AllTierLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  // Fetch user profile
  const refreshProfile = useCallback(async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user || !session) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.get<UserProfile>('/user/profile');
      setProfile(response.data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load subscription info');
      // Set default free tier profile on error
      setProfile({
        id: user.id,
        email: user.email || '',
        tier: 'free',
        limits: defaultLimits,
        usage: { analyses_today: 0, chat_messages_month: 0 },
        analysis_status: { allowed: true, tier: 'free' },
        chat_status: { allowed: false, tier: 'free' },
      });
    } finally {
      setLoading(false);
    }
  }, [user, session, authLoading]);

  // Fetch all tier limits for upgrade modal
  const fetchAllLimits = useCallback(async () => {
    if (authLoading || !session) return;

    try {
      const response = await api.get<AllTierLimits>('/user/limits');
      setAllTierLimits(response.data);
    } catch (err) {
      console.error('Failed to fetch tier limits:', err);
    }
  }, [session, authLoading]);

  // Fetch profile on auth change (only when auth is done loading)
  // TEMPORARILY DISABLED FOR DEBUGGING
  useEffect(() => {
    if (!authLoading && user && session) {
      // Add a delay to ensure session is fully established
      const timer = setTimeout(() => {
        refreshProfile();
        fetchAllLimits();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, session, authLoading]); // removed callback deps to prevent loops

  // Derived values
  const tier = profile?.tier || 'free';
  const limits = profile?.limits || defaultLimits;
  const analysisStatus = profile?.analysis_status || null;
  const chatStatus = profile?.chat_status || null;

  // Feature checks
  const isFeatureEnabled = useCallback((feature: keyof TierLimits): boolean => {
    if (!limits) return false;
    const value = limits[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return value !== null;
  }, [limits]);

  const canAnalyze = useCallback((): boolean => {
    return analysisStatus?.allowed ?? true;
  }, [analysisStatus]);

  const canChat = useCallback((): boolean => {
    if (!limits?.chat_enabled) return false;
    return chatStatus?.allowed ?? false;
  }, [limits, chatStatus]);

  const canExport = useCallback((): boolean => {
    return limits?.export_enabled ?? false;
  }, [limits]);

  const canUseSemantic = useCallback((): boolean => {
    return limits?.semantic_enabled ?? false;
  }, [limits]);

  const canSaveAnalyses = useCallback((): boolean => {
    return (limits?.save_analyses_days ?? 0) > 0;
  }, [limits]);

  const getMaxGroups = useCallback((): number => {
    return limits?.max_groups ?? 1;
  }, [limits]);

  // Upgrade modal handlers
  const openUpgradeModal = useCallback((reason: string) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
    setUpgradeReason(null);
  }, []);

  const value: SubscriptionContextType = {
    profile,
    loading,
    error,
    tier,
    limits,
    allTierLimits,
    analysisStatus,
    chatStatus,
    isFeatureEnabled,
    canAnalyze,
    canChat,
    canExport,
    canUseSemantic,
    canSaveAnalyses,
    getMaxGroups,
    refreshProfile,
    showUpgradeModal,
    upgradeReason,
    openUpgradeModal,
    closeUpgradeModal,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
