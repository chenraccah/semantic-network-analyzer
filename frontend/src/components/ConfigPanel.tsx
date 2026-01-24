import { useState } from 'react';
import { Settings, Plus, Trash2, ChevronDown, ChevronUp, Crown } from 'lucide-react';
import type { AnalysisConfig, GroupConfig } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';

interface ConfigPanelProps {
  config: AnalysisConfig;
  onChange: (config: AnalysisConfig) => void;
  onGroupConfigChange?: (index: number, changes: Partial<GroupConfig>) => void;
}

export function ConfigPanel({ config, onChange, onGroupConfigChange }: ConfigPanelProps) {
  const { canUseSemantic, openUpgradeModal, tier } = useSubscription();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newMappingSource, setNewMappingSource] = useState('');
  const [newMappingTarget, setNewMappingTarget] = useState('');
  const [newDeleteWord, setNewDeleteWord] = useState('');

  const semanticEnabled = canUseSemantic();

  const handleChange = (key: keyof AnalysisConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const addMapping = () => {
    if (newMappingSource && newMappingTarget) {
      handleChange('wordMappings', {
        ...config.wordMappings,
        [newMappingSource.toLowerCase()]: newMappingTarget.toLowerCase(),
      });
      setNewMappingSource('');
      setNewMappingTarget('');
    }
  };

  const removeMapping = (source: string) => {
    const newMappings = { ...config.wordMappings };
    delete newMappings[source];
    handleChange('wordMappings', newMappings);
  };

  const addDeleteWord = () => {
    if (newDeleteWord && !config.deleteWords.includes(newDeleteWord.toLowerCase())) {
      handleChange('deleteWords', [...config.deleteWords, newDeleteWord.toLowerCase()]);
      setNewDeleteWord('');
    }
  };

  const removeDeleteWord = (word: string) => {
    handleChange('deleteWords', config.deleteWords.filter(w => w !== word));
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-semibold">Configuration</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 border-t">
          {/* Group Settings */}
          <div className="pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Group Settings</h3>
            <div className="space-y-4">
              {config.groups.map((group, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Group {index + 1} Name</label>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => onGroupConfigChange?.(index, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{group.name} Text Column</label>
                    <input
                      type="number"
                      min="0"
                      value={group.textColumn}
                      onChange={(e) => onGroupConfigChange?.(index, { textColumn: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Basic Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Analysis Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Min Score Threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={config.minScoreThreshold}
                  onChange={(e) => handleChange('minScoreThreshold', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Word Mappings */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Word Mappings</h3>
            <p className="text-xs text-gray-500 mb-2">
              Map word variants to a unified form (e.g., "collaborate" → "collaboration")
            </p>
            
            {/* Add new mapping */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Source word"
                value={newMappingSource}
                onChange={(e) => setNewMappingSource(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <span className="py-2 text-gray-500">→</span>
              <input
                type="text"
                placeholder="Target word"
                value={newMappingTarget}
                onChange={(e) => setNewMappingTarget(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={addMapping}
                className="px-3 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Current mappings */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(config.wordMappings).map(([source, target]) => (
                <div
                  key={source}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                >
                  <span>{source}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{target}</span>
                  <button
                    onClick={() => removeMapping(source)}
                    className="ml-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {Object.keys(config.wordMappings).length === 0 && (
                <span className="text-sm text-gray-400">No mappings added</span>
              )}
            </div>
          </div>

          {/* Delete Words */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Words to Delete</h3>
            <p className="text-xs text-gray-500 mb-2">
              These words will be excluded from the analysis
            </p>
            
            {/* Add new word */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Word to delete"
                value={newDeleteWord}
                onChange={(e) => setNewDeleteWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addDeleteWord()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={addDeleteWord}
                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Current delete words */}
            <div className="flex flex-wrap gap-2">
              {config.deleteWords.map((word) => (
                <div
                  key={word}
                  className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-sm"
                >
                  <span>{word}</span>
                  <button
                    onClick={() => removeDeleteWord(word)}
                    className="ml-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {config.deleteWords.length === 0 && (
                <span className="text-sm text-gray-400">No words to delete</span>
              )}
            </div>
          </div>

          {/* Semantic Analysis */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-700">Semantic Analysis</h3>
              {!semanticEnabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                  <Crown className="w-3 h-3" />
                  Pro
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Use AI embeddings to find semantically related words (e.g., "happy" ↔ "joyful")
            </p>

            {!semanticEnabled ? (
              <div className="p-4 bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Crown className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Semantic Analysis is a Pro Feature</p>
                    <p className="text-xs text-gray-500">Upgrade to find semantically related words like "happy" and "joyful"</p>
                  </div>
                  <button
                    onClick={() => openUpgradeModal('Upgrade to Pro to unlock semantic analysis')}
                    className="px-3 py-1.5 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useSemantic}
                      onChange={(e) => handleChange('useSemantic', e.target.checked)}
                      className="rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600">Enable Semantic Similarity</span>
                  </label>
                </div>
                {config.useSemantic && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Similarity Threshold (0-1)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.semanticThreshold}
                      onChange={(e) => handleChange('semanticThreshold', parseFloat(e.target.value) || 0.5)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Higher = stricter matching
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Advanced Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Min Frequency</label>
                <input
                  type="number"
                  min="1"
                  value={config.minFrequency}
                  onChange={(e) => handleChange('minFrequency', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Clustering Method</label>
                <select
                  value={config.clusterMethod}
                  onChange={(e) => handleChange('clusterMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="louvain">Louvain</option>
                  <option value="spectral">Spectral</option>
                </select>
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.unifyPlurals}
                    onChange={(e) => handleChange('unifyPlurals', e.target.checked)}
                    className="rounded text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">Unify Plurals</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
