import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Typography, message, Spin, Checkbox, Upload, List, Tooltip, Space, Modal, Tabs } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { ArrowLeftOutlined, SaveOutlined, SyncOutlined, UploadOutlined, FileOutlined, FilePdfOutlined, FileImageOutlined, DeleteFilled, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { clientsAPI } from '../api';
import api from '../api';
import useAuthStore from '../store/authStore';

const { Title, Text } = Typography;

function calcMikrotikIP(subnet, ending = '1') {
  if (!subnet) return '';
  try {
    const network = subnet.split('/')[0];
    const parts = network.split('.');
    if (parts.length === 4) { parts[3] = ending; return parts.join('.'); }
  } catch (e) {}
  return '';
}

const CONNECTION_LABELS_TRANSFER = {
  fiber: '⚡ Оптоволокно', dsl: '☎️ DSL', cable: '🔌 Кабель',
  wireless: '📡 Беспроводное', modem: '📶 Модем', mrnet: '↔️ MR-Net',
};

function TransferStep1({ visible, transferFromSlot, clients, selectedClient, onSelect }) {
  if (!visible) return null;
  return (
    <div>
      <p style={{ marginBottom: 12, color: '#666' }}>
        После передачи все поля провайдера {transferFromSlot} у текущего клиента будут очищены.
      </p>
      <Select
        showSearch
        placeholder="Начните вводить адрес или компанию..."
        style={{ width: '100%' }}
        optionFilterProp="label"
        value={selectedClient}
        onChange={onSelect}
        options={clients.map(c => ({
          value: c.id,
          label: c.company ? `${c.company} — ${c.address || ''}` : (c.address || `Клиент #${c.id}`)
        }))}
      />
    </div>
  );
}

function SlotCard({ slot, isSelected, onSelect }) {
  const hasData = !!(slot.provider || slot.personal_account || slot.contract_number);
  const tooltipContent = hasData ? (
    <div style={{ fontSize: 12 }}>
      <div><b>Провайдер:</b> {slot.provider?.name || '—'}</div>
      <div><b>Тип:</b> {CONNECTION_LABELS_TRANSFER[slot.connection_type] || '—'}</div>
      <div><b>Лицевой счёт:</b> {slot.personal_account || '—'}</div>
      <div><b>№ договора:</b> {slot.contract_number || '—'}</div>
    </div>
  ) : null;

  const card = (
    <div
      onClick={() => onSelect(slot.key)}
      style={{
        flex: 1,
        border: `2px solid ${isSelected ? '#1677ff' : hasData ? '#52c41a' : '#d9d9d9'}`,
        borderRadius: 8,
        padding: '16px 12px',
        cursor: 'pointer',
        background: isSelected ? '#e6f4ff' : hasData ? '#f6ffed' : '#fafafa',
        textAlign: 'center',
        transition: 'all 0.2s',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{slot.label}</div>
      {hasData ? (
        <>
          <div style={{ color: '#52c41a', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>● Заполнен</div>
          <div style={{ fontSize: 12, color: '#555' }}>{slot.provider?.name || '—'}</div>
          {slot.connection_type && (
            <div style={{ fontSize: 11, color: '#888' }}>{CONNECTION_LABELS_TRANSFER[slot.connection_type]}</div>
          )}
        </>
      ) : (
        <div style={{ color: '#bbb', fontSize: 12 }}>○ Пустой</div>
      )}
      {isSelected && (
        <div style={{ marginTop: 8, color: '#1677ff', fontSize: 12, fontWeight: 500 }}>✓ Выбран</div>
      )}
    </div>
  );

  return hasData ? (
    <Tooltip title={tooltipContent} placement="top">{card}</Tooltip>
  ) : card;
}

function TransferStep2({ visible, selectedClientDetail, selectedToSlot, onSelectSlot }) {
  if (!visible) return null;
  if (!selectedClientDetail) {
    return <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>Загрузка данных клиента...</div>;
  }

  const clientName = selectedClientDetail.company || selectedClientDetail.address || `Клиент #${selectedClientDetail.id}`;
  const slots = [
    {
      key: '1',
      label: 'Провайдер 1',
      provider: selectedClientDetail.provider_data,
      connection_type: selectedClientDetail.connection_type,
      personal_account: selectedClientDetail.personal_account,
      contract_number: selectedClientDetail.contract_number,
    },
    {
      key: '2',
      label: 'Провайдер 2',
      provider: selectedClientDetail.provider2_data,
      connection_type: selectedClientDetail.connection_type2,
      personal_account: selectedClientDetail.personal_account2,
      contract_number: selectedClientDetail.contract_number2,
    },
  ];
  const selectedSlot = slots.find(s => s.key === selectedToSlot);

  return (
    <div>
      <p style={{ marginBottom: 16, color: '#666' }}>
        Клиент: <strong>{clientName}</strong>. Выберите слот для записи:
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        {slots.map(slot => (
          <SlotCard
            key={slot.key}
            slot={slot}
            isSelected={selectedToSlot === slot.key}
            onSelect={onSelectSlot}
          />
        ))}
      </div>
      {selectedToSlot && selectedSlot?.provider && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, fontSize: 12, color: '#d46b08' }}>
          ⚠️ Данные в слоте «{selectedSlot.label}» будут перезаписаны
        </div>
      )}
    </div>
  );
}

export default function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isDraftMode = new URLSearchParams(location.search).get('draft') === '1';
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [mikrotikIP, setMikrotikIP] = useState('');
  const [serverIP, setServerIP] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [fetchingIP, setFetchingIP] = useState(false);
  const [connectionType, setConnectionType] = useState('');
  const [connectionType2, setConnectionType2] = useState('');
  const [showProvider2, setShowProvider2] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [transferStep, setTransferStep] = useState(1);       // 1 = выбор клиента, 2 = выбор слота
  const [transferFromSlot, setTransferFromSlot] = useState('1');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const [selectedToSlot, setSelectedToSlot] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const draftIdRef = useRef(null);
  const permissions = useAuthStore((s) => s.permissions);

  // Cleanup черновика при уходе
  useEffect(() => {
    const handleUnload = () => {
      const draftId = draftIdRef.current;
      if (draftId) {
        navigator.sendBeacon(`/api/clients/${draftId}/discard_draft/`,
          new Blob([JSON.stringify({})], { type: 'application/json' }));
        localStorage.removeItem('pending_draft_id');
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      const draftId = draftIdRef.current;
      if (draftId) {
        clientsAPI.discardDraft(draftId).catch(() => {});
        localStorage.removeItem('pending_draft_id');
        draftIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const providersRes = await api.get('/clients/providers/');
        setProviders(providersRes.data.results || providersRes.data);

        if (isEdit && !isDraftMode) {
          const { data } = await clientsAPI.get(id);
          form.setFieldsValue(data);
          setMikrotikIP(calcMikrotikIP(data.subnet, '1'));
          setServerIP(calcMikrotikIP(data.subnet, '2'));
          setConnectionType(data.connection_type || '');
          setConnectionType2(data.connection_type2 || '');
          if (data.provider2 || data.personal_account2 || data.contract_number2) {
            setShowProvider2(true);
          }
          const filesRes = await clientsAPI.getFiles(id);
          setFiles(filesRes.data);
        } else if (isEdit && isDraftMode) {
          // Черновик — просто грузим файлы
          try {
            const filesRes = await clientsAPI.getFiles(id);
            setFiles(filesRes.data);
          } catch (e) {}
          setIsDraft(true);
          draftIdRef.current = id;
          localStorage.setItem('pending_draft_id', id);
        } else {
          // Новый клиент — чистим старый черновик и создаём новый
          const pendingDraft = localStorage.getItem('pending_draft_id');
          if (pendingDraft) {
            clientsAPI.discardDraft(pendingDraft).catch(() => {});
            localStorage.removeItem('pending_draft_id');
          }
          const { data } = await clientsAPI.createDraft();
          draftIdRef.current = data.id;
          setIsDraft(true);
          navigate(`/clients/${data.id}/edit?draft=1`, { replace: true });
        }
      } catch {
        message.error('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleUpload = async ({ file }) => {
    const currentId = id;
    if (!currentId) return false;
    if (file.size > 5 * 1024 * 1024) {
      message.error('Файл слишком большой. Максимум 5 МБ');
      return false;
    }
    setUploading(true);
    try {
      const { data } = await clientsAPI.uploadFile(currentId, file);
      setFiles((prev) => [data, ...prev]);
      message.success(`Файл «${file.name}» загружен`);
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка загрузки файла');
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

  const handleGetExternalIP = async () => {
    // Берём Микротик IP прямо из текущего значения формы
    const subnet = form.getFieldValue('subnet');
    const mikrotikIPValue = calcMikrotikIP(subnet, '1');
    if (!mikrotikIPValue) {
      message.error('Поле Микротик IP не заполнено — укажите подсеть аптеки');
      return;
    }

    setFetchingIP(true);
    try {
      // Проверяем SSH настройки
      const settingsRes = await api.get('/clients/system-settings/');
      const sshSettings = settingsRes.data;
      if (!sshSettings.ssh_user) {
        message.error('SSH пользователь не задан — заполните в разделе Настройки');
        setFetchingIP(false);
        return;
      }
      if (!sshSettings.has_ssh_password) {
        message.error('SSH пароль не задан — заполните в разделе Настройки');
        setFetchingIP(false);
        return;
      }

      // Передаём mikrotik_ip напрямую в запрос
      const currentExternalIP = form.getFieldValue('external_ip') || '';
      const { data } = await api.post('/clients/fetch_external_ip/', {
        mikrotik_ip: mikrotikIPValue,
        old_external_ip: currentExternalIP,
      });

      form.setFieldsValue({ external_ip: data.new_ip });
      if (!data.old_ip) {
        message.success(`Внешний IP получен: ${data.new_ip}`);
      } else if (data.changed) {
        message.success(`Внешний IP изменился: ${data.old_ip} → ${data.new_ip}`);
      } else {
        message.info(`Внешний IP не изменился: ${data.new_ip}`);
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка получения IP');
    } finally {
      setFetchingIP(false);
    }
  };

  const handleOpenTransfer = async (fromSlot = '1') => {
    try {
      const { data } = await api.get('/clients/?page_size=1000');
      const list = (data.results || data).filter(c => c.id !== parseInt(id));
      setClients(list);
      setSelectedClient(null);
      setSelectedClientDetail(null);
      setSelectedToSlot(null);
      setTransferFromSlot(fromSlot);
      setTransferStep(1);
      setTransferModal(true);
    } catch {
      message.error('Ошибка загрузки клиентов');
    }
  };

  const handleSelectTransferClient = async (clientId) => {
    setSelectedClient(clientId);
    setSelectedClientDetail(null);
    setSelectedToSlot(null);
    try {
      const { data } = await api.get(`/clients/${clientId}/`);
      setSelectedClientDetail(data);
    } catch {
      message.error('Ошибка загрузки данных клиента');
    }
  };

  const handleTransfer = async () => {
    if (!selectedClient) { message.warning('Выберите клиента'); return; }
    if (!selectedToSlot) { message.warning('Выберите слот провайдера'); return; }
    setTransferring(true);
    try {
      const { data } = await api.post(`/clients/${id}/transfer_modem/`, {
        to_client_id: selectedClient,
        from_slot: transferFromSlot,
        to_slot: selectedToSlot,
      });
      setTransferModal(false);
      // Очищаем поля исходного слота в форме
      const sfx = transferFromSlot === '1' ? '' : '2';
      form.setFieldsValue({
        [`provider${sfx}`]: undefined,
        [`personal_account${sfx}`]: '',
        [`contract_number${sfx}`]: '',
        [`tariff${sfx}`]: '',
        [`connection_type${sfx}`]: undefined,
        [`modem_number${sfx}`]: '',
        [`modem_iccid${sfx}`]: '',
        [`provider_settings${sfx}`]: '',
        [`provider_equipment${sfx}`]: false,
      });
      if (transferFromSlot === '1') setConnectionType('');
      else setConnectionType2('');
      message.success(`Провайдер ${transferFromSlot} передан клиенту: ${data.to_client.name}`);
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка передачи');
    } finally {
      setTransferring(false);
    }
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      if (isEdit && !isDraftMode) {
        await clientsAPI.update(id, values);
        message.success('Клиент обновлён');
        navigate(`/clients/${id}`);
      } else {
        await clientsAPI.update(id, { ...values, is_draft: false });
        draftIdRef.current = null;
        setIsDraft(false);
        localStorage.removeItem('pending_draft_id');
        message.success('Клиент создан');
        navigate(`/clients/${id}`);
      }
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = permissions.can_edit_client || permissions.can_create_client;
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <Title level={4} style={{ margin: 0 }}>
          {isDraftMode ? 'Новый клиент' : isEdit ? 'Редактирование клиента' : 'Новый клиент'}
        </Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} disabled={!canEdit}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={[
            {
              key: 'info',
              label: 'Информация',
              forceRender: true,
              children: (
                <>
                  <Card title="Основная информация" style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item name="address" label="Адрес">
                          <Input.TextArea rows={2} placeholder="г. Новосибирск, ул. Примерная, д. 1" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="company" label="Компания / организация">
                          <Input placeholder="ООО «Название»" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="inn" label="ИНН">
                          <Input placeholder="123456789012" maxLength={12} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="phone" label="Телефон">
                          <Input placeholder="+7 (999) 123-45-67" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="iccid" label="ICCID">
                          <Input placeholder="89701xxxxxxxxxxxxxxx" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Некорректный email' }]}>
                          <Input placeholder="example@mail.ru" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="pharmacy_code" label="Код аптеки">
                          <Input placeholder="APT-001" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="status" label="Статус" initialValue="active">
                          <Select options={[
                            { value: 'active', label: 'Активен' },
                            { value: 'inactive', label: 'Неактивен' },
                          ]} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>

                  <Card title="Сеть" style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="subnet" label="Подсеть аптеки">
                          <Input placeholder="10.1.5.0/24" onChange={(e) => {
                            setMikrotikIP(calcMikrotikIP(e.target.value, '1'));
                            setServerIP(calcMikrotikIP(e.target.value, '2'));
                          }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="external_ip"
                          label={
                            <Space size={8}>
                              <span>Внешний IP</span>
                              <Tooltip title="Получить внешний IP с Микротика по SSH">
                                <Button
                                  size="small" type="primary" ghost
                                  icon={<SyncOutlined spin={fetchingIP} />}
                                  loading={fetchingIP}
                                  onClick={handleGetExternalIP}
                                  style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                                >
                                  Получить
                                </Button>
                              </Tooltip>
                            </Space>
                          }
                        >
                          <Input placeholder="1.2.3.4" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Микротик IP">
                          <Input value={mikrotikIP || '—'} disabled style={{ background: '#f5f5f5', color: '#333' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Сервер IP">
                          <Input value={serverIP || '—'} disabled style={{ background: '#f5f5f5', color: '#333' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>

                  {id && (
                    <Card title={
                      <Space>
                        <UploadOutlined />Файлы
                        <span style={{ marginLeft: 8, background: '#f0f0f0', borderRadius: 10, padding: '0 8px', fontSize: 12 }}>
                          {files.length}
                        </span>
                      </Space>
                    } style={{ marginBottom: 16 }}>
                      <Upload customRequest={handleUpload} showUploadList={false} multiple>
                        <Button icon={<UploadOutlined />} loading={uploading} style={{ marginBottom: 12 }}>
                          Загрузить файл (макс. 5 МБ)
                        </Button>
                      </Upload>
                      {files.length === 0 ? (
                        <div style={{ color: '#999', padding: '8px 0' }}>Файлов нет</div>
                      ) : (
                        <List dataSource={files} renderItem={(file) => (
                          <List.Item actions={[
                            <Tooltip title="Скачать">
                              <Button type="link" size="small" icon={<DownloadOutlined />}
                                href={file.url} target="_blank" rel="noreferrer" />
                            </Tooltip>,
                            <Tooltip title="Удалить">
                              <Button type="link" danger size="small" icon={<DeleteFilled />}
                                onClick={() => handleDeleteFile(file.id, file.name)} />
                            </Tooltip>,
                          ]}>
                            <List.Item.Meta
                              avatar={getFileIcon(file.name)}
                              title={file.name}
                              description={<span style={{ fontSize: 11 }}>{formatSize(file.size)} · {file.uploaded_by_name}</span>}
                            />
                          </List.Item>
                        )} />
                      )}
                    </Card>
                  )}
                </>
              ),
            },
            {
              key: 'providers',
              label: (
                <Space size={4}>
                  Провайдеры
                  {showProvider2 && <span style={{ background: '#1677ff', color: '#fff', borderRadius: 8, fontSize: 11, padding: '0 6px' }}>2</span>}
                </Space>
              ),
              forceRender: true,
              children: (
                <>
                  {/* ===== ПРОВАЙДЕР 1 ===== */}
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span>Провайдер 1</span>
                        <Space>
                          {!showProvider2 && (
                            <Button
                              size="small" type="dashed"
                              onClick={() => setShowProvider2(true)}
                              style={{ fontSize: 12 }}
                            >
                              + Добавить провайдер 2
                            </Button>
                          )}
                          <Button
                            size="small" danger type="text"
                            onClick={() => {
                              form.setFieldsValue({
                                provider: undefined, personal_account: '', contract_number: '',
                                tariff: '', connection_type: undefined, modem_number: '', modem_iccid: '',
                                provider_settings: '', provider_equipment: false,
                              });
                              setConnectionType('');
                            }}
                          >
                            Очистить
                          </Button>
                        </Space>
                      </div>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item name="provider" label="Провайдер">
                          <Select placeholder="Выберите провайдера" allowClear showSearch optionFilterProp="label"
                            options={providers.map((p) => ({ value: p.id, label: p.name }))} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="personal_account" label="Лицевой счёт">
                          <Input placeholder="12345678" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="contract_number" label="№ договора">
                          <Input placeholder="ДГ-2024-001" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="connection_type"
                          label={
                            <Space size={8}>
                              <span>Тип подключения</span>
                              {isEdit && !isDraftMode && ['modem', 'mrnet'].includes(connectionType) && (
                                <Button
                                  size="small" type="primary" ghost
                                  icon={<SendOutlined />}
                                  onClick={() => handleOpenTransfer('1')}
                                  style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                                >
                                  Передать
                                </Button>
                              )}
                            </Space>
                          }
                        >
                          <Select
                            placeholder="Выберите тип"
                            allowClear
                            onChange={(val) => setConnectionType(val || '')}
                            options={[
                              { value: 'fiber', label: '⚡ Оптоволокно' },
                              { value: 'dsl', label: '☎️ DSL' },
                              { value: 'cable', label: '🔌 Кабель' },
                              { value: 'wireless', label: '📡 Беспроводное' },
                              { value: 'modem', label: '📶 Модем' },
                              { value: 'mrnet', label: '↔️ MR-Net' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="tariff" label="Тариф (Мбит/с)">
                          <Input placeholder="100" suffix="Мбит/с" />
                        </Form.Item>
                      </Col>
                      {['modem', 'mrnet'].includes(connectionType) && (
                        <>
                          <Col span={12}>
                            <Form.Item name="modem_number" label="Номер (модем/SIM)">
                              <Input placeholder="+7 (999) 123-45-67" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="modem_iccid" label="ICCID модема">
                              <Input placeholder="89701xxxxxxxxxxxxxxx" />
                            </Form.Item>
                          </Col>
                        </>
                      )}
                      <Col span={24}>
                        <Form.Item name="provider_settings" label="Настройки провайдера">
                          <Input.TextArea rows={4} placeholder={"IP: 192.168.1.1\nМаска: 255.255.255.0\nШлюз: 192.168.1.254\nDNS: 8.8.8.8"} />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item name="provider_equipment" valuePropName="checked">
                          <Checkbox>Оборудование провайдера на объекте</Checkbox>
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>

                  {/* ===== ПРОВАЙДЕР 2 ===== */}
                  {showProvider2 && (
                    <Card
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span>Провайдер 2</span>
                          <Button
                            size="small" danger type="text"
                            onClick={() => {
                              form.setFieldsValue({
                                provider2: undefined, personal_account2: '', contract_number2: '',
                                tariff2: '', connection_type2: undefined, modem_number2: '', modem_iccid2: '',
                                provider_settings2: '', provider_equipment2: false,
                              });
                              setConnectionType2('');
                              setShowProvider2(false);
                            }}
                          >
                            Очистить
                          </Button>
                        </div>
                      }
                      style={{ marginBottom: 16, borderColor: '#91caff' }}
                    >
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item name="provider2" label="Провайдер">
                            <Select placeholder="Выберите провайдера" allowClear showSearch optionFilterProp="label"
                              options={providers.map((p) => ({ value: p.id, label: p.name }))} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="personal_account2" label="Лицевой счёт">
                            <Input placeholder="12345678" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="contract_number2" label="№ договора">
                            <Input placeholder="ДГ-2024-001" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="connection_type2"
                            label={
                              <Space size={8}>
                                <span>Тип подключения</span>
                                {isEdit && !isDraftMode && ['modem', 'mrnet'].includes(connectionType2) && (
                                  <Button
                                    size="small" type="primary" ghost
                                    icon={<SendOutlined />}
                                    onClick={() => handleOpenTransfer('2')}
                                    style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                                  >
                                    Передать
                                  </Button>
                                )}
                              </Space>
                            }
                          >
                            <Select
                              placeholder="Выберите тип"
                              allowClear
                              onChange={(val) => setConnectionType2(val || '')}
                              options={[
                                { value: 'fiber', label: '⚡ Оптоволокно' },
                                { value: 'dsl', label: '☎️ DSL' },
                                { value: 'cable', label: '🔌 Кабель' },
                                { value: 'wireless', label: '📡 Беспроводное' },
                                { value: 'modem', label: '📶 Модем' },
                                { value: 'mrnet', label: '↔️ MR-Net' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="tariff2" label="Тариф (Мбит/с)">
                            <Input placeholder="100" suffix="Мбит/с" />
                          </Form.Item>
                        </Col>
                        {['modem', 'mrnet'].includes(connectionType2) && (
                          <>
                            <Col span={12}>
                              <Form.Item name="modem_number2" label="Номер (модем/SIM)">
                                <Input placeholder="+7 (999) 123-45-67" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="modem_iccid2" label="ICCID модема">
                                <Input placeholder="89701xxxxxxxxxxxxxxx" />
                              </Form.Item>
                            </Col>
                          </>
                        )}
                        <Col span={24}>
                          <Form.Item name="provider_settings2" label="Настройки провайдера">
                            <Input.TextArea rows={4} placeholder={"IP: 192.168.1.1\nМаска: 255.255.255.0\nШлюз: 192.168.1.254\nDNS: 8.8.8.8"} />
                          </Form.Item>
                        </Col>
                        <Col span={24}>
                          <Form.Item name="provider_equipment2" valuePropName="checked">
                            <Checkbox>Оборудование провайдера на объекте</Checkbox>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  )}
                </>
              ),
            },
          ]}
        />

        {canEdit && (
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large" style={{ marginTop: 16 }}>
            {isDraftMode ? 'Создать клиента' : isEdit ? 'Сохранить изменения' : 'Создать клиента'}
          </Button>
        )}
      </Form>

      <Modal
        title={
          transferStep === 1
            ? 'Шаг 1 из 2 — Выберите клиента'
            : `Шаг 2 из 2 — Куда записать провайдер ${transferFromSlot}?`
        }
        open={transferModal}
        onCancel={() => setTransferModal(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {transferStep === 2 && (
                <Button onClick={() => { setTransferStep(1); setSelectedToSlot(null); }}>
                  ← Назад
                </Button>
              )}
            </div>
            <Space>
              <Button onClick={() => setTransferModal(false)}>Отмена</Button>
              {transferStep === 1 ? (
                <Button
                  type="primary"
                  disabled={!selectedClient}
                  onClick={() => setTransferStep(2)}
                >
                  Далее →
                </Button>
              ) : (
                <Button
                  type="primary" danger
                  disabled={!selectedToSlot}
                  loading={transferring}
                  onClick={handleTransfer}
                >
                  Передать
                </Button>
              )}
            </Space>
          </div>
        }
        width={500}
      >
        <TransferStep1
          visible={transferStep === 1}
          transferFromSlot={transferFromSlot}
          clients={clients}
          selectedClient={selectedClient}
          onSelect={handleSelectTransferClient}
        />
        <TransferStep2
          visible={transferStep === 2}
          selectedClientDetail={selectedClientDetail}
          selectedToSlot={selectedToSlot}
          onSelectSlot={setSelectedToSlot}
        />
      </Modal>
    </div>
  );
}
