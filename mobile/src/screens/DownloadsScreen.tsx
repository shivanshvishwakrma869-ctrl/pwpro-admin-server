import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useDownloads } from '../context/DownloadContext';
import { DownloadItem } from '../types';

export default function DownloadsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { downloads, removeDownload, openOrShareFile, downloadingId, downloadProgress } =
    useDownloads();

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const renderItem = ({ item }: { item: DownloadItem }) => {
    const isPdf = item.type === 'pdf';

    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
        onPress={() => {
          if (isPdf && navigation) {
            navigation.navigate('PdfViewer', {
              title: item.title,
              url: item.fileUri,
              isLocal: true,
            });
          } else {
            openOrShareFile(item.fileUri);
          }
        }}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: isPdf ? 'rgba(239, 68, 68, 0.15)' : colors.accentLight },
          ]}
        >
          <Ionicons
            name={isPdf ? 'document-text' : 'videocam'}
            size={22}
            color={isPdf ? '#ef4444' : colors.accentText}
          />
        </View>

        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
              {isPdf ? 'PDF Note' : 'Offline Video'}
            </Text>
            <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.sizeText, { color: colors.textSecondary }]}>
              {formatSize(item.fileSize)}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.deleteBtn}
          onPress={() => removeDownload(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Offline Downloads ({downloads.length})
        </Text>
      </View>

      {downloadingId && (
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.progressTitle, { color: colors.text }]}>
            Downloading: {downloadingId}
          </Text>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.inputBg }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round(downloadProgress * 100)}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
          <Text style={[styles.progressPercentage, { color: colors.accentText }]}>
            {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      )}

      <FlatList
        data={downloads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cloud-download-outline" size={54} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Offline Downloads</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Download PDF class notes and lectures to study offline without internet connection.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  progressCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
  },
  progressPercentage: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dot: {
    fontSize: 11,
  },
  sizeText: {
    fontSize: 11,
  },
  deleteBtn: {
    padding: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
