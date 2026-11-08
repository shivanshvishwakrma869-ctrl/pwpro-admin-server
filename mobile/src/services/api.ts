import AsyncStorage from '@react-native-async-storage/async-storage';
import { encodePayload, decodePayload } from '../utils/crypto';
import { Batch, Subject, Topic, Lecture, Attachment, WatchHistoryItem } from '../types';

export const BASE_URL = 'https://pw.akkistudyx.in';
export const DEFAULT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M';

const randomClientId = 'client_' + Math.random().toString(36).substring(2, 12);

// Image formatter matching the website
export function formatImageUrl(image: any): string {
  if (!image) {
    return 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/4df42d8f-a9cb-4be3-9799-aeb11b152ca6.png';
  }
  if (typeof image === 'string') {
    const t = image.trim();
    if (!t) return 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/4df42d8f-a9cb-4be3-9799-aeb11b152ca6.png';
    if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:')) {
      return t;
    }
    if (t.startsWith('/')) {
      return `${BASE_URL}${t}`;
    }
    return `https://static.pw.live/${t.replace(/^\/+/, '')}`;
  }
  if (typeof image === 'object') {
    if (typeof image.url === 'string' && image.url.trim().length > 0) {
      return image.url.trim();
    }
    const key = (image.key || image.name || image.file || '').toString().trim().replace(/^\/+/, '');
    const baseUrl = image.baseUrl ? image.baseUrl.trim() : 'https://static.pw.live/';
    if (key) {
      return `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}${key}`;
    }
    if (baseUrl && (baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
      return baseUrl;
    }
  }
  return 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/4df42d8f-a9cb-4be3-9799-aeb11b152ca6.png';
}

