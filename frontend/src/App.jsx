import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import useAuthStore from './store/authStore';
import { authAPI } from './api';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
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
  const permissions = useAuthStore((s) => s.permissions);
  if (!permissions.can_manage_users) return <Navigate to="/clients" replace />;
  return children;
}

export default function App() {
  const { setUser, isAuthenticated } = useAuthStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      authAPI.me()
        .then(({ data }) => setUser({ ...data, permissions: data.role_data?.permissions || {} }))
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
    <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/clients" /> : <LoginPage />} />
          <Route path="/clients" element={<RequireAuth><ClientsPage /></RequireAuth>} />
          <Route path="/clients/new" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
          <Route path="/clients/:id/edit" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
          <Route path="/clients/:id" element={<RequireAuth><ClientDetailPage /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth><RequireAdmin><UsersPage /></RequireAdmin></RequireAuth>} />
          <Route path="/providers" element={<RequireAuth><ProvidersPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/clients" />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
