import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Space, Typography,
  Popconfirm, message, Tag, Tooltip
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  BankOutlined, KeyOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import api from '../api/axios';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

export default function OfdCompaniesPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role_data?.name !== 'communications';

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients/ofd-companies/');
      setCompanies(res.data.results || res.data);
    } catch {
      message.error('Не удалось загрузить компании');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingCompany(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (company) => {
    setEditingCompany(company);
    form.setFieldsValue({
      name: company.name,
      inn: company.inn,
      ofd_token: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      // Валидируем только name и inn, токен не обязателен
      await form.validateFields(['name', 'inn']);
      const values = form.getFieldsValue();
      setSaving(true);
      const payload = {
        name: values.name,
        inn: values.inn,
      };
      // Токен передаём только если он введён
      const token = values.ofd_token;
      if (token && token.trim()) {
        payload.ofd_token = token.trim();
      }
      if (editingCompany) {
        await api.patch(`/clients/ofd-companies/${editingCompany.id}/`, payload);
        message.success('Компания обновлена');
      } else {
        await api.post('/clients/ofd-companies/', payload);
        message.success('Компания добавлена');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      if (e?.response?.data) {
        const errs = Object.entries(e.response.data).map(([k, v]) => `${k}: ${v}`).join('; ');
        message.error(errs);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/ofd-companies/${id}/`);
      message.success('Компания удалена');
      load();
    } catch {
      message.error('Не удалось удалить компанию');
    }
  };

  const columns = [
    {
      title: 'Название компании',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <BankOutlined style={{ color: '#1677ff' }} />
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: 'ИНН',
      dataIndex: 'inn',
      key: 'inn',
      render: (text) => <code style={{ fontSize: 13 }}>{text}</code>,
    },
    {
      title: 'Токен ОФД',
      dataIndex: 'has_token',
      key: 'has_token',
      align: 'center',
      render: (hasToken) => hasToken
        ? <Tag icon={<CheckCircleOutlined />} color="success">Задан</Tag>
        : <Tag icon={<CloseCircleOutlined />} color="error">Не задан</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      align: 'right',
      render: (_, record) => canEdit ? (
        <Space>
          <Tooltip title="Редактировать">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить компанию?"
            description="Клиенты связанные с этой компанией потеряют привязку."
            onConfirm={() => handleDelete(record.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Удалить">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ) : null,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BankOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Компании ОФД
        </Title>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Добавить компанию
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={companies}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'Компании не добавлены' }}
      />

      <Modal
        title={editingCompany ? 'Редактировать компанию' : 'Новая компания'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editingCompany ? 'Сохранить' : 'Добавить'}
        cancelText="Отмена"
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Название компании"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="ООО Фармакопейка" prefix={<BankOutlined />} />
          </Form.Item>

          <Form.Item
            name="inn"
            label="ИНН"
            rules={[
              { required: true, message: 'Введите ИНН' },
              { pattern: /^\d{10,12}$/, message: 'ИНН должен содержать 10 или 12 цифр' },
            ]}
          >
            <Input placeholder="1234567890" maxLength={12} />
          </Form.Item>

          <Form.Item
            name="ofd_token"
            label={
              <Space>
                <KeyOutlined />
                Токен ОФД
                {editingCompany?.has_token && (
                  <Tag color="success" style={{ fontSize: 11 }}>уже задан</Tag>
                )}
              </Space>
            }
            extra={editingCompany?.has_token
              ? 'Оставьте пустым чтобы не менять текущий токен'
              : 'Токен из личного кабинета lk.ofd.ru'}
          >
            <Input.Password
              placeholder={editingCompany?.has_token ? '••••••••••••••••' : 'Введите токен ОФД'}
              autoComplete="new-password"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
