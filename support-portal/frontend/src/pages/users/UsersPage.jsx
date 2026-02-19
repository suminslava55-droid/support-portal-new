import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Tag,
  Typography, Popconfirm, message, Row, Col
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons'
import { getUsers, createUser, updateUser, deleteUser, setPassword, getRoles } from '../../api/users'

const { Title } = Typography
const { Option } = Select

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, user: null })
  const [passModal, setPassModal] = useState({ open: false, userId: null })
  const [form] = Form.useForm()
  const [passForm] = Form.useForm()

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await getUsers()
      setUsers(data.results || data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    getRoles().then(({ data }) => setRoles(data.results || data))
  }, [])

  const openCreate = () => {
    form.resetFields()
    setModal({ open: true, user: null })
  }

  const openEdit = (user) => {
    form.setFieldsValue({ ...user, role_id: user.role?.id })
    setModal({ open: true, user })
  }

  const handleSubmit = async (values) => {
    try {
      if (modal.user) {
        await updateUser(modal.user.id, values)
        message.success('Пользователь обновлён')
      } else {
        await createUser(values)
        message.success('Пользователь создан')
      }
      setModal({ open: false, user: null })
      fetchUsers()
    } catch (err) {
      const errData = err.response?.data
      if (errData) {
        const msgs = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
        message.error(msgs)
      } else {
        message.error('Ошибка сохранения')
      }
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteUser(id)
      message.success('Пользователь удалён')
      fetchUsers()
    } catch {
      message.error('Ошибка при удалении')
    }
  }

  const handleSetPassword = async ({ password }) => {
    try {
      await setPassword(passModal.userId, password)
      message.success('Пароль изменён')
      setPassModal({ open: false, userId: null })
      passForm.resetFields()
    } catch {
      message.error('Ошибка при изменении пароля')
    }
  }

  const columns = [
    { title: 'ФИО', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Роль', dataIndex: 'role', key: 'role',
      render: (r) => r ? <Tag color="blue">{r.display_name}</Tag> : <Tag>Нет роли</Tag>
    },
    {
      title: 'Статус', dataIndex: 'is_active', key: 'is_active',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Активен' : 'Отключён'}</Tag>
    },
    {
      title: 'Действия', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>Изменить</Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => setPassModal({ open: true, userId: record.id })}>Пароль</Button>
          <Popconfirm title="Удалить пользователя?" onConfirm={() => handleDelete(record.id)} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />}>Удалить</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <Card>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Пользователи</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить пользователя</Button>
      </Row>
      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} />

      <Modal
        title={modal.user ? 'Редактирование пользователя' : 'Новый пользователь'}
        open={modal.open}
        onCancel={() => setModal({ open: false, user: null })}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="last_name" label="Фамилия" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="first_name" label="Имя" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="username" label="Логин" rules={[{ required: true }]}><Input /></Form.Item>
          {!modal.user && (
            <Form.Item name="password" label="Пароль" rules={[{ required: true }, { min: 8, message: 'Минимум 8 символов' }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="role_id" label="Роль">
            <Select allowClear placeholder="Выберите роль">
              {roles.map(r => <Option key={r.id} value={r.id}>{r.display_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Статус" initialValue={true}>
            <Select>
              <Option value={true}>Активен</Option>
              <Option value={false}>Отключён</Option>
            </Select>
          </Form.Item>
          <Row justify="end" gutter={8}>
            <Col><Button onClick={() => setModal({ open: false, user: null })}>Отмена</Button></Col>
            <Col><Button type="primary" htmlType="submit">Сохранить</Button></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Изменить пароль"
        open={passModal.open}
        onCancel={() => { setPassModal({ open: false, userId: null }); passForm.resetFields() }}
        footer={null}
      >
        <Form form={passForm} layout="vertical" onFinish={handleSetPassword}>
          <Form.Item name="password" label="Новый пароль" rules={[{ required: true }, { min: 8, message: 'Минимум 8 символов' }]}>
            <Input.Password />
          </Form.Item>
          <Row justify="end" gutter={8}>
            <Col><Button onClick={() => setPassModal({ open: false, userId: null })}>Отмена</Button></Col>
            <Col><Button type="primary" htmlType="submit">Изменить</Button></Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  )
}
