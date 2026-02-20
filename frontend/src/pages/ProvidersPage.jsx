import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Typography, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';

const { Title } = Typography;

const CONNECTION_TYPES = [
  { value: 'fiber', label: 'Оптоволокно' },
  { value: 'dsl', label: 'DSL' },
  { value: 'cable', label: 'Кабель' },
  { value: 'wireless', label: 'Беспроводное' },
  { value: 'satellite', label: 'Спутниковое' },
  { value: 'other', label: 'Другое' },
];

const CONNECTION_COLORS = {
  fiber: 'blue', dsl: 'orange', cable: 'green',
  wireless: 'purple', satellite: 'cyan', other: 'default',
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/clients/providers/');
      setProviders(data.results || data);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProviders(); }, []);

  const openModal = (provider = null) => {
    setEditing(provider);
    form.setFieldsValue(provider || {});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.patch(`/clients/providers/${editing.id}/`, values);
        message.success('Провайдер обновлён');
      } else {
        await api.post('/clients/providers/', values);
        message.success('Провайдер добавлен');
      }
      setModalOpen(false);
      form.resetFields();
      fetchProviders();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/providers/${id}/`);
      message.success('Провайдер удалён');
      fetchProviders();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const columns = [
    { title: 'Название', dataIndex: 'name', width: 200 },
    {
      title: 'Тип подключения',
      dataIndex: 'connection_type',
      width: 180,
      render: (v, r) => v
        ? <Tag color={CONNECTION_COLORS[v]}>{r.connection_type_display}</Tag>
        : '—',
    },
    {
      title: 'Телефоны техподдержки',
      dataIndex: 'support_phones',
      render: (v) => v
        ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{v}</pre>
        : '—',
    },
    {
      title: 'Действия',
      width: 100,
      render: (_, r) => (
        <>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} style={{ marginRight: 8 }} />
          <Popconfirm title="Удалить провайдера?" onConfirm={() => handleDelete(r.id)} okText="Да" cancelText="Нет" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Провайдеры</Title>
          <Typography.Text type="secondary">Справочник провайдеров — привязка к клиенту при создании карточки</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Добавить провайдера
        </Button>
      </div>

      <Table columns={columns} dataSource={providers} rowKey="id" loading={loading} bordered size="middle" />

      <Modal
        title={editing ? 'Редактировать провайдера' : 'Новый провайдер'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Сохранить"
        cancelText="Отмена"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Название провайдера" rules={[{ required: true, message: 'Обязательное поле' }]}>
            <Input placeholder="Ростелеком, МТС, Новотелеком..." />
          </Form.Item>
          <Form.Item name="connection_type" label="Тип подключения">
            <Select placeholder="Выберите тип" allowClear options={CONNECTION_TYPES} />
          </Form.Item>
          <Form.Item name="support_phones" label="Телефоны техподдержки">
            <Input.TextArea
              rows={3}
              placeholder={"8-800-100-00-00 (общий)\n+7 (383) 000-00-01 (технический отдел)"}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
