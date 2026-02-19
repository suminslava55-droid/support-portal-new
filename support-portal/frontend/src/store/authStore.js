import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,
  permissions: {},
  isAuthenticated: false,

  login: (userData, tokens) => {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    set({
      user: userData,
      permissions: userData.permissions || {},
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, permissions: {}, isAuthenticated: false });
  },

  setUser: (userData) => set({
    user: userData,
    permissions: userData.permissions || {},
    isAuthenticated: true,
  }),
}));

export default useAuthStore;
