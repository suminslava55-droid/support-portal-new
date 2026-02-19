import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Tag, Button, Timeline, Input, Space,
  Descriptions, Divider, message, Spin, Popconfirm, Empty
} from 'antd';
import {
  EditOutlined, ArrowLeftOutlined, DeleteOutlined,
  SendOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { clientsAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title, Text } = Typography;

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [noteSending, setNoteSending] = useState(false);
  const permissions = useAuthStore((s) => s.permissions);

  const fetchClient = useCallback(async () => {
    try {
      const [clientRes, notesRes] = await Promise.all([
        clientsAPI.get(id),
        clientsAPI.getNotes(id),
      ]);
      setClient(clientRes.data);
      setNotes(notesRes.data);
    } catch {
      message.error('Ошибка загрузки клиента');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setNoteSending(true);
    try {
      const { data } = await clientsAPI.addNote(id, noteText.trim());
      setNotes((prev) => [data, ...prev]);
      setNoteText('');
    } catch {
      message.error('Ошибка добавления заметки');
    } finally {
      setNoteSending(false);
    }
  };

  const handleDelete = async () => {
    try {
      await clientsAPI.delete(id);
      message.success('Клиент удалён');
      navigate('/clients');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!client) return <div>Клиент не найден</div>;

  const statusColor = client.status === 'active' ? 'green' : 'default';
  const statusLabel = client.status === 'active' ? 'Активен' : 'Неактивен';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')} />
          <Title level={4} style={{ margin: 0 }}>{client.full_name}</Title>
          <Tag color={statusColor}>{statusLabel}</Tag>
        </Space>
        <Space>
          {permissions.can_edit_client && (
            <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/clients/${id}/edit`)}>
              Редактировать
            </Button>
          )}
          {permissions.can_delete_client && (
            <Popconfirm title="Удалить клиента?" onConfirm={handleDelete} okText="Удалить" cancelText="Отмена" okType="danger">
              <Button danger icon={<DeleteOutlined />}>Удалить</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          {/* Основная информация */}
          <Card title="Информация о клиенте" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Фамилия">{client.last_name}</Descriptions.Item>
              <Descriptions.Item label="Имя">{client.first_name}</Descriptions.Item>
              {client.middle_name && <Descriptions.Item label="Отчество">{client.middle_name}</Descriptions.Item>}
              <Descriptions.Item label="Телефон">{client.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{client.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Компания" span={2}>{client.company || '—'}</Descriptions.Item>
              <Descriptions.Item label="Адрес" span={2}>{client.address || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ответственный">{client.assigned_to_data?.full_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Создал">{client.created_by_data?.full_name || '—'}</Descriptions.Item>
            </Descriptions>

            {client.custom_field_values?.length > 0 && (
              <>
                <Divider>Дополнительные поля</Divider>
                <Descriptions column={2} bordered size="small">
                  {client.custom_field_values.map((cfv) => (
                    <Descriptions.Item key={cfv.id} label={cfv.field_name}>
                      {cfv.value || '—'}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}
          </Card>

          {/* Заметки */}
          <Card title="Заметки">
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input.TextArea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Добавить заметку..."
                rows={2}
                style={{ borderRadius: '6px 0 0 6px' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleAddNote}
                loading={noteSending}
                style={{ height: 'auto', borderRadius: '0 6px 6px 0' }}
              >
                Добавить
              </Button>
            </Space.Compact>

            {notes.length === 0 ? (
              <Empty description="Заметок пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              notes.map((note) => (
                <Card key={note.id} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong>{note.author_name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(note.created_at).format('DD.MM.YYYY HH:mm')}
                    </Text>
                  </div>
                  <Text>{note.text}</Text>
                </Card>
              ))
            )}
          </Card>
        </Col>

        <Col span={8}>
          {/* История изменений */}
          <Card title="История изменений">
            {client.activities?.length === 0 ? (
              <Empty description="История пуста" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={client.activities?.map((a) => ({
                  dot: <ClockCircleOutlined style={{ color: '#1677ff' }} />,
                  children: (
                    <div>
                      <Text>{a.action}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {a.user_name} · {dayjs(a.created_at).format('DD.MM HH:mm')}
                      </Text>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
