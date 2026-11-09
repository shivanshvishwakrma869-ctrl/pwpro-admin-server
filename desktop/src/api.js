// PW Pro Desktop API Service
const BASE_URL = 'https://pw.akkistudyx.in';
const DEFAULT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M';
const ADMIN_BASE_URL = 'https://pwpro-admin-server.vercel.app';

const randomClientId = 'desktop_' + Math.random().toString(36).substring(2, 12);

function formatImageUrl(image) {
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

async function fetchFromProxy(apiPath, customToken) {
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
  return decoded ?? rawJson;
}

let batchesCache = null;

async function getBatches(force = false) {
  if (!force && batchesCache && batchesCache.length > 0) {
    return batchesCache;
  }
  const local = localStorage.getItem('pw_desktop_batches_v1');
  if (!force && local) {
    try {
      const parsed = JSON.parse(local);
      if (Date.now() - parsed.time < 6 * 3600 * 1000 && parsed.data.length > 0) {
        batchesCache = parsed.data;
        return parsed.data;
      }
    } catch {}
  }

  const res = await fetchFromProxy('/__batches_list__');
  let list = [];
  if (Array.isArray(res)) {
    list = res;
  } else if (res && typeof res === 'object') {
    if (Array.isArray(res.batches)) list = res.batches;
    else if (Array.isArray(res.data)) list = res.data;
    else list = Object.values(res);
  }

  const mapped = list.map((item) => {
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
    batchesCache = mapped;
    try {
      localStorage.setItem('pw_desktop_batches_v1', JSON.stringify({ time: Date.now(), data: mapped.slice(0, 1500) }));
    } catch {}
  }
  return mapped;
}

async function getBatchDetails(batchIdOrSlug) {
  try {
    let data = null;
    try {
      data = await fetchFromProxy(`/v1/batches/${batchIdOrSlug}/details`);
    } catch {
      data = await fetchFromProxy(`/batch-service/v1/batches/${batchIdOrSlug}/details`);
    }
    if (!data) return null;

    const subjects = (data.subjects || []).map((s) => ({
      _id: s._id || s.id,
      id: s._id || s.id,
      title: s.subject || s.title || 'Subject',
      subject: s.subject || s.title || 'Subject',
      slug: s.slug || s._id,
      previewImage: s.previewImage || s.image,
      teachers: (s.teachers || []).map((t) => (typeof t === 'string' ? t : t?.name || '')),
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

async function getTopics(batchId, subjectId) {
  try {
    let res = null;
    try {
      res = await fetchFromProxy(`/v1/batches/${batchId}/subject/${subjectId}/topics?page=1&limit=60`);
    } catch {
      res = await fetchFromProxy(`/batch-service/v1/batch-tags/${batchId}/subject/${subjectId}/topics?page=1&limit=60`);
    }
    const rawList = Array.isArray(res) ? res : res?.data || [];
    return rawList.map((t) => ({
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

async function getTopicLectures(batchId, subjectId, topicId, topicSlug) {
  try {
    let items = [];
    const targetTag = topicSlug || topicId;
    const paths = [
      `/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&tag=${targetTag}&contentType=videos`,
      `/v1/batches/${batchId}/subject/${subjectId}/contents?page=1&tag=${targetTag}&contentType=videos`,
      `/batch-service/v1/batches/${batchId}/subject/${subjectId}/contents?page=1&tag=${targetTag}&contentType=videos`,
    ];

    for (const p of paths) {
      try {
        const res = await fetchFromProxy(p);
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0) {
          items = list;
          break;
        }
      } catch {}
    }

    return items.map((item) => {
      let streamUrl = '';
      if (item.url) streamUrl = item.url;
      else if (item.videoUrl) streamUrl = item.videoUrl;
      else if (item.videoDetails?.videoUrl) streamUrl = item.videoDetails.videoUrl;
      else if (item.videoDetails?.url) streamUrl = item.videoDetails.url;

      return {
        _id: item._id || item.id,
        id: item._id || item.id,
        title: item.topic || item.title || 'Lecture',
        topic: item.topic || item.title || 'Lecture',
        duration: item.duration || '00:00',
        date: item.date || item.createdAt || '',
        videoUrl: streamUrl,
        url: streamUrl,
        type: item.type || 'video',
        image: formatImageUrl(item.image || item.thumbnail),
        faculty: item.faculty || item.teacher || '',
      };
    });
  } catch (err) {
    console.error('getTopicLectures error:', err);
    return [];
  }
}

async function getTopicNotes(batchId, subjectId, topicId, topicSlug) {
  try {
    let items = [];
    const targetTag = topicSlug || topicId;
    const paths = [
      `/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&tag=${targetTag}&contentType=notes`,
      `/v1/batches/${batchId}/subject/${subjectId}/contents?page=1&tag=${targetTag}&contentType=notes`,
      `/batch-service/v1/batches/${batchId}/subject/${subjectId}/contents?page=1&tag=${targetTag}&contentType=notes`,
    ];

    for (const p of paths) {
      try {
        const res = await fetchFromProxy(p);
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0) {
          items = list;
          break;
        }
      } catch {}
    }

    const notes = [];
    items.forEach((item) => {
      const attachments = item.homeworkIds || item.attachments || [];
      if (Array.isArray(attachments) && attachments.length > 0) {
        attachments.forEach((att) => {
          let pdfUrl = att.attachmentIds?.[0]?.baseUrl && att.attachmentIds?.[0]?.key
            ? `${att.attachmentIds[0].baseUrl.replace(/\/+$/, '')}/${att.attachmentIds[0].key.replace(/^\/+/, '')}`
            : att.attachmentIds?.[0]?.url || att.url || att.link || '';

          notes.push({
            _id: att._id || att.id || Math.random().toString(36).slice(2),
            id: att._id || att.id || Math.random().toString(36).slice(2),
            name: att.topic || att.name || item.topic || 'Chapter Note PDF',
            title: att.topic || att.name || item.topic || 'Chapter Note PDF',
            url: pdfUrl,
            date: item.date || att.createdAt || '',
          });
        });
      } else if (item.url || item.documentUrl) {
        notes.push({
          _id: item._id || item.id,
          id: item._id || item.id,
          name: item.topic || item.title || 'Chapter Note PDF',
          title: item.topic || item.title || 'Chapter Note PDF',
          url: item.url || item.documentUrl,
          date: item.date || item.createdAt || '',
        });
      }
    });

    return notes;
  } catch (err) {
    console.error('getTopicNotes error:', err);
    return [];
  }
}

// Admin & Activation Backend Client
const AdminAPI = {
  async activateKey(keyCode, deviceId) {
    const res = await fetch(`${ADMIN_BASE_URL}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyCode.trim().toUpperCase(), deviceId }),
    });
    return res.json();
  },

  async verifyDevice(deviceId) {
    const res = await fetch(`${ADMIN_BASE_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    return res.json();
  },

  async getAnnouncement() {
    const res = await fetch(`${ADMIN_BASE_URL}/api/announcement`);
    return res.json();
  },

  async updateAnnouncement(password, message, active) {
    const res = await fetch(`${ADMIN_BASE_URL}/api/admin/announcement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, message, active }),
    });
    return res.json();
  },

  async getAdminKeys(password) {
    const res = await fetch(`${ADMIN_BASE_URL}/api/admin/keys?password=${encodeURIComponent(password)}`);
    return res.json();
  },

  async createAdminKeys(password, count = 1, validityDays = 0) {
    const res = await fetch(`${ADMIN_BASE_URL}/api/admin/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, count, validityDays }),
    });
    return res.json();
  },

  async revokeKey(password, id) {
    const res = await fetch(`${ADMIN_BASE_URL}/api/admin/keys/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return res.json();
  },

  async resetKeyDevice(password, key) {
    const res = await fetch(`${ADMIN_BASE_URL}/api/admin/reset-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, key }),
    });
    return res.json();
  },
};
