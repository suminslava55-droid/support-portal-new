import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin, Divider } from 'antd';
import { SaveOutlined, EyeInvisibleOutlined, EyeTwoTone, SettingOutlined } from '@ant-design/icons';
import { settingsAPI } from '../api';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await settingsAPI.get();
        form.setFieldsValue({ ssh_user: data.ssh_user });
        setHasPassword(data.has_ssh_password);
      } catch {
        message.error('Ошибка загрузки настроек');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [form]);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const { data } = await settingsAPI.save(values);
      setHasPassword(data.has_ssh_password);
      form.setFieldsValue({ ssh_password: '' });
      message.success('Настройки сохранены');
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <SettingOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>Настройки системы</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 600 }}>
        <Card title="Подключение к Микротику по SSH">
          <Form.Item name="ssh_user" label="SSH пользователь">
            <Input placeholder="admin" prefix={<Text type="secondary">user:</Text>} />
          </Form.Item>
          <Form.Item
            name="ssh_password"
            label={
              <span>
                SSH пароль{' '}
                {hasPassword && <Text type="secondary" style={{ fontSize: 12 }}>(пароль уже задан — введите новый чтобы изменить)</Text>}
              </span>
            }
          >
            <Input.Password
              placeholder={hasPassword ? '••••••••' : 'Введите пароль'}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
            Сохранить
          </Button>
        </Card>
      </Form>
    </div>
  );
}
