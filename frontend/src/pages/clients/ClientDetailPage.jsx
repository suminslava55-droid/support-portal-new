import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Button, Tag, Typography, Space, Spin, message,
  List, Avatar, Input, Divider, Popconfirm, Select, Row, Col, Modal, Form
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, SendOutlined,
  UserOutlined, PhoneOutlined, MailOutlined, BankOutlined, EnvironmentOutlined
} from '@ant-design/icons'
import { getClient, updateClient, deleteClient, addClientNote, getProviders } from '../../api/clients'
import { getUsers } from '../../api/users'
import useAuthStore from '../../store/authStore'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const STATUS_COLORS = { active: 'green', inactive: 'default', blocked: 'red' }
const STATUS_LABELS = { active: 'Активный', inactive: 'Неактивный', blocked: 'Заблокирован' }

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [providers, setProviders] = useState([])
  const [users, setUsers] = useState([])
  const [form] = Form.useForm()

  const fetchClient = async () => {
    try {
      const { data } = await getClient(id)
      setClient(data)
    } catch {
      message.error('Клиент не найден')
      navigate('/clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClient()
    getProviders().then(({ data }) => setProviders(data.results || data))
    getUsers().then(({ data }) => setUsers(data.results || data))
  }, [id])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setNoteLoading(true)
    try {
      await addClientNote(id, noteText)
      setNoteText('')
      fetchClient()
      message.success('Заметка добавлена')
    } catch {
      message.error('Ошибка при добавлении заметки')
    } finally {
      setNoteLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteClient(id)
      message.success('Клиент удалён')
      navigate('/clients')
    } catch {
      message.error('Ошибка при удалении')
    }
  }

  const openEdit = () => {
    form.setFieldsValue({
      ...client,
      provider_id: client.provider?.id,
      assigned_to_id: client.assigned_to?.id,
    })
    setEditModal(true)
  }

  const handleEdit = async (values) => {
    try {
      const { data } = await updateClient(id, values)
      setClient(data)
      setEditModal(false)
      message.success('Данные обновлены')
    } catch {
      message.error('Ошибка при сохранении')
    }
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!client) return null

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Row justify="space-between" align="middle">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>
              Назад
            </Button>
            <Title level={4} style={{ margin: 0 }}>{client.full_name}</Title>
            <Tag color={STATUS_COLORS[client.status]}>{STATUS_LABELS[client.status]}</Tag>
          </Space>
          <Space>
            {hasPermission('edit_clients') && (
              <Button icon={<EditOutlined />} onClick={openEdit}>Редактировать</Button>
            )}
            {hasPermission('delete_clients') && (
              <Popconfirm title="Удалить клиента?" onConfirm={handleDelete} okText="Да" cancelText="Нет">
                <Button danger icon={<DeleteOutlined />}>Удалить</Button>
              </Popconfirm>
            )}
          </Space>
        </Row>

        <Card title="Основная информация">
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label={<><PhoneOutlined /> Телефон</>}>{client.phone}</Descriptions.Item>
            <Descriptions.Item label={<><MailOutlined /> Email</>}>{client.email || '—'}</Descriptions.Item>
            <Descriptions.Item label={<><BankOutlined /> Компания</>}>{client.company || '—'}</Descriptions.Item>
            <Descriptions.Item label="Провайдер">
              {client.provider ? <Tag>{client.provider.name}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label={<><EnvironmentOutlined /> Адрес</>} span={2}>
              {client.address || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Telegram">{client.telegram || '—'}</Descriptions.Item>
            <Descriptions.Item label="WhatsApp">{client.whatsapp || '—'}</Descriptions.Item>
            <Descriptions.Item label="ВКонтакте">{client.vk || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ответственный">
              {client.assigned_to ? (
                <Space><Avatar size="small" icon={<UserOutlined />} />{client.assigned_to.full_name}</Space>
              ) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Создан">{dayjs(client.created_at).format('DD.MM.YYYY HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="Создал">{client.created_by?.full_name || '—'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Заметки и история">
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <TextArea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Добавьте заметку о клиенте..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') handleAddNote() }}
            />
            <Button
              type="primary" icon={<SendOutlined />}
              onClick={handleAddNote} loading={noteLoading}
              style={{ height: 'auto' }}
            >
              Добавить
            </Button>
          </Space.Compact>
          <List
            dataSource={client.notes || []}
            locale={{ emptyText: 'Заметок пока нет' }}
            renderItem={(note) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={<Space><Text strong>{note.author?.full_name}</Text><Text type="secondary" style={{ fontSize: 12 }}>{dayjs(note.created_at).format('DD.MM.YYYY HH:mm')}</Text></Space>}
                  description={<Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{note.text}</Paragraph>}
                />
              </List.Item>
            )}
          />
        </Card>
      </Space>

      <Modal
        title="Редактирование клиента"
        open={editModal}
        onCancel={() => setEditModal(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="last_name" label="Фамилия" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="first_name" label="Имя" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="middle_name" label="Отчество"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="phone" label="Телефон" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="company" label="Компания"><Input /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="provider_id" label="Провайдер">
                <Select allowClear placeholder="Выберите провайдера">
                  {providers.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Адрес"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="telegram" label="Telegram"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="vk" label="ВКонтакте"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Статус">
                <Select>
                  <Option value="active">Активный</Option>
                  <Option value="inactive">Неактивный</Option>
                  <Option value="blocked">Заблокирован</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assigned_to_id" label="Ответственный специалист">
                <Select allowClear placeholder="Назначить специалиста">
                  {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row justify="end" gutter={8}>
            <Col><Button onClick={() => setEditModal(false)}>Отмена</Button></Col>
            <Col><Button type="primary" htmlType="submit">Сохранить</Button></Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
