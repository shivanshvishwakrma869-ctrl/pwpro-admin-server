import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function ActivationScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { activateKey, deviceId, authApiUrl, setAuthApiUrl } = useAuth();

  const [inputKey, setInputKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settings modal for custom server URL
  const [showConfig, setShowConfig] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState(authApiUrl);

  const handleActivate = async () => {
    if (!inputKey.trim()) {
      Alert.alert('Key Required', 'Please enter your unique activation key.');
      return;
    }

    setSubmitting(true);
    const res = await activateKey(inputKey);
    setSubmitting(false);

    if (res.success) {
      Alert.alert('Activated Successfully', res.message);
    } else {
      Alert.alert('Activation Failed', res.message);
    }
  };

  const handleSaveApiUrl = async () => {
    await setAuthApiUrl(tempApiUrl);
    setShowConfig(false);
    Alert.alert('Server Updated', `Auth endpoint set to:\n${tempApiUrl}`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      {/* Top Config Gear */}
      <View style={styles.topRow}>
        <Pressable
          style={[styles.configBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => setShowConfig(true)}
        >
          <Ionicons name="server-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Brand & Shield Icon */}
      <View style={styles.header}>
        <View style={[styles.shieldIconWrap, { backgroundColor: colors.accentLight }]}>
          <Ionicons name="shield-checkmark" size={48} color={colors.accentText} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>PW Pro by Shivansh</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Single-Device Protected Access
        </Text>
      </View>

      {/* Notice Card */}
      <View
        style={[
          styles.noticeCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.noticeHeader}>
          <Ionicons name="key-outline" size={20} color={colors.accent} />
          <Text style={[styles.noticeTitle, { color: colors.text }]}>
            Activation Key Required
          </Text>
        </View>
        <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>
          Each key works only once and binds exclusively to your device. Once activated, you will
          have unlimited access to all batches, video lectures, and PDF notes.
        </Text>

        {/* Device ID Display */}
        <View
          style={[
            styles.deviceIdBox,
            { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.deviceTextWrap}>
            <Text style={[styles.deviceLabel, { color: colors.textSecondary }]}>YOUR DEVICE ID:</Text>
            <Text style={[styles.deviceValue, { color: colors.text }]} numberOfLines={1}>
              {deviceId || 'Loading...'}
            </Text>
          </View>
          <Pressable
            style={[styles.copyPill, { backgroundColor: colors.accentLight }]}
            onPress={() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={14}
              color={colors.accentText}
            />
            <Text style={[styles.copyPillText, { color: colors.accentText }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Activation Input Form */}
      <View style={styles.form}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          ENTER ACTIVATION KEY:
        </Text>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={20} color={colors.accent} />
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            placeholder="e.g. PWPRO-XXXX-XXXX"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            value={inputKey}
            onChangeText={(t) => setInputKey(t.toUpperCase())}
            returnKeyType="done"
            onSubmitEditing={handleActivate}
          />
          {inputKey.length > 0 && (
            <Pressable onPress={() => setInputKey('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[
            styles.activateBtn,
            { backgroundColor: colors.accent, opacity: submitting ? 0.7 : 1 },
          ]}
          onPress={handleActivate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color="#000" />
              <Text style={styles.activateBtnText}>Activate Application</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Get a key info */}
      <View style={styles.supportSection}>
        <Text style={[styles.supportTitle, { color: colors.textSecondary }]}>
          ACTIVATION & ACCESS
        </Text>
        <Text style={[styles.supportDesc, { color: colors.textSecondary }]}>
          Keys are issued directly by the administrator and are single-use, permanently locked to your unique device ID upon activation.
        </Text>
      </View>

      {/* Server Endpoint Config Modal */}
      <Modal
        visible={showConfig}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfig(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>
              Auth Server Endpoint
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Enter your Vercel or cloud backend URL where the admin key validator is deployed:
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder },
              ]}
              value={tempApiUrl}
              onChangeText={setTempApiUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://your-admin.vercel.app"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalCancel, { borderColor: colors.cardBorder }]}
                onPress={() => setShowConfig(false)}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, { backgroundColor: colors.accent }]}
                onPress={handleSaveApiUrl}
              >
                <Text style={{ color: '#000', fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  topRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  configBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shieldIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  noticeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  deviceIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  deviceTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  deviceLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deviceValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  copyPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  form: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    gap: 8,
  },
  activateBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  supportSection: {
    alignItems: 'center',
    paddingTop: 10,
  },
  supportTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  supportDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  supportButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  supportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  supportBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  modalInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalSave: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
