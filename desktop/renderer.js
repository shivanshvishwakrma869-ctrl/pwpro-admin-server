// PW Pro Desktop VIP Renderer
let currentDeviceId = 'WIN-STANDALONE';
let adminUnlocked = false;
let allBatches = [];
let currentCategory = 'All';
let currentBatch = null;
let currentSubjects = [];
let currentSelectedSubject = null;
let currentTopics = [];
let currentFilteredTopics = [];
let currentTopicFilter = 'all';
let currentTopic = null;
let currentLectures = [];
let currentNotes = [];
let currentPlayingLecture = null;
let hlsInstance = null;

// Category definitions with icons
const CATEGORIES = [
  { name: 'All', icon: 'grid' },
  { name: 'Physics Wallah', icon: 'school' },
  { name: 'Next Toppers', icon: 'trophy' },
  { name: 'JEE', icon: 'calculator' },
  { name: 'NEET', icon: 'medkit' },
  { name: 'Class 12', icon: 'layers' },
  { name: 'Class 11', icon: 'layers' },
  { name: 'Class 10', icon: 'layers' },
  { name: 'Foundation', icon: 'compass' },
  { name: 'NDA', icon: 'shield' },
];

// Helper to switch main views
function switchView(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

// 1. Initial Launch & Hardware Activation
async function initApp() {
  if (window.desktopAPI && window.desktopAPI.getDeviceId) {
    currentDeviceId = await window.desktopAPI.getDeviceId();
  }
  document.getElementById('display-hardware-id').textContent = currentDeviceId;

  // Check saved license
  const savedKey = localStorage.getItem('pw_vip_key');
  const isActivated = localStorage.getItem('pw_activated') === 'true';

  if (!isActivated || !savedKey) {
    showActivationModal();
  } else {
    // Verify device in background
    AdminAPI.verifyDevice(currentDeviceId).then((res) => {
      if (res && res.active) {
        updateVipBadge(res.key, res.expiresAt);
      } else {
        showActivationModal();
      }
    }).catch(() => {
      // Offline fallback: allow access if already activated
      updateVipBadge(savedKey, null);
    });
  }

  // Load Announcement
  loadAnnouncement();

  // Load Batches
  renderCategories();
  loadBatches();

  // Load Continue Watching
  renderContinueWatching();

  // Setup Event Listeners
  setupEventListeners();
}

function showActivationModal() {
  document.getElementById('modal-activation').style.display = 'flex';
}

function updateVipBadge(key, expiresAt) {
  const pill = document.getElementById('vip-status-pill');
  const text = document.getElementById('vip-status-text');
  if (expiresAt) {
    const diffDays = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 3600 * 24));
    if (diffDays > 0) {
      text.textContent = `VIP Active: ${diffDays}d left`;
    } else {
      text.textContent = `VIP Expired`;
      pill.style.borderColor = 'var(--red)';
      showActivationModal();
      return;
    }
  } else {
    text.textContent = 'Lifetime VIP Active';
  }
  pill.style.display = 'flex';
}

// Live Announcement
async function loadAnnouncement() {
  try {
    const res = await AdminAPI.getAnnouncement();
    if (res && res.active && res.message) {
      document.getElementById('announcement-text').textContent = res.message;
      document.getElementById('live-announcement').style.display = 'flex';
    } else {
      document.getElementById('live-announcement').style.display = 'none';
    }
  } catch {}
}

// Category Tabs
function renderCategories() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = `category-chip ${cat.name === currentCategory ? 'active' : ''}`;
    btn.textContent = cat.name;
    btn.addEventListener('click', () => {
      currentCategory = cat.name;
      document.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      filterBatches();
    });
    container.appendChild(btn);
  });
}

// Load Batches
async function loadBatches() {
  try {
    const batches = await getBatches();
    allBatches = batches;
    filterBatches();
  } catch (err) {
    document.getElementById('batches-grid').innerHTML = `
      <div class="error-msg" style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <p>Unable to load batches. Check internet connection.</p>
        <button class="primary-btn" style="width: 140px; margin-top: 10px;" onclick="loadBatches()">Retry</button>
      </div>`;
  }
}

