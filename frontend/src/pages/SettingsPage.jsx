import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Typography, message, Spin,
  Popconfirm, Space, Switch, InputNumber, Divider, Modal
} from 'antd';
import {
  SaveOutlined, EyeInvisibleOutlined, EyeTwoTone,
  SettingOutlined, DeleteOutlined, MailOutlined, SendOutlined
} from '@ant-design/icons';
import { settingsAPI } from '../api';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [sshForm] = Form.useForm();
  const [smtpForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [savingSsh, setSavingSsh] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [hasSSHPassword, setHasSSHPassword] = useState(false);
  const [hasSMTPPassword, setHasSMTPPassword] = useState(false);
  const [useSsl, setUseSsl] = useState(true);
  const [useTls, setUseTls] = useState(false);
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await settingsAPI.get();
        sshForm.setFieldsValue({ ssh_user: data.ssh_user });
        setHasSSHPassword(data.has_ssh_password);
        smtpForm.setFieldsValue({
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port || 465,
          smtp_user: data.smtp_user,
          smtp_from_email: data.smtp_from_email,
          smtp_from_name: data.smtp_from_name,
          smtp_use_ssl: data.smtp_use_ssl,
          smtp_use_tls: data.smtp_use_tls,
        });
        setHasSMTPPassword(data.has_smtp_password);
        setUseSsl(data.smtp_use_ssl);
        setUseTls(data.smtp_use_tls);
      } catch {
        message.error('Ошибка загрузки настроек');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sshForm, smtpForm]);

  const handleClearSsh = async () => {
    try {
      await settingsAPI.clear('ssh');
      setHasSSHPassword(false);
      sshForm.setFieldsValue({ ssh_user: '', ssh_password: '' });
      message.success('SSH данные очищены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка очистки');
    }
  };

  const handleClearSmtp = async () => {
    try {
      await settingsAPI.clear('smtp');
      setHasSMTPPassword(false);
      setUseSsl(true);
      setUseTls(false);
      smtpForm.resetFields();
      smtpForm.setFieldsValue({ smtp_port: 465, smtp_use_ssl: true, smtp_use_tls: false });
      message.success('SMTP данные очищены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка очистки');
    }
  };

  const onSaveSsh = async (values) => {
    setSavingSsh(true);
    try {
      const { data } = await settingsAPI.save({ ...values, section: 'ssh' });
      setHasSSHPassword(data.has_ssh_password);
      sshForm.setFieldsValue({ ssh_password: '' });
      message.success('SSH настройки сохранены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingSsh(false);
    }
  };

  const onSaveSmtp = async (values) => {
    setSavingSmtp(true);
    try {
      const { data } = await settingsAPI.save({ ...values, section: 'smtp' });
      setHasSMTPPassword(data.has_smtp_password);
      smtpForm.setFieldsValue({ smtp_password: '' });
      message.success('SMTP настройки сохранены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) { message.warning('Введите email'); return; }
    setSendingTest(true);
    try {
      const { data } = await settingsAPI.testEmail(testEmail.trim());
      message.success(data.message);
      setTestEmailModal(false);
      setTestEmail('');
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка отправки');
    } finally {
      setSendingTest(false);
    }
  };

  // Авто-переключение SSL/TLS — включить одно, выключить другое
  const handleSslChange = (val) => {
    setUseSsl(val);
    if (val) { setUseTls(false); smtpForm.setFieldsValue({ smtp_use_tls: false, smtp_port: 465 }); }
    smtpForm.setFieldsValue({ smtp_use_ssl: val });
  };
  const handleTlsChange = (val) => {
    setUseTls(val);
    if (val) { setUseSsl(false); smtpForm.setFieldsValue({ smtp_use_ssl: false, smtp_port: 587 }); }
    smtpForm.setFieldsValue({ smtp_use_tls: val });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <SettingOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>Настройки системы</Title>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>

        {/* ===== SSH ===== */}
        <Form form={sshForm} layout="vertical" onFinish={onSaveSsh}>
          <Card title="Подключение к Микротику по SSH">
            <Form.Item name="ssh_user" label="SSH пользователь">
              <Input placeholder="admin" />
            </Form.Item>
            <Form.Item
              name="ssh_password"
              label={
                <span>
                  SSH пароль{' '}
                  {hasSSHPassword && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      (задан — введите новый чтобы изменить)
                    </Text>
                  )}
                </span>
              }
            >
              <Input.Password
                placeholder={hasSSHPassword ? '••••••••' : 'Введите пароль'}
                iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={savingSsh} icon={<SaveOutlined />}>
                Сохранить
              </Button>
              <Popconfirm
                title="Очистить SSH данные?"
                description="Логин и пароль будут удалены из базы данных"
                onConfirm={handleClearSsh}
                okText="Очистить" okType="danger" cancelText="Отмена"
              >
                <Button danger icon={<DeleteOutlined />}>Очистить</Button>
              </Popconfirm>
            </Space>
          </Card>
        </Form>

        {/* ===== SMTP ===== */}
        <Form form={smtpForm} layout="vertical" onFinish={onSaveSmtp}>
          <Card
            title={<Space><MailOutlined style={{ color: '#1677ff' }} /><span>Настройки Email (SMTP)</span></Space>}
            extra={
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => setTestEmailModal(true)}
              >
                Тест отправки
              </Button>
            }
          >
            <Form.Item name="smtp_host" label="SMTP сервер">
              <Input placeholder="smtp.gmail.com  /  smtp.yandex.ru  /  smtp.mail.ru" />
            </Form.Item>

            <Space style={{ width: '100%' }} align="start">
              <Form.Item name="smtp_port" label="Порт" style={{ width: 120 }}>
                <InputNumber style={{ width: '100%' }} min={1} max={65535} />
              </Form.Item>
              <Form.Item label="SSL (порт 465)" style={{ marginLeft: 16 }}>
                <Switch
                  checked={useSsl}
                  onChange={handleSslChange}
                  checkedChildren="Вкл"
                  unCheckedChildren="Выкл"
                />
              </Form.Item>
              <Form.Item label="TLS / STARTTLS (порт 587)">
                <Switch
                  checked={useTls}
                  onChange={handleTlsChange}
                  checkedChildren="Вкл"
                  unCheckedChildren="Выкл"
                />
              </Form.Item>
            </Space>
            <Form.Item name="smtp_use_ssl" hidden><Input /></Form.Item>
            <Form.Item name="smtp_use_tls" hidden><Input /></Form.Item>

            <Divider style={{ margin: '4px 0 16px' }} />

            <Form.Item name="smtp_user" label="Логин (обычно совпадает с email отправителя)">
              <Input placeholder="noreply@mycompany.ru" />
            </Form.Item>
            <Form.Item
              name="smtp_password"
              label={
                <span>
                  Пароль{' '}
                  {hasSMTPPassword && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      (задан — введите новый чтобы изменить)
                    </Text>
                  )}
                </span>
              }
            >
              <Input.Password
                placeholder={hasSMTPPassword ? '••••••••' : 'Введите пароль'}
                iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Divider style={{ margin: '4px 0 16px' }} />

            <Form.Item name="smtp_from_email" label='Email отправителя (поле "From")'>
              <Input placeholder="noreply@mycompany.ru" />
            </Form.Item>
            <Form.Item name="smtp_from_name" label='Имя отправителя (поле "From name")'>
              <Input placeholder="Support Portal" />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={savingSmtp} icon={<SaveOutlined />}>
                Сохранить
              </Button>
              <Popconfirm
                title="Очистить SMTP данные?"
                description="Все SMTP настройки будут удалены"
                onConfirm={handleClearSmtp}
                okText="Очистить" okType="danger" cancelText="Отмена"
              >
                <Button danger icon={<DeleteOutlined />}>Очистить</Button>
              </Popconfirm>
            </Space>
          </Card>
        </Form>
      </div>

      {/* Модал тест-отправки */}
      <Modal
        title={<Space><SendOutlined />Тестовая отправка письма</Space>}
        open={testEmailModal}
        onCancel={() => { setTestEmailModal(false); setTestEmail(''); }}
        onOk={handleTestEmail}
        okText="Отправить"
        cancelText="Отмена"
        okButtonProps={{ loading: sendingTest, icon: <SendOutlined /> }}
      >
        <p style={{ color: '#666', marginBottom: 12 }}>
          Введите email на который отправить тестовое письмо. Убедитесь что SMTP настройки сохранены.
        </p>
        <Input
          placeholder="test@example.com"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          onPressEnter={handleTestEmail}
          prefix={<MailOutlined style={{ color: '#ccc' }} />}
        />
      </Modal>
    </div>
  );
}
