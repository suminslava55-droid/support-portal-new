import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Typography, message, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { usersAPI, rolesAPI } from '../api';

const { Title } = Typography;

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
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
    form.setFieldsValue(user || { is_active: true });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editingUser) {
        await usersAPI.update(editingUser.id, values);
        message.success('Пользователь обновлён');
      } else {
        await usersAPI.create(values);
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
        <>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} style={{ marginRight: 8 }} />
          <Popconfirm title="Удалить пользователя?" onConfirm={() => handleDelete(r.id)} okText="Да" cancelText="Нет" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Пользователи</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Добавить пользователя
        </Button>
      </div>

      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} bordered size="middle" />

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
          <Form.Item name="password" label={editingUser ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'} rules={editingUser ? [] : [{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={roles.map((r) => ({ value: r.id, label: r.name_display }))} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
