import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Typography, Divider, message, Spin } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { clientsAPI, usersAPI, customFieldsAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

export default function ClientFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const permissions = useAuthStore((s) => s.permissions);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [usersRes, fieldsRes] = await Promise.all([
          usersAPI.list(),
          customFieldsAPI.list(),
        ]);
        setUsers(usersRes.data.results || usersRes.data);
        setCustomFields(fieldsRes.data.results || fieldsRes.data);

        if (isEdit) {
          const { data } = await clientsAPI.get(id);
          const customFieldsValues = {};
          (data.custom_field_values || []).forEach((cfv) => {
            customFieldsValues[`cf_${cfv.field}`] = cfv.value;
          });
          form.setFieldsValue({ ...data, ...customFieldsValues });
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
    const customFieldsData = {};
    const clientData = {};

    Object.entries(values).forEach(([key, value]) => {
      if (key.startsWith('cf_')) {
        customFieldsData[key.replace('cf_', '')] = value || '';
      } else {
        clientData[key] = value;
      }
    });
    clientData.custom_fields = customFieldsData;

    try {
      if (isEdit) {
        await clientsAPI.update(id, clientData);
        message.success('Клиент обновлён');
        navigate(`/clients/${id}`);
      } else {
        const { data } = await clientsAPI.create(clientData);
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
            <Col span={8}>
              <Form.Item name="last_name" label="Фамилия" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="Иванов" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="first_name" label="Имя" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="Иван" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="middle_name" label="Отчество">
                <Input placeholder="Иванович" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Телефон">
                <Input placeholder="+7 (999) 123-45-67" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Некорректный email' }]}>
                <Input placeholder="example@mail.ru" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Компания / организация">
                <Input placeholder="ООО «Название»" />
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
            <Col span={24}>
              <Form.Item name="address" label="Адрес">
                <Input.TextArea rows={2} placeholder="г. Москва, ул. Примерная, д. 1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assigned_to" label="Ответственный">
                <Select
                  placeholder="Выберите специалиста"
                  allowClear
                  options={users.map((u) => ({ value: u.id, label: u.full_name || u.email }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {customFields.length > 0 && (
          <Card title="Дополнительные поля" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              {customFields.map((field) => (
                <Col span={12} key={field.id}>
                  <Form.Item
                    name={`cf_${field.id}`}
                    label={field.name}
                    rules={field.is_required ? [{ required: true, message: 'Обязательное поле' }] : []}
                  >
                    {field.field_type === 'select' ? (
                      <Select
                        placeholder="Выберите значение"
                        allowClear
                        options={(field.options || []).map((o) => ({ value: o, label: o }))}
                      />
                    ) : (
                      <Input />
                    )}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {canEdit && (
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
            {isEdit ? 'Сохранить изменения' : 'Создать клиента'}
          </Button>
        )}
      </Form>
    </div>
  );
}
