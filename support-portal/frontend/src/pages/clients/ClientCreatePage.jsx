import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Row, Col, Typography, Space, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { createClient, getProviders } from '../../api/clients'
import { getUsers } from '../../api/users'

const { Title } = Typography
const { Option } = Select

export default function ClientCreatePage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    getProviders().then(({ data }) => setProviders(data.results || data))
    getUsers().then(({ data }) => setUsers(data.results || data))
  }, [])

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const { data } = await createClient(values)
      message.success('Клиент создан')
      navigate(`/clients/${data.id}`)
    } catch (err) {
      const errData = err.response?.data
      if (errData) {
        const msgs = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
        message.error(msgs)
      } else {
        message.error('Ошибка при создании клиента')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>Назад</Button>
        <Title level={4} style={{ margin: 0 }}>Новый клиент</Title>
      </Space>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="last_name" label="Фамилия" rules={[{ required: true, message: 'Обязательное поле' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="first_name" label="Имя" rules={[{ required: true, message: 'Обязательное поле' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="middle_name" label="Отчество"><Input /></Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Телефон" rules={[{ required: true, message: 'Обязательное поле' }]}>
              <Input placeholder="+7 (999) 000-00-00" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Некорректный email' }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="company" label="Компания / организация"><Input /></Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="provider_id" label="Провайдер">
              <Select allowClear placeholder="Выберите провайдера">
                {providers.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="address" label="Адрес">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={8}><Form.Item name="telegram" label="Telegram"><Input placeholder="@username" /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item name="vk" label="ВКонтакте"><Input /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Статус" initialValue="active">
              <Select>
                <Option value="active">Активный</Option>
                <Option value="inactive">Неактивный</Option>
                <Option value="blocked">Заблокирован</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="assigned_to_id" label="Ответственный специалист">
              <Select allowClear placeholder="Назначить специалиста">
                {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Space>
            <Button onClick={() => navigate('/clients')}>Отмена</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Создать клиента</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}
