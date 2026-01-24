/**
 * Analysis history panel for viewing and loading saved analyses
 */

import { useState, useEffect } from 'react';
import { History, Trash2, Download, Loader2, Clock, Crown, X } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  getSavedAnalyses,
  getSavedAnalysis,
  deleteSavedAnalysis,
  checkSaveAccess,
  type SavedAnalysisSummary
} from '../utils/api';

interface AnalysisHistoryProps {
  onLoad: (config: any, results: any) => void;
  onClose: () => void;
}

export function AnalysisHistory({ onLoad, onClose }: AnalysisHistoryProps) {
  const { tier, openUpgradeModal } = useSubscription();

  const [analyses, setAnalyses] = useState<SavedAnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(false);

  // Fetch saved analyses on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user can save
        const saveCheck = await checkSaveAccess();
        setCanSave(saveCheck.allowed);

        if (saveCheck.allowed) {
          const result = await getSavedAnalyses();
          setAnalyses(result.analyses);
        }
      } catch (err: any) {
        console.error('Error fetching analyses:', err);
        if (err.response?.status === 403) {
          setCanSave(false);
        } else {
          setError('Failed to load saved analyses');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLoad = async (id: string) => {
    try {
      setLoadingId(id);
      setError(null);

      const analysis = await getSavedAnalysis(id);
      onLoad(analysis.config, analysis.results);
      onClose();
    } catch (err: any) {
      console.error('Error loading analysis:', err);
      setError('Failed to load analysis');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved analysis?')) {
      return;
    }

    try {
      setDeletingId(id);
      setError(null);

      await deleteSavedAnalysis(id);
      setAnalyses(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      console.error('Error deleting analysis:', err);
      setError('Failed to delete analysis');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getExpiresIn = (expiresAt: string | null) => {
    if (!expiresAt) return null;

    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-primary-500" />
            <h2 className="text-xl font-bold text-gray-900">Saved Analyses</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : !canSave ? (
            <div className="text-center py-12">
              <Crown className="w-12 h-12 text-primary-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Pro Feature
              </h3>
              <p className="text-gray-500 mb-4">
                Saving analyses requires a Pro or Enterprise subscription.
              </p>
              <button
                onClick={() => {
                  onClose();
                  openUpgradeModal('Upgrade to save your analyses');
                }}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Saved Analyses
              </h3>
              <p className="text-gray-500">
                Run an analysis and save it to see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="border rounded-lg p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {analysis.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{formatDate(analysis.created_at)}</span>
                        {analysis.expires_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getExpiresIn(analysis.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleLoad(analysis.id)}
                        disabled={loadingId !== null || deletingId !== null}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                      >
                        {loadingId === analysis.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Load
                      </button>
                      <button
                        onClick={() => handleDelete(analysis.id)}
                        disabled={loadingId !== null || deletingId !== null}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === analysis.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {canSave && analyses.length > 0 && (
          <div className="px-6 py-3 border-t bg-gray-50 text-center text-sm text-gray-500">
            {tier === 'pro' && 'Analyses are saved for 7 days'}
            {tier === 'enterprise' && 'Analyses are saved for 90 days'}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Save analysis dialog
 */
interface SaveAnalysisDialogProps {
  onSave: (name: string) => void;
  onClose: () => void;
  saving: boolean;
}

export function SaveAnalysisDialog({ onSave, onClose, saving }: SaveAnalysisDialogProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Save Analysis</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Analysis Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Analysis"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
              disabled={saving}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
