import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Space, Typography, Popconfirm, Alert, message } from 'antd';
import {
  SaveOutlined, DeleteOutlined, EyeInvisibleOutlined, EyeTwoTone, ApiOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { settingsAPI } from '../../api';

const { Text } = Typography;
const DEFAULT_TRIGGER = '[NET] NO PING IN VPN';

/** Настройки → Учётные записи → Zabbix (URL, IP, API-токен, триггер) для отчёта «Проблемки». */
export default function SettingsZabbix() {
  const [form] = Form.useForm();
  const [hasToken, setHasToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    settingsAPI.get()
      .then(({ data }) => {
        form.setFieldsValue({
          zabbix_url: data.zabbix_url,
          zabbix_ip: data.zabbix_ip,
          zabbix_trigger: data.zabbix_trigger || DEFAULT_TRIGGER,
        });
        setHasToken(!!data.has_zabbix_token);
      })
      .catch(() => {});
  }, [form]);

  const onSave = async (values) => {
    setSaving(true);
    try {
      const { data } = await settingsAPI.save({ ...values, section: 'zabbix' });
      setHasToken(data.has_zabbix_token);
      form.setFieldsValue({ zabbix_token: '' });
      message.success('Настройки Zabbix сохранены');
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    try {
      await settingsAPI.clear('zabbix');
      setHasToken(false);
      setTestResult(null);
      form.setFieldsValue({ zabbix_url: '', zabbix_ip: '', zabbix_token: '', zabbix_trigger: DEFAULT_TRIGGER });
      message.success('Настройки Zabbix очищены');
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка очистки');
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await settingsAPI.testZabbix(form.getFieldsValue());
      setTestResult({ ok: true, text: `Подключение есть — Zabbix ${data.version}` });
    } catch (e) {
      setTestResult({ ok: false, text: e.response?.data?.error || 'Ошибка подключения' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onSave}>
      <Card title={<Space><ApiOutlined style={{ color: '#1677ff' }} /><span>Zabbix</span></Space>}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
          Используется для отчёта «Проблемки» (карточка клиента → Провайдеры): когда у аптеки пропадала
          и восстанавливалась связь. Узел Zabbix ищется по Коду аптеки (UT).
        </Text>
        <Form.Item name="zabbix_url" label="URL Zabbix"
          rules={[{ type: 'url', message: 'Введите адрес вида https://zabbix.example.ru' }]}>
          <Input placeholder="https://zabbix.medexport-omsk.ru" autoComplete="off" />
        </Form.Item>
        <Form.Item name="zabbix_ip" label="IP сервера Zabbix"
          extra="Необязательно. Нужен, если сервер портала не может найти IP по имени из URL — тогда подключение идёт по IP, а сертификат проверяется по имени.">
          <Input placeholder="192.168.55.24" autoComplete="off" style={{ maxWidth: 240 }} />
        </Form.Item>
        <Form.Item
          name="zabbix_token"
          label={
            <span>
              API-токен{' '}
              {hasToken && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (токен уже задан — введите новый чтобы изменить)
                </Text>
              )}
            </span>
          }
        >
          <Input.Password
            placeholder={hasToken ? '••••••••' : 'Пользователи → API-токены в Zabbix'}
            autoComplete="new-password"
            iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>
        <Form.Item name="zabbix_trigger" label="Триггер пропадания связи"
          extra="Точное название триггера на узлах аптек.">
          <Input placeholder={DEFAULT_TRIGGER} autoComplete="off" />
        </Form.Item>

        {testResult && (
          <Alert
            style={{ marginBottom: 12 }}
            type={testResult.ok ? 'success' : 'error'}
            showIcon
            message={testResult.text}
          />
        )}

        <Space wrap>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
            Сохранить
          </Button>
          <Button onClick={onTest} loading={testing} icon={<CheckCircleOutlined />}>
            Проверить подключение
          </Button>
          <Popconfirm
            title="Очистить настройки Zabbix?"
            description="URL, IP и токен будут удалены из базы данных"
            onConfirm={onClear}
            okText="Очистить" okType="danger" cancelText="Отмена"
          >
            <Button danger icon={<DeleteOutlined />}>Очистить</Button>
          </Popconfirm>
        </Space>
      </Card>
    </Form>
  );
}
