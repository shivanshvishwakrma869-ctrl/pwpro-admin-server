import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../context/BookmarkContext';
import { useDownloads } from '../context/DownloadContext';
import { getFastStreamUrl, getStreamUrl, getAttachments } from '../services/api';
import { Lecture, Attachment } from '../types';

const { width } = Dimensions.get('window');
const VIDEO_HEIGHT = (width * 9) / 16;

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export default function PlayerScreen({ route, navigation }: any) {
  const { batchId, batchName, subjectId, subjectName, topicId, lecture } = route.params as {
    batchId: string;
    batchName?: string;
    subjectId: string;
    subjectName?: string;
    topicId?: string;
    lecture: Lecture;
  };

  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const { downloadFile, isDownloaded } = useDownloads();

  const webViewRef = useRef<any>(null);
  const WebViewComponent: any = WebView;
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showSpeedModal, setShowSpeedModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'solutions'>('notes');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState<boolean>(true);

  const lectureId = lecture._id || lecture.scheduleId || lecture.videoId || '';
  const bookmarked = isBookmarked(lectureId);
  const downloaded = isDownloaded(lecture.title);

  useEffect(() => {
    // Resolve direct origin CDN stream for fast, buffer-free playback
    const initStream = async () => {
      try {
        const fastUrl = await getFastStreamUrl({
          videoId: lecture.videoId,
          scheduleId: lecture.scheduleId,
          batchId,
          subjectId,
          topicId,
          title: lecture.title,
          directVideoUrl: lecture.videoDetails?.videoUrl,
        });
        setStreamUrl(fastUrl);
      } catch {
        const fallback = getStreamUrl({
          videoId: lecture.videoId,
          scheduleId: lecture.scheduleId,
          batchId,
          subjectId,
          topicId,
          title: lecture.title,
        });
        setStreamUrl(fallback);
      }
    };

    initStream();

    // Fetch PDF attachments & notes
    if (lecture.scheduleId) {
      loadNotes(lecture.scheduleId);
    } else {
      setLoadingAttachments(false);
    }
  }, [lecture]);

  const loadNotes = async (scheduleId: string) => {
    setLoadingAttachments(true);
    try {
      const data = await getAttachments({
        batchId,
        subjectId,
        scheduleId,
        title: lecture.title,
      });
      setAttachments(data);
    } catch (e) {
      console.error('Failed to load notes', e);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleSeek = (seconds: number) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.videoElement) {
          window.videoElement.currentTime += ${seconds};
        }
        true;
      `);
    }
  };

  const handleSelectSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedModal(false);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.videoElement) {
          window.videoElement.playbackRate = ${speed};
        }
        true;
      `);
    }
  };

  const handleToggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(lectureId);
    } else {
      addBookmark({
        id: lectureId,
        title: lecture.title,
        batchId,
        batchName,
        subjectId,
        subjectName,
        topicId,
        videoId: lecture.videoId || '',
        scheduleId: lecture.scheduleId,
        thumbnail: lecture.videoDetails?.image,
        timestamp: Date.now(),
      });
    }
  };

  const handleDownloadVideo = () => {
    if (!streamUrl) return;
    downloadFile(streamUrl, lecture.title, 'video', batchName);
  };

  const handleDownloadPdf = (att: Attachment) => {
    if (!att.attachmentUrl) {
      Alert.alert('Error', 'PDF download URL is not available.');
      return;
    }
    downloadFile(att.attachmentUrl, att.name || 'Lecture_Notes.pdf', 'pdf', batchName);
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

  const playerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: contain; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
</head>
<body>
  <video id="player" controls playsinline autoplay crossorigin="anonymous" controlslist="nodownload"></video>
  <script>
    const video = document.getElementById('player');
    window.videoElement = video;
    const stream = "${streamUrl}";

    if (Hls.isSupported() && (stream.includes('.m3u8') || stream.includes('master') || stream.includes('playlist'))) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60
      });
      hls.loadSource(stream);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              video.src = stream;
              break;
          }
        }
      });
    } else {
      video.src = stream;
      video.play().catch(() => {});
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 6,
            backgroundColor: colors.card,
            borderBottomColor: colors.cardBorder,
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
          {lecture.title}
        </Text>
      </View>

      {/* Video Player */}
      <View style={styles.videoWrapper}>
        {streamUrl ? (
          <WebViewComponent
            ref={webViewRef}
            style={styles.videoPlayer}
            source={{ html: playerHtml }}
            allowsFullscreenVideo={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            userAgent="Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}
      </View>

      {/* Quick Player Bar */}
      <View
        style={[
          styles.quickControlsBar,
          { backgroundColor: colors.card, borderBottomColor: colors.cardBorder },
        ]}
      >
        <Pressable style={styles.controlPill} onPress={() => handleSeek(-10)}>
          <Ionicons name="refresh-outline" size={16} color={colors.text} />
          <Text style={[styles.controlPillText, { color: colors.text }]}>-10s</Text>
        </Pressable>

        <Pressable
          style={[styles.speedBtn, { backgroundColor: colors.accentLight }]}
          onPress={() => setShowSpeedModal(true)}
        >
          <Ionicons name="speedometer-outline" size={15} color={colors.accentText} />
          <Text style={[styles.speedBtnText, { color: colors.accentText }]}>
            {playbackSpeed}x Speed
          </Text>
        </Pressable>

        <Pressable style={styles.controlPill} onPress={() => handleSeek(10)}>
          <Ionicons name="play-forward-outline" size={16} color={colors.text} />
          <Text style={[styles.controlPillText, { color: colors.text }]}>+10s</Text>
        </Pressable>

        <Pressable
          style={[
            styles.iconCircleBtn,
            { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
          ]}
          onPress={handleToggleBookmark}
        >
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={bookmarked ? colors.accent : colors.textSecondary}
          />
        </Pressable>

        <Pressable
          style={[
            styles.iconCircleBtn,
            { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
          ]}
          onPress={handleDownloadVideo}
        >
          <Ionicons
            name={downloaded ? 'checkmark-circle' : 'download-outline'}
            size={18}
            color={downloaded ? colors.accent : colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabsRow,
          { backgroundColor: colors.card, borderBottomColor: colors.cardBorder },
        ]}
      >
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
            Class Notes ({attachments.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            activeTab === 'details' && [styles.activeTab, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab('details')}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={activeTab === 'details' ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'details' ? colors.accent : colors.textSecondary },
            ]}
          >
            Lecture Info
          </Text>
        </Pressable>
      </View>

      {/* Tab Contents */}
      <ScrollView contentContainerStyle={styles.tabContentScroll}>
        {activeTab === 'notes' && (
          <View>
            {loadingAttachments ? (
              <View style={styles.centerSmall}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.loadingSmallText, { color: colors.textSecondary }]}>
                  Loading PDF class notes...
                </Text>
              </View>
            ) : attachments.length === 0 ? (
              <View style={styles.centerSmall}>
                <Ionicons name="document-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyTabNote, { color: colors.textSecondary }]}>
                  No PDF notes attached for this lecture.
                </Text>
              </View>
            ) : (
              attachments.map((att, idx) => (
                <View
                  key={att.id || idx}
                  style={[
                    styles.attachmentCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={styles.attLeft}>
                    <View style={[styles.pdfIconWrap, { backgroundColor: '#ef444420' }]}>
                      <Ionicons name="document" size={20} color="#ef4444" />
                    </View>
                    <View style={styles.attInfo}>
                      <Text style={[styles.attTitle, { color: colors.text }]} numberOfLines={2}>
                        {att.name || att.title || 'Lecture Notes'}
                      </Text>
                      <Text style={[styles.attBadge, { color: colors.textSecondary }]}>
                        {att.type || 'PDF Document'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.attActions}>
                    <Pressable
                      style={[styles.attViewBtn, { backgroundColor: colors.inputBg }]}
                      onPress={() => handleOpenPdf(att)}
                    >
                      <Ionicons name="eye-outline" size={16} color={colors.text} />
                      <Text style={[styles.attViewBtnText, { color: colors.text }]}>View</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.attDownloadBtn, { backgroundColor: colors.accent }]}
                      onPress={() => handleDownloadPdf(att)}
                    >
                      <Ionicons name="download" size={15} color="#000" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'details' && (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Text style={[styles.infoTitle, { color: colors.text }]}>{lecture.title}</Text>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Batch:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{batchName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Subject:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{subjectName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Faculty:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {lecture.teacher || 'Physics Wallah'}
              </Text>
            </View>
            {lecture.duration ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Duration:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{lecture.duration}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Playback Speed Modal */}
      <Modal
        visible={showSpeedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpeedModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSpeedModal(false)}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Playback Speed</Text>
            {SPEED_OPTIONS.map((rate) => {
              const selected = playbackSpeed === rate;
              return (
                <Pressable
                  key={rate}
                  style={[
                    styles.speedOption,
                    selected && { backgroundColor: colors.accentLight },
                  ]}
                  onPress={() => handleSelectSpeed(rate)}
                >
                  <Text
                    style={[
                      styles.speedOptionText,
                      { color: selected ? colors.accentText : colors.text },
                    ]}
                  >
                    {rate}x {rate === 1.0 ? '(Normal)' : ''}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.accentText} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  videoWrapper: {
    width: '100%',
    height: VIDEO_HEIGHT,
    backgroundColor: '#000000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  controlPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  speedBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
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
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabContentScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  centerSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  loadingSmallText: {
    fontSize: 13,
  },
  emptyTabNote: {
    fontSize: 13,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  attLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  pdfIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attInfo: {
    flex: 1,
  },
  attTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  attBadge: {
    fontSize: 11,
    marginTop: 2,
  },
  attActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  attViewBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  attDownloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 70,
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    width: 260,
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  speedOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
