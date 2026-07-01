import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Modal, Form, Input, message, Switch, Image, Drawer, Button, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  SyncOutlined, TeamOutlined, SettingOutlined, UserOutlined, LogoutOutlined,
  WifiOutlined, LockOutlined, BulbOutlined, BulbFilled, CalendarOutlined, BankOutlined,
  SearchOutlined, DashboardOutlined, BookOutlined, MenuOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ApiOutlined, DesktopOutlined,
} from '@ant-design/icons';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import api from '../api';

const { Header, Sider, Content } = Layout;

import { validatePassword } from '../utils/validators';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setUser } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [form] = Form.useForm();
  const [forceForm] = Form.useForm();
  const [forcePwdOpen, setForcePwdOpen] = useState(false);
  const [forcePwdLoading, setForcePwdLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (location.state?.forceChangePassword || user?.must_change_password) {
      setForcePwdOpen(true);
    }
  }, [location.state, user?.must_change_password]);

  const isAdmin = user?.role_data?.name === 'admin' || user?.is_superuser;
  const isAdminOrSysadmin = isAdmin || user?.role_data?.name === 'sysadmin';
  const isCommunications = user?.role_data?.name === 'communications';

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Дашборд' },
    { key: '/clients', icon: <TeamOutlined />, label: 'Клиенты' },
    { key: '/fn-replacement', icon: <SyncOutlined />, label: 'Замена ФН' },
    { key: '/search', icon: <SearchOutlined />, label: 'Поиск' },
    { key: '/providers', icon: <WifiOutlined />, label: 'Провайдеры' },
    { key: '/ofd-companies', icon: <BankOutlined />, label: 'Компании' },
    ...(!isCommunications ? [{ key: '/calendar', icon: <CalendarOutlined />, label: 'Календарь' }] : []),
    { key: '/faq', icon: <BookOutlined />, label: 'База знаний' },
    ...(isAdminOrSysadmin ? [{ key: '/comproxy', icon: <ApiOutlined />, label: 'ComProxy' }] : []),
    ...(isAdmin ? [{ key: '/pc-management', icon: <DesktopOutlined />, label: 'Управление ПК аптек' }] : []),
    ...(isAdmin ? [{ key: '/users', icon: <UserOutlined />, label: 'Пользователи' }] : []),
    ...(isAdmin ? [{ key: '/settings', icon: <SettingOutlined />, label: 'Настройки' }] : []),
  ];

  const handleChangePassword = async () => {
    const values = await form.validateFields();
    if (values.new_password !== values.confirm_password) {
      message.error('Новые пароли не совпадают');
      return;
    }
    setPwdLoading(true);
    try {
      await api.post('/auth/change-password/', {
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success('Пароль успешно изменён');
      setPwdModalOpen(false);
      form.resetFields();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Ошибка смены пароля');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleForceChangePassword = async () => {
    const values = await forceForm.validateFields();
    if (values.new_password !== values.confirm_password) {
      message.error('Пароли не совпадают');
      return;
    }
    setForcePwdLoading(true);
    try {
      await api.post('/auth/change-password/', {
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success('Пароль успешно изменён');
      setForcePwdOpen(false);
      forceForm.resetFields();
      if (user) setUser({ ...user, must_change_password: false });
    } catch (err) {
      message.error(err.response?.data?.detail || 'Ошибка смены пароля');
    } finally {
      setForcePwdLoading(false);
    }
  };

  const userMenu = {
    items: [
      { key: 'change-password', icon: <LockOutlined />, label: 'Сменить пароль' },
      {
        key: 'theme',
        icon: isDark ? <BulbFilled style={{ color: '#fadb14' }} /> : <BulbOutlined />,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, minWidth: 160 }}>
            <span>Тёмная тема</span>
            <Switch size="small" checked={isDark} onChange={toggleTheme} onClick={(_, e) => e.stopPropagation()} />
          </div>
        ),
      },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Выйти', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') { logout(); navigate('/login'); }
      if (key === 'change-password') { setPwdModalOpen(true); }
      if (key === 'theme') { toggleTheme(); }
    },
  };

  const selectedKey = '/' + location.pathname.split('/')[1];

  const menuContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Логотип — скрыт при свёрнутом сайдбаре */}
      {!collapsed && (
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Image
            src="/saint.jpg"
            alt="Святой покровитель техподдержки"
            width={38} height={38}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #1677ff', cursor: 'pointer' }}
            preview={{ mask: '🔍' }}
          />
          <Typography.Text strong style={{ fontSize: 15, color: '#1677ff', lineHeight: 1.2 }}>
            Портал поддержки
          </Typography.Text>
        </div>
      )}
      <Menu
        mode="inline"
        theme={isDark ? 'dark' : 'light'}
        selectedKeys={[selectedKey]}
        items={menuItems}
        inlineCollapsed={collapsed}
        onClick={({ key }) => { navigate(key); setDrawerOpen(false); }}
        style={{ border: 'none', marginTop: collapsed ? 8 : 8 }}
      />
      </div>

      {/* Низ сайдбара: пользователь + свернуть */}
      <div style={{
        borderTop: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
        background: isDark ? '#141414' : '#fff',
      }}>
        {collapsed ? (
          /* Свёрнутый вид: иконка сверху, аватар снизу */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
            {!isMobile && (
              <Tooltip title="Развернуть меню" placement="right">
                <Button
                  type="text"
                  size="small"
                  style={{ marginBottom: 4 }}
                  icon={<MenuUnfoldOutlined />}
                  onClick={() => setCollapsed(c => !c)}
                />
              </Tooltip>
            )}
            <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
              <Avatar style={{ background: '#1677ff', cursor: 'pointer' }}>{user?.full_name?.[0] || 'U'}</Avatar>
            </Dropdown>
          </div>
        ) : (
          /* Развёрнутый вид: аватар + имя + иконка в одну строку */
          <div style={{ padding: '10px 8px 10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                <Avatar style={{ background: '#1677ff', flexShrink: 0 }}>{user?.full_name?.[0] || 'U'}</Avatar>
                <div style={{ lineHeight: 1.2, overflow: 'hidden', minWidth: 0 }}>
                  <Typography.Text strong style={{ fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>{user?.role_display}</Typography.Text>
                </div>
              </div>
            </Dropdown>
            {!isMobile && (
              <Tooltip title="Свернуть меню" placement="right">
                <Button
                  type="text"
                  size="small"
                  style={{ flexShrink: 0 }}
                  icon={<MenuFoldOutlined />}
                  onClick={() => setCollapsed(c => !c)}
                />
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* Десктоп — сворачиваемое боковое меню */}
      {!isMobile && (
        <Sider
          theme={isDark ? 'dark' : 'light'}
          width={220}
          collapsedWidth={64}
          collapsed={collapsed}
          style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.06)', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', transition: 'width 0.2s' }}
        >
          {menuContent}
        </Sider>
      )}

      {/* Мобильный — Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{ body: { padding: 0, background: isDark ? '#141414' : '#fff' }, header: { display: 'none' } }}
        >
          {menuContent}
        </Drawer>
      )}

      <Layout>
        {isMobile && (
          <Header style={{
            background: 'transparent',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            position: 'sticky', top: 0, zIndex: 10,
            height: 48,
            lineHeight: '48px',
          }}>
            <Button type="text" icon={<MenuOutlined style={{ fontSize: 18 }} />} onClick={() => setDrawerOpen(true)} />
          </Header>
        )}

        <Content style={{ padding: isMobile ? 12 : 24, minHeight: isMobile ? 'calc(100vh - 48px)' : '100vh' }}>
          <div style={{ padding: isMobile ? 12 : 24, borderRadius: 8, minHeight: '100%', background: 'transparent' }}>
            {children}
          </div>
        </Content>
      </Layout>

      <Modal
        title={<><LockOutlined style={{ marginRight: 8 }} />Смена пароля</>}
        open={pwdModalOpen}
        onOk={handleChangePassword}
        onCancel={() => { setPwdModalOpen(false); form.resetFields(); }}
        okText="Сменить пароль" cancelText="Отмена"
        confirmLoading={pwdLoading} width={420}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="old_password" label="Текущий пароль" rules={[{ required: true, message: 'Введите текущий пароль' }]}>
            <Input.Password placeholder="Введите текущий пароль" />
          </Form.Item>
          <Form.Item name="new_password" label="Новый пароль" rules={[{ required: true, message: 'Введите новый пароль' }, { validator: validatePassword }]}>
            <Input.Password placeholder="Мин. 8 символов, заглавная и цифра" />
          </Form.Item>
          <Form.Item name="confirm_password" label="Повторите новый пароль" rules={[{ required: true, message: 'Повторите новый пароль' }]}>
            <Input.Password placeholder="Повторите новый пароль" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<><LockOutlined style={{ color: '#fa8c16', marginRight: 8 }} />Требуется смена пароля</>}
        open={forcePwdOpen}
        onOk={handleForceChangePassword}
        closable={false} maskClosable={false} keyboard={false}
        okText="Сменить пароль"
        cancelButtonProps={{ style: { display: 'none' } }}
        confirmLoading={forcePwdLoading} width={420}
      >
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591', color: '#874d00', fontSize: 13 }}>
          ⚠️ Администратор потребовал сменить пароль. Пожалуйста, установите новый пароль для продолжения работы.
        </div>
        <Form form={forceForm} layout="vertical">
          <Form.Item name="old_password" label="Текущий пароль" rules={[{ required: true, message: 'Введите текущий пароль' }]}>
            <Input.Password placeholder="Введите текущий пароль" autoFocus />
          </Form.Item>
          <Form.Item name="new_password" label="Новый пароль" rules={[{ required: true, message: 'Введите новый пароль' }, { validator: validatePassword }]}>
            <Input.Password placeholder="Мин. 8 символов, заглавная и цифра" />
          </Form.Item>
          <Form.Item name="confirm_password" label="Повторите новый пароль" rules={[{ required: true, message: 'Повторите пароль' }]}>
            <Input.Password placeholder="Повторите новый пароль" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
