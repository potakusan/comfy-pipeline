export interface ModelItem {
  fileName: string;
  name: string;
  size: number;
  mtime: string;
  thumbnail: string | null;
  trainedWords?: string[];
  civitaiModelId?: number;
}

export interface DownloadJobStatus {
  id: string;
  status: 'pending' | 'downloading' | 'done' | 'error';
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  fileName: string;
  modelName: string;
  error?: string;
}

export type SortKey = 'mtime' | 'az' | 'za';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function sortItems(items: ModelItem[], key: SortKey): ModelItem[] {
  return [...items].sort((a, b) => {
    if (key === 'az') return a.name.localeCompare(b.name);
    if (key === 'za') return b.name.localeCompare(a.name);
    return b.mtime.localeCompare(a.mtime); // newest first
  });
}
