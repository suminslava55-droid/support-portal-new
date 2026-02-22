import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Tag, Button, Timeline, Input, Space,
  Descriptions, message, Spin, Popconfirm, Empty, Tooltip, Upload, List, Image, Badge
} from 'antd';
import {
  EditOutlined, ArrowLeftOutlined, DeleteOutlined,
  SendOutlined, ClockCircleOutlined, WifiOutlined, CopyOutlined, GlobalOutlined,
  CheckCircleFilled, CloseCircleFilled, SyncOutlined, MinusCircleOutlined,
  UploadOutlined, FileOutlined, FilePdfOutlined, FileImageOutlined, DeleteFilled, DownloadOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { clientsAPI } from '../api';
import api from '../api';
import useAuthStore from '../store/authStore';

const { Title, Text } = Typography;

const CONNECTION_LABELS = {
  fiber: '⚡ Оптоволокно',
  dsl: '☎️ DSL',
  cable: '🔌 Кабель',
  wireless: '📡 Беспроводное',
  modem: '📶 Модем',
  mrnet: '↔️ MR-Net',
};
const CONNECTION_COLORS = {
  fiber: 'blue', dsl: 'orange', cable: 'green', wireless: 'purple',
  modem: 'cyan', mrnet: 'geekblue',
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
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pingResults, setPingResults] = useState({ external_ip: null, mikrotik_ip: null, server_ip: null });
  const [pinging, setPinging] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const permissions = useAuthStore((s) => s.permissions);

  const fetchClient = useCallback(async () => {
    try {
      const [clientRes, notesRes, filesRes] = await Promise.all([
        clientsAPI.get(id),
        clientsAPI.getNotes(id),
        clientsAPI.getFiles(id),
      ]);
      setClient(clientRes.data);
      setNotes(notesRes.data);
      setFiles(filesRes.data);
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

  const handleUpload = async ({ file }) => {
    setUploading(true);
    try {
      const { data } = await clientsAPI.uploadFile(id, file);
      setFiles((prev) => [data, ...prev]);
      message.success(`Файл «${file.name}» загружен`);
    } catch {
      message.error('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDeleteFile = async (fileId, fileName) => {
    try {
      await clientsAPI.deleteFile(id, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      message.success(`Файл «${fileName}» удалён`);
    } catch {
      message.error('Ошибка удаления файла');
    }
  };

  const getFileIcon = (name) => {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <FileImageOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
    if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
    return <FileOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  };

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
            title={<Space><GlobalOutlined style={{ color: '#1677ff' }} /><span>Сеть</span></Space>}
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
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Подсеть аптеки">
                <CopyField value={client.subnet} />
              </Descriptions.Item>
              <Descriptions.Item label="Внешний IP">
                <Space>
                  {client.external_ip ? (
                    <a href={`http://${client.external_ip}`} target="_blank" rel="noreferrer"
                      style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {client.external_ip}
                    </a>
                  ) : <Text type="secondary">—</Text>}
                  {client.external_ip && (
                    <Tooltip title="Скопировать">
                      <Button type="text" size="small"
                        icon={<CopyOutlined style={{ color: '#1677ff' }} />}
                        onClick={() => { copyToClipboard(client.external_ip); message.success('Скопировано!', 1); }}
                        style={{ padding: '0 2px', height: 'auto' }}
                      />
                    </Tooltip>
                  )}
                  <PingStatus status={pingResults.external_ip} ip={client.external_ip} />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Микротик IP">
                <Space>
                  <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {client.mikrotik_ip
                      ? <a href={`http://${client.mikrotik_ip}`} target="_blank" rel="noreferrer"
                          style={{ color: 'inherit' }}>{client.mikrotik_ip}</a>
                      : '—'}
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
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
          <Card
            title={<Space><WifiOutlined style={{ color: '#1677ff' }} /><span>Провайдер 1</span></Space>}
            style={{ marginBottom: 16 }}
          >
            {provider ? (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Название" span={2}>
                  <Text strong>{provider.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Тип подключения">
                  {client.connection_type
                    ? <Tag color={CONNECTION_COLORS[client.connection_type]}>{CONNECTION_LABELS[client.connection_type]}</Tag>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Тариф">
                  {client.tariff
                    ? <><Text strong>{client.tariff}</Text> <Text type="secondary">Мбит/с</Text></>
                    : '—'}
                </Descriptions.Item>
                {['modem', 'mrnet'].includes(client.connection_type) && (
                  <>
                    <Descriptions.Item label="Номер (модем/SIM)">
                      {client.modem_number
                        ? <CopyField value={client.modem_number} />
                        : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="ICCID модема">
                      {client.modem_iccid
                        ? <CopyField value={client.modem_iccid} />
                        : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                  </>
                )}
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

                <Descriptions.Item label="Телефоны техподдержки" span={2}>
                  <CopyField value={provider.support_phones}>
                    {provider.support_phones
                      ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{provider.support_phones}</pre>
                      : null}
                  </CopyField>
                </Descriptions.Item>

                <Descriptions.Item label="Оборудование провайдера" span={2}>
                  {client.provider_equipment
                    ? <Tag color="green" style={{ fontSize: 13 }}>✓ Присутствует</Tag>
                    : <Tag color="red" style={{ fontSize: 13 }}>✗ Отсутствует</Tag>}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="Провайдер не указан" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="link" onClick={() => navigate(`/clients/${id}/edit`)}>Указать провайдера</Button>
              </Empty>
            )}
          </Card>

          {/* ===== ПРОВАЙДЕР 2 ===== */}
          {client.provider2_data && (
            <Card
              title={<Space><WifiOutlined style={{ color: '#4096ff' }} /><span>Провайдер 2</span></Space>}
              style={{ marginBottom: 16, borderColor: '#91caff' }}
            >
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Название" span={2}>
                  <Text strong>{client.provider2_data.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Тип подключения">
                  {client.connection_type2
                    ? <Tag color={CONNECTION_COLORS[client.connection_type2]}>{CONNECTION_LABELS[client.connection_type2]}</Tag>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Тариф">
                  {client.tariff2
                    ? <><Text strong>{client.tariff2}</Text> <Text type="secondary">Мбит/с</Text></>
                    : '—'}
                </Descriptions.Item>
                {['modem', 'mrnet'].includes(client.connection_type2) && (
                  <>
                    <Descriptions.Item label="Номер (модем/SIM)">
                      {client.modem_number2 ? <CopyField value={client.modem_number2} /> : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="ICCID модема">
                      {client.modem_iccid2 ? <CopyField value={client.modem_iccid2} /> : <Text type="secondary">—</Text>}
                    </Descriptions.Item>
                  </>
                )}
                <Descriptions.Item label="Лицевой счёт">
                  <CopyField value={client.personal_account2} />
                </Descriptions.Item>
                <Descriptions.Item label="№ договора">
                  <CopyField value={client.contract_number2} />
                </Descriptions.Item>
                <Descriptions.Item label="Настройки провайдера" span={2}>
                  {client.provider_settings2
                    ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{client.provider_settings2}</pre>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Телефоны техподдержки" span={2}>
                  <CopyField value={client.provider2_data.support_phones}>
                    {client.provider2_data.support_phones
                      ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{client.provider2_data.support_phones}</pre>
                      : null}
                  </CopyField>
                </Descriptions.Item>
                <Descriptions.Item label="Оборудование провайдера" span={2}>
                  {client.provider_equipment2
                    ? <Tag color="green" style={{ fontSize: 13 }}>✓ Присутствует</Tag>
                    : <Tag color="red" style={{ fontSize: 13 }}>✗ Отсутствует</Tag>}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

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
          <Card
            title={<Space>История изменений <Tag>{client.activities?.length || 0}</Tag></Space>}
            style={{ marginBottom: 16 }}
          >
            {!client.activities?.length ? (
              <Empty description="История пуста" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <Timeline
                  items={(showAllActivity
                    ? client.activities
                    : client.activities.slice(0, 2)
                  ).map((a) => ({
                    dot: <span style={{ fontSize: 14 }}><ActivityIcon action={a.action} /></span>,
                    children: (
                      <div style={{ marginBottom: 4 }}>
                        {a.action.startsWith('Изменено:')
                          ? <>
                              <Text style={{ fontSize: 12, fontWeight: 600 }}>Изменено:</Text>
                              {a.action.replace('Изменено: ', '').split(' | ').map((item, i) => (
                                <div key={i} style={{ fontSize: 12, paddingLeft: 8, color: '#333' }}>• {item}</div>
                              ))}
                            </>
                          : (a.action.includes('\n')
                            ? <div>
                                {a.action.split('\n').map((line, i) => (
                                  <div key={i} style={{ fontSize: 13, color: '#333', lineHeight: '1.6' }}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                            : <Text style={{ fontSize: 13 }}>{a.action}</Text>
                          )
                        }
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {a.user_name} · {dayjs(a.created_at).format('DD.MM.YYYY HH:mm')}
                          </Text>
                        </div>
                      </div>
                    ),
                  }))}
                />
                {client.activities.length > 2 && (
                  <Button
                    type="link" size="small"
                    onClick={() => setShowAllActivity(!showAllActivity)}
                    style={{ padding: 0 }}
                  >
                    {showAllActivity
                      ? '▲ Свернуть'
                      : `▼ Показать ещё ${client.activities.length - 2}`}
                  </Button>
                )}
              </>
            )}
          </Card>

          <Card
            title={<Space><UploadOutlined />Файлы<Tag>{files.length}</Tag></Space>}
            extra={
              permissions.can_edit_client && (
                <Upload
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={handleUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                >
                  <Button size="small" icon={<UploadOutlined />} loading={uploading}>
                    Загрузить
                  </Button>
                </Upload>
              )
            }
          >
            {files.length === 0 ? (
              <Empty description="Файлов нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Image.PreviewGroup>
                <List
                  dataSource={files}
                  renderItem={(file) => {
                    const ext = (file.name || '').split('.').pop().toLowerCase();
                    const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
                    return (
                      <List.Item
                        actions={[
                          <Tooltip title="Скачать">
                            <Button type="link" size="small" icon={<DownloadOutlined />}
                              href={file.url} download={file.name} />
                          </Tooltip>,
                          permissions.can_edit_client && (
                            <Popconfirm
                              title="Удалить файл?"
                              description={file.name}
                              onConfirm={() => handleDeleteFile(file.id, file.name)}
                              okText="Удалить"
                              cancelText="Отмена"
                              okType="danger"
                            >
                              <Tooltip title="Удалить">
                                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                              </Tooltip>
                            </Popconfirm>
                          ),
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            isImage ? (
                              <Image
                                src={file.url}
                                width={40}
                                height={40}
                                style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                                preview={{ mask: false }}
                              />
                            ) : getFileIcon(file.name)
                          }
                          title={<Text ellipsis style={{ maxWidth: 160 }}>{file.name}</Text>}
                          description={
                            <Space size={4}>
                              <Text type="secondary" style={{ fontSize: 11 }}>{formatSize(file.size)}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>·</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>{file.uploaded_by_name}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              </Image.PreviewGroup>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
