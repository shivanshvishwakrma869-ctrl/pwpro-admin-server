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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getBatches } from '../services/api';
import { Batch } from '../types';

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const categories = ['All', 'JEE', 'NEET', 'Class 12', 'Class 11', 'Class 10'];

  const loadData = async () => {
    try {
      const data = await getBatches();
      setBatches(data);
      setFilteredBatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
          (b.classes && b.classes.some((c) => c.toLowerCase().includes(catLower)))
      );
    }
    if (query.trim().length > 0) {
      const q = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.language?.toLowerCase().includes(q)
      );
    }
    setFilteredBatches(result);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.brandRow}>
        <View>
          <Text style={[styles.brandTitle, { color: colors.accent }]}>PW Pro by Shivansh</Text>
          <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
            Physics Wallah Batches & Lectures
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

      {/* Community Links Banner */}
      <View style={styles.socialRow}>
        <Pressable
          style={[styles.socialPill, { backgroundColor: '#0284c7' }]}
          onPress={() => Linking.openURL('https://t.me/AKKISTUDYX1')}
        >
          <Ionicons name="paper-plane" size={14} color="#fff" />
          <Text style={styles.socialPillText}>Telegram Channel</Text>
        </Pressable>
        <Pressable
          style={[styles.socialPill, { backgroundColor: '#16a34a' }]}
          onPress={() => Linking.openURL('https://whatsapp.com/channel/0029Vb679UN9MF8swZIMLd40')}
        >
          <Ionicons name="logo-whatsapp" size={14} color="#fff" />
          <Text style={styles.socialPillText}>WhatsApp Group</Text>
        </Pressable>
      </View>

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
          Explore Batches ({filteredBatches.length})
        </Text>
      </View>
    </View>
  );

  const renderBatchCard = ({ item }: { item: Batch }) => (
    <Pressable
      style={[
        styles.batchCard,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
      onPress={() => navigation.navigate('BatchDetail', { batchId: item._id, batch: item })}
    >
      <Image source={{ uri: item.image }} style={styles.batchImage} resizeMode="cover" />
      <View style={styles.batchInfo}>
        <Text style={[styles.batchName, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.badgeText, { color: colors.accentText }]}>
              {item.language || 'Hinglish'}
            </Text>
          </View>
          <Text style={[styles.byName, { color: colors.textSecondary }]}>
            {item.byName || 'Physics Wallah'}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading PW Batches...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBatches}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          renderItem={renderBatchCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No batches found matching "{searchQuery}"
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
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  headerContainer: {
    paddingTop: 8,
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
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
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  socialPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  socialPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  categoriesList: {
    paddingVertical: 4,
    gap: 8,
    marginBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitleRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  batchCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  batchImage: {
    width: '100%',
    height: 110,
  },
  batchInfo: {
    padding: 10,
  },
  batchName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    minHeight: 36,
  },
  badgeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  byName: {
    fontSize: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
});
