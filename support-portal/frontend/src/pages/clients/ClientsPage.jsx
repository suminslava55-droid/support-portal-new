import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Input, Select, Space, Tag, Card, Typography, Row, Col, Tooltip, message
} from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { getClients, getProviders } from '../../api/clients'
import { getUsers } from '../../api/users'
import useAuthStore from '../../store/authStore'
import dayjs from 'dayjs'

const { Title } = Typography
const { Option } = Select

const STATUS_COLORS = { active: 'green', inactive: 'default', blocked: 'red' }

export default function ClientsPage() {
  const navigate = useNavigate()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState([])
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({ search: '', status: '', provider: '', assigned_to: '' })

  const fetchClients = async (page = 1) => {
    setLoading(true)
    try {
      const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
      const { data } = await getClients(params)
      setClients(data.results || data)
      setPagination(p => ({ ...p, total: data.count || data.length, current: page }))
    } catch {
      message.error('Ошибка загрузки клиентов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getProviders().then(({ data }) => setProviders(data.results || data))
    getUsers().then(({ data }) => setUsers(data.results || data))
  }, [])

  useEffect(() => { fetchClients(1) }, [filters])

  const columns = [
    {
      title: 'ФИО', dataIndex: 'full_name', key: 'full_name',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/clients/${record.id}`)} style={{ padding: 0 }}>
          {text}
        </Button>
      )
    },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Компания', dataIndex: 'company', key: 'company' },
    {
      title: 'Провайдер', dataIndex: 'provider', key: 'provider',
      render: (p) => p ? <Tag>{p.name}</Tag> : '—'
    },
    {
      title: 'Статус', dataIndex: 'status', key: 'status',
      render: (s, r) => <Tag color={STATUS_COLORS[s]}>{r.status_display}</Tag>
    },
    {
      title: 'Специалист', dataIndex: 'assigned_to', key: 'assigned_to',
      render: (u) => u ? u.full_name : '—'
    },
    {
      title: 'Создан', dataIndex: 'created_at', key: 'created_at',
      render: (d) => dayjs(d).format('DD.MM.YYYY')
    },
    {
      title: '', key: 'actions',
      render: (_, record) => (
        <Tooltip title="Открыть карточку">
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/clients/${record.id}`)} />
        </Tooltip>
      )
    },
  ]

  return (
    <Card>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Клиенты</Title>
        {hasPermission('create_clients') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clients/new')}>
            Добавить клиента
          </Button>
        )}
      </Row>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Поиск по имени, телефону, email, компании..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            allowClear
          />
        </Col>
        <Col>
          <Select
            placeholder="Статус" style={{ width: 150 }} allowClear
            onChange={(v) => setFilters(f => ({ ...f, status: v || '' }))}
          >
            <Option value="active">Активный</Option>
            <Option value="inactive">Неактивный</Option>
            <Option value="blocked">Заблокирован</Option>
          </Select>
        </Col>
        <Col>
          <Select
            placeholder="Провайдер" style={{ width: 160 }} allowClear
            onChange={(v) => setFilters(f => ({ ...f, provider: v || '' }))}
          >
            {providers.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
          </Select>
        </Col>
        <Col>
          <Select
            placeholder="Специалист" style={{ width: 180 }} allowClear
            onChange={(v) => setFilters(f => ({ ...f, assigned_to: v || '' }))}
          >
            {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
          </Select>
        </Col>
      </Row>
      <Table
        columns={columns}
        dataSource={clients}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showTotal: (total) => `Всего: ${total}`,
          onChange: (page) => fetchClients(page),
          showSizeChanger: false,
        }}
      />
    </Card>
  )
}
