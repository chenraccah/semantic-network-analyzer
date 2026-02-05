export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="text-center space-y-2">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto w-16 animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mx-auto w-20 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 8, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4 animate-pulse" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
