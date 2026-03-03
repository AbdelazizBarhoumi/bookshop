// Electron API exposed via preload
export interface ElectronAPI {
  showNotification: (title: string, body: string) => Promise<void>;
  backupData: (jsonData: string) => Promise<{ success: boolean; path?: string }>;
  autoBackup: (jsonData: string) => Promise<{ success: boolean; path?: string }>;
  restoreData: () => Promise<{ success: boolean; data?: string }>;
  exportFile: (content: string | ArrayBuffer, defaultName: string, filterName: string, extension: string) => Promise<{ success: boolean; path?: string }>;
  importCSV: () => Promise<{ success: boolean; data?: string }>;
  printReceipt: (htmlContent: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
