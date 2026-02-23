import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, theme as antTheme } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import { authAPI } from './api';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import SettingsPage from './pages/SettingsPage';
import ClientFormPage from './pages/ClientFormPage';
import UsersPage from './pages/UsersPage';
import ProvidersPage from './pages/ProvidersPage';

dayjs.locale('ru');

function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function RequireAdmin({ children }) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role_data?.name === 'admin' || user?.is_superuser;
  if (!isAdmin) return <Navigate to="/clients" replace />;
  return children;
}

export default function App() {
  const { setUser, isAuthenticated } = useAuthStore();
  const isDark = useThemeStore((s) => s.isDark);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      authAPI.me()
        .then(({ data }) => {
          const permissions = data.role_data ? {
            can_view_all_clients: data.role_data.can_view_all_clients,
            can_create_client: data.role_data.can_create_client,
            can_edit_client: data.role_data.can_edit_client,
            can_delete_client: data.role_data.can_delete_client,
            can_manage_users: data.role_data.can_manage_users,
            can_manage_roles: data.role_data.can_manage_roles,
            can_manage_custom_fields: data.role_data.can_manage_custom_fields,
          } : {};
          setUser({ ...data, permissions });
        })
        .catch(() => localStorage.clear())
        .finally(() => setInitializing(false));
    } else {
      setInitializing(false);
    }
  }, []);

  if (initializing) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: { colorPrimary: '#1677ff', borderRadius: 6 },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/clients" /> : <LoginPage />} />
          <Route path="/clients" element={<RequireAuth><ClientsPage /></RequireAuth>} />
          <Route path="/clients/new" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
          <Route path="/clients/:id/edit" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
          <Route path="/clients/:id" element={<RequireAuth><ClientDetailPage /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth><RequireAdmin><UsersPage /></RequireAdmin></RequireAuth>} />
          <Route path="/providers" element={<RequireAuth><ProvidersPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><RequireAdmin><SettingsPage /></RequireAdmin></RequireAuth>} />
          <Route path="*" element={<Navigate to="/clients" />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
