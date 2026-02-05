import { useState, useRef } from 'react';
import { Plus, Trash2, Crown, Info, Download, FileSpreadsheet } from 'lucide-react';
import type { AnalysisConfig, GroupConfig } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Tooltip } from './Tooltip';

const PRESETS_KEY = 'sna-config-presets';

interface ConfigPreset {
  name: string;
  config: AnalysisConfig;
}

function loadPresets(): ConfigPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePresets(presets: ConfigPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

interface ConfigPanelProps {
  config: AnalysisConfig;
  onChange: (config: AnalysisConfig) => void;
  onGroupConfigChange?: (index: number, changes: Partial<GroupConfig>) => void;
}

export function ConfigPanel({ config, onChange, onGroupConfigChange }: ConfigPanelProps) {
  const { canUseSemantic, openUpgradeModal } = useSubscription();
  const [newMappingSource, setNewMappingSource] = useState('');
  const [newMappingTarget, setNewMappingTarget] = useState('');
  const [newDeleteWord, setNewDeleteWord] = useState('');
  const [bulkDeleteText, setBulkDeleteText] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<ConfigPreset[]>(loadPresets);
  const [mappingFileStatus, setMappingFileStatus] = useState('');
  const mappingFileRef = useRef<HTMLInputElement>(null);

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

  // Bulk paste words for deletion
  const handleBulkPaste = () => {
    if (!bulkDeleteText.trim()) return;
    const words = bulkDeleteText
      .split(/[,\n]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);
    const unique = [...new Set([...config.deleteWords, ...words])];
    handleChange('deleteWords', unique);
    setBulkDeleteText('');
  };

  // Save config preset
  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const newPreset: ConfigPreset = { name: presetName.trim(), config: { ...config } };
    const updated = [...presets.filter(p => p.name !== newPreset.name), newPreset];
    setPresets(updated);
    savePresets(updated);
    setPresetName('');
  };

  // Load config preset
  const handleLoadPreset = (preset: ConfigPreset) => {
    onChange({ ...preset.config });
  };

  // Delete config preset
  const handleDeletePreset = (name: string) => {
    const updated = presets.filter(p => p.name !== name);
    setPresets(updated);
    savePresets(updated);
  };

  const handleDownloadExampleMappings = () => {
    const csv = 'source,target\ncollaborate,collaboration\nteaching,teach\nlearning,learn\nhappy,happiness\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word_mappings_example.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload Excel/CSV for word mappings
  const handleMappingFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        const newMappings: Record<string, string> = { ...config.wordMappings };
        let count = 0;

        // Skip header if it looks like one
        const startIdx = lines[0]?.match(/source|from|original/i) ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
          const sep = lines[i].includes('\t') ? '\t' : ',';
          const parts = lines[i].split(sep).map(s => s.trim().toLowerCase().replace(/^["']|["']$/g, ''));
          if (parts.length >= 2 && parts[0] && parts[1]) {
            newMappings[parts[0]] = parts[1];
            count++;
          }
        }

        handleChange('wordMappings', newMappings);
        setMappingFileStatus(`Loaded ${count} mappings from file`);
        setTimeout(() => setMappingFileStatus(''), 3000);
      } catch {
        setMappingFileStatus('Error parsing file');
        setTimeout(() => setMappingFileStatus(''), 3000);
      }
    };

    if (ext === 'xlsx' || ext === 'xls') {
      setMappingFileStatus('Excel files: use CSV/TSV export instead');
      setTimeout(() => setMappingFileStatus(''), 3000);
    } else {
      reader.readAsText(file);
    }

    // Reset file input
    if (mappingFileRef.current) mappingFileRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Group Settings */}
      <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Group Settings</h3>
            <div className="space-y-4">
              {config.groups.map((group, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Group {index + 1} Name
                      <Tooltip content="Name used to identify this group in the analysis results">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </Tooltip>
                    </label>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => onGroupConfigChange?.(index, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Text Column
                      <Tooltip content="0-indexed column number containing the text data in your file">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={group.textColumn}
                      onChange={(e) => onGroupConfigChange?.(index, { textColumn: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Min Score %
                      <Tooltip content="Minimum normalized percentage score for this group to include a word">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={group.minScoreThreshold}
                      onChange={(e) => onGroupConfigChange?.(index, { minScoreThreshold: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Config Presets */}
          <div className="pt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Config Presets</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Preset name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 text-sm disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {presets.map(p => (
                  <div key={p.name} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100">
                    <button
                      onClick={() => handleLoadPreset(p)}
                      className="hover:text-primary-600 dark:hover:text-primary-400"
                      title="Load preset"
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() => handleDeletePreset(p.name)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {presets.length === 0 && (
              <span className="text-sm text-gray-400 dark:text-gray-500">No presets saved</span>
            )}
          </div>


          {/* Word Mappings */}
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Word Mappings
              <Tooltip content="Combine word variants into a single form for cleaner analysis">
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </Tooltip>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Map word variants to a unified form (e.g., "collaborate" → "collaboration")
            </p>
            
            {/* Add new mapping */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Source word"
                value={newMappingSource}
                onChange={(e) => setNewMappingSource(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
              <span className="py-2 text-gray-500 dark:text-gray-400">→</span>
              <input
                type="text"
                placeholder="Target word"
                value={newMappingTarget}
                onChange={(e) => setNewMappingTarget(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
              <button
                onClick={addMapping}
                className="px-3 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Upload mappings from file */}
            <div className="flex items-center gap-2 mb-3">
              <input
                ref={mappingFileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleMappingFileUpload}
                className="hidden"
              />
              <button
                onClick={() => mappingFileRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Upload CSV/TSV
              </button>
              <button
                onClick={handleDownloadExampleMappings}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-3.5 h-3.5" />
                Download Example
              </button>
              {mappingFileStatus && (
                <span className="text-xs text-green-600 dark:text-green-400">{mappingFileStatus}</span>
              )}
            </div>

            {/* Current mappings */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(config.wordMappings).map(([source, target]) => (
                <div
                  key={source}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                >
                  <span>{source}</span>
                  <span className="text-gray-400 dark:text-gray-500">→</span>
                  <span className="font-medium">{target}</span>
                  <button
                    onClick={() => removeMapping(source)}
                    className="ml-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {Object.keys(config.wordMappings).length === 0 && (
                <span className="text-sm text-gray-400 dark:text-gray-500">No mappings added</span>
              )}
            </div>
          </div>

          {/* Delete Words */}
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Words to Delete
              <Tooltip content="Additional words to exclude beyond the default stop words">
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </Tooltip>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              />
              <button
                onClick={addDeleteWord}
                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Bulk paste */}
            <div className="mb-3">
              <textarea
                placeholder="Paste words (one per line or comma-separated)"
                value={bulkDeleteText}
                onChange={(e) => setBulkDeleteText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm h-20 resize-y"
              />
              <button
                onClick={handleBulkPaste}
                disabled={!bulkDeleteText.trim()}
                className="mt-1 px-3 py-1.5 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 disabled:opacity-50"
              >
                Add All
              </button>
            </div>

            {/* Current delete words */}
            <div className="flex flex-wrap gap-2">
              {config.deleteWords.map((word) => (
                <div
                  key={word}
                  className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-sm"
                >
                  <span>{word}</span>
                  <button
                    onClick={() => removeDeleteWord(word)}
                    className="ml-1 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {config.deleteWords.length === 0 && (
                <span className="text-sm text-gray-400 dark:text-gray-500">No words to delete</span>
              )}
            </div>
          </div>

          {/* Semantic Analysis */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Semantic Analysis
                <Tooltip content="AI-powered analysis finding words with similar meaning">
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                </Tooltip>
              </h3>
              {!semanticEnabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                  <Crown className="w-3 h-3" />
                  Pro
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Use AI embeddings to find semantically related words (e.g., "happy" ↔ "joyful")
            </p>

            {!semanticEnabled ? (
              <div className="p-4 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Crown className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Semantic Analysis is a Pro Feature</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Upgrade to find semantically related words like "happy" and "joyful"</p>
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">Enable Semantic Similarity</span>
                  </label>
                </div>
                {config.useSemantic && (
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Similarity Threshold (0-1)
                      <Tooltip content="How similar words must be to create a semantic edge (higher = stricter)">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.semanticThreshold}
                      onChange={(e) => handleChange('semanticThreshold', parseFloat(e.target.value) || 0.5)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Higher = stricter matching
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Advanced Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Min Frequency
                  <Tooltip content="Minimum number of times a word must appear to be included">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                  </Tooltip>
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.minFrequency}
                  onChange={(e) => handleChange('minFrequency', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Clustering Method
                  <Tooltip content="Algorithm for grouping related words into communities">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                  </Tooltip>
                </label>
                <select
                  value={config.clusterMethod}
                  onChange={(e) => handleChange('clusterMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                  <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                    Unify Plurals
                    <Tooltip content="Merge singular and plural forms of the same word">
                      <Info className="w-3.5 h-3.5 text-gray-400" />
                    </Tooltip>
                  </span>
                </label>
              </div>
            </div>
          </div>
    </div>
  );
}
