import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Typography, message, Spin } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { clientsAPI } from '../api';
import api from '../api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

function calcMikrotikIP(subnet) {
  if (!subnet) return '';
  try {
    const network = subnet.split('/')[0];
    const parts = network.split('.');
    if (parts.length === 4) { parts[3] = '2'; return parts.join('.'); }
  } catch (e) {}
  return '';
}

export default function ClientFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [mikrotikIP, setMikrotikIP] = useState('');
  const permissions = useAuthStore((s) => s.permissions);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const providersRes = await api.get('/clients/providers/');
        setProviders(providersRes.data.results || providersRes.data);
        if (isEdit) {
          const { data } = await clientsAPI.get(id);
          form.setFieldsValue(data);
          setMikrotikIP(calcMikrotikIP(data.subnet));
        }
      } catch {
        message.error('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEdit, form]);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      if (isEdit) {
        await clientsAPI.update(id, values);
        message.success('Клиент обновлён');
        navigate(`/clients/${id}`);
      } else {
        const { data } = await clientsAPI.create(values);
        message.success('Клиент создан');
        navigate(`/clients/${data.id}`);
      }
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = permissions.can_edit_client || permissions.can_create_client;
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Редактирование клиента' : 'Новый клиент'}</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} disabled={!canEdit}>
        <Card title="Основная информация" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Адрес">
                <Input.TextArea rows={2} placeholder="г. Новосибирск, ул. Примерная, д. 1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Компания / организация">
                <Input placeholder="ООО «Название»" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inn" label="ИНН">
                <Input placeholder="123456789012" maxLength={12} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Телефон">
                <Input placeholder="+7 (999) 123-45-67" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="iccid" label="ICCID">
                <Input placeholder="89701xxxxxxxxxxxxxxx" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Некорректный email' }]}>
                <Input placeholder="example@mail.ru" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pharmacy_code" label="Код аптеки">
                <Input placeholder="APT-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Статус" initialValue="active">
                <Select options={[
                  { value: 'active', label: 'Активен' },
                  { value: 'inactive', label: 'Неактивен' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Провайдер" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="provider" label="Провайдер">
                <Select
                  placeholder="Выберите провайдера" allowClear showSearch optionFilterProp="label"
                  options={providers.map((p) => ({ value: p.id, label: p.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="personal_account" label="Лицевой счёт">
                <Input placeholder="12345678" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contract_number" label="№ договора">
                <Input placeholder="ДГ-2024-001" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="provider_settings" label="Настройки провайдера">
                <Input.TextArea rows={4} placeholder={"IP: 192.168.1.1\nМаска: 255.255.255.0\nШлюз: 192.168.1.254\nDNS: 8.8.8.8"} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subnet" label="Подсеть аптеки">
                <Input placeholder="10.1.5.0/24" onChange={(e) => setMikrotikIP(calcMikrotikIP(e.target.value))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="external_ip" label="Внешний IP">
                <Input placeholder="1.2.3.4" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Микротик IP (вычисляется автоматически)">
                <Input value={mikrotikIP || '—'} disabled style={{ background: '#f5f5f5', color: '#333' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {canEdit && (
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
            {isEdit ? 'Сохранить изменения' : 'Создать клиента'}
          </Button>
        )}
      </Form>
    </div>
  );
}