function filterBatches() {
  const query = document.getElementById('global-search').value.toLowerCase().trim();
  let filtered = allBatches;

  if (currentCategory !== 'All') {
    const catLower = currentCategory.toLowerCase();
    if (catLower === 'next toppers') {
      filtered = filtered.filter((b) =>
        b.name.toLowerCase().includes('next topper') ||
        (b.byName && b.byName.toLowerCase().includes('next topper')) ||
        b.slug.toLowerCase().includes('next-topper')
      );
    } else if (catLower === 'physics wallah') {
      filtered = filtered.filter((b) =>
        !b.name.toLowerCase().includes('next topper') &&
        (!b.byName || !b.byName.toLowerCase().includes('next topper'))
      );
    } else {
      filtered = filtered.filter((b) =>
        b.name.toLowerCase().includes(catLower) ||
        (b.byName && b.byName.toLowerCase().includes(catLower)) ||
        (b.classes && b.classes.some((c) => c.toLowerCase().includes(catLower)))
      );
    }
  }

  if (query) {
    filtered = filtered.filter((b) =>
      b.name.toLowerCase().includes(query) ||
      (b.language && b.language.toLowerCase().includes(query)) ||
      (b.byName && b.byName.toLowerCase().includes(query))
    );
  }

  document.getElementById('batch-category-title').textContent =
    currentCategory === 'All' ? 'All Batches' : `${currentCategory} Batches`;
  document.getElementById('batch-results-count').textContent = `Showing ${filtered.length} batches`;

  renderBatchesGrid(filtered);
}

