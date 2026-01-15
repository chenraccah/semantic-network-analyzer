import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import type { FileUploadProps } from '../types';

export function FileUpload({ label, onFileSelect, selectedFile }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
    },
    maxFiles: 1,
  });

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null as any);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${selectedFile ? 'has-file' : ''}`}
      >
        <input {...getInputProps()} />
        
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-green-600" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleClear}
              className="ml-4 p-1 rounded-full hover:bg-gray-200"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-10 h-10 mx-auto text-gray-400" />
            <p className="text-gray-600">
              {isDragActive ? (
                'Drop the file here...'
              ) : (
                <>
                  Drag & drop a file here, or <span className="text-primary-600">click to select</span>
                </>
              )}
            </p>
            <p className="text-xs text-gray-400">
              Supports: .xlsx, .xls, .csv, .tsv
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
