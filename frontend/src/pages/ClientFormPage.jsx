import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Typography, message, Spin, Checkbox, Upload, List, Tooltip, Space, Modal, Tabs, Tag, Descriptions, Empty, Popconfirm } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { ArrowLeftOutlined, SaveOutlined, SyncOutlined, UploadOutlined, FileOutlined, FilePdfOutlined, FileImageOutlined, DeleteFilled, DownloadOutlined, ReloadOutlined, CloudDownloadOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
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


// Компонент карточки ККТ (переиспользуется)
function KktCard({ kkt, onDelete }) {
  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <Space>
          <span>🖨️ {kkt.kkt_model || 'ККТ'}</span>
          <Tag color="blue">РНМ: {kkt.kkt_reg_id}</Tag>
        </Space>
      }
      extra={
        <Space>
          {kkt.fetched_at && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Обновлено: {dayjs(kkt.fetched_at).format('DD.MM.YYYY HH:mm')}
            </Typography.Text>
          )}
          <Popconfirm
            title="Удалить ККТ?"
            description="Данные этой ККТ будут удалены из системы."
            onConfirm={onDelete}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger type="text" />
          </Popconfirm>
        </Space>
      }
    >
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 2, lg: 3 }}>
        <Descriptions.Item label="Модель ККТ">
          <Typography.Text strong>{kkt.kkt_model || '—'}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="РНМ">{kkt.kkt_reg_id || '—'}</Descriptions.Item>
        <Descriptions.Item label="Серийный номер">{kkt.serial_number || '—'}</Descriptions.Item>
        <Descriptions.Item label="Номер ФН">{kkt.fn_number || '—'}</Descriptions.Item>
        <Descriptions.Item label="Конец срока ФН">
          {kkt.fn_end_date ? (
            <Tag color={dayjs(kkt.fn_end_date).isBefore(dayjs().add(90, 'day')) ? 'red' : 'green'}>
              {dayjs(kkt.fn_end_date).format('DD.MM.YYYY')}
            </Tag>
          ) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Конец договора ОФД">
          {kkt.contract_end_date ? (
            <Tag color={dayjs(kkt.contract_end_date).isBefore(dayjs().add(30, 'day')) ? 'red' : 'green'}>
              {dayjs(kkt.contract_end_date).format('DD.MM.YYYY')}
            </Tag>
          ) : '—'}
        </Descriptions.Item>
        {kkt.fiscal_address && (
          <Descriptions.Item label="Адрес установки" span={3}>
            {kkt.fiscal_address}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
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
  const [ofdCompanies, setOfdCompanies] = useState([]);
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
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'info');
  // ККТ
  const [kktData, setKktData] = useState([]);
  const [kktFetching, setKktFetching] = useState(false);
  const [kktRefreshing, setKktRefreshing] = useState(false);
  const [rnmFields, setRnmFields] = useState(['']);
  const [addByRnmVisible, setAddByRnmVisible]   = useState(false);
  const [addByRnmValue, setAddByRnmValue]       = useState('');
  const [addByRnmLoading, setAddByRnmLoading]   = useState(false);
  const draftIdRef = useRef(null);
  const permissions = useAuthStore((s) => s.permissions);

  // Cleanup черновика при закрытии/обновлении страницы
  useEffect(() => {
    const handleUnload = () => {
      const draftId = draftIdRef.current || localStorage.getItem('pending_draft_id');
      if (draftId) {
        navigator.sendBeacon(`/api/clients/${draftId}/discard_draft/`,
          new Blob([JSON.stringify({})], { type: 'application/json' }));
        localStorage.removeItem('pending_draft_id');
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // Cleanup черновика при размонтировании компонента (навигация внутри React)
  useEffect(() => {
    return () => {
      const draftId = draftIdRef.current || localStorage.getItem('pending_draft_id');
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
        const [providersRes, companiesRes] = await Promise.all([
          api.get('/clients/providers/'),
          api.get('/clients/ofd-companies/'),
        ]);
        setProviders(providersRes.data.results || providersRes.data);
        setOfdCompanies(companiesRes.data.results || companiesRes.data);

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
    // Загружаем ККТ если редактируем существующего клиента
    if (isEdit && !isDraftMode && id) {
      api.get(`/clients/${id}/ofd_kkt/`).then(res => setKktData(res.data)).catch(() => {});
    }
  }, []);

  const loadKktData = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/clients/${id}/ofd_kkt/`);
      setKktData(res.data);
    } catch { setKktData([]); }
  };

  // Автосохранение поля в черновик (не конвертирует в клиента)
  const saveDraftField = async (field, value) => {
    if (!isDraft || !id) return;
    try {
      await api.patch(`/clients/${id}/`, { [field]: value, _draft_save: true });
    } catch {}
  };

  const fetchKktFromOfd = async () => {
    if (!id) return;
    // Проверяем что компания и адрес заполнены
    const vals = form.getFieldsValue();
    if (!vals.ofd_company) {
      message.warning('Выберите компанию перед получением данных ККТ');
      return;
    }
    if (!vals.address || !vals.address.trim()) {
      message.warning('Заполните адрес перед получением данных ККТ');
      return;
    }
    // Если черновик — сначала сохраняем компанию и адрес
    if (isDraft) {
      await saveDraftField('ofd_company', vals.ofd_company);
      await saveDraftField('address', vals.address.trim());
    }
    setKktFetching(true);
    try {
      const res = await api.post(`/clients/${id}/ofd_kkt/`);
      message.success(res.data.message || 'Данные ККТ получены с ОФД');
      if (res.data.errors?.length) res.data.errors.forEach(e => message.warning(e, 5));
      await loadKktData();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка при получении данных с ОФД', 6);
    } finally { setKktFetching(false); }
  };

  const refreshKktByRnm = async () => {
    if (!id) return;
    setKktRefreshing(true);
    try {
      const res = await api.patch(`/clients/${id}/ofd_kkt/`);
      message.success(res.data.message || 'ККТ обновлены');
      if (res.data.errors?.length) res.data.errors.forEach(e => message.warning(e, 5));
      await loadKktData();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка при обновлении ККТ', 6);
    } finally { setKktRefreshing(false); }
  };

  const addKktByRnm = async () => {
    const rnm = addByRnmValue.trim();
    if (!rnm) { message.warning('Введите РНМ'); return; }
    setAddByRnmLoading(true);
    try {
      const res = await api.patch(`/clients/${id}/ofd_kkt/`, { rnm_override: rnm });
      message.success(res.data.message || 'ККТ добавлена');
      setAddByRnmVisible(false);
      setAddByRnmValue('');
      await loadKktData();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка при поиске ККТ по РНМ', 6);
    } finally { setAddByRnmLoading(false); }
  };

  const fetchKktByRnmList = async () => {
    if (!id) return;
    const filled = rnmFields.filter(r => r.trim());
    if (!filled.length) return;
    const vals = form.getFieldsValue();
    // Проверяем компанию
    if (!vals.ofd_company) {
      message.warning('Выберите компанию — она нужна для получения данных по РНМ');
      return;
    }
    // Проверяем адрес
    if (!vals.address || !vals.address.trim()) {
      message.warning('Заполните адрес — он нужен для проверки принадлежности ККТ');
      return;
    }
    // Если черновик — сохраняем компанию и адрес
    if (isDraft) {
      await saveDraftField('ofd_company', vals.ofd_company);
      await saveDraftField('address', vals.address.trim());
    }
    setKktRefreshing(true);
    const fetched = [];
    const errors = [];
    try {
      for (const rnm of filled) {
        try {
          const res = await api.patch(`/clients/${id}/ofd_kkt/`, { rnm_override: rnm.trim() });
          if (res.data.success) {
            fetched.push(rnm.trim());
          } else if (res.data.errors?.length) {
            errors.push(...res.data.errors);
          }
        } catch (e) {
          errors.push(e.response?.data?.error || `РНМ ${rnm}: неизвестная ошибка`);
        }
      }
      await loadKktData();
      if (fetched.length > 0) {
        message.success(`Загружено ККТ: ${fetched.length}`);
      }
      if (errors.length > 0) {
        errors.forEach(err => message.error(err, 8));
      }
      if (fetched.length === 0 && errors.length === 0) {
        message.info('Нет данных для загрузки');
      }
    } finally { setKktRefreshing(false); }
  };

  const deleteKkt = async (kktId) => {
    try {
      await api.delete(`/clients/${id}/ofd_kkt/${kktId}/`);
      message.success('ККТ удалена');
      await loadKktData();
    } catch { message.error('Не удалось удалить ККТ'); }
  };

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
    if (!values.address || !values.address.trim()) {
      message.error('Адрес обязателен для заполнения');
      return;
    }
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

      <Form form={form} layout="vertical" onFinish={onFinish} onFinishFailed={() => message.error('Адрес обязателен для заполнения')} disabled={!canEdit}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={[
            {
              key: 'info',
              label: <span>📋 Информация</span>,
              forceRender: true,
              children: (
                <>
                  <Card title="Основная информация" style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item name="address" label="Адрес" rules={[{ required: true, message: '' }]}>
                          <Input.TextArea
                            rows={2}
                            placeholder="г. Новосибирск, ул. Примерная, д. 1"
                            onBlur={e => saveDraftField('address', e.target.value)}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="ofd_company" label="Компания">
                          <Select
                            placeholder="Выберите компанию"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            onChange={value => saveDraftField('ofd_company', value || null)}
                            options={ofdCompanies.map(c => ({
                              value: c.id,
                              label: `${c.name} (ИНН: ${c.inn})`,
                            }))}
                          />
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
                        <Form.Item name="pharmacy_code" label="Код аптеки (UT)">
                          <Input placeholder="UT000001" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="warehouse_code" label="Код склада">
                          <Input placeholder="81174669" />
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
                  🌐 Провайдеры
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
                          {
                key: 'kkt',
                label: '🧾 ККТ',
                children: (
                  <div>
                    {/* ===== РЕЖИМ СОЗДАНИЯ (черновик) ===== */}
                    {isDraftMode && (
                      <div>
                        {/* Блок получения данных */}
                        <Card
                          style={{ marginBottom: 16, borderStyle: 'dashed' }}
                          bodyStyle={{ padding: 20 }}
                        >
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>Получить данные ККТ по</Text>
                          </div>
                          <Space wrap>
                            <Button
                              type="primary"
                              icon={<CloudDownloadOutlined />}
                              onClick={fetchKktFromOfd}
                              loading={kktFetching}
                            >
                              ИНН (поиск по адресу)
                            </Button>
                            <Button
                              type="primary"
                              icon={<CloudDownloadOutlined />}
                              onClick={fetchKktByRnmList}
                              loading={kktRefreshing}
                              disabled={!rnmFields.some(r => r.trim())}
                            >
                              РНМ (поиск по номеру)
                            </Button>
                          </Space>
                        </Card>

                        {/* Поля РНМ */}
                        <Card
                          title={<Text strong>Регистрационные номера ККТ (РНМ)</Text>}
                          style={{ marginBottom: 16 }}
                          extra={
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              size="small"
                              onClick={() => setRnmFields([...rnmFields, ''])}
                            >
                              Добавить РНМ
                            </Button>
                          }
                        >
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {rnmFields.map((val, idx) => (
                              <Space key={idx} style={{ width: '100%' }}>
                                <Input
                                  placeholder="0001234567890123 (16 цифр)"
                                  value={val}
                                  maxLength={16}
                                  style={{ width: 260 }}
                                  onChange={e => {
                                    const next = [...rnmFields];
                                    next[idx] = e.target.value;
                                    setRnmFields(next);
                                  }}
                                />
                                {rnmFields.length > 1 && (
                                  <Button
                                    icon={<MinusCircleOutlined />}
                                    size="small"
                                    danger
                                    type="text"
                                    onClick={() => setRnmFields(rnmFields.filter((_, i) => i !== idx))}
                                  />
                                )}
                              </Space>
                            ))}
                          </Space>
                        </Card>

                        {/* Полученные ККТ */}
                        {kktData.length > 0 && kktData.map((kkt) => (
                          <KktCard key={kkt.id} kkt={kkt} onDelete={() => deleteKkt(kkt.id)} />
                        ))}
                      </div>
                    )}

                    {/* ===== РЕЖИМ РЕДАКТИРОВАНИЯ ===== */}
                    {isEdit && !isDraftMode && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <Text strong style={{ fontSize: 16 }}>🧾 Кассовая техника</Text>
                          <Space direction="vertical" align="end" size={8}>
                            <Space>
                              <Button
                                type="primary"
                                icon={<CloudDownloadOutlined />}
                                onClick={fetchKktFromOfd}
                                loading={kktFetching}
                              >
                                Получить данные ККТ по ИНН
                              </Button>
                              <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={refreshKktByRnm}
                                loading={kktRefreshing}
                                disabled={kktData.length === 0}
                              >
                                Обновить по РНМ
                              </Button>
                              <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => { setAddByRnmVisible(v => !v); setAddByRnmValue(''); }}
                              >
                                Добавить по РНМ
                              </Button>
                            </Space>
                            {addByRnmVisible && (
                              <Space>
                                <Input
                                  placeholder="16 цифр РНМ"
                                  value={addByRnmValue}
                                  onChange={e => setAddByRnmValue(e.target.value)}
                                  onPressEnter={addKktByRnm}
                                  style={{ width: 200 }}
                                  maxLength={16}
                                  autoFocus
                                />
                                <Button type="primary" loading={addByRnmLoading} onClick={addKktByRnm}>
                                  Найти
                                </Button>
                                <Button onClick={() => { setAddByRnmVisible(false); setAddByRnmValue(''); }}>
                                  Отмена
                                </Button>
                              </Space>
                            )}
                          </Space>
                        </div>
                        {kktData.length === 0 ? (
                          <Empty
                            description={<span>Нет данных ККТ.<br />Нажмите «Получить данные ККТ по ИНН» для загрузки.</span>}
                            style={{ padding: '40px 0' }}
                          />
                        ) : (
                          kktData.map((kkt) => (
                            <KktCard key={kkt.id} kkt={kkt} onDelete={() => deleteKkt(kkt.id)} />
                          ))
                        )}
                      </div>
                    )}
                  </div>
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
