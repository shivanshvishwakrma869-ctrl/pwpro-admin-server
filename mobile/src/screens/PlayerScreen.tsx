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
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBookmarks } from '../context/BookmarkContext';
import { useDownloads } from '../context/DownloadContext';
import {
  getFastStreamUrl,
  getStreamUrl,
  getAttachments,
  saveWatchHistory,
  getLectureNote,
  saveLectureNote,
} from '../services/api';
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
  const [savedPosition, setSavedPosition] = useState<number>(0);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<Array<{ id: number; height: number; label: string }>>([
    { id: -1, height: 0, label: 'Auto' },
  ]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [qualityLabel, setQualityLabel] = useState<string>('Auto');
  const [showQualityModal, setShowQualityModal] = useState<boolean>(false);
  const [seekFeedback, setSeekFeedback] = useState<{ show: boolean; side: 'left' | 'right'; count: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [activeTab, setActiveTab] = useState<'notes' | 'mynotes' | 'details'>('notes');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState<boolean>(true);
  const [personalNote, setPersonalNote] = useState<string>('');
  const [noteSaved, setNoteSaved] = useState<boolean>(false);

  const lectureId = lecture._id || lecture.scheduleId || lecture.videoId || '';
  const bookmarked = isBookmarked(lectureId);
  const downloaded = isDownloaded(lecture.title);

  useEffect(() => {
    // 1. Load saved playback position to resume seamlessly
    AsyncStorage.getItem(`pw_pos_${lectureId}`).then((val) => {
      if (val) {
        const sec = parseFloat(val);
        if (sec > 5) {
          setSavedPosition(sec);
          const m = Math.floor(sec / 60);
          const s = Math.floor(sec % 60);
          setResumeToast(`Resuming from ${m}:${s < 10 ? '0' : ''}${s}`);
          setTimeout(() => setResumeToast(null), 4000);
        }
      }
    });

    // 2. Load preferred persistent playback speed
    AsyncStorage.getItem('preferred_playback_speed').then((sp) => {
      if (sp) {
        const num = parseFloat(sp);
        if (!isNaN(num) && num > 0) setPlaybackSpeed(num);
      }
    });

    // Record watch history for "Continue Watching"
    saveWatchHistory({
      lectureId,
      lecture,
      batchId,
      batchName,
      subjectId,
      subjectName,
      topicId,
      timestamp: Date.now(),
    });

    // Load personal lecture note
    getLectureNote(lectureId).then(setPersonalNote);

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
    const side = seconds < 0 ? 'left' : 'right';
    setSeekFeedback({ show: true, side, count: Math.abs(seconds) });
    setTimeout(() => setSeekFeedback(null), 800);
  };

  const handleSelectSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedModal(false);
    AsyncStorage.setItem('preferred_playback_speed', speed.toString()).catch(() => {});
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.videoElement) {
          window.videoElement.playbackRate = ${speed};
        }
        true;
      `);
    }
  };

  const handleTogglePip = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(function(){});
        } else if (window.videoElement && window.videoElement.requestPictureInPicture) {
          window.videoElement.requestPictureInPicture().catch(function(e){
            console.log('PiP not available', e);
          });
        }
        true;
      `);
    }
  };

  const onMessageFromPlayer = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'QUALITIES' && Array.isArray(data.levels)) {
        const mapped = [
          { id: -1, height: 0, label: 'Auto' },
          ...data.levels.map((lvl: any, index: number) => ({
            id: index,
            height: lvl.height || 0,
            label: lvl.height ? `${lvl.height}p` : `Option ${index + 1}`,
          })),
        ];
        setAvailableQualities(mapped);
      } else if (data.type === 'PROGRESS') {
        const cur = Math.floor(data.currentTime || 0);
        const dur = Math.floor(data.duration || 0);
        if (cur > 0) {
          AsyncStorage.setItem(`pw_pos_${lectureId}`, cur.toString()).catch(() => {});
          if (dur > 0) {
            const pct = Math.min(Math.round((cur / dur) * 100), 100);
            AsyncStorage.setItem(`pw_pct_${lectureId}`, pct.toString()).catch(() => {});
          }
        }
      }
    } catch {}
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

  const handleNoteChange = (text: string) => {
    setPersonalNote(text);
    saveLectureNote(lectureId, text);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
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
    const initialTime = ${savedPosition || 0};
    const initialSpeed = ${playbackSpeed || 1.0};
    let hasSeekedToResume = false;

    function notifyRN(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function applyResumeAndSpeed() {
      if (initialSpeed !== 1.0) {
        video.playbackRate = initialSpeed;
      }
      if (!hasSeekedToResume && initialTime > 5) {
        hasSeekedToResume = true;
        video.currentTime = initialTime;
      }
    }

    video.addEventListener('loadedmetadata', applyResumeAndSpeed);
    video.addEventListener('canplay', applyResumeAndSpeed);

    let lastProgressReport = 0;
    video.addEventListener('timeupdate', function() {
      const now = Date.now();
      if (now - lastProgressReport > 2000) {
        lastProgressReport = now;
        notifyRN({
          type: 'PROGRESS',
          currentTime: video.currentTime,
          duration: video.duration || 0
        });
      }
    });

    if (Hls.isSupported() && (stream.includes('.m3u8') || stream.includes('/api/m') || stream.includes('master') || stream.includes('playlist'))) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        backBufferLength: 90,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5
      });
      window.hlsInstance = hls;
      hls.loadSource(stream);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
        video.play().catch(function() {});
        applyResumeAndSpeed();
        if (hls.levels && hls.levels.length > 0) {
          notifyRN({
            type: 'QUALITIES',
            levels: hls.levels.map(function(l, idx) {
              return { id: idx, height: l.height || 0, bitrate: l.bitrate || 0 };
            })
          });
        }
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
        notifyRN({ type: 'LEVEL_SWITCHED', level: data.level });
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
      video.play().catch(function() {});
      applyResumeAndSpeed();
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
          <>
            <WebViewComponent
              key={streamUrl}
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
              onMessage={onMessageFromPlayer}
              userAgent="Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            />
            {resumeToast && (
              <View style={styles.resumeToastWrap} pointerEvents="none">
                <Ionicons name="time" size={14} color="#000" />
                <Text style={styles.resumeToastText}>{resumeToast}</Text>
              </View>
            )}
            {seekFeedback && (
              <View
                style={[
                  styles.seekFeedbackOverlay,
                  seekFeedback.side === 'left' ? styles.seekLeft : styles.seekRight,
                ]}
                pointerEvents="none"
              >
                <Ionicons
                  name={seekFeedback.side === 'left' ? 'refresh' : 'play-forward'}
                  size={32}
                  color="#ffffff"
                />
                <Text style={styles.seekFeedbackText}>
                  {seekFeedback.side === 'left' ? '-' : '+'}
                  {seekFeedback.count}s
                </Text>
              </View>
            )}
          </>
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
            {playbackSpeed}x
          </Text>
        </Pressable>

        <Pressable
          style={[styles.speedBtn, { backgroundColor: colors.accentLight }]}
          onPress={() => setShowQualityModal(true)}
        >
          <Ionicons name="options-outline" size={15} color={colors.accentText} />
          <Text style={[styles.speedBtnText, { color: colors.accentText }]}>
            {qualityLabel}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.speedBtn, { backgroundColor: colors.accentLight }]}
          onPress={handleTogglePip}
        >
          <Ionicons name="albums-outline" size={15} color={colors.accentText} />
          <Text style={[styles.speedBtnText, { color: colors.accentText }]}>
            PiP
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
            PDF Notes ({attachments.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            activeTab === 'mynotes' && [styles.activeTab, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab('mynotes')}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={activeTab === 'mynotes' ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'mynotes' ? colors.accent : colors.textSecondary },
            ]}
          >
            My Notes
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
            Info
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

        {activeTab === 'mynotes' && (
          <View style={[styles.notesContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.notesHeader}>
              <View style={styles.notesHeaderLeft}>
                <Ionicons name="pencil" size={16} color={colors.accent} />
                <Text style={[styles.notesTitle, { color: colors.text }]}>Personal Revision Scratchpad</Text>
              </View>
              {noteSaved && (
                <View style={styles.savedPill}>
                  <Ionicons name="checkmark-circle" size={13} color="#10b981" />
                  <Text style={styles.savedText}>Saved</Text>
                </View>
              )}
            </View>
            <TextInput
              style={[
                styles.notesInput,
                { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
              multiline
              numberOfLines={8}
              placeholder="Jot down important formulas, timestamps, and questions for this lecture..."
              placeholderTextColor={colors.textSecondary}
              value={personalNote}
              onChangeText={handleNoteChange}
              textAlignVertical="top"
            />
            <Text style={[styles.notesHint, { color: colors.textSecondary }]}>
              Notes are auto-saved locally on your phone and available anytime.
            </Text>
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

      {/* Video Quality Modal */}
      <Modal
        visible={showQualityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQualityModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowQualityModal(false)}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Streaming Quality</Text>
            {availableQualities.map((item) => {
              const selected = selectedQuality === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.speedOption,
                    selected && { backgroundColor: colors.accentLight },
                  ]}
                  onPress={() => handleSelectQuality(item.id, item.label)}
                >
                  <Text
                    style={[
                      styles.speedOptionText,
                      { color: selected ? colors.accentText : colors.text },
                    ]}
                  >
                    {item.label} {item.id === -1 ? '(Adaptive Zero-Buffer)' : ''}
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
    position: 'relative',
  },
  seekFeedbackOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  seekLeft: {
    left: 10,
  },
  seekRight: {
    right: 10,
  },
  seekFeedbackText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  resumeToastWrap: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  resumeToastText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
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
  notesContainer: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 120,
  },
  notesHint: {
    fontSize: 11,
    marginTop: 8,
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