// Low-level proxy requester for PW API endpoints through website
export async function fetchFromProxy<T = any>(apiPath: string, customToken?: string): Promise<T> {
  const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const token = (customToken || DEFAULT_TOKEN).replace(/^Bearer\s+/i, '').trim();
  const encodedPath = encodePayload({ path: normalizedPath });
  const url = `${BASE_URL}/api/q?t=${encodeURIComponent(encodedPath)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'client-type': 'WEB',
      client_type: 'WEB',
      'client-version': '1.0.0',
      'X-Shield-Encode': '1',
      randomId: randomClientId,
      Authorization: `Bearer ${token}`,
      token: token,
    },
  });

  if (!res.ok) {
    throw new Error(`Proxy error ${res.status}: ${res.statusText}`);
  }

  const rawJson = await res.json();
  const decoded = decodePayload(rawJson);
  return (decoded ?? rawJson) as T;
}

// In-memory cache for ultra-fast navigation
let memoryBatchesCache: Batch[] | null = null;

// 1. Get All Batches with Smart Caching
export async function getBatches(forceRefresh = false): Promise<Batch[]> {
  try {
    if (!forceRefresh && memoryBatchesCache && memoryBatchesCache.length > 0) {
      return memoryBatchesCache;
    }

    // Check local cache first for instant startup
    if (!forceRefresh) {
      try {
        const cached = await AsyncStorage.getItem('ns_batches_cache_v4');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
            // Keep in memory and return
            memoryBatchesCache = parsed.data;
            if (Date.now() - parsed.timestamp < 6 * 3600 * 1000) {
              return parsed.data;
            }
          }
        }
      } catch (e) {
        console.warn('Cache read warning:', e);
      }
    }

    const res = await fetchFromProxy<any>('/__batches_list__');
    let list: any[] = [];
    if (Array.isArray(res)) {
      list = res;
    } else if (res && typeof res === 'object') {
      if (Array.isArray(res.batches)) {
        list = res.batches;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      } else {
        list = Object.values(res);
      }
    }

    const mapped: Batch[] = list.map((item: any) => {
      const id = item._id || item.id || item.slug;
      const classes = Array.isArray(item.classes)
        ? item.classes
        : item.class
        ? [item.class]
        : [];
      return {
        _id: id,
        id: id,
        name: item.name || item.title || 'Physics Wallah Batch',
        slug: item.slug || id,
        language:
          typeof item.language === 'string'
            ? item.language
            : item.languageDetails?.name || 'Hinglish',
        image: formatImageUrl(item.previewImage || item.image),
        classes: classes,
        fee: item.fee?.total || 0,
        byName: item.byName || item.exam || item.category || 'Physics Wallah',
        startDate: item.startDate,
        endDate: item.endDate,
      };
    });

    if (mapped.length > 0) {
      memoryBatchesCache = mapped;
      // Store compact snapshot (first 1500 batches) in AsyncStorage to avoid Android CursorWindow limits
      AsyncStorage.setItem(
        'ns_batches_cache_v4',
        JSON.stringify({ timestamp: Date.now(), data: mapped.slice(0, 1500) })
      ).catch(() => {});
    }

    return mapped;
  } catch (error) {
    console.error('getBatches failed:', error);
    // If network fails, attempt to read old cache as fallback
    try {
      const cached = await AsyncStorage.getItem('ns_batches_cache_v4');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.data)) return parsed.data;
      }
    } catch {}
    return [];
  }
}

// 2. Get Single Batch Details with its Subjects
export async function getBatchDetails(batchIdOrSlug: string): Promise<Batch | null> {
  try {
    const res = await fetchFromProxy<any>(`/v3/batches/${batchIdOrSlug}/details`);
    const data = res?.data || res;
    if (!data) return null;

    const subjects = (data.subjects || []).map((s: any) => ({
      _id: s._id || s.id,
      id: s._id || s.id,
      title: s.subject || s.title || 'Subject',
      subject: s.subject || s.title || 'Subject',
      slug: s.slug || s._id,
      previewImage: s.previewImage || s.image,
      teachers: (s.teachers || []).map((t: any) => (typeof t === 'string' ? t : t?.name || '')),
    }));

    return {
      _id: data._id || data.id || batchIdOrSlug,
      id: data._id || data.id || batchIdOrSlug,
      name: data.name || data.title || 'Physics Wallah Batch',
      slug: data.slug || batchIdOrSlug,
      language:
        typeof data.language === 'string'
          ? data.language
          : data.languageDetails?.name || 'Hinglish',
      image: formatImageUrl(data.previewImage || data.image),
      classes: data.classes || [],
      fee: data.fee?.total || 0,
      subjects: subjects,
      byName: data.byName || 'Physics Wallah',
      startDate: data.startDate,
      endDate: data.endDate,
    };
  } catch (err) {
    console.error('getBatchDetails error:', err);
    return null;
  }
}

// 3. Get Topics for a given Batch & Subject
export async function getTopics(batchId: string, subjectId: string): Promise<Topic[]> {
  try {
    let res: any;
    try {
      res = await fetchFromProxy(`/v1/batches/${batchId}/subject/${subjectId}/topics?page=1&limit=60`);
    } catch {
      res = await fetchFromProxy(
        `/batch-service/v1/batch-tags/${batchId}/subject/${subjectId}/topics?page=1&limit=60`
      );
    }
    const rawList = Array.isArray(res) ? res : res?.data || [];
    return rawList.map((t: any) => ({
      _id: t._id || t.id,
      id: t._id || t.id,
      name: t.name || t.title || 'Topic',
      slug: t.slug || t._id,
      lecturesCount: t.videos ?? t.lectureVideos ?? t.lecturesCount ?? t.videosCount ?? 0,
      notesCount: t.notes ?? t.notesCount ?? 0,
      dppCount: t.exercises ?? t.dppCount ?? 0,
    }));
  } catch (err) {
    console.error('getTopics error:', err);
    return [];
  }
}

// 4. Get Lectures inside a Topic
export async function getTopicLectures(
  batchId: string,
  subjectId: string,
  topicId: string,
  topicSlug?: string
): Promise<Lecture[]> {
  try {
    let items: any[] = [];
    const targetTag = topicSlug || topicId;

    // Strategy 1: v2 batches contents with tag filter (matches website and returns full lectures)
    try {
      const r1: any = await fetchFromProxy(
        `/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&contentType=videos&tag=${encodeURIComponent(
          targetTag
        )}`
      );
      if (Array.isArray(r1) && r1.length > 0) items = r1;
      else if (Array.isArray(r1?.data) && r1.data.length > 0) items = r1.data;
    } catch {}

    // Strategy 2: If tag had no results, try with topicId
    if (items.length === 0 && topicSlug && topicSlug !== topicId) {
      try {
        const r2: any = await fetchFromProxy(
          `/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&contentType=videos&tag=${encodeURIComponent(
            topicId
          )}`
        );
        if (Array.isArray(r2) && r2.length > 0) items = r2;
        else if (Array.isArray(r2?.data) && r2.data.length > 0) items = r2.data;
      } catch {}
    }

    // Strategy 3: Batch-service schedule contents
    if (items.length === 0) {
      try {
        const r3: any = await fetchFromProxy(
          `/batch-service/v3/batch-subject-schedules/${batchId}/subject/${subjectId}/contents?skip=0&limit=50&contentType=videos&tagId=${topicId}`
        );
        if (Array.isArray(r3) && r3.length > 0) items = r3;
        else if (Array.isArray(r3?.data) && r3.data.length > 0) items = r3.data;
      } catch {}
    }

    // Strategy 4: Fallback to all subject videos filtered by tag
    if (items.length === 0) {
      try {
        const r4: any = await fetchFromProxy(
          `/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&contentType=videos`
        );
        const candidate = Array.isArray(r4) ? r4 : r4?.data || [];
        if (candidate.length > 0) {
          const filtered = candidate.filter((item: any) =>
            Array.isArray(item.tags)
              ? item.tags.some(
                  (tg: any) =>
                    (tg._id || tg.id || tg) === topicId ||
                    (tg.slug && tg.slug === targetTag)
                )
              : true
          );
          items = filtered.length > 0 ? filtered : candidate;
        }
      } catch {}
    }

    return items.map((item: any) => {
      const vDetails = item.videoDetails || {};
      const childId = item.childId || item.scheduleId || item._id;
      const videoId = item.videoId || vDetails.videoId || vDetails._id || item._id;

      return {
        _id: item._id || item.id || childId,
        id: item._id || item.id || childId,
        title: item.title || item.topic || vDetails.name || 'Lecture',
        scheduleId: childId,
        videoId: videoId,
        duration: vDetails.duration || item.duration || '0 min',
        startTime: item.startTime || item.date,
        teacher: (item.teachers && item.teachers[0]?.name) || item.faculty || 'PW Teacher',
        date: item.date || item.createdAt,
        videoDetails: {
          _id: videoId,
          videoId: videoId,
          videoUrl: item.videoUrl || vDetails.videoUrl || item.streamUrl || '',
          duration: vDetails.duration || 0,
          name: item.title || vDetails.name,
          image: formatImageUrl(vDetails.image || item.image),
        },
      };
    });
  } catch (err) {
    console.error('getTopicLectures error:', err);
    return [];
  }
}

// 4b. Get PDF Notes inside a Topic (for chapters or PDF-only folders)
export async function getTopicNotes(
  batchId: string,
  subjectId: string,
  topicId: string,
  topicSlug?: string
): Promise<Attachment[]> {
  try {
    const targetTag = topicSlug || topicId;
    let res: any;
    try {
      res = await fetchFromProxy(
        `/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&contentType=notes&tag=${encodeURIComponent(
          targetTag
        )}`
      );
    } catch {
      res = await fetchFromProxy(
        `/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&contentType=notes&tag=${encodeURIComponent(
          topicId
        )}`
      );
    }

    const items = Array.isArray(res) ? res : res?.data || [];
    const notes: Attachment[] = [];

    items.forEach((item: any) => {
      if (Array.isArray(item.homeworkIds)) {
        item.homeworkIds.forEach((hw: any) => {
          if (Array.isArray(hw.attachmentIds)) {
            hw.attachmentIds.forEach((att: any) => {
              const fileKey = (att.key || att.name || '').toString().replace(/^\/+/, '');
              const dlUrl = att.baseUrl
                ? `${att.baseUrl.replace(/\/+$/, '')}/${fileKey}`
                : `https://d2bps9p1kiy4ka.cloudfront.net/${fileKey}`;

              notes.push({
                _id: att._id || hw._id,
                id: att._id || hw._id,
                name: att.name || hw.topic || 'Lecture Note.pdf',
                title: hw.topic || att.name || 'Lecture Notes',
                attachmentUrl: dlUrl,
                key: att.key,
                baseUrl: att.baseUrl,
                type: 'NOTES',
              });
            });
          }
        });
      }
    });

    return notes;
  } catch (err) {
    console.error('getTopicNotes error:', err);
    return [];
  }
}

