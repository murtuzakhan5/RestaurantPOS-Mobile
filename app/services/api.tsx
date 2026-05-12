import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = 'https://billpak.runasp.net/api';
// export const API_URL = 'https://localhost:7246/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, 
});

api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(
      `🌐 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`
    );

    return config;
  },
  error => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  response => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  async error => {
    if (error.response) {
      console.log(
        `❌ Error ${error.response.status}: ${error.response.config?.url}`
      );

      if (error.response.status === 401) {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('permissions');
        await AsyncStorage.removeItem('loginPhone');
      }
    } else if (error.request) {
      console.log('🌍 No response from server - Check network or CORS');
    } else {
      console.log('💥 Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;