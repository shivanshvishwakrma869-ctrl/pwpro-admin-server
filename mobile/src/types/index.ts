export interface Batch {
  _id: string;
  id?: string;
  name: string;
  slug?: string;
  language?: string;
  image?: string;
  previewImage?: any;
  fee?: number;
  classes?: string[];
  subjects?: Subject[];
  byName?: string;
  startDate?: string;
  endDate?: string;
}

export interface Subject {
  _id: string;
  id?: string;
  title: string;
  subject?: string;
  slug?: string;
  previewImage?: any;
  teachers?: string[];
}

export interface Topic {
  _id: string;
  id?: string;
  name: string;
  slug?: string;
  lecturesCount?: number;
  notesCount?: number;
  dppCount?: number;
}

export interface Lecture {
  _id: string;
  id?: string;
  title: string;
  scheduleId?: string;
  videoId?: string;
  videoDetails?: {
    _id?: string;
    id?: string;
    videoId?: string;
    videoUrl?: string;
    duration?: number;
    name?: string;
    image?: string;
  };
  duration?: string | number;
  startTime?: string;
  topic?: string;
  teacher?: string;
  date?: string;
  hasAttachment?: boolean;
}

export interface Attachment {
  _id?: string;
  id?: string;
  name: string;
  title?: string;
  attachmentUrl?: string;
  key?: string;
  baseUrl?: string;
  type?: 'NOTES' | 'DPP' | 'SOLUTION' | 'PDF';
}

export interface Bookmark {
  id: string;
  title: string;
  batchId: string;
  batchName?: string;
  subjectId: string;
  subjectName?: string;
  topicId?: string;
  videoId: string;
  scheduleId?: string;
  thumbnail?: string;
  timestamp: number;
}

export interface DownloadItem {
  id: string;
  title: string;
  fileUri: string;
  type: 'video' | 'pdf';
  fileSize?: number;
  dateDownloaded: number;
  batchName?: string;
  subjectName?: string;
}

export interface WatchHistoryItem {
  lectureId: string;
  lecture: Lecture;
  batchId: string;
  batchName?: string;
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  timestamp: number;
}