// 5. Build Direct Fast Stream URL (Zero-buffer HLS stream with signed token)
export async function getFastStreamUrl(params: {
  videoId?: string;
  scheduleId?: string;
  videoKey?: string;
  batchId?: string;
  subjectId?: string;
  topicId?: string;
  title?: string;
  url?: string;
  directVideoUrl?: string;
}): Promise<string> {
  // Always use the verified CORS-enabled HLS proxy manifest which auto-refreshes segments
  // and avoids 403 Forbidden errors from raw unsigned CloudFront MPD/M3U8 URLs
  return getStreamUrl(params);
}

// Low-level proxy HLS URL builder
export function getStreamUrl(params: {
  videoId?: string;
  scheduleId?: string;
  videoKey?: string;
  batchId?: string;
  subjectId?: string;
  topicId?: string;
  title?: string;
  url?: string;
}): string {
  const tokenPayload = encodePayload({
    videoId: params.videoId || '',
    scheduleId: params.scheduleId || '',
    videoKey: params.videoKey || '',
    batchId: params.batchId || '',
    subjectId: params.subjectId || '',
    topicId: params.topicId || '',
    title: params.title || '',
    url: params.url || '',
  });
  return `${BASE_URL}/api/m?t=${encodeURIComponent(tokenPayload)}`;
}

