import React from 'react';
import {
  Card, Form, Input, Button, Space, Switch, InputNumber, Divider, Modal,
  Typography, Popconfirm,
} from 'antd';
import {
  SaveOutlined, EyeInvisibleOutlined, EyeTwoTone,
  SettingOutlined, DeleteOutlined, MailOutlined, SendOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export default function SettingsAccounts({
  sshForm, smtpForm,
  hasSSHPassword, hasSMTPPassword,
  useSsl, useTls,
  savingSsh, savingSmtp,
  testEmailModal, setTestEmailModal,
  testEmail, setTestEmail,
  sendingTest,
  onSaveSsh, onSaveSmtp,
  handleClearSsh, handleClearSmtp,
  handleSslChange, handleTlsChange,
  handleTestEmail,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* SSH */}
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
                    (пароль уже задан — введите новый чтобы изменить)
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

      {/* SMTP */}
      <Form form={smtpForm} layout="vertical" onFinish={onSaveSmtp}>
        <Card
          title={<Space><MailOutlined style={{ color: '#1677ff' }} /><span>Настройки Email (SMTP)</span></Space>}
          extra={
            <Button size="small" icon={<SendOutlined />} onClick={() => setTestEmailModal(true)}>
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
              <Switch checked={useSsl} onChange={handleSslChange} checkedChildren="Вкл" unCheckedChildren="Выкл" />
            </Form.Item>
            <Form.Item label="TLS / STARTTLS (порт 587)">
              <Switch checked={useTls} onChange={handleTlsChange} checkedChildren="Вкл" unCheckedChildren="Выкл" />
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
                    (пароль уже задан — введите новый чтобы изменить)
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
          <Form.Item name="smtp_from_email" label="Email отправителя (From)">
            <Input placeholder="noreply@mycompany.ru" />
          </Form.Item>
          <Form.Item name="smtp_from_name" label="Имя отправителя">
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

      {/* Модал: тест отправки */}
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
