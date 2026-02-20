import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Modal, Form, Input, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { TeamOutlined, UserOutlined, LogoutOutlined, WifiOutlined, LockOutlined } from '@ant-design/icons';
import useAuthStore from '../store/authStore';
import api from '../api';

const { Header, Sider, Content } = Layout;

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [form] = Form.useForm();

  const isAdmin = user?.role === 'admin' || user?.is_superuser;

  const menuItems = [
    { key: '/clients', icon: <TeamOutlined />, label: 'Клиенты' },
    ...(isAdmin ? [{ key: '/users', icon: <UserOutlined />, label: 'Пользователи' }] : []),
    { key: '/providers', icon: <WifiOutlined />, label: 'Провайдеры' },
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
      const detail = err.response?.data?.detail || 'Ошибка смены пароля';
      message.error(detail);
    } finally {
      setPwdLoading(false);
    }
  };

  const userMenu = {
    items: [
      {
        key: 'change-password',
        icon: <LockOutlined />,
        label: 'Сменить пароль',
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Выйти',
        danger: true,
      },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') { logout(); navigate('/login'); }
      if (key === 'change-password') { setPwdModalOpen(true); }
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
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
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

      {/* Модалка смены пароля */}
      <Modal
        title={<><LockOutlined style={{ marginRight: 8 }} />Смена пароля</>}
        open={pwdModalOpen}
        onOk={handleChangePassword}
        onCancel={() => { setPwdModalOpen(false); form.resetFields(); }}
        okText="Сменить пароль"
        cancelText="Отмена"
        confirmLoading={pwdLoading}
        width={420}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="old_password"
            label="Текущий пароль"
            rules={[{ required: true, message: 'Введите текущий пароль' }]}
          >
            <Input.Password placeholder="Введите текущий пароль" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="Новый пароль"
            rules={[
              { required: true, message: 'Введите новый пароль' },
              { min: 6, message: 'Минимум 6 символов' },
            ]}
          >
            <Input.Password placeholder="Минимум 6 символов" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Повторите новый пароль"
            rules={[{ required: true, message: 'Повторите новый пароль' }]}
          >
            <Input.Password placeholder="Повторите новый пароль" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