// 6. Get Lecture Attachments (Notes, DPP, Solutions)
export async function getAttachments(params: {
  batchId: string;
  subjectId: string;
  scheduleId: string;
  title?: string;
}): Promise<Attachment[]> {
  try {
    const payload = encodePayload({
      batchId: params.batchId,
      subjectId: params.subjectId,
      scheduleId: params.scheduleId,
      title: params.title || 'Lecture',
    });
    const res = await fetch(`${BASE_URL}/api/a?t=${encodeURIComponent(payload)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.data || [];

    return list.map((att: any) => {
      let downloadUrl = att.attachmentUrl || att.url || '';
      if (!downloadUrl && (att.key || att.name)) {
        const fileKey = (att.key || att.name).toString().replace(/^\/+/, '');
        downloadUrl = `https://d2bps9p1kiy4ka.cloudfront.net/${fileKey}`;
      }
      return {
        _id: att._id || att.id,
        id: att._id || att.id,
        name: att.name || att.title || 'Lecture Notes.pdf',
        title: att.title || att.name || 'Lecture Notes',
        attachmentUrl: downloadUrl,
        key: att.key,
        baseUrl: att.baseUrl,
        type: att.type || 'NOTES',
      };
    });
  } catch (err) {
    console.error('getAttachments error:', err);
    return [];
  }
}

// 7. Watch History Management (Continue Watching feature)
export async function getWatchHistory(): Promise<WatchHistoryItem[]> {
  try {
    const stored = await AsyncStorage.getItem('pwpro_watch_history');
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export async function saveWatchHistory(item: WatchHistoryItem): Promise<void> {
  try {
    const history = await getWatchHistory();
    const filtered = history.filter((h) => h.lectureId !== item.lectureId);
    filtered.unshift(item);
    // Keep last 15 items
    const limited = filtered.slice(0, 15);
    await AsyncStorage.setItem('pwpro_watch_history', JSON.stringify(limited));
  } catch (e) {
    console.error('Failed to save watch history', e);
  }
}

// 8. Personal Lecture Notes (In-App Scratchpad feature)
export async function getLectureNote(lectureId: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(`pwpro_note_${lectureId}`)) || '';
  } catch {
    return '';
  }
}

export async function saveLectureNote(lectureId: string, noteText: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`pwpro_note_${lectureId}`, noteText);
  } catch (e) {
    console.error('Failed to save note', e);
  }
}
