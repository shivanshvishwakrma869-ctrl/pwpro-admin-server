import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bookmark } from '../types';

interface BookmarkContextType {
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Bookmark) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  isBookmarked: (id: string) => boolean;
}

const BookmarkContext = createContext<BookmarkContextType>({
  bookmarks: [],
  addBookmark: async () => {},
  removeBookmark: async () => {},
  isBookmarked: () => false,
});

export const BookmarkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const data = await AsyncStorage.getItem('pwpro_bookmarks');
      if (data) {
        setBookmarks(JSON.parse(data));
      }
    } catch (e) {
      console.error('Failed to load bookmarks', e);
    }
  };

  const addBookmark = async (item: Bookmark) => {
    try {
      const filtered = bookmarks.filter((b) => b.id !== item.id);
      const updated = [item, ...filtered];
      setBookmarks(updated);
      await AsyncStorage.setItem('pwpro_bookmarks', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to add bookmark', e);
    }
  };

  const removeBookmark = async (id: string) => {
    try {
      const updated = bookmarks.filter((b) => b.id !== id);
      setBookmarks(updated);
      await AsyncStorage.setItem('pwpro_bookmarks', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to remove bookmark', e);
    }
  };

  const isBookmarked = (id: string) => {
    return bookmarks.some((b) => b.id === id);
  };

  return (
    <BookmarkContext.Provider value={{ bookmarks, addBookmark, removeBookmark, isBookmarked }}>
      {children}
    </BookmarkContext.Provider>
  );
};

export const useBookmarks = () => useContext(BookmarkContext);
