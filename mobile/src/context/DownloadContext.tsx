import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { DownloadItem } from '../types';

interface DownloadContextType {
  downloads: DownloadItem[];
  downloadFile: (url: string, filename: string, type: 'video' | 'pdf', batchName?: string) => Promise<string | null>;
  removeDownload: (id: string) => Promise<void>;
  isDownloaded: (id: string) => boolean;
  openOrShareFile: (fileUri: string) => Promise<void>;
  downloadingId: string | null;
  downloadProgress: number;
}

const DownloadContext = createContext<DownloadContextType>({
  downloads: [],
  downloadFile: async () => null,
  removeDownload: async () => {},
  isDownloaded: () => false,
  openOrShareFile: async () => {},
  downloadingId: null,
  downloadProgress: 0,
});

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      const data = await AsyncStorage.getItem('pwpro_downloads');
      if (data) {
        setDownloads(JSON.parse(data));
      }
    } catch (e) {
      console.error('Failed to load downloads', e);
    }
  };

  const isDownloaded = (id: string) => {
    return downloads.some((d) => d.id === id);
  };

  const downloadFile = async (
    url: string,
    filename: string,
    type: 'video' | 'pdf',
    batchName?: string
  ): Promise<string | null> => {
    try {
      const sanitizedName = filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const safeFilename = sanitizedName.endsWith('.pdf') || sanitizedName.endsWith('.mp4')
        ? sanitizedName
        : `${sanitizedName}.${type === 'pdf' ? 'pdf' : 'mp4'}`;

      const targetDir = `${FileSystem.documentDirectory}downloads/`;
      const dirInfo = await FileSystem.getInfoAsync(targetDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
      }

      const fileUri = `${targetDir}${safeFilename}`;
      setDownloadingId(safeFilename);
      setDownloadProgress(0);

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {},
        (downloadProgressData) => {
          const progress =
            downloadProgressData.totalBytesWritten /
            (downloadProgressData.totalBytesExpectedToWrite || 1);
          setDownloadProgress(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        const newItem: DownloadItem = {
          id: safeFilename,
          title: filename,
          fileUri: result.uri,
          type,
          fileSize: fileInfo.exists ? (fileInfo as any).size : 0,
          dateDownloaded: Date.now(),
          batchName,
        };

        const updated = [newItem, ...downloads.filter((d) => d.id !== safeFilename)];
        setDownloads(updated);
        await AsyncStorage.setItem('pwpro_downloads', JSON.stringify(updated));
        Alert.alert('Download Complete', `${filename} saved successfully!`);
        return result.uri;
      }
      return null;
    } catch (error: any) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', error?.message || 'Unable to download file');
      return null;
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const removeDownload = async (id: string) => {
    try {
      const item = downloads.find((d) => d.id === id);
      if (item && item.fileUri) {
        await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
      }
      const updated = downloads.filter((d) => d.id !== id);
      setDownloads(updated);
      await AsyncStorage.setItem('pwpro_downloads', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to remove download', e);
    }
  };

  const openOrShareFile = async (fileUri: string) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to open file');
    }
  };

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        downloadFile,
        removeDownload,
        isDownloaded,
        openOrShareFile,
        downloadingId,
        downloadProgress,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloads = () => useContext(DownloadContext);
