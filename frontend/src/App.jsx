import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, theme as antTheme } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import { authAPI } from './api';
import AppLayout from './components/AppLayout';
import { customTheme, darkTheme } from './theme/customTheme';
import ErrorBoundary from './components/ErrorBoundary';

const LoginPage        = lazy(() => import('./pages/LoginPage'));
const DashboardPage    = lazy(() => import('./pages/DashboardPage'));
const CalendarPage     = lazy(() => import('./pages/CalendarPage'));
const ClientsPage      = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const SettingsPage     = lazy(() => import('./pages/SettingsPage'));
const ClientFormPage   = lazy(() => import('./pages/ClientFormPage'));
const UsersPage        = lazy(() => import('./pages/UsersPage'));
const ProvidersPage    = lazy(() => import('./pages/ProvidersPage'));
const OfdCompaniesPage = lazy(() => import('./pages/OfdCompaniesPage'));
const FnReplacementPage= lazy(() => import('./pages/FnReplacementPage'));
const SearchPage       = lazy(() => import('./pages/SearchPage'));
const FaqPage          = lazy(() => import('./pages/FaqPage'));

dayjs.locale('ru');

const PageLoader = () => (
  <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" />
  </div>
);

function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function RequireAdmin({ children }) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role_data?.name === 'admin' || user?.is_superuser;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireCalendar({ children }) {
  const user = useAuthStore((s) => s.user);
  const isCommunications = user?.role_data?.name === 'communications';
  if (isCommunications) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { setUser, isAuthenticated } = useAuthStore();
  const isDark = useThemeStore((s) => s.isDark);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const bg = isDark ? '#141414' : '#ffffff';
    const color = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.88)';
    document.body.style.background = bg;
    document.body.style.backgroundColor = bg;
    document.body.style.color = color;
    document.documentElement.style.background = bg;
    document.documentElement.style.backgroundColor = bg;

    let styleEl = document.getElementById('scrollbar-theme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'scrollbar-theme';
      document.head.appendChild(styleEl);
    }
    if (isDark) {
      styleEl.textContent = `
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1f1f1f; }
        ::-webkit-scrollbar-thumb { background: #424242; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      `;
    } else {
      styleEl.textContent = '';
    }
  }, [isDark]);

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

  const theme = isDark ? darkTheme : customTheme;

  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: theme.token,
        components: theme.components,
      }}
    >
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
            <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
            <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
            <Route path="/calendar" element={<RequireAuth><RequireCalendar><CalendarPage /></RequireCalendar></RequireAuth>} />
            <Route path="/clients" element={<RequireAuth><ClientsPage /></RequireAuth>} />
            <Route path="/clients/new" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
            <Route path="/clients/:id/edit" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
            <Route path="/clients/:id" element={<RequireAuth><ClientDetailPage /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth><RequireAdmin><UsersPage /></RequireAdmin></RequireAuth>} />
            <Route path="/providers" element={<RequireAuth><ProvidersPage /></RequireAuth>} />
            <Route path="/ofd-companies" element={<RequireAuth><OfdCompaniesPage /></RequireAuth>} />
            <Route path="/fn-replacement" element={<RequireAuth><FnReplacementPage /></RequireAuth>} />
            <Route path="/faq" element={<RequireAuth><FaqPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><RequireAdmin><SettingsPage /></RequireAdmin></RequireAuth>} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ConfigProvider>
  );
}
