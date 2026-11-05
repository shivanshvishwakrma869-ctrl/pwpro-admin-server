import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../context/BookmarkContext';
import { useDownloads } from '../context/DownloadContext';
import { getTopicLectures, getStreamUrl } from '../services/api';
import { Lecture } from '../types';

export default function TopicScreen({ route, navigation }: any) {
  const { batchId, batchName, subjectId, subjectName, topicId, topicName } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const { downloadFile, isDownloaded } = useDownloads();

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLectures();
  }, [batchId, subjectId, topicId]);

  const loadLectures = async () => {
    try {
      const data = await getTopicLectures(batchId, subjectId, topicId);
      setLectures(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookmark = (item: Lecture) => {
    const lectureId = item._id || item.scheduleId || item.videoId || '';
    if (isBookmarked(lectureId)) {
      removeBookmark(lectureId);
    } else {
      addBookmark({
        id: lectureId,
        title: item.title,
        batchId,
        batchName,
        subjectId,
        subjectName,
        topicId,
        videoId: item.videoId || '',
        scheduleId: item.scheduleId,
        thumbnail: item.videoDetails?.image,
        timestamp: Date.now(),
      });
    }
  };

  const handleDownloadVideo = (item: Lecture) => {
    const streamUrl = getStreamUrl({
      videoId: item.videoId,
      scheduleId: item.scheduleId,
      batchId,
      subjectId,
      topicId,
      title: item.title,
    });
    downloadFile(streamUrl, item.title, 'video', batchName);
  };

  const renderLectureItem = ({ item, index }: { item: Lecture; index: number }) => {
    const lectureId = item._id || item.scheduleId || item.videoId || '';
    const bookmarked = isBookmarked(lectureId);
    const downloaded = isDownloaded(item.title);

    return (
      <Pressable
        style={[
          styles.lectureCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
        onPress={() =>
          navigation.navigate('Player', {
            batchId,
            batchName,
            subjectId,
            subjectName,
            topicId,
            lecture: item,
          })
        }
      >
        <View style={styles.cardHeader}>
          <View style={[styles.indexCircle, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.indexText, { color: colors.accentText }]}>
              {index + 1}
            </Text>
          </View>
          <View style={styles.titleWrap}>
            <Text style={[styles.lectureTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.lectureMetaRow}>
              <Text style={[styles.lectureTeacher, { color: colors.textSecondary }]}>
                👨‍🏫 {item.teacher || 'Physics Wallah'}
              </Text>
              {item.duration ? (
                <Text style={[styles.lectureDuration, { color: colors.textSecondary }]}>
                  ⏱️ {item.duration}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Action Row */}
        <View style={[styles.actionRow, { borderTopColor: colors.cardBorder }]}>
          <Pressable
            style={[styles.playBtn, { backgroundColor: colors.accent }]}
            onPress={() =>
              navigation.navigate('Player', {
                batchId,
                batchName,
                subjectId,
                subjectName,
                topicId,
                lecture: item,
              })
            }
          >
            <Ionicons name="play" size={15} color="#000" />
            <Text style={styles.playBtnText}>Watch Lecture</Text>
          </Pressable>

          <View style={styles.secondaryActions}>
            <Pressable
              style={[
                styles.iconActionBtn,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
              onPress={() => handleToggleBookmark(item)}
            >
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={bookmarked ? colors.accent : colors.textSecondary}
              />
            </Pressable>

            <Pressable
              style={[
                styles.iconActionBtn,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
              onPress={() => handleDownloadVideo(item)}
            >
              <Ionicons
                name={downloaded ? 'checkmark-circle' : 'download-outline'}
                size={18}
                color={downloaded ? colors.accent : colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.topicHeaderTitle, { color: colors.text }]} numberOfLines={1}>
            {topicName || 'Lectures'}
          </Text>
          <Text style={[styles.topicHeaderSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {subjectName} • {batchName}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Fetching lectures...
          </Text>
        </View>
      ) : (
        <FlatList
          data={lectures}
          keyExtractor={(item, index) => item._id || item.scheduleId || `${index}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderLectureItem}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="videocam-off-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No video lectures published for this chapter yet.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleWrap: {
    flex: 1,
  },
  topicHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topicHeaderSub: {
    fontSize: 12,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  lectureCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  indexCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 13,
    fontWeight: '700',
  },
  titleWrap: {
    flex: 1,
  },
  lectureTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  lectureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  lectureTeacher: {
    fontSize: 11,
  },
  lectureDuration: {
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  playBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
});
