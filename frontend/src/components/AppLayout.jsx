import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  TeamOutlined, UserOutlined, LogoutOutlined,
  SettingOutlined, AppstoreOutlined
} from '@ant-design/icons';
import useAuthStore from '../store/authStore';

const { Header, Sider, Content } = Layout;

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, permissions, logout } = useAuthStore();

  const menuItems = [
    { key: '/clients', icon: <TeamOutlined />, label: 'Клиенты' },
    ...(permissions.can_manage_users ? [
      { key: '/users', icon: <UserOutlined />, label: 'Пользователи' },
    ] : []),
    ...(permissions.can_manage_custom_fields ? [
      { key: '/custom-fields', icon: <AppstoreOutlined />, label: 'Кастомные поля' },
    ] : []),
  ];

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: 'Выйти', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') { logout(); navigate('/login'); }
    },
  };

  const selectedKey = '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={220} style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text strong style={{ fontSize: 16, color: '#1677ff' }}>
            Портал поддержки
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px', display: 'flex',
          justifyContent: 'flex-end', alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 10
        }}>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar style={{ background: '#1677ff' }}>
                {user?.full_name?.[0] || 'U'}
              </Avatar>
              <div style={{ lineHeight: 1.2 }}>
                <Typography.Text strong style={{ fontSize: 13 }}>{user?.full_name}</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>{user?.role_display}</Typography.Text>
              </div>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: '100%' }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
