import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Tag, Button, Timeline, Input, Space,
  Descriptions, message, Spin, Popconfirm, Empty, Tooltip, Badge
} from 'antd';
import {
  EditOutlined, ArrowLeftOutlined, DeleteOutlined,
  SendOutlined, ClockCircleOutlined, WifiOutlined, CopyOutlined,
  CheckCircleFilled, CloseCircleFilled, SyncOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { clientsAPI } from '../api';
import api from '../api';
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

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback для HTTP
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

function CopyField({ value, children }) {
  const handleCopy = () => {
    if (!value) return;
    copyToClipboard(value);
    message.success('Скопировано!', 1);
  };
  return (
    <Space size={6}>
      <span>{children || value || '—'}</span>
      {value && (
        <Tooltip title="Скопировать">
          <Button type="text" size="small"
            icon={<CopyOutlined style={{ color: '#1677ff' }} />}
            onClick={handleCopy} style={{ padding: '0 2px', height: 'auto' }}
          />
        </Tooltip>
      )}
    </Space>
  );
}

function PingStatus({ status, ip }) {
  if (!ip) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
  if (status === 'checking') return <SyncOutlined spin style={{ color: '#1677ff' }} />;
  if (status === true) return (
    <Tooltip title={`${ip} — доступен`}>
      <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
    </Tooltip>
  );
  if (status === false) return (
    <Tooltip title={`${ip} — недоступен`}>
      <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />
    </Tooltip>
  );
  return (
    <Tooltip title="Не проверено">
      <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
    </Tooltip>
  );
}

function ActivityIcon({ action }) {
  if (action.includes('создана')) return '🆕';
  if (action.includes('заметка')) return '💬';
  if (action.includes('Провайдер')) return '🌐';
  if (action.includes('Статус')) return '🔄';
  if (action.includes('Телефон') || action.includes('Email')) return '📞';
  if (action.includes('IP') || action.includes('Подсеть') || action.includes('Микротик')) return '🖧';
  if (action.includes('договора') || action.includes('счёт')) return '📄';
  if (action.includes('ICCID')) return '📱';
  if (action.includes('Код аптеки')) return '🏥';
  return '✏️';
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [noteSending, setNoteSending] = useState(false);
  const [pingResults, setPingResults] = useState({ external_ip: null, mikrotik_ip: null, server_ip: null });
  const [pinging, setPinging] = useState(false);
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

  const checkPing = useCallback(async () => {
    setPinging(true);
    setPingResults({ external_ip: 'checking', mikrotik_ip: 'checking', server_ip: 'checking' });
    try {
      const { data } = await api.get(`/clients/${id}/ping/`);
      setPingResults({
        external_ip: data.external_ip?.alive ?? null,
        mikrotik_ip: data.mikrotik_ip?.alive ?? null,
        server_ip: data.server_ip?.alive ?? null,
      });
    } catch {
      setPingResults({ external_ip: false, mikrotik_ip: false, server_ip: false });
    } finally {
      setPinging(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  // Запускаем пинг автоматически после загрузки карточки
  useEffect(() => {
    if (client) {
      checkPing();
    }
  }, [client?.id]);

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
  const pageTitle = client.address || client.company || `Клиент #${client.id}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')} />
          <Title level={4} style={{ margin: 0 }}>{pageTitle}</Title>
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
              <Descriptions.Item label="Адрес" span={2}>{client.address || '—'}</Descriptions.Item>
              <Descriptions.Item label="Компания">{client.company || '—'}</Descriptions.Item>
              <Descriptions.Item label="ИНН"><CopyField value={client.inn} /></Descriptions.Item>
              <Descriptions.Item label="Телефон"><CopyField value={client.phone} /></Descriptions.Item>
              <Descriptions.Item label="ICCID"><CopyField value={client.iccid} /></Descriptions.Item>
              <Descriptions.Item label="Email"><CopyField value={client.email} /></Descriptions.Item>
              <Descriptions.Item label="Код аптеки"><CopyField value={client.pharmacy_code} /></Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<Space><WifiOutlined style={{ color: '#1677ff' }} /><span>Провайдер</span></Space>}
            extra={
              <Tooltip title="Проверить доступность IP">
                <Button
                  size="small" icon={<SyncOutlined spin={pinging} />}
                  onClick={checkPing} loading={pinging}
                >
                  Проверить доступность
                </Button>
              </Tooltip>
            }
            style={{ marginBottom: 16 }}
          >
            {provider ? (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Название" span={2}>
                  <Text strong>{provider.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Тип подключения" span={2}>
                  {provider.connection_type
                    ? <Tag color={CONNECTION_COLORS[provider.connection_type]}>{CONNECTION_LABELS[provider.connection_type]}</Tag>
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
                <Descriptions.Item label="Подсеть аптеки">
                  <CopyField value={client.subnet} />
                </Descriptions.Item>
                <Descriptions.Item label="Внешний IP">
                  <Space>
                    <CopyField value={client.external_ip} />
                    <PingStatus status={pingResults.external_ip} ip={client.external_ip} />
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Микротик IP">
                  <Space>
                    <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {client.mikrotik_ip || '—'}
                    </Tag>
                    {client.mikrotik_ip && (
                      <Tooltip title="Скопировать">
                        <Button type="text" size="small"
                          icon={<CopyOutlined style={{ color: '#1677ff' }} />}
                          onClick={() => { copyToClipboard(client.mikrotik_ip); message.success('Скопировано!', 1); }}
                          style={{ padding: '0 2px', height: 'auto' }}
                        />
                      </Tooltip>
                    )}
                    <PingStatus status={pingResults.mikrotik_ip} ip={client.mikrotik_ip} />
                    <Text type="secondary" style={{ fontSize: 11 }}>авто (.1)</Text>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Сервер IP">
                  <Space>
                    <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {client.server_ip || '—'}
                    </Tag>
                    {client.server_ip && (
                      <Tooltip title="Скопировать">
                        <Button type="text" size="small"
                          icon={<CopyOutlined style={{ color: '#1677ff' }} />}
                          onClick={() => { copyToClipboard(client.server_ip); message.success('Скопировано!', 1); }}
                          style={{ padding: '0 2px', height: 'auto' }}
                        />
                      </Tooltip>
                    )}
                    <PingStatus status={pingResults.server_ip} ip={client.server_ip} />
                    <Text type="secondary" style={{ fontSize: 11 }}>авто (.2)</Text>
                  </Space>
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
                <Button type="link" onClick={() => navigate(`/clients/${id}/edit`)}>Указать провайдера</Button>
              </Empty>
            )}
          </Card>

          <Card title="Заметки">
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input.TextArea
                value={noteText} onChange={(e) => setNoteText(e.target.value)}
                placeholder="Добавить заметку..." rows={2}
                style={{ borderRadius: '6px 0 0 6px' }}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleAddNote}
                loading={noteSending} style={{ height: 'auto', borderRadius: '0 6px 6px 0' }}>
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
          <Card title={<Space>История изменений <Tag>{client.activities?.length || 0}</Tag></Space>}>
            {!client.activities?.length ? (
              <Empty description="История пуста" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                <Timeline
                  items={client.activities.map((a) => ({
                    dot: <span style={{ fontSize: 14 }}><ActivityIcon action={a.action} /></span>,
                    children: (
                      <div style={{ marginBottom: 4 }}>
                        <Text style={{ fontSize: 13 }}>{a.action}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {a.user_name} · {dayjs(a.created_at).format('DD.MM.YYYY HH:mm')}
                        </Text>
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
