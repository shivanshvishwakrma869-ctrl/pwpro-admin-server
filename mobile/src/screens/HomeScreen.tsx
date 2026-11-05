import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getBatches, getWatchHistory } from '../services/api';
import { Batch, WatchHistoryItem } from '../types';

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const categories = ['All', 'JEE', 'NEET', 'Class 12', 'Class 11', 'Class 10', 'Foundation', 'NDA'];

  const loadData = async (force = false) => {
    try {
      const [batchesData, historyData] = await Promise.all([
        getBatches(force),
        getWatchHistory(),
      ]);
      setBatches(batchesData);
      setFilteredBatches(batchesData);
      setWatchHistory(historyData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh history when navigating back to home
      getWatchHistory().then(setWatchHistory).catch(() => {});
    });
    return unsubscribe;
  }, [navigation]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applyFilters(text, selectedCategory);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    applyFilters(searchQuery, category);
  };

  const applyFilters = (query: string, category: string) => {
    let result = batches;
    if (category !== 'All') {
      const catLower = category.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(catLower) ||
          b.byName?.toLowerCase().includes(catLower) ||
          (b.classes && b.classes.some((c) => c.toLowerCase().includes(catLower)))
      );
    }
    if (query.trim().length > 0) {
      const q = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.language?.toLowerCase().includes(q) ||
          b.byName?.toLowerCase().includes(q)
      );
    }
    setFilteredBatches(result);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.brandRow}>
        <View>
          <Text style={[styles.brandTitle, { color: colors.accent }]}>PW Pro by Shivansh</Text>
          <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
            Physics Wallah VIP Batches & Lectures
          </Text>
        </View>
        <Pressable
          style={[styles.themeBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={toggleTheme}
        >
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={20}
            color={isDark ? '#FACC15' : colors.text}
          />
        </Pressable>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search batches (Yakeen, Arjuna, Lakshya...)"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Continue Watching Feature */}
      {watchHistory.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historySectionHeader}>
            <Ionicons name="time" size={16} color={colors.accent} />
            <Text style={[styles.historyTitle, { color: colors.text }]}>Continue Watching</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyList}>
            {watchHistory.map((item) => (
              <Pressable
                key={item.lectureId}
                style={[
                  styles.historyCard,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
                onPress={() =>
                  navigation.navigate('Player', {
                    batchId: item.batchId,
                    batchName: item.batchName,
                    subjectId: item.subjectId || '',
                    subjectName: item.subjectName || '',
                    topicId: item.topicId || '',
                    lecture: item.lecture,
                  })
                }
              >
                <View style={styles.historyThumbWrap}>
                  <Image
                    source={{
                      uri:
                        item.lecture.videoDetails?.image ||
                        'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/4df42d8f-a9cb-4be3-9799-aeb11b152ca6.png',
                    }}
                    style={styles.historyThumb}
                  />
                  <View style={styles.historyPlayBadge}>
                    <Ionicons name="play" size={12} color="#fff" />
                  </View>
                </View>
                <View style={styles.historyDetails}>
                  <Text style={[styles.historyLectureTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.lecture.title}
                  </Text>
                  <Text style={[styles.historyBatchName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.batchName || 'Physics Wallah'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Categories */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.categoriesList}
        renderItem={({ item }) => {
          const isSelected = selectedCategory === item;
          return (
            <Pressable
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? colors.accent : colors.card,
                  borderColor: isSelected ? colors.accent : colors.cardBorder,
                },
              ]}
              onPress={() => handleCategorySelect(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: isSelected ? '#000000' : colors.text },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {selectedCategory === 'All' ? 'All Batches' : `${selectedCategory} Batches`}
        </Text>
        <Text style={[styles.batchCount, { color: colors.textSecondary }]}>
          {filteredBatches.length.toLocaleString()} Available
        </Text>
      </View>
    </View>
  );

  const renderBatchItem = ({ item }: { item: Batch }) => (
    <Pressable
      style={[
        styles.batchCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        },
      ]}
      onPress={() =>
        navigation.navigate('BatchDetail', {
          batchId: item._id,
          batchName: item.name,
          batchSlug: item.slug,
        })
      }
    >
      <Image
        source={{ uri: item.image }}
        style={styles.batchImage}
        resizeMode="cover"
      />
      <View style={styles.batchInfo}>
        <View style={styles.tagRow}>
          <View style={[styles.langBadge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.langText, { color: colors.accentText }]}>
              {item.language}
            </Text>
          </View>
          {item.byName ? (
            <Text style={[styles.byNameText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.byName}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.batchTitle, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.freeBadge}>
            <Ionicons name="sparkles" size={12} color="#10B981" />
            <Text style={styles.freeText}>Full Access</Text>
          </View>
          <View style={styles.exploreBtn}>
            <Text style={[styles.exploreText, { color: colors.accent }]}>Explore</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading batches...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={filteredBatches}
        keyExtractor={(item) => item._id}
        renderItem={renderBatchItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? undefined : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={batches.length === 0 ? 'cloud-offline-outline' : 'search'}
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {batches.length === 0 ? 'Unable to load batches' : 'No batches found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {batches.length === 0
                  ? 'Please check your internet connection or pull down to refresh.'
                  : 'Try searching with a different keyword or select "All".'}
              </Text>
              {batches.length === 0 && (
                <Pressable
                  style={[styles.retryBtn, { backgroundColor: colors.accent }]}
                  onPress={() => loadData(true)}
                >
                  <Ionicons name="reload" size={16} color="#000" />
                  <Text style={styles.retryBtnText}>Retry Loading</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerContainer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    height: '100%',
  },
  historySection: {
    marginBottom: 14,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    width: 200,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyThumbWrap: {
    position: 'relative',
    width: 52,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
  },
  historyThumb: {
    width: '100%',
    height: '100%',
  },
  historyPlayBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDetails: {
    flex: 1,
  },
  historyLectureTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyBatchName: {
    fontSize: 10,
    marginTop: 2,
  },
  categoriesList: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  batchCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  batchCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  batchImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#1f2937',
  },
  batchInfo: {
    padding: 14,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
  },
  byNameText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(156, 163, 175, 0.2)',
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  exploreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});
