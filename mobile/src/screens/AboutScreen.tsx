import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { license, deactivateDevice } = useAuth();

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear temporary batch cache? Your downloaded files and bookmarks will be kept safely.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('ns_batches_cache_v4');
              Alert.alert('Cache Cleared', 'App cache was cleared successfully.');
            } catch (e) {
              console.error(e);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
      contentContainerStyle={styles.content}
    >
      {/* Brand Header */}
      <View style={styles.brandCenter}>
        <View style={[styles.logoCircle, { backgroundColor: colors.accentLight }]}>
          <Ionicons name="school" size={36} color={colors.accentText} />
        </View>
        <Text style={[styles.appName, { color: colors.text }]}>PW Pro by Shivansh</Text>
        <Text style={[styles.appVersion, { color: colors.textSecondary }]}>v1.4.0 (VIP Edition)</Text>
      </View>

      {/* License Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LICENSE & DEVICE</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={[styles.row, styles.borderBottom, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>License Status</Text>
            </View>
            <View style={[styles.licensePill, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.licensePillText, { color: colors.accentText }]}>
                ACTIVE (Hardware Bound)
              </Text>
            </View>
          </View>

          <View style={[styles.row, styles.borderBottom, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Active Key</Text>
            </View>
            <Text style={[styles.licenseKeyValue, { color: colors.text }]}>
              {license?.key || 'PWPRO-VIP-2026'}
            </Text>
          </View>

          <Pressable
            style={styles.row}
            onPress={() => {
              Alert.alert(
                'Deactivate Device',
                'Are you sure you want to release this device? You will need an activation key to use the app again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Deactivate', style: 'destructive', onPress: deactivateDevice },
                ]
              );
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={[styles.rowLabel, { color: '#ef4444' }]}>Deactivate Device</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Pressable style={styles.row} onPress={toggleTheme}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={isDark ? 'moon-outline' : 'sunny-outline'}
                size={20}
                color={colors.accent}
              />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Appearance Theme</Text>
            </View>
            <Text style={[styles.themeValue, { color: colors.accent }]}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Features Showcase */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APP CAPABILITIES</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.featureItem}>
            <Ionicons name="flash" size={16} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Zero-Buffer Direct Origin CDN Video Streaming
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="cloud-download" size={16} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Offline PDF class notes & lecture download manager
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="document-text" size={16} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Built-in document reader for DPPs & revision sheets
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="speedometer" size={16} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Custom playback speeds (0.5x up to 3.0x speed)
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="bookmark" size={16} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              One-tap lecture bookmarking across all 14,000+ batches
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="create" size={16} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              In-app Personal Lecture Scratchpad for revision notes
            </Text>
          </View>
        </View>
      </View>

      {/* Storage Management */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>STORAGE & CACHE</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Pressable style={styles.row} onPress={handleClearCache}>
            <View style={styles.rowLeft}>
              <Ionicons name="trash-bin-outline" size={20} color="#f97316" />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Clear Batch Cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          PW Pro by Shivansh • Student Edition
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  brandCenter: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
  },
  appVersion: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  licensePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  licensePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  licenseKeyValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
  },
});
