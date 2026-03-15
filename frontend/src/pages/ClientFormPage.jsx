import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Typography, message, Spin, Space, Tabs } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { clientsAPI } from '../api';
import api from '../api';
import useAuthStore from '../store/authStore';
import ClientFormInfo      from './client-form/ClientFormInfo';
import ClientFormProviders from './client-form/ClientFormProviders';
import ClientFormKkt       from './client-form/ClientFormKkt';
import TransferModal       from './client-form/TransferModal';

const { Title } = Typography;

function calcMikrotikIP(subnet, ending = '1') {
  if (!subnet) return '';
  try {
    const network = subnet.split('/')[0];
    const parts = network.split('.');
    if (parts.length === 4) { parts[3] = ending; return parts.join('.'); }
  } catch (e) {}
  return '';
}

export default function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isDraftMode = new URLSearchParams(location.search).get('draft') === '1';
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const permissions = useAuthStore((s) => s.permissions);
  const draftIdRef = useRef(null);

  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [providers, setProviders]   = useState([]);
  const [ofdCompanies, setOfdCompanies] = useState([]);
  const [mikrotikIP, setMikrotikIP] = useState('');
  const [serverIP, setServerIP]     = useState('');
  const [files, setFiles]           = useState([]);
  const [uploading, setUploading]   = useState(false);
  const [fetchingIP, setFetchingIP] = useState(false);
  const [connectionType, setConnectionType]   = useState('');
  const [connectionType2, setConnectionType2] = useState('');
  const [showProvider2, setShowProvider2]     = useState(false);
  const [activeTab, setActiveTab]   = useState(location.state?.tab || 'info');
  const [isDraft, setIsDraft]       = useState(false);

  // ККТ
  const [kktData, setKktData]               = useState([]);
  const [kktFetching, setKktFetching]       = useState(false);
  const [kktRefreshing, setKktRefreshing]   = useState(false);
  const [rnmFields, setRnmFields]           = useState(['']);
  const [addByRnmVisible, setAddByRnmVisible] = useState(false);
  const [addByRnmValue, setAddByRnmValue]   = useState('');
  const [addByRnmLoading, setAddByRnmLoading] = useState(false);

  // Transfer
  const [transferModal, setTransferModal]           = useState(false);
  const [transferStep, setTransferStep]             = useState(1);
  const [transferFromSlot, setTransferFromSlot]     = useState('1');
  const [clients, setClients]                       = useState([]);
  const [selectedClient, setSelectedClient]         = useState(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const [selectedToSlot, setSelectedToSlot]         = useState(null);
  const [transferring, setTransferring]             = useState(false);

  // ─── Cleanup черновика ──────────────────────────────────
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
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

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

  // ─── Инициализация ──────────────────────────────────────
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
          if (data.provider2 || data.personal_account2 || data.contract_number2) setShowProvider2(true);
          const filesRes = await clientsAPI.getFiles(id);
          setFiles(filesRes.data);
        } else if (isEdit && isDraftMode) {
          try {
            const filesRes = await clientsAPI.getFiles(id);
            setFiles(filesRes.data);
          } catch {}
          setIsDraft(true);
          draftIdRef.current = id;
          localStorage.setItem('pending_draft_id', id);
        } else {
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
    if (isEdit && !isDraftMode && id) {
      api.get(`/clients/${id}/ofd_kkt/`).then(res => setKktData(res.data)).catch(() => {});
    }
  }, []); // eslint-disable-line

  // ─── Helpers ────────────────────────────────────────────
  const saveDraftField = async (field, value) => {
    if (!isDraft || !id) return;
    try { await api.patch(`/clients/${id}/`, { [field]: value, _draft_save: true }); } catch {}
  };

  const loadKktData = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/clients/${id}/ofd_kkt/`);
      setKktData(res.data);
    } catch { setKktData([]); }
  };

  // ─── ККТ handlers ───────────────────────────────────────
  const fetchKktFromOfd = async () => {
    if (!id) return;
    const vals = form.getFieldsValue();
    if (!vals.ofd_company) { message.warning('Выберите компанию перед получением данных ККТ'); return; }
    if (!vals.address?.trim()) { message.warning('Заполните адрес перед получением данных ККТ'); return; }
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
      setAddByRnmVisible(false); setAddByRnmValue('');
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
    if (!vals.ofd_company) { message.warning('Выберите компанию — она нужна для получения данных по РНМ'); return; }
    if (!vals.address?.trim()) { message.warning('Заполните адрес — он нужен для проверки принадлежности ККТ'); return; }
    if (isDraft) {
      await saveDraftField('ofd_company', vals.ofd_company);
      await saveDraftField('address', vals.address.trim());
    }
    setKktRefreshing(true);
    const fetched = [], errors = [];
    try {
      for (const rnm of filled) {
        try {
          const res = await api.patch(`/clients/${id}/ofd_kkt/`, { rnm_override: rnm.trim() });
          if (res.data.success) fetched.push(rnm.trim());
          else if (res.data.errors?.length) errors.push(...res.data.errors);
        } catch (e) {
          errors.push(e.response?.data?.error || `РНМ ${rnm}: неизвестная ошибка`);
        }
      }
      await loadKktData();
      if (fetched.length > 0) message.success(`Загружено ККТ: ${fetched.length}`);
      if (errors.length > 0) errors.forEach(err => message.error(err, 8));
      if (fetched.length === 0 && errors.length === 0) message.info('Нет данных для загрузки');
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
    if (!id) return false;
    if (file.size > 5 * 1024 * 1024) { message.error('Файл слишком большой. Максимум 5 МБ'); return false; }
    setUploading(true);
    try {
      const { data } = await clientsAPI.uploadFile(id, file);
      setFiles(prev => [data, ...prev]);
      message.success(`Файл «${file.name}» загружен`);
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка загрузки файла');
    } finally { setUploading(false); }
    return false;
  };

  const handleDeleteFile = async (fileId, fileName) => {
    try {
      await clientsAPI.deleteFile(id, fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      message.success(`Файл «${fileName}» удалён`);
    } catch { message.error('Ошибка удаления файла'); }
  };

  // ─── Внешний IP ─────────────────────────────────────────
  const handleGetExternalIP = async () => {
    const subnet = form.getFieldValue('subnet');
    const mikrotikIPValue = calcMikrotikIP(subnet, '1');
    if (!mikrotikIPValue) { message.error('Укажите подсеть аптеки'); return; }
    setFetchingIP(true);
    try {
      const settingsRes = await api.get('/clients/system-settings/');
      const s = settingsRes.data;
      if (!s.ssh_user) { message.error('SSH пользователь не задан'); setFetchingIP(false); return; }
      if (!s.has_ssh_password) { message.error('SSH пароль не задан'); setFetchingIP(false); return; }
      const currentExternalIP = form.getFieldValue('external_ip') || '';
      const { data } = await api.post('/clients/fetch_external_ip/', {
        mikrotik_ip: mikrotikIPValue, old_external_ip: currentExternalIP,
      });
      form.setFieldsValue({ external_ip: data.new_ip });
      if (!data.old_ip) message.success(`Внешний IP получен: ${data.new_ip}`);
      else if (data.changed) message.success(`Внешний IP изменился: ${data.old_ip} → ${data.new_ip}`);
      else message.info(`Внешний IP не изменился: ${data.new_ip}`);
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка получения IP');
    } finally { setFetchingIP(false); }
  };

  // ─── Transfer ───────────────────────────────────────────
  const handleOpenTransfer = async (fromSlot = '1') => {
    try {
      const { data } = await api.get('/clients/?page_size=1000');
      setClients((data.results || data).filter(c => c.id !== parseInt(id)));
      setSelectedClient(null); setSelectedClientDetail(null);
      setSelectedToSlot(null); setTransferFromSlot(fromSlot);
      setTransferStep(1); setTransferModal(true);
    } catch { message.error('Ошибка загрузки клиентов'); }
  };

  const handleSelectTransferClient = async (clientId) => {
    setSelectedClient(clientId); setSelectedClientDetail(null); setSelectedToSlot(null);
    try {
      const { data } = await api.get(`/clients/${clientId}/`);
      setSelectedClientDetail(data);
    } catch { message.error('Ошибка загрузки данных клиента'); }
  };

  const handleTransfer = async () => {
    if (!selectedClient) { message.warning('Выберите клиента'); return; }
    if (!selectedToSlot) { message.warning('Выберите слот провайдера'); return; }
    setTransferring(true);
    try {
      const { data } = await api.post(`/clients/${id}/transfer_modem/`, {
        to_client_id: selectedClient, from_slot: transferFromSlot, to_slot: selectedToSlot,
      });
      setTransferModal(false);
      const sfx = transferFromSlot === '1' ? '' : '2';
      form.setFieldsValue({
        [`provider${sfx}`]: undefined, [`personal_account${sfx}`]: '',
        [`contract_number${sfx}`]: '', [`tariff${sfx}`]: '',
        [`connection_type${sfx}`]: undefined, [`modem_number${sfx}`]: '',
        [`modem_iccid${sfx}`]: '', [`provider_settings${sfx}`]: '',
        [`provider_equipment${sfx}`]: false,
      });
      if (transferFromSlot === '1') setConnectionType('');
      else setConnectionType2('');
      message.success(`Провайдер ${transferFromSlot} передан клиенту: ${data.to_client.name}`);
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка передачи');
    } finally { setTransferring(false); }
  };

  // ─── Сохранение ─────────────────────────────────────────
  const onFinish = async (values) => {
    if (!values.address?.trim()) { message.error('Адрес обязателен для заполнения'); return; }
    setSaving(true);
    try {
      if (isEdit && !isDraftMode) {
        await clientsAPI.update(id, values);
        message.success('Клиент обновлён');
        navigate(`/clients/${id}`);
      } else {
        await clientsAPI.update(id, { ...values, is_draft: false });
        draftIdRef.current = null; setIsDraft(false);
        localStorage.removeItem('pending_draft_id');
        message.success('Клиент создан');
        navigate(`/clients/${id}`);
      }
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const canEdit = permissions.can_edit_client || permissions.can_create_client;
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const tabItems = [
    {
      key: 'info',
      label: '📋 Информация',
      forceRender: true,
      children: (
        <ClientFormInfo
          id={id} form={form}
          ofdCompanies={ofdCompanies}
          mikrotikIP={mikrotikIP} serverIP={serverIP}
          fetchingIP={fetchingIP} handleGetExternalIP={handleGetExternalIP}
          files={files} uploading={uploading}
          handleUpload={handleUpload} handleDeleteFile={handleDeleteFile}
          saveDraftField={saveDraftField}
        />
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
        <ClientFormProviders
          form={form} providers={providers}
          connectionType={connectionType} setConnectionType={setConnectionType}
          connectionType2={connectionType2} setConnectionType2={setConnectionType2}
          showProvider2={showProvider2} setShowProvider2={setShowProvider2}
          isEdit={isEdit} isDraftMode={isDraftMode}
          handleOpenTransfer={handleOpenTransfer}
        />
      ),
    },
    {
      key: 'kkt',
      label: '🧾 ККТ',
      children: (
        <ClientFormKkt
          isDraftMode={isDraftMode} isEdit={isEdit}
          kktData={kktData} kktFetching={kktFetching} kktRefreshing={kktRefreshing}
          fetchKktFromOfd={fetchKktFromOfd} refreshKktByRnm={refreshKktByRnm}
          deleteKkt={deleteKkt} fetchKktByRnmList={fetchKktByRnmList}
          rnmFields={rnmFields} setRnmFields={setRnmFields}
          addByRnmVisible={addByRnmVisible} setAddByRnmVisible={setAddByRnmVisible}
          addByRnmValue={addByRnmValue} setAddByRnmValue={setAddByRnmValue}
          addByRnmLoading={addByRnmLoading} addKktByRnm={addKktByRnm}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <Title level={4} style={{ margin: 0 }}>
          {isDraftMode ? 'Новый клиент' : isEdit ? 'Редактирование клиента' : 'Новый клиент'}
        </Title>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onFinishFailed={() => message.error('Адрес обязателен для заполнения')}
        disabled={!canEdit}
        onValuesChange={(changed) => {
          if (changed.subnet !== undefined) {
            setMikrotikIP(calcMikrotikIP(changed.subnet, '1'));
            setServerIP(calcMikrotikIP(changed.subnet, '2'));
          }
        }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 0 }} items={tabItems} />

        {canEdit && (
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large" style={{ marginTop: 16 }}>
            {isDraftMode ? 'Создать клиента' : isEdit ? 'Сохранить изменения' : 'Создать клиента'}
          </Button>
        )}
      </Form>

      <TransferModal
        open={transferModal} onClose={() => setTransferModal(false)}
        transferStep={transferStep} setTransferStep={setTransferStep}
        transferFromSlot={transferFromSlot}
        clients={clients} selectedClient={selectedClient} onSelectClient={handleSelectTransferClient}
        selectedClientDetail={selectedClientDetail}
        selectedToSlot={selectedToSlot} setSelectedToSlot={setSelectedToSlot}
        transferring={transferring} onTransfer={handleTransfer}
      />
    </div>
  );
}
