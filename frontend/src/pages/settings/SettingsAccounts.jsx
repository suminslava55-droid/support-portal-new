import React from 'react';
import {
  Card, Form, Input, Button, Space, Switch, InputNumber, Divider, Modal,
  Typography, Popconfirm,
} from 'antd';
import {
  SaveOutlined, EyeInvisibleOutlined, EyeTwoTone,
  SettingOutlined, DeleteOutlined, MailOutlined, SendOutlined, DesktopOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export default function SettingsAccounts({
  sshForm, smtpForm, winrmForm, regimeForm,
  hasSSHPassword, hasSMTPPassword, hasWinrmPassword, hasRegimePassword,
  useSsl, useTls,
  savingSsh, savingSmtp, savingWinrm, savingRegime,
  testEmailModal, setTestEmailModal,
  testEmail, setTestEmail,
  sendingTest,
  onSaveSsh, onSaveSmtp, onSaveWinrm, onSaveRegime,
  handleClearSsh, handleClearSmtp, handleClearWinrm, handleClearRegime,
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

      {/* УЗ Windows для подключения к ПК аптек */}
      <Form form={winrmForm} layout="vertical" onFinish={onSaveWinrm}>
        <Card title={<Space><DesktopOutlined style={{ color: '#1677ff' }} /><span>УЗ для подключения к ПК аптек</span></Space>}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            Учётная запись Windows-администратора для удалённого выполнения скриптов (WinRM/WMI)
            и копирования файлов (SMB) на серверы и кассы аптек.
          </Text>
          <Form.Item name="winrm_user" label="Пользователь Windows">
            <Input placeholder="admin2" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="winrm_password"
            label={
              <span>
                Пароль{' '}
                {hasWinrmPassword && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (пароль уже задан — введите новый чтобы изменить)
                  </Text>
                )}
              </span>
            }
          >
            <Input.Password
              placeholder={hasWinrmPassword ? '••••••••' : 'Введите пароль'}
              autoComplete="new-password"
              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingWinrm} icon={<SaveOutlined />}>
              Сохранить
            </Button>
            <Popconfirm
              title="Очистить УЗ Windows?"
              description="Логин и пароль будут удалены из базы данных"
              onConfirm={handleClearWinrm}
              okText="Очистить" okType="danger" cancelText="Отмена"
            >
              <Button danger icon={<DeleteOutlined />}>Очистить</Button>
            </Popconfirm>
          </Space>
        </Card>
      </Form>

      {/* УЗ для подключения к Regime (ЛМ ЧЗ) */}
      <Form form={regimeForm} layout="vertical" onFinish={onSaveRegime}>
        <Card title={<Space><SafetyCertificateOutlined style={{ color: '#1677ff' }} /><span>УЗ для подключения к Regime</span></Space>}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            Basic Auth для инициализации локального модуля «Честный знак» (ЛМ ЧЗ) на серверах аптек
            (порт 5995, эндпоинт /api/v2/init).
          </Text>
          <Form.Item name="regime_user" label="Пользователь Regime">
            <Input placeholder="admin" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="regime_password"
            label={
              <span>
                Пароль{' '}
                {hasRegimePassword && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (пароль уже задан — введите новый чтобы изменить)
                  </Text>
                )}
              </span>
            }
          >
            <Input.Password
              placeholder={hasRegimePassword ? '••••••••' : 'Введите пароль'}
              autoComplete="new-password"
              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingRegime} icon={<SaveOutlined />}>
              Сохранить
            </Button>
            <Popconfirm
              title="Очистить УЗ Regime?"
              description="Логин и пароль будут удалены из базы данных"
              onConfirm={handleClearRegime}
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
          <Form.Item
            name="allowed_email_domains"
            label="Разрешённые домены получателей"
            extra="Через запятую. Оставьте пустым — любые домены. Пример: company.ru,company2.ru"
          >
            <Input placeholder="company.ru,company2.ru" />
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
