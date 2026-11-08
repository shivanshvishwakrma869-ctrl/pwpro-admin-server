import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getBatchDetails, getTopics } from '../services/api';
import { Batch, Subject, Topic } from '../types';

export default function BatchDetailScreen({ route, navigation }: any) {
  const { batchId, batch: initialBatch } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [batch, setBatch] = useState<Batch | null>(initialBatch || null);
  const [subjects, setSubjects] = useState<Subject[]>(initialBatch?.subjects || []);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [searchTopic, setSearchTopic] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'videos' | 'notes'>('all');
  const [loadingBatch, setLoadingBatch] = useState(!initialBatch?.subjects);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [batchId]);

  const loadDetails = async () => {
    try {
      const data = await getBatchDetails(batchId);
      if (data) {
        setBatch(data);
        if (data.subjects && data.subjects.length > 0) {
          setSubjects(data.subjects);
          setSelectedSubject(data.subjects[0]);
          loadTopics(batchId, data.subjects[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBatch(false);
    }
  };

  const loadTopics = async (bId: string, sId: string) => {
    setLoadingTopics(true);
    try {
      const res = await getTopics(bId, sId);
      setTopics(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTopics(false);
    }
  };

  const onSelectSubject = (sub: Subject) => {
    setSelectedSubject(sub);
    loadTopics(batchId, sub._id);
  };

  const filteredTopics = topics.filter((t) => {
    if (filterMode === 'videos' && (t.lecturesCount || 0) === 0) return false;
    if (filterMode === 'notes' && (t.notesCount || 0) === 0) return false;
    if (searchTopic.trim().length > 0) {
      return t.name.toLowerCase().includes(searchTopic.toLowerCase());
    }
    return true;
  });

  const renderTopicItem = ({ item }: { item: Topic }) => (
    <Pressable
      style={[
        styles.topicCard,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
      onPress={() =>
        navigation.navigate('Topic', {
          batchId,
          batchName: batch?.name,
          subjectId: selectedSubject?._id,
          subjectName: selectedSubject?.title,
          topicId: item._id,
          topicName: item.name,
          topicSlug: item.slug,
        })
      }
    >
      <View style={styles.topicLeft}>
        <View style={[styles.folderIconWrap, { backgroundColor: colors.accentLight }]}>
          <Ionicons
            name={(item.lecturesCount || 0) > 0 ? 'videocam-outline' : 'document-text-outline'}
            size={20}
            color={colors.accentText}
          />
        </View>
        <View style={styles.topicTextWrap}>
          <Text style={[styles.topicTitle, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.statsRow}>
            {(item.lecturesCount || 0) > 0 ? (
              <View style={[styles.badgeItem, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="play-circle" size={12} color={colors.accentText} />
                <Text style={[styles.statBadgeText, { color: colors.accentText }]}>
                  {item.lecturesCount} {item.lecturesCount === 1 ? 'Lecture' : 'Lectures'}
                </Text>
              </View>
            ) : null}
            {(item.notesCount || 0) > 0 ? (
              <View style={[styles.badgeItem, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="document-text" size={12} color={colors.textSecondary} />
                <Text style={[styles.statBadgeText, { color: colors.textSecondary }]}>
                  {item.notesCount} {item.notesCount === 1 ? 'PDF Note' : 'PDF Notes'}
                </Text>
              </View>
            ) : null}
            {(item.lecturesCount || 0) === 0 && (item.notesCount || 0) === 0 ? (
              <View style={[styles.badgeItem, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="layers-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.statBadgeText, { color: colors.textSecondary }]}>
                  Chapter Materials
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar with Back Button */}
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
        <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
          {batch?.name || 'Batch Details'}
        </Text>
      </View>

      {loadingBatch ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading batch curriculum...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTopics}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.contentList}
          ListHeaderComponent={
            <View>
              {/* Batch Banner */}
              {batch?.image ? (
                <Image
                  source={{ uri: batch.image }}
                  style={styles.batchBanner}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.bannerInfo}>
                <Text style={[styles.batchDetailTitle, { color: colors.text }]}>
                  {batch?.name}
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.badgeText, { color: colors.accentText }]}>
                      {batch?.language || 'Hinglish'}
                    </Text>
                  </View>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    by {batch?.byName || 'Physics Wallah'}
                  </Text>
                </View>
              </View>

              {/* Subjects Horizontal Scroll */}
              <View style={styles.subjectsSection}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>Subjects</Text>
                {subjects.length === 0 ? (
                  <Text style={[styles.noSubjectsText, { color: colors.textSecondary }]}>
                    No subjects available for this batch yet.
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.subjectsRow}
                  >
                    {subjects.map((sub) => {
                      const isSelected = selectedSubject?._id === sub._id;
                      return (
                        <Pressable
                          key={sub._id}
                          style={[
                            styles.subjectChip,
                            {
                              backgroundColor: isSelected ? colors.accent : colors.card,
                              borderColor: isSelected ? colors.accent : colors.cardBorder,
                            },
                          ]}
                          onPress={() => onSelectSubject(sub)}
                        >
                          <Ionicons
                            name="book-outline"
                            size={14}
                            color={isSelected ? '#000' : colors.accent}
                          />
                          <Text
                            style={[
                              styles.subjectChipText,
                              { color: isSelected ? '#000000' : colors.text },
                            ]}
                          >
                            {sub.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* In-Batch Search & Filter Row */}
              <View style={styles.searchSection}>
                <View
                  style={[
                    styles.searchBox,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                >
                  <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search chapters in this subject..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchTopic}
                    onChangeText={setSearchTopic}
                    returnKeyType="search"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  {searchTopic.length > 0 && (
                    <Pressable onPress={() => setSearchTopic('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>

                {/* Filter Pills */}
                <View style={styles.filterRow}>
                  <Pressable
                    style={[
                      styles.filterPill,
                      { borderColor: colors.cardBorder, backgroundColor: colors.card },
                      filterMode === 'all' && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => setFilterMode('all')}
                  >
                    <Ionicons
                      name="apps"
                      size={13}
                      color={filterMode === 'all' ? '#000' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: filterMode === 'all' ? '#000' : colors.textSecondary },
                      ]}
                    >
                      All ({topics.length})
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.filterPill,
                      { borderColor: colors.cardBorder, backgroundColor: colors.card },
                      filterMode === 'videos' && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => setFilterMode('videos')}
                  >
                    <Ionicons
                      name="videocam"
                      size={13}
                      color={filterMode === 'videos' ? '#000' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: filterMode === 'videos' ? '#000' : colors.textSecondary },
                      ]}
                    >
                      Videos
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.filterPill,
                      { borderColor: colors.cardBorder, backgroundColor: colors.card },
                      filterMode === 'notes' && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => setFilterMode('notes')}
                  >
                    <Ionicons
                      name="document-text"
                      size={13}
                      color={filterMode === 'notes' ? '#000' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: filterMode === 'notes' ? '#000' : colors.textSecondary },
                      ]}
                    >
                      PDF Notes
                    </Text>
                  </Pressable>
                </View>
              </View>

              {loadingTopics && (
                <View style={styles.topicsLoader}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.topicsLoaderText, { color: colors.textSecondary }]}>
                    Loading chapters...
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={renderTopicItem}
          ListEmptyComponent={
            !loadingTopics ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="folder-open-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchTopic.trim()
                    ? `No chapters matching "${searchTopic}"`
                    : 'No chapters found for this subject.'}
                </Text>
              </View>
            ) : undefined
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
    marginRight: 8,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
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
  contentList: {
    paddingBottom: 32,
  },
  batchBanner: {
    width: '100%',
    height: 180,
  },
  bannerInfo: {
    padding: 16,
  },
  batchDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
  },
  subjectsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  noSubjectsText: {
    fontSize: 13,
  },
  subjectsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topicsHeaderRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topicsLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  topicsLoaderText: {
    fontSize: 13,
  },
  topicCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  folderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicTextWrap: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
});
