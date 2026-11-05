import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface LicenseInfo {
  key: string;
  deviceId: string;
  activatedAt: number;
  expiresAt?: number | null;
  status: 'active' | 'expired' | 'revoked';
}

interface AuthContextType {
  isActivated: boolean;
  isLoading: boolean;
  deviceId: string;
  license: LicenseInfo | null;
  activateKey: (key: string) => Promise<{ success: boolean; message: string }>;
  deactivateDevice: () => Promise<void>;
  authApiUrl: string;
  setAuthApiUrl: (url: string) => Promise<void>;
}

const DEFAULT_API_URL = 'https://pwpro-admin-server.vercel.app';

const AuthContext = createContext<AuthContextType>({
  isActivated: false,
  isLoading: true,
  deviceId: '',
  license: null,
  activateKey: async () => ({ success: false, message: '' }),
  deactivateDevice: async () => {},
  authApiUrl: DEFAULT_API_URL,
  setAuthApiUrl: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deviceId, setDeviceId] = useState<string>('');
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [authApiUrl, setAuthApiUrlState] = useState<string>(DEFAULT_API_URL);

  useEffect(() => {
    initAuth();
  }, []);

  const getOrCreateDeviceId = async (): Promise<string> => {
    let id = await AsyncStorage.getItem('pwpro_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      await AsyncStorage.setItem('pwpro_device_id', id);
    }
    return id;
  };

  const initAuth = async () => {
    try {
      const devId = await getOrCreateDeviceId();
      setDeviceId(devId);

      const savedApiUrl = await AsyncStorage.getItem('pwpro_auth_api_url');
      if (savedApiUrl) {
        setAuthApiUrlState(savedApiUrl);
      }

      const storedLicense = await AsyncStorage.getItem('pwpro_license');
      if (storedLicense) {
        const parsed: LicenseInfo = JSON.parse(storedLicense);

        // Verify device integrity
        if (parsed.deviceId === devId) {
          // Check expiration if set
          if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
            setIsActivated(false);
            setLicense({ ...parsed, status: 'expired' });
          } else {
            setIsActivated(true);
            setLicense(parsed);
          }
        } else {
          // Stolen license data from another device
          setIsActivated(false);
          await AsyncStorage.removeItem('pwpro_license');
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const setAuthApiUrl = async (url: string) => {
    const trimmed = url.trim().replace(/\/+$/, '');
    setAuthApiUrlState(trimmed);
    await AsyncStorage.setItem('pwpro_auth_api_url', trimmed);
  };

  const activateKey = async (rawKey: string): Promise<{ success: boolean; message: string }> => {
    const cleanKey = rawKey.trim().toUpperCase();
    if (!cleanKey) {
      return { success: false, message: 'Please enter a valid activation key.' };
    }

    try {
      // Send activation request to auth backend
      const res = await fetch(`${authApiUrl}/api/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          key: cleanKey,
          deviceId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const newLicense: LicenseInfo = {
          key: cleanKey,
          deviceId,
          activatedAt: Date.now(),
          expiresAt: data.expiresAt || null,
          status: 'active',
        };

        await AsyncStorage.setItem('pwpro_license', JSON.stringify(newLicense));
        setLicense(newLicense);
        setIsActivated(true);

        return {
          success: true,
          message: data.message || 'Key activated successfully! Welcome to PW Pro.',
        };
      } else {
        return {
          success: false,
          message: data?.error || 'Invalid or already used key. Please check with admin.',
        };
      }
    } catch (err: any) {
      // In offline mode or if server is temporarily unreachable, check if key format is offline master
      if (cleanKey === 'PWPRO-MASTER-ADMIN-99') {
        const newLicense: LicenseInfo = {
          key: cleanKey,
          deviceId,
          activatedAt: Date.now(),
          status: 'active',
        };
        await AsyncStorage.setItem('pwpro_license', JSON.stringify(newLicense));
        setLicense(newLicense);
        setIsActivated(true);
        return { success: true, message: 'Master activation unlocked.' };
      }

      return {
        success: false,
        message:
          'Could not connect to activation server. Please verify your internet or server URL.',
      };
    }
  };

  const deactivateDevice = async () => {
    try {
      await AsyncStorage.removeItem('pwpro_license');
      setIsActivated(false);
      setLicense(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isActivated,
        isLoading,
        deviceId,
        license,
        activateKey,
        deactivateDevice,
        authApiUrl,
        setAuthApiUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
