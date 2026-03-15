import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Tag, Button, Timeline, Input, Space,
  message, Spin, Popconfirm, Empty, Tooltip, Upload, List, Image, Tabs,
} from 'antd';
import {
  EditOutlined, ArrowLeftOutlined, DeleteOutlined, SendOutlined,
  UploadOutlined, DownloadOutlined, DeleteFilled,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { clientsAPI } from '../api';
import api from '../api';
import useAuthStore from '../store/authStore';
import ClientDetailInfo      from './client-detail/ClientDetailInfo';
import ClientDetailProviders from './client-detail/ClientDetailProviders';
import ClientDetailKkt       from './client-detail/ClientDetailKkt';
import { ActivityIcon, getFileIcon, formatSize } from './client-detail/helpers';

const { Title, Text } = Typography;

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useAuthStore((s) => s.permissions);

  const [client, setClient]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState(location.state?.tab || 'info');

  // Заметки
  const [notes, setNotes]             = useState([]);
  const [noteText, setNoteText]       = useState('');
  const [noteSending, setNoteSending] = useState(false);

  // Файлы
  const [files, setFiles]             = useState([]);
  const [uploading, setUploading]     = useState(false);

  // История
  const [showAllActivity, setShowAllActivity] = useState(false);

  // Пинг
  const [pingResults, setPingResults] = useState({ external_ip: null, mikrotik_ip: null, server_ip: null });
  const [pinging, setPinging]         = useState(false);

  // ККТ
  const [kktData, setKktData]         = useState([]);
  const [kktFetching, setKktFetching] = useState(false);
  const [kktRefreshing, setKktRefreshing] = useState(false);

  // ─── Загрузка ───────────────────────────────────────────
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

  const loadKktData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/clients/${id}/ofd_kkt/`);
      setKktData(res.data);
    } catch { setKktData([]); }
  }, [id]);

  useEffect(() => {
    fetchClient();
    loadKktData();
  }, [fetchClient, loadKktData]);

  useEffect(() => {
    if (client) checkPing();
  }, [client?.id]); // eslint-disable-line

  // ─── Пинг ───────────────────────────────────────────────
  const checkPing = useCallback(async () => {
    setPinging(true);
    setPingResults({ external_ip: 'checking', mikrotik_ip: 'checking', server_ip: 'checking' });
    try {
      const { data } = await api.get(`/clients/${id}/ping/`);
      setPingResults({
        external_ip: data.external_ip?.alive ?? null,
        mikrotik_ip: data.mikrotik_ip?.alive ?? null,
        server_ip:   data.server_ip?.alive ?? null,
      });
    } catch {
      setPingResults({ external_ip: false, mikrotik_ip: false, server_ip: false });
    } finally { setPinging(false); }
  }, [id]);

  // ─── ККТ ────────────────────────────────────────────────
  const fetchKktFromOfd = async () => {
    setKktFetching(true);
    try {
      const res = await api.post(`/clients/${id}/ofd_kkt/`);
      message.success(res.data.message || 'Данные ККТ получены с ОФД');
      if (res.data.errors?.length > 0) res.data.errors.forEach(e => message.warning(e, 5));
      await loadKktData();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка при получении данных с ОФД', 6);
    } finally { setKktFetching(false); }
  };

  const refreshKktByRnm = async () => {
    setKktRefreshing(true);
    try {
      const res = await api.patch(`/clients/${id}/ofd_kkt/`);
      message.success(res.data.message || 'ККТ обновлены');
      if (res.data.errors?.length > 0) res.data.errors.forEach(e => message.warning(e, 5));
      await loadKktData();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка при обновлении ККТ', 6);
    } finally { setKktRefreshing(false); }
  };

  const deleteKkt = async (kktId) => {
    try {
      await api.delete(`/clients/${id}/ofd_kkt/${kktId}/`);
      message.success('ККТ удалена');
      await loadKktData();
    } catch { message.error('Не удалось удалить ККТ'); }
  };

  // ─── Файлы ──────────────────────────────────────────────
  const handleUpload = async ({ file }) => {
    setUploading(true);
    try {
      const { data } = await clientsAPI.uploadFile(id, file);
      setFiles((prev) => [data, ...prev]);
      message.success(`Файл «${file.name}» загружен`);
    } catch { message.error('Ошибка загрузки файла'); }
    finally { setUploading(false); }
    return false;
  };

  const handleDeleteFile = async (fileId, fileName) => {
    try {
      await clientsAPI.deleteFile(id, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      message.success(`Файл «${fileName}» удалён`);
    } catch { message.error('Ошибка удаления файла'); }
  };

  // ─── Заметки ────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setNoteSending(true);
    try {
      const { data } = await clientsAPI.addNote(id, noteText.trim());
      setNotes((prev) => [data, ...prev]);
      setNoteText('');
    } catch { message.error('Ошибка добавления заметки'); }
    finally { setNoteSending(false); }
  };

  // ─── Удаление ───────────────────────────────────────────
  const handleDelete = async () => {
    try {
      await clientsAPI.delete(id);
      message.success('Клиент удалён');
      navigate('/clients');
    } catch { message.error('Ошибка удаления'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!client) return <div>Клиент не найден</div>;

  const pageTitle = client.address || client.company || `Клиент #${client.id}`;

  const tabItems = [
    {
      key: 'info',
      label: '📋 Информация',
      children: (
        <ClientDetailInfo
          client={client}
          pingResults={pingResults}
          pinging={pinging}
          checkPing={checkPing}
        />
      ),
    },
    {
      key: 'providers',
      label: (
        <Space size={4}>
          🌐 Провайдеры
          {(client.provider_data || client.provider2_data) && (
            <Tag color="blue" style={{ marginLeft: 2, fontSize: 11 }}>
              {[client.provider_data, client.provider2_data].filter(Boolean).length}
            </Tag>
          )}
        </Space>
      ),
      children: <ClientDetailProviders client={client} />,
    },
    {
      key: 'kkt',
      label: '🧾 ККТ',
      children: (
        <ClientDetailKkt
          kktData={kktData}
          kktFetching={kktFetching}
          kktRefreshing={kktRefreshing}
          fetchKktFromOfd={fetchKktFromOfd}
          refreshKktByRnm={refreshKktByRnm}
          deleteKkt={deleteKkt}
        />
      ),
    },
  ];

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
          <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 0 }} items={tabItems} />

          {/* Заметки */}
          <Card title="Заметки" style={{ marginTop: 16 }}>
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
                <Card key={note.id} size="small" style={{ marginBottom: 8 }}>
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
          {/* История */}
          <Card
            title={<Space>История изменений <Tag>{client.activities?.length || 0}</Tag></Space>}
            style={{ marginBottom: 16 }}
          >
            {!client.activities?.length ? (
              <Empty description="История пуста" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <Timeline
                  items={(showAllActivity ? client.activities : client.activities.slice(0, 2)).map((a) => ({
                    dot: <span style={{ fontSize: 14 }}><ActivityIcon action={a.action} /></span>,
                    children: (
                      <div style={{ marginBottom: 4 }}>
                        {a.action.startsWith('Изменено:')
                          ? <>
                              <Text style={{ fontSize: 12, fontWeight: 600 }}>Изменено:</Text>
                              {a.action.replace('Изменено: ', '').split(' | ').map((item, i) => (
                                <div key={i} style={{ fontSize: 12, paddingLeft: 8 }}>• {item}</div>
                              ))}
                            </>
                          : (a.action.includes('\n')
                            ? <div>
                                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{a.action.split('\n')[0]}</div>
                                {a.action.split('\n').slice(1).map((line, i) => (
                                  <div key={i} style={{ fontSize: 12, paddingLeft: 8, lineHeight: '1.6' }}>• {line}</div>
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
                  <Button type="link" size="small" onClick={() => setShowAllActivity(!showAllActivity)} style={{ padding: 0 }}>
                    {showAllActivity ? '▲ Свернуть' : `▼ Показать ещё ${client.activities.length - 2}`}
                  </Button>
                )}
              </>
            )}
          </Card>

          {/* Файлы */}
          <Card
            title={<Space><UploadOutlined />Файлы<Tag>{files.length}</Tag></Space>}
            extra={
              permissions.can_edit_client && (
                <Upload showUploadList={false} beforeUpload={() => false} onChange={handleUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
                  <Button size="small" icon={<UploadOutlined />} loading={uploading}>Загрузить</Button>
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
                            <Button type="link" size="small" icon={<DownloadOutlined />} href={file.url} download={file.name} />
                          </Tooltip>,
                          permissions.can_edit_client && (
                            <Popconfirm
                              title="Удалить файл?" description={file.name}
                              onConfirm={() => handleDeleteFile(file.id, file.name)}
                              okText="Удалить" cancelText="Отмена" okType="danger"
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
                              <Image src={file.url} width={40} height={40}
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