function renderBatchesGrid(list) {
  const grid = document.getElementById('batches-grid');
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">No batches found matching your criteria.</div>`;
    return;
  }

  list.forEach((b) => {
    const card = document.createElement('div');
    card.className = 'batch-card';
    card.innerHTML = `
      <div class="batch-card-img-wrap">
        <img src="${b.image}" alt="${b.name}" loading="lazy">
        <span class="batch-vip-overlay">&#9733; VIP UNLOCKED</span>
      </div>
      <div class="batch-card-body">
        <div class="batch-tag-row">
          <span class="tag-pill accent-tag">${b.language}</span>
          <span class="tag-pill">${b.byName || 'Physics Wallah'}</span>
        </div>
        <h4 class="batch-card-title">${b.name}</h4>
        <div class="batch-card-footer">
          <span class="full-access-text">&#10004; Full Access</span>
          <span class="explore-pill">Explore Curriculum &rarr;</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => openBatchDetail(b));
    grid.appendChild(card);
  });
}

// 2. Batch Detail & Pinned Subjects
async function openBatchDetail(batch) {
  currentBatch = batch;
  switchView('view-batch-detail');

  document.getElementById('detail-batch-name').textContent = batch.name;
  document.getElementById('detail-batch-title').textContent = batch.name;
  document.getElementById('detail-batch-image').src = batch.image;
  document.getElementById('detail-batch-lang').textContent = batch.language || 'Hinglish';
  document.getElementById('detail-batch-faculty').textContent = batch.byName || 'Physics Wallah';

  document.getElementById('pinned-subjects-list').innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">Loading subjects...</span>';
  document.getElementById('chapters-list').innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading curriculum...</p></div>';

  const details = await getBatchDetails(batch.slug || batch._id);
  if (!details || !details.subjects || details.subjects.length === 0) {
    document.getElementById('pinned-subjects-list').innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">No subjects available.</span>';
    document.getElementById('chapters-list').innerHTML = '';
    return;
  }

  currentSubjects = details.subjects;
  renderPinnedSubjects();
  selectSubject(currentSubjects[0]);
}

function getSubjectIcon(title) {
  const t = title.toLowerCase();
  if (t.includes('physic')) return '&#9889;';
  if (t.includes('chem')) return '&#9879;';
  if (t.includes('math')) return '&#8734;';
  if (t.includes('bio') || t.includes('botan') || t.includes('zool')) return '&#127807;';
  return '&#128214;';
}

function renderPinnedSubjects() {
  const container = document.getElementById('pinned-subjects-list');
  container.innerHTML = '';
  currentSubjects.forEach((sub) => {
    const btn = document.createElement('button');
    btn.className = `subject-tab ${currentSelectedSubject && currentSelectedSubject._id === sub._id ? 'active' : ''}`;
    btn.innerHTML = `<span>${getSubjectIcon(sub.title)}</span><span>${sub.title}</span>`;
    btn.addEventListener('click', () => selectSubject(sub));
    container.appendChild(btn);
  });
}

async function selectSubject(sub) {
  currentSelectedSubject = sub;
  renderPinnedSubjects();

  document.getElementById('chapters-list').innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading chapters...</p></div>';
  const topics = await getTopics(currentBatch._id, sub._id);
  currentTopics = topics;
  filterChapters();
}

function filterChapters() {
  const query = document.getElementById('chapter-search').value.toLowerCase().trim();
  let list = currentTopics;

  if (currentTopicFilter === 'videos') {
    list = list.filter((t) => (t.lecturesCount || 0) > 0);
  } else if (currentTopicFilter === 'notes') {
    list = list.filter((t) => (t.notesCount || 0) > 0);
  }

  if (query) {
    list = list.filter((t) => t.name.toLowerCase().includes(query));
  }

  currentFilteredTopics = list;
  renderChaptersList(list);
}

function renderChaptersList(list) {
  const container = document.getElementById('chapters-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">No chapters found matching filter.</div>`;
    return;
  }

  list.forEach((topic, idx) => {
    const card = document.createElement('div');
    card.className = 'chapter-card';
    card.innerHTML = `
      <div class="chapter-card-left">
        <div class="chapter-index-box">${String(idx + 1).padStart(2, '0')}</div>
        <div class="chapter-card-meta">
          <h4 class="chapter-title">${topic.name}</h4>
          <div class="chapter-badges">
            ${topic.lecturesCount > 0 ? `<span class="tag-pill accent-tag">&#9654; ${topic.lecturesCount} Lectures</span>` : ''}
            ${topic.notesCount > 0 ? `<span class="tag-pill green-tag">&#128196; ${topic.notesCount} PDF Notes</span>` : ''}
          </div>
        </div>
      </div>
      <span class="explore-pill">Open &rarr;</span>
    `;
    card.addEventListener('click', () => openChapterRoom(topic));
    container.appendChild(card);
  });
}

// 3. Chapter Study Room & Video Player
async function openChapterRoom(topic) {
  currentTopic = topic;
  switchView('view-chapter-room');

  document.getElementById('study-batch-crumb').textContent = currentBatch.name;
  document.getElementById('study-subject-crumb').textContent = currentSelectedSubject.title;
  document.getElementById('study-chapter-crumb').textContent = topic.name;

  // Reset Player & Notes
  stopVideoPlayer();
  document.getElementById('tray-lectures-list').innerHTML = '<span>Loading lectures...</span>';
  document.getElementById('pdf-tabs-list').innerHTML = '';
  document.getElementById('pdf-frame').src = '';
  document.getElementById('pdf-placeholder').style.display = 'flex';

  // Load lectures & notes concurrently
  const [lectures, notes] = await Promise.all([
    getTopicLectures(currentBatch._id, currentSelectedSubject._id, topic._id, topic.slug),
    getTopicNotes(currentBatch._id, currentSelectedSubject._id, topic._id, topic.slug),
  ]);

  currentLectures = lectures;
  currentNotes = notes;

  renderChapterLectures(lectures);
  renderChapterNotes(notes);

  if (lectures.length > 0) {
    playLecture(lectures[0]);
  }
}

function renderChapterLectures(list) {
  document.getElementById('tray-lecture-count').textContent = list.length;
  const container = document.getElementById('tray-lectures-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = `<span style="color: var(--text-secondary); padding: 10px;">No video lectures in this chapter.</span>`;
    return;
  }

  list.forEach((lec) => {
    const item = document.createElement('div');
    item.className = `lecture-tray-item ${currentPlayingLecture && currentPlayingLecture._id === lec._id ? 'active' : ''}`;
    item.innerHTML = `
      <div class="lecture-item-left">
        <span class="lecture-play-icon">&#9658;</span>
        <div>
          <div class="lecture-item-title">${lec.title}</div>
          <div class="lecture-item-duration">${lec.duration || 'Full Lecture'}</div>
        </div>
      </div>
    `;
    item.addEventListener('click', () => playLecture(lec));
    container.appendChild(item);
  });
}

function playLecture(lec) {
  currentPlayingLecture = lec;
  document.getElementById('playing-lecture-title').textContent = lec.title;
  document.getElementById('playing-lecture-info').textContent = lec.duration ? `Duration: ${lec.duration}` : 'Direct Zero-Buffer CDN Stream';

  renderChapterLectures(currentLectures);

  const video = document.getElementById('hls-video');
  document.getElementById('video-placeholder').style.display = 'none';

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  const streamUrl = lec.videoUrl || lec.url;
  if (!streamUrl) {
    alert('Video stream not available for this lecture.');
    return;
  }

  // Record into Continue Watching history
  saveWatchHistory(lec);

  if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
    hlsInstance = new Hls({
      enableWorker: true,
      maxBufferLength: 120,
      maxMaxBufferLength: 600,
      maxBufferSize: 60 * 1000 * 1000, // 60MB pre-buffer
      backBufferLength: 60,
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      buildQualityMenu(data.levels);
      
      // Auto-resume position
      const savedPos = localStorage.getItem(`pw_pos_${lec._id}`);
      if (savedPos && Number(savedPos) > 10) {
        video.currentTime = Number(savedPos);
      }

      // Apply saved speed
      const savedSpeed = localStorage.getItem('pw_speed') || '1.0';
      video.playbackRate = Number(savedSpeed);
      document.getElementById('btn-speed').textContent = `${savedSpeed}x`;

      video.play().catch(() => {});
    });
  } else {
    video.src = streamUrl;
    video.play().catch(() => {});
  }

  // Periodic position save
  video.ontimeupdate = () => {
    if (video.currentTime > 5 && video.duration) {
      localStorage.setItem(`pw_pos_${lec._id}`, String(Math.floor(video.currentTime)));
    }
  };
}

function stopVideoPlayer() {
  const video = document.getElementById('hls-video');
  video.pause();
  video.src = '';
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
}

function buildQualityMenu(levels) {
  const menu = document.getElementById('quality-menu');
  menu.innerHTML = '<button data-level="-1" class="active">Auto (Adaptive)</button>';
  levels.forEach((lvl, idx) => {
    const btn = document.createElement('button');
    btn.dataset.level = idx;
    btn.textContent = `${lvl.height}p (${Math.round(lvl.bitrate / 1000)}k)`;
    btn.addEventListener('click', () => {
      if (hlsInstance) {
        hlsInstance.currentLevel = idx;
        document.getElementById('btn-quality').textContent = `${lvl.height}p`;
        menu.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
    menu.appendChild(btn);
  });
  menu.querySelector('[data-level="-1"]').addEventListener('click', () => {
    if (hlsInstance) {
      hlsInstance.currentLevel = -1;
      document.getElementById('btn-quality').textContent = 'Quality: Auto';
      menu.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      menu.querySelector('[data-level="-1"]').classList.add('active');
    }
  });
}

// PDF Notes
function renderChapterNotes(notes) {
  document.getElementById('notes-count-badge').textContent = `${notes.length} PDFs`;
  const container = document.getElementById('pdf-tabs-list');
  container.innerHTML = '';

  if (notes.length === 0) {
    container.innerHTML = '<span style="color: var(--text-secondary); font-size: 12px; padding: 6px;">No PDF notes available.</span>';
    return;
  }

  notes.forEach((note, idx) => {
    const tab = document.createElement('button');
    tab.className = `pdf-tab-item ${idx === 0 ? 'active' : ''}`;
    tab.innerHTML = `<span>&#128196;</span><span>${note.name || note.title}</span>`;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pdf-tab-item').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      openPdf(note);
    });
    container.appendChild(tab);
  });

  openPdf(notes[0]);
}

