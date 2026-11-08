import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../context/BookmarkContext';
import { useDownloads } from '../context/DownloadContext';
import { getTopicLectures, getTopicNotes, getStreamUrl } from '../services/api';
import { Lecture, Attachment } from '../types';

export default function TopicScreen({ route, navigation }: any) {
  const { batchId, batchName, subjectId, subjectName, topicId, topicName, topicSlug } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const { downloadFile, isDownloaded } = useDownloads();

  const [activeTab, setActiveTab] = useState<'videos' | 'notes'>('videos');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [notes, setNotes] = useState<Attachment[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, [batchId, subjectId, topicId, topicSlug]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const [lecturesData, notesData] = await Promise.all([
        getTopicLectures(batchId, subjectId, topicId, topicSlug),
        getTopicNotes(batchId, subjectId, topicId, topicSlug),
      ]);
      setLectures(lecturesData);
      setNotes(notesData);

      // If topic has no videos but has notes (e.g. Mind Maps, Study Module), auto-switch to Notes tab
      if (lecturesData.length === 0 && notesData.length > 0) {
        setActiveTab('notes');
      }
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

  const handleDownloadPdf = (att: Attachment) => {
    if (!att.attachmentUrl) {
      Alert.alert('Unavailable', 'PDF download link is missing.');
      return;
    }
    downloadFile(att.attachmentUrl, att.name || 'Notes.pdf', 'pdf', batchName);
  };

  const handleOpenPdf = (att: Attachment) => {
    if (!att.attachmentUrl) {
      Alert.alert('Unavailable', 'PDF link is not available.');
      return;
    }
    navigation.navigate('PdfViewer', {
      title: att.name || 'Lecture Notes',
      url: att.attachmentUrl,
    });
  };

  const filteredLectures = lectures.filter((l) => {
    if (!searchQuery.trim()) return true;
    return (l.title || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    return (n.name || n.title || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

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

  const renderNoteItem = ({ item, index }: { item: Attachment; index: number }) => {
    return (
      <View
        style={[
          styles.lectureCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.indexCircle, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="document-text" size={16} color={colors.accentText} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={[styles.lectureTitle, { color: colors.text }]} numberOfLines={2}>
              {item.name || item.title || 'PDF Document'}
            </Text>
            <Text style={[styles.lectureTeacher, { color: colors.textSecondary, marginTop: 4 }]}>
              📄 Official PW Document
            </Text>
          </View>
        </View>

        <View style={[styles.actionRow, { borderTopColor: colors.cardBorder }]}>
          <Pressable
            style={[styles.playBtn, { backgroundColor: colors.accent }]}
            onPress={() => handleOpenPdf(item)}
          >
            <Ionicons name="eye-outline" size={15} color="#000" />
            <Text style={styles.playBtnText}>Read PDF</Text>
          </Pressable>

          <View style={styles.secondaryActions}>
            <Pressable
              style={[
                styles.iconActionBtn,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
              onPress={() => handleDownloadPdf(item)}
            >
              <Ionicons name="cloud-download-outline" size={18} color={colors.accent} />
            </Pressable>
          </View>
        </View>
      </View>
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

      {/* Tabs Row */}
      <View style={[styles.tabsBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
        <Pressable
          style={[
            styles.tabItem,
            activeTab === 'videos' && [styles.activeTab, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab('videos')}
        >
          <Ionicons
            name="videocam-outline"
            size={16}
            color={activeTab === 'videos' ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'videos' ? colors.accent : colors.textSecondary },
            ]}
          >
            Videos ({lectures.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            activeTab === 'notes' && [styles.activeTab, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab('notes')}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={activeTab === 'notes' ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'notes' ? colors.accent : colors.textSecondary },
            ]}
          >
            PDF Notes ({notes.length})
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchSection, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={activeTab === 'videos' ? 'Search video lectures by title...' : 'Search PDF notes...'}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Fetching curriculum...
          </Text>
        </View>
      ) : activeTab === 'videos' ? (
        <FlatList
          data={filteredLectures}
          keyExtractor={(item, index) => item._id || item.scheduleId || `${index}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          renderItem={renderLectureItem}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="videocam-off-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery.trim()
                  ? `No video lectures matching "${searchQuery}"`
                  : notes.length > 0
                  ? 'No video lectures in this folder. Tap "PDF Notes" above to view study materials.'
                  : 'No video lectures published for this chapter yet.'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item, index) => item._id || `${index}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          renderItem={renderNoteItem}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery.trim()
                  ? `No PDF notes matching "${searchQuery}"`
                  : 'No PDF notes available for this chapter yet.'}
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
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    // borderBottomColor set dynamically
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
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
