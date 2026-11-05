import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../context/BookmarkContext';
import { Bookmark } from '../types';

export default function BookmarksScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { bookmarks, removeBookmark } = useBookmarks();

  const renderItem = ({ item }: { item: Bookmark }) => (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
      onPress={() =>
        navigation.navigate('Player', {
          batchId: item.batchId,
          batchName: item.batchName,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          topicId: item.topicId,
          lecture: {
            _id: item.id,
            title: item.title,
            videoId: item.videoId,
            scheduleId: item.scheduleId,
          },
        })
      }
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accentLight }]}>
        <Ionicons name="play" size={20} color={colors.accentText} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.subjectName ? `${item.subjectName} • ` : ''}
          {item.batchName || 'Physics Wallah'}
        </Text>
      </View>
      <Pressable
        style={styles.deleteBtn}
        onPress={() => removeBookmark(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </Pressable>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Bookmarked Lectures ({bookmarks.length})
        </Text>
      </View>

      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={54} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Bookmarks Saved</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Bookmark lectures while browsing to watch them quickly anytime.
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
  sub: {
    fontSize: 12,
    marginTop: 4,
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
