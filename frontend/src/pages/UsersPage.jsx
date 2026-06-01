import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Typography, message, Tag, Popconfirm, DatePicker, Space, Checkbox, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, KeyOutlined } from '@ant-design/icons';
import { usersAPI, rolesAPI } from '../api';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([usersAPI.list(), rolesAPI.list()]);
      setUsers(usersRes.data.results || usersRes.data);
      setRoles(rolesRes.data.results || rolesRes.data);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (user = null) => {
    setEditingUser(user);
    form.setFieldsValue(user ? {
      ...user,
      birthday: user.birthday ? dayjs(user.birthday) : null,
      must_change_password: user.must_change_password || false,
    } : { is_active: true, must_change_password: false });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      const payload = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : null,
      };
      if (editingUser) {
        await usersAPI.update(editingUser.id, payload);
        message.success('Пользователь обновлён');
      } else {
        await usersAPI.create(payload);
        message.success('Пользователь создан');
      }
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id) => {
    try {
      await usersAPI.delete(id);
      message.success('Пользователь удалён');
      fetchData();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const ROLE_COLORS = { admin: 'red', senior: 'blue' };

  const columns = [
    { title: 'ФИО', dataIndex: 'full_name' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Роль',
      dataIndex: 'role_data',
      render: (r) => r ? <Tag color={ROLE_COLORS[r.name]}>{r.name_display}</Tag> : '—',
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Активен' : 'Заблокирован'}</Tag>,
    },
    {
      title: 'Действия',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Удалить пользователя?" onConfirm={() => handleDelete(r.id)} okText="Да" cancelText="Нет" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
          {r.must_change_password && (
            <Tooltip title="Должен сменить пароль при следующем входе">
              <KeyOutlined style={{ color: '#fa8c16', fontSize: 15, margin: '0 4px' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Пользователи</Title>
        <Space>
          <Input
            placeholder="Поиск по имени, email, роли..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            allowClear
            style={{ width: 280 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Добавить пользователя
        </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users.filter(u => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return (
            (u.full_name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.role_data?.name_display || '').toLowerCase().includes(q)
          );
        })}
        rowKey="id"
        loading={loading}
        bordered
        size="middle"
      />

      <Modal
        title={editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="last_name" label="Фамилия" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="first_name" label="Имя" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="middle_name" label="Отчество">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
            extra="Минимум 8 символов, заглавная буква и цифра"
            rules={[
              ...(editingUser ? [] : [{ required: true, message: 'Введите пароль' }]),
              {
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  if (value.length < 8) return Promise.reject('Минимум 8 символов');
                  if (!/[A-Z]/.test(value)) return Promise.reject('Нужна хотя бы одна заглавная буква');
                  if (!/[0-9]/.test(value)) return Promise.reject('Нужна хотя бы одна цифра');
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={roles.map((r) => ({ value: r.id, label: r.name_display }))} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="birthday" label="День рождения">
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder="Выберите дату" />
          </Form.Item>
          <Form.Item name="must_change_password" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>
              <span style={{ fontWeight: 500 }}>Сменить пароль при следующем входе</span>
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
