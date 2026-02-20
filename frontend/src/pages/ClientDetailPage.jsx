import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Tag, Button, Timeline, Input, Space,
  Descriptions, message, Spin, Popconfirm, Empty, Tooltip
} from 'antd';
import {
  EditOutlined, ArrowLeftOutlined, DeleteOutlined,
  SendOutlined, ClockCircleOutlined, WifiOutlined, CopyOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { clientsAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title, Text } = Typography;

const CONNECTION_LABELS = {
  fiber: 'Оптоволокно', dsl: 'DSL', cable: 'Кабель',
  wireless: 'Беспроводное', satellite: 'Спутниковое', other: 'Другое',
};
const CONNECTION_COLORS = {
  fiber: 'blue', dsl: 'orange', cable: 'green',
  wireless: 'purple', satellite: 'cyan', other: 'default',
};

function CopyField({ value, children }) {
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    message.success('Скопировано!', 1);
  };
  return (
    <Space size={6}>
      <span>{children || value || '—'}</span>
      {value && (
        <Tooltip title="Скопировать">
          <Button
            type="text" size="small"
            icon={<CopyOutlined style={{ color: '#1677ff' }} />}
            onClick={handleCopy}
            style={{ padding: '0 2px', height: 'auto' }}
          />
        </Tooltip>
      )}
    </Space>
  );
}

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

  const provider = client.provider_data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')} />
          <Title level={4} style={{ margin: 0 }}>{client.full_name}</Title>
          <Tag color={client.status === 'active' ? 'green' : 'default'}>
            {client.status === 'active' ? 'Активен' : 'Неактивен'}
          </Tag>
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
          <Card title="Информация о клиенте" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Фамилия">{client.last_name}</Descriptions.Item>
              <Descriptions.Item label="Имя">{client.first_name}</Descriptions.Item>
              {client.middle_name && (
                <Descriptions.Item label="Отчество" span={2}>{client.middle_name}</Descriptions.Item>
              )}
              <Descriptions.Item label="ИНН">
                <CopyField value={client.inn} />
              </Descriptions.Item>
              <Descriptions.Item label="Телефон">
                <CopyField value={client.phone} />
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <CopyField value={client.email} />
              </Descriptions.Item>
              <Descriptions.Item label="Компания" span={2}>{client.company || '—'}</Descriptions.Item>
              <Descriptions.Item label="Адрес" span={2}>{client.address || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<Space><WifiOutlined style={{ color: '#1677ff' }} /><span>Провайдер</span></Space>}
            style={{ marginBottom: 16 }}
          >
            {provider ? (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Название" span={2}>
                  <Text strong>{provider.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Тип подключения" span={2}>
                  {provider.connection_type
                    ? <Tag color={CONNECTION_COLORS[provider.connection_type]}>
                        {CONNECTION_LABELS[provider.connection_type]}
                      </Tag>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Лицевой счёт">
                  <CopyField value={client.personal_account} />
                </Descriptions.Item>
                <Descriptions.Item label="№ договора">
                  <CopyField value={client.contract_number} />
                </Descriptions.Item>
                <Descriptions.Item label="Настройки провайдера" span={2}>
                  {client.provider_settings
                    ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{client.provider_settings}</pre>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Подсеть аптеки" span={2}>
                  {client.subnet
                    ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{client.subnet}</pre>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Телефоны техподдержки" span={2}>
                  <CopyField value={provider.support_phones}>
                    {provider.support_phones
                      ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{provider.support_phones}</pre>
                      : null}
                  </CopyField>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="Провайдер не указан" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="link" onClick={() => navigate(`/clients/${id}/edit`)}>
                  Указать провайдера
                </Button>
              </Empty>
            )}
          </Card>

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
                type="primary" icon={<SendOutlined />}
                onClick={handleAddNote} loading={noteSending}
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
