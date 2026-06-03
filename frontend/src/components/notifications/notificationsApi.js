/**
 * M4 · Notifications REST wrapper.
 * Uses adminApi headers when present, otherwise falls back to mood_auth_token.
 */
import axios from 'axios';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const API = process.env.REACT_APP_BACKEND_URL;

export const notificationsApi = {
  list: (params = {}) =>
    axios.get(`${API}/api/notifications`, { headers: headers(), params }).then(r => r.data),

  unreadCount: () =>
    axios.get(`${API}/api/notifications/unread-count`, { headers: headers() }).then(r => r.data),

  markRead: ({ ids, all = false }) =>
    axios.post(`${API}/api/notifications/mark-read`,
      ids ? { ids } : { all: true },
      { headers: headers() }).then(r => r.data),

  archive: (id) =>
    axios.post(`${API}/api/notifications/${id}/archive`, {}, { headers: headers() }).then(r => r.data),

  categories: () =>
    axios.get(`${API}/api/notifications/categories`, { headers: headers() }).then(r => r.data),

  preferences: {
    get: () => axios.get(`${API}/api/notifications/preferences`, { headers: headers() }).then(r => r.data),
    set: (items) => axios.patch(`${API}/api/notifications/preferences`, { items },
                                { headers: headers() }).then(r => r.data),
  },
};

export default notificationsApi;
