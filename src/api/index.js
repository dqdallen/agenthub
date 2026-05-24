import axios from 'axios';

// 创建 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

// 请求拦截器 - 添加认证 token
api.interceptors.request.use(
  (config) => {
    console.log('=== API Request ===')
    console.log('Method:', config.method)
    console.log('URL:', config.url)
    console.log('Params:', config.params)
    console.log('Full URL:', config.baseURL + config.url, new URLSearchParams(config.params).toString())
    
    const token = localStorage.getItem('agenthub_token') || sessionStorage.getItem('agenthub_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('=== API Request Error ===', error)
    return Promise.reject(error)
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => {
    console.log('=== API Response ===')
    console.log('Status:', response.status)
    console.log('Data:', response.data)
    return response;
  },
  (error) => {
    console.error('=== API Response Error ===')
    console.error('Error:', error)
    console.error('Response:', error.response)
    console.error('Request:', error.config)
    
    // 只在 API 不是登录相关的情况下才处理 401
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth')) {
      localStorage.removeItem('agenthub_token');
      sessionStorage.removeItem('agenthub_token');
      // 避免在登录页面直接跳转
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