function openPdf(note) {
  if (!note || !note.url) return;
  document.getElementById('pdf-placeholder').style.display = 'none';
  document.getElementById('pdf-frame').src = note.url;
}

// Continue Watching
function saveWatchHistory(lec) {
  try {
    let history = JSON.parse(localStorage.getItem('pw_watch_history') || '[]');
    history = history.filter((h) => h.lectureId !== lec._id);
    history.unshift({
      lectureId: lec._id,
      batchId: currentBatch._id,
      batchName: currentBatch.name,
      subjectId: currentSelectedSubject._id,
      subjectName: currentSelectedSubject.title,
      topicId: currentTopic._id,
      topicName: currentTopic.name,
      lecture: lec,
      savedAt: Date.now(),
    });
    localStorage.setItem('pw_watch_history', JSON.stringify(history.slice(0, 10)));
    renderContinueWatching();
  } catch {}
}

function renderContinueWatching() {
  const container = document.getElementById('continue-watching-list');
  const section = document.getElementById('continue-watching-section');
  const history = JSON.parse(localStorage.getItem('pw_watch_history') || '[]');

  if (history.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = '';

  history.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-thumb-wrap">
        <img src="${item.lecture.image || currentBatch?.image || ''}" alt="">
      </div>
      <div class="history-details">
        <div class="history-title">${item.lecture.title}</div>
        <div class="history-batch">${item.batchName}</div>
        <div class="history-progress-bar"><div class="history-progress-fill" style="width: 50%;"></div></div>
      </div>
    `;
    card.addEventListener('click', async () => {
      const b = allBatches.find((x) => x._id === item.batchId) || { _id: item.batchId, name: item.batchName };
      await openBatchDetail(b);
      const sub = currentSubjects.find((s) => s._id === item.subjectId) || currentSubjects[0];
      if (sub) await selectSubject(sub);
      const top = currentTopics.find((t) => t._id === item.topicId);
      if (top) await openChapterRoom(top);
    });
    container.appendChild(card);
  });
}

// 4. Integrated Admin Panel Suite
function openAdminSuite() {
  if (!adminUnlocked) {
    document.getElementById('modal-admin-auth').style.display = 'flex';
    document.getElementById('admin-password-input').focus();
  } else {
    switchView('view-admin');
    loadAdminData();
  }
}

async function verifyAdminPassword() {
  const pwd = document.getElementById('admin-password-input').value;
  const err = document.getElementById('admin-auth-error');
  try {
    const res = await AdminAPI.getAdminKeys(pwd);
    if (res && res.keys) {
      adminUnlocked = true;
      sessionStorage.setItem('pw_admin_pwd', pwd);
      document.getElementById('modal-admin-auth').style.display = 'none';
      switchView('view-admin');
      loadAdminData();
    } else {
      err.textContent = 'Invalid Master Admin Password.';
      err.style.display = 'block';
    }
  } catch (e) {
    err.textContent = 'Authentication failed. Please check connection.';
    err.style.display = 'block';
  }
}

async function loadAdminData() {
  const pwd = sessionStorage.getItem('pw_admin_pwd');
  if (!pwd) return;

  const tbody = document.getElementById('admin-keys-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-td">Refreshing keys from Neon DB...</td></tr>';

  try {
    const res = await AdminAPI.getAdminKeys(pwd);
    const keys = res.keys || [];
    document.getElementById('admin-keys-count').textContent = keys.length;
    tbody.innerHTML = '';

    if (keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No activation keys found in database.</td></tr>';
      return;
    }

    keys.forEach((k) => {
      const isExpired = k.is_expired || (k.expires_at && new Date(k.expires_at).getTime() < Date.now());
      let statusClass = 'unused';
      let statusLabel = 'Unused';
      if (k.is_used) {
        if (isExpired) {
          statusClass = 'expired';
          statusLabel = 'Expired';
        } else {
          statusClass = 'active';
          statusLabel = 'Active';
        }
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="key-code-td">${k.key_code}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>${k.validity_days > 0 ? `${k.validity_days} Days` : 'Lifetime'}</td>
        <td>${k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</td>
        <td><code>${k.device_id || 'Not Bound'}</code></td>
        <td>${new Date(k.created_at).toLocaleDateString()}</td>
        <td>
          <button class="secondary-btn" onclick="resetKey('${k.key_code}')">Reset Device</button>
          <button class="danger-btn" style="padding: 4px 8px; font-size: 11px;" onclick="revokeKey(${k.id})">Revoke</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--red); text-align:center;">Failed to load keys.</td></tr>';
  }
}

window.resetKey = async function(keyCode) {
  const pwd = sessionStorage.getItem('pw_admin_pwd');
  if (!confirm(`Reset device hardware binding for key ${keyCode}? The user will be able to activate a new PC/phone.`)) return;
  await AdminAPI.resetKeyDevice(pwd, keyCode);
  loadAdminData();
};

window.revokeKey = async function(id) {
  const pwd = sessionStorage.getItem('pw_admin_pwd');
  if (!confirm(`Permanently revoke key #${id}?`)) return;
  await AdminAPI.revokeKey(pwd, id);
  loadAdminData();
};

async function handleGenerateKeys() {
  const pwd = sessionStorage.getItem('pw_admin_pwd');
  const count = Number(document.getElementById('gen-count').value);
  const validity = Number(document.getElementById('gen-validity').value);

  const res = await AdminAPI.createAdminKeys(pwd, count, validity);
  if (res && res.keys) {
    const out = document.getElementById('new-keys-output');
    out.style.display = 'block';
    out.innerHTML = `<strong>Generated ${res.keys.length} Keys:</strong><br>` + res.keys.map((k) => k.key_code).join('<br>');
    loadAdminData();
  }
}

// 5. Global Event Listeners & Keyboard Shortcuts
function setupEventListeners() {
  // Brand Click -> Return to batches
  document.getElementById('btn-brand').addEventListener('click', () => switchView('view-batches'));
  document.getElementById('btn-back-to-batches').addEventListener('click', () => switchView('view-batches'));
  document.getElementById('btn-back-to-chapters').addEventListener('click', () => switchView('view-batch-detail'));

  // Search
  const searchInput = document.getElementById('global-search');
  searchInput.addEventListener('input', () => {
    document.getElementById('clear-search-btn').style.display = searchInput.value ? 'block' : 'none';
    filterBatches();
  });
  document.getElementById('clear-search-btn').addEventListener('click', () => {
    searchInput.value = '';
    document.getElementById('clear-search-btn').style.display = 'none';
    filterBatches();
  });

  // Chapter Search
  document.getElementById('chapter-search').addEventListener('input', filterChapters);
  document.querySelectorAll('.filter-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      currentTopicFilter = btn.dataset.filter;
      filterChapters();
    });
  });

  // Dual Study Mode Toggles
  document.getElementById('btn-split-mode').addEventListener('click', toggleSplitMode);
  document.getElementById('btn-view-video-only').addEventListener('click', () => setStudyMode('video'));
  document.getElementById('btn-view-split').addEventListener('click', () => setStudyMode('split'));
  document.getElementById('btn-view-notes-only').addEventListener('click', () => setStudyMode('notes'));

  // PiP
  document.getElementById('btn-pip').addEventListener('click', async () => {
    const video = document.getElementById('hls-video');
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {}
  });

  // Playback Speed
  document.querySelectorAll('#speed-menu button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = btn.dataset.speed;
      const video = document.getElementById('hls-video');
      video.playbackRate = Number(speed);
      document.getElementById('btn-speed').textContent = `${speed}x`;
      localStorage.setItem('pw_speed', speed);
      document.querySelectorAll('#speed-menu button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Download All Notes
  document.getElementById('btn-download-all-notes').addEventListener('click', async () => {
    if (!currentNotes || currentNotes.length === 0) return;
    if (window.desktopAPI && window.desktopAPI.downloadPdf) {
      alert(`Starting download of ${currentNotes.length} chapter notes to your Downloads/PW Pro Notes/ folder.`);
      for (const n of currentNotes) {
        await window.desktopAPI.downloadPdf({ url: n.url, filename: `${n.name}.pdf` });
      }
      alert('All chapter notes downloaded successfully!');
    }
  });

  // Admin Toggle
  document.getElementById('btn-admin-toggle').addEventListener('click', openAdminSuite);
  document.getElementById('btn-close-admin-auth').addEventListener('click', () => {
    document.getElementById('modal-admin-auth').style.display = 'none';
  });
  document.getElementById('btn-submit-admin-auth').addEventListener('click', verifyAdminPassword);
  document.getElementById('admin-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyAdminPassword();
  });
  document.getElementById('btn-generate-keys').addEventListener('click', handleGenerateKeys);
  document.getElementById('btn-reload-keys').addEventListener('click', loadAdminData);

  // Publish Announcement
  document.getElementById('btn-publish-announcement').addEventListener('click', async () => {
    const msg = document.getElementById('admin-announcement-input').value.trim();
    const pwd = sessionStorage.getItem('pw_admin_pwd');
    if (!msg) return;
    await AdminAPI.updateAnnouncement(pwd, msg, true);
    alert('Announcement published to all live Android and Desktop apps!');
    loadAnnouncement();
  });
  document.getElementById('btn-clear-announcement').addEventListener('click', async () => {
    const pwd = sessionStorage.getItem('pw_admin_pwd');
    await AdminAPI.updateAnnouncement(pwd, '', false);
    alert('Announcement banner cleared.');
    loadAnnouncement();
  });

  // Shortcuts Modal
  document.getElementById('btn-shortcuts').addEventListener('click', () => {
    document.getElementById('modal-shortcuts').style.display = 'flex';
  });
  document.getElementById('btn-close-shortcuts').addEventListener('click', () => {
    document.getElementById('modal-shortcuts').style.display = 'none';
  });

  // License Activation Button
  document.getElementById('btn-activate-pc').addEventListener('click', async () => {
    const key = document.getElementById('activation-key-input').value.trim();
    const err = document.getElementById('activation-error');
    if (!key) return;

    err.style.display = 'none';
    try {
      const res = await AdminAPI.activateKey(key, currentDeviceId);
      if (res && res.success) {
        localStorage.setItem('pw_vip_key', key);
        localStorage.setItem('pw_activated', 'true');
        document.getElementById('modal-activation').style.display = 'none';
        updateVipBadge(key, res.expiresAt);
        alert('PC Successfully Activated! Welcome to PW Pro VIP.');
      } else {
        err.textContent = res.error || 'Invalid or already used key.';
        err.style.display = 'block';
      }
    } catch (e) {
      err.textContent = 'Activation error. Please check internet connection.';
      err.style.display = 'block';
    }
  });

  // Keyboard Shortcuts (Space, Arrows, F, P, D, Ctrl+K)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    const video = document.getElementById('hls-video');

    if (e.code === 'Space') {
      e.preventDefault();
      if (video.paused) video.play();
      else video.pause();
    } else if (e.code === 'ArrowLeft') {
      video.currentTime = Math.max(0, video.currentTime - 10);
    } else if (e.code === 'ArrowRight') {
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
    } else if (e.code === 'ArrowUp') {
      video.volume = Math.min(1, video.volume + 0.1);
    } else if (e.code === 'ArrowDown') {
      video.volume = Math.max(0, video.volume - 0.1);
    } else if (e.code === 'KeyF') {
      if (!document.fullscreenElement) video.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    } else if (e.code === 'KeyM') {
      video.muted = !video.muted;
    } else if (e.code === 'KeyP') {
      document.getElementById('btn-pip').click();
    } else if (e.code === 'KeyD') {
      toggleSplitMode();
    } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
      e.preventDefault();
      document.getElementById('global-search').focus();
    }
  });
}

function toggleSplitMode() {
  const notesPane = document.getElementById('notes-pane');
  const videoPane = document.getElementById('video-pane');
  if (notesPane.style.display === 'none') {
    setStudyMode('split');
  } else {
    setStudyMode('video');
  }
}

function setStudyMode(mode) {
  const notesPane = document.getElementById('notes-pane');
  const videoPane = document.getElementById('video-pane');
  document.querySelectorAll('.toggle-mode-btn').forEach((b) => b.classList.remove('active'));

  if (mode === 'video') {
    videoPane.style.display = 'flex';
    videoPane.style.flex = '1';
    notesPane.style.display = 'none';
    document.getElementById('btn-view-video-only').classList.add('active');
  } else if (mode === 'notes') {
    videoPane.style.display = 'none';
    notesPane.style.display = 'flex';
    notesPane.style.flex = '1';
    document.getElementById('btn-view-notes-only').classList.add('active');
  } else {
    videoPane.style.display = 'flex';
    videoPane.style.flex = '3';
    notesPane.style.display = 'flex';
    notesPane.style.flex = '2';
    document.getElementById('btn-view-split').classList.add('active');
  }
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
