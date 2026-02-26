import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, Typography, message,
  Tooltip, Modal, Checkbox, Divider, Radio, Dropdown,
} from 'antd';
import {
  PlusOutlined, FileExcelOutlined, SearchOutlined,
  DownloadOutlined, MailOutlined, SendOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { clientsAPI, settingsAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title, Text } = Typography;

// Определение групп и полей
const CONNECTION_TYPE_MAP = {
  'fiber':    { label: 'Оптоволокно', icon: '💡' },
  'cable':    { label: 'Кабель',      icon: '🔌' },
  'wireless': { label: 'Беспроводное',icon: '📡' },
  'modem':    { label: 'Модем',       icon: '📶' },
  'mrnet':    { label: 'MR-Net',      icon: '🌐' },
  // русские значения (если бэкенд отдаёт display)
  'Оптоволокно':   { label: 'Оптоволокно',  icon: '💡' },
  'Кабель':        { label: 'Кабель',        icon: '🔌' },
  'Беспроводное':  { label: 'Беспроводное',  icon: '📡' },
  'Модем':         { label: 'Модем',         icon: '📶' },
  'MR-Net':        { label: 'MR-Net',        icon: '🌐' },
};

const formatConnType = (val) => {
  if (!val) return '—';
  const t = CONNECTION_TYPE_MAP[val];
  if (t) return `${t.icon} ${t.label}`;
  return val;
};

const FIELD_GROUPS = [
  {
    key: 'basic',
    label: 'Основная информация',
    fields: [
      { key: 'address',       label: 'Адрес' },
      { key: 'company',       label: 'Компания' },
      { key: 'inn',           label: 'ИНН' },
      { key: 'phone',         label: 'Телефон' },
      { key: 'email',         label: 'Email' },
      { key: 'pharmacy_code', label: 'Код аптеки' },
      { key: 'iccid',         label: 'ICCID' },
      { key: 'status',        label: 'Статус' },
    ],
  },
  {
    key: 'network',
    label: 'Сеть',
    fields: [
      { key: 'subnet',      label: 'Подсеть' },
      { key: 'external_ip', label: 'Внешний IP' },
      { key: 'mikrotik_ip', label: 'Микротик IP' },
      { key: 'server_ip',   label: 'Сервер IP' },
    ],
  },
];

const PROVIDER_GROUPS = [
  { key: 'provider1', label: 'Провайдер 1' },
  { key: 'provider2', label: 'Провайдер 2' },
];

const ALL_FIELD_KEYS = [
  ...FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key)),
  ...PROVIDER_GROUPS.map(g => g.key),
];

// Колонки таблицы клиентов (настраиваемые)
const TABLE_COLUMNS_KEY = 'clients_table_columns';
const TABLE_COLUMN_DEFS = [
  { key: 'address',          label: 'Адрес',           alwaysVisible: true },
  { key: 'company',          label: 'Компания' },
  { key: 'inn',              label: 'ИНН' },
  { key: 'phone',            label: 'Телефон' },
  { key: 'email',            label: 'Email' },
  { key: 'pharmacy_code',    label: 'Код аптеки' },
  { key: 'iccid',            label: 'ICCID' },
  { key: 'status',           label: 'Статус' },
  { key: 'subnet',           label: 'Подсеть' },
  { key: 'external_ip',      label: 'Внешний IP' },
  { key: 'mikrotik_ip',      label: 'Микротик IP' },
  { key: 'server_ip',        label: 'Сервер IP' },
  // Провайдер 1 подполя
  { key: 'p1_name',          label: 'Провайдер 1: Название',       group: 'provider1' },
  { key: 'p1_type',          label: 'Провайдер 1: Тип',            group: 'provider1' },
  { key: 'p1_account',       label: 'Провайдер 1: Лицевой счёт',  group: 'provider1' },
  { key: 'p1_contract',      label: 'Провайдер 1: № договора',     group: 'provider1' },
  // Провайдер 2 подполя
  { key: 'p2_name',          label: 'Провайдер 2: Название',       group: 'provider2' },
  { key: 'p2_type',          label: 'Провайдер 2: Тип',            group: 'provider2' },
  { key: 'p2_account',       label: 'Провайдер 2: Лицевой счёт',  group: 'provider2' },
  { key: 'p2_contract',      label: 'Провайдер 2: № договора',     group: 'provider2' },
];
const DEFAULT_TABLE_COLUMNS = ['address', 'company', 'phone', 'status', 'p1_name', 'p1_type', 'p2_name', 'p2_type'];

// Компонент группы с общим чекбоксом и дочерними
function FieldGroup({ group, selected, onChange }) {
  const allKeys = group.fields.map(f => f.key);
  const checkedKeys = allKeys.filter(k => selected.includes(k));
  const allChecked = checkedKeys.length === allKeys.length;
  const indeterminate = checkedKeys.length > 0 && checkedKeys.length < allKeys.length;

  const toggleGroup = () => {
    if (allChecked) {
      onChange(selected.filter(k => !allKeys.includes(k)));
    } else {
      onChange([...selected.filter(k => !allKeys.includes(k)), ...allKeys]);
    }
  };

  const toggleField = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Checkbox
        checked={allChecked}
        indeterminate={indeterminate}
        onChange={toggleGroup}
        style={{ fontWeight: 600, fontSize: 13 }}
      >
        {group.label}
      </Checkbox>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
        marginTop: 8, marginLeft: 24,
      }}>
        {group.fields.map(field => (
          <Checkbox
            key={field.key}
            checked={selected.includes(field.key)}
            onChange={() => toggleField(field.key)}
            style={{ fontSize: 13 }}
          >
            {field.label}
          </Checkbox>
        ))}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [providerFilter, setProviderFilter] = useState([]);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [allProviders, setAllProviders] = useState([]);
  const navigate = useNavigate();
  const permissions = useAuthStore((s) => s.permissions);

  // Модал экспорта
  const [exportModal, setExportModal] = useState(false);
  const [exportStep, setExportStep] = useState(1);
  const [exportVia, setExportVia] = useState('file');
  const [emailTo, setEmailTo] = useState('');
  const [smtpOk, setSmtpOk] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState(ALL_FIELD_KEYS);

  // Настройка колонок таблицы
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TABLE_COLUMNS_KEY)) || DEFAULT_TABLE_COLUMNS; }
    catch { return DEFAULT_TABLE_COLUMNS; }
  });
  const [colSettingsOpen, setColSettingsOpen] = useState(false);

  const toggleColumn = (key) => {
    const col = TABLE_COLUMN_DEFS.find(c => c.key === key);
    if (col?.alwaysVisible) return;
    setVisibleColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem(TABLE_COLUMNS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Load providers for filter
  useEffect(() => {
    import('../api').then(({ default: api }) => {
      api.get('/clients/providers/?page_size=1000').then(({ data }) => {
        setAllProviders(data.results || data);
      }).catch(() => {});
    });
  }, []);

  const fetchClients = useCallback(async (page = 1, sf, so) => {
    setLoading(true);
    const activeSortField = sf !== undefined ? sf : sortField;
    const activeSortOrder = so !== undefined ? so : sortOrder;
    const fieldMap = { provider_name: 'provider__name', company: 'ofd_company__name', inn: 'ofd_company__inn' };
    const backendField = activeSortField ? (fieldMap[activeSortField] || activeSortField) : '';
    const ordering = backendField ? (activeSortOrder === 'descend' ? `-${backendField}` : backendField) : undefined;
    try {
      const { data } = await clientsAPI.list({
        page,
        search: search || undefined,
        status: status || undefined,
        provider: providerFilter.length ? providerFilter.join(',') : undefined,
        ordering,
      });
      setClients(data.results);
      setPagination((p) => ({ ...p, total: data.count, current: page }));
    } catch {
      message.error('Ошибка загрузки клиентов');
    } finally {
      setLoading(false);
    }
  }, [search, status, providerFilter, sortField, sortOrder]);

  useEffect(() => { fetchClients(1); }, [fetchClients]);

  const handleTableChange = (pag, _filters, sorter) => {
    const newField = sorter.field || '';
    const newOrder = sorter.order || '';
    setSortField(newField);
    setSortOrder(newOrder);
    fetchClients(pag.current, newField, newOrder);
  };

  const openExportModal = async () => {
    setExportStep(1);
    setExportVia('file');
    setEmailTo('');
    setSmtpOk(null);
    setExporting(false);
    setSelectedFields(ALL_FIELD_KEYS);
    setExportModal(true);
    try {
      const { data } = await settingsAPI.get();
      const ok = !!(data.smtp_host && data.smtp_user && data.has_smtp_password && data.smtp_from_email);
      setSmtpOk(ok);
    } catch {
      setSmtpOk(false);
    }
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      message.warning('Выберите хотя бы одно поле');
      return;
    }
    if (exportVia === 'email' && !emailTo.trim()) {
      message.warning('Введите email для отправки');
      return;
    }
    setExporting(true);
    try {
      const payload = {
        search: search || undefined,
        status: status || undefined,
        fields: selectedFields.join(','),
        send_via: exportVia,
        to_email: exportVia === 'email' ? emailTo.trim() : undefined,
      };
      if (exportVia === 'email') {
        const { data } = await clientsAPI.exportExcelEmail(payload);
        message.success(data.message);
        setExportModal(false);
      } else {
        const { data } = await clientsAPI.exportExcelPost(payload);
        const url = window.URL.createObjectURL(new Blob([data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        setExportModal(false);
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const show = (key) => visibleColumns.includes(key);

  // Строим объединённую колонку провайдеров (П1 и П2 в одной ячейке, двумя строками)
  // Строим колонку провайдера динамически из выбранных подполей
  const buildProviderCol = (num) => {
    const fieldMap = {
      [`p${num}_name`]:     { label: 'Название',      getter: r => num === 1 ? r.provider_name    : r.provider2_name },
      [`p${num}_type`]:     { label: 'Тип',           getter: r => formatConnType(num === 1 ? r.provider_type    : r.provider2_type) },
      [`p${num}_account`]:  { label: 'Лицевой счёт', getter: r => num === 1 ? r.provider_account  : r.provider2_account },
      [`p${num}_contract`]: { label: '№ договора',    getter: r => num === 1 ? r.provider_contract : r.provider2_contract },
    };
    const activeFields = Object.entries(fieldMap).filter(([k]) => visibleColumns.includes(k));
    if (activeFields.length === 0) return null;
    return {
      title: (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Провайдер {num}</div>
          <div style={{ display: 'flex', fontSize: 11, color: '#999', gap: 4 }}>
            {activeFields.map(([k, f]) => (
              <span key={k} style={{ flex: 1, minWidth: 60 }}>{f.label}</span>
            ))}
          </div>
        </div>
      ),
      key: `provider${num}`,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {activeFields.map(([k, f]) => (
            <span key={k} style={{ flex: 1, fontSize: 12, minWidth: 60 }}>{f.getter(r) || '—'}</span>
          ))}
        </div>
      ),
      width: 80 + activeFields.length * 90,
    };
  };

  const allColumns = [
    {
      title: 'Адрес', dataIndex: 'address', key: 'address',
      sorter: true, sortOrder: sortField === 'address' ? sortOrder : null,
      render: (address, r) => (
        <Button type="link" onClick={() => navigate(`/clients/${r.id}`)}
          style={{ padding: 0, fontWeight: 500, textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}>
          {address || r.display_name || '—'}
        </Button>
      ),
    },
    show('company')       && { title: 'Компания',    dataIndex: 'company',       key: 'company',       sorter: true, sortOrder: sortField === 'company' ? sortOrder : null,   render: v => v || '—' },
    show('inn')           && { title: 'ИНН',         dataIndex: 'inn',           key: 'inn',           sorter: true, sortOrder: sortField === 'inn' ? sortOrder : null,       render: v => v || '—' },
    show('phone')         && { title: 'Телефон',     dataIndex: 'phone',         key: 'phone',         sorter: true, sortOrder: sortField === 'phone' ? sortOrder : null,     render: v => v || '—' },
    show('email')         && { title: 'Email',       dataIndex: 'email',         key: 'email',         sorter: true, sortOrder: sortField === 'email' ? sortOrder : null,     render: v => v || '—' },
    show('pharmacy_code') && { title: 'Код аптеки',  dataIndex: 'pharmacy_code', key: 'pharmacy_code', render: v => v || '—' },
    show('iccid')         && { title: 'ICCID',       dataIndex: 'iccid',         key: 'iccid',         render: v => v || '—' },
    show('subnet')        && { title: 'Подсеть',     dataIndex: 'subnet',        key: 'subnet',        render: v => v || '—' },
    show('external_ip')   && { title: 'Внешний IP',  dataIndex: 'external_ip',   key: 'external_ip',   render: v => v || '—' },
    show('mikrotik_ip')   && { title: 'Микротик IP', dataIndex: 'mikrotik_ip',   key: 'mikrotik_ip',   render: v => v || '—' },
    show('server_ip')     && { title: 'Сервер IP',   dataIndex: 'server_ip',     key: 'server_ip',     render: v => v || '—' },
    buildProviderCol(1),
    buildProviderCol(2),
    show('status') && {
      title: 'Статус', dataIndex: 'status', key: 'status',
      sorter: true, sortOrder: sortField === 'status' ? sortOrder : null,
      render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? 'Активен' : 'Неактивен'}</Tag>,
    },
  ].filter(Boolean);

  const columns = allColumns;

  // Подсчёт выбранных провайдеров для отображения
  const selectedProviders = PROVIDER_GROUPS.filter(g => selectedFields.includes(g.key));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Клиенты</Title>
        {permissions.can_create_client && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clients/new')}>
            Добавить клиента
          </Button>
        )}
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Поиск по адресу, телефону, email, компании, ИНН..."
          style={{ width: 420 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onSearch={() => fetchClients(1)}
          allowClear
        />
        <Select
          placeholder="Статус" style={{ width: 160 }} allowClear
          value={status || undefined}
          onChange={v => setStatus(v || '')}
          options={[
            { value: 'active', label: 'Активен' },
            { value: 'inactive', label: 'Неактивен' },
          ]}
        />
        <Select
          mode="multiple"
          placeholder="Провайдер"
          style={{ minWidth: 180, maxWidth: 320 }}
          allowClear
          maxTagCount={2}
          value={providerFilter}
          onChange={v => setProviderFilter(v || [])}
          options={allProviders.map(p => ({ value: p.id, label: p.name }))}
        />
        <Tooltip title="Экспорт в Excel">
          <Button
            icon={<FileExcelOutlined />}
            onClick={openExportModal}
            style={{ color: '#217346', borderColor: '#217346' }}
          />
        </Tooltip>
        <Dropdown
          open={colSettingsOpen}
          onOpenChange={setColSettingsOpen}
          trigger={['click']}
          dropdownRender={() => (
            <div style={{
              background: '#fff', borderRadius: 8, padding: '12px 16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 240,
              border: '1px solid #f0f0f0', maxHeight: 420, overflowY: 'auto',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
                ⚙️ Колонки таблицы
              </div>
              {[
                { group: 'Основные', keys: ['company','inn','phone','email','pharmacy_code','iccid','status'] },
                { group: 'Сеть', keys: ['subnet','external_ip','mikrotik_ip','server_ip'] },
                { group: 'Провайдер 1', keys: ['p1_name','p1_type','p1_account','p1_contract'] },
                { group: 'Провайдер 2', keys: ['p2_name','p2_type','p2_account','p2_contract'] },
              ].map(({ group, keys }) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{group}</div>
                  {keys.map(key => {
                    const def = TABLE_COLUMN_DEFS.find(c => c.key === key);
                    return (
                      <div key={key} style={{ marginBottom: 5 }}>
                        <Checkbox
                          checked={visibleColumns.includes(key)}
                          onChange={() => toggleColumn(key)}
                        >
                          <span style={{ fontSize: 13 }}>{def?.label}</span>
                        </Checkbox>
                      </div>
                    );
                  })}
                </div>
              ))}
              <Divider style={{ margin: '8px 0' }} />
              <Button size="small" block onClick={() => {
                setVisibleColumns(DEFAULT_TABLE_COLUMNS);
                localStorage.setItem(TABLE_COLUMNS_KEY, JSON.stringify(DEFAULT_TABLE_COLUMNS));
              }}>
                Сбросить к стандарту
              </Button>
            </div>
          )}
        >
          <Tooltip title="Настройка колонок">
            <Button icon={<SettingOutlined />} />
          </Tooltip>
        </Dropdown>
      </Space>

      <Table
        columns={columns} dataSource={clients} rowKey="id"
        loading={loading} bordered size="middle"
        onChange={handleTableChange}
        pagination={{
          ...pagination, showSizeChanger: false,
          showTotal: total => `Всего: ${total}`,
        }}
      />

      {/* ===== МОДАЛ ЭКСПОРТА ===== */}
      <Modal
        title={exportStep === 1 ? 'Экспорт — Шаг 1 из 2: Способ' : 'Экспорт — Шаг 2 из 2: Поля'}
        open={exportModal}
        onCancel={() => setExportModal(false)}
        width={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {exportStep === 2 && (
                <Button onClick={() => setExportStep(1)}>← Назад</Button>
              )}
            </div>
            <Space>
              <Button onClick={() => setExportModal(false)}>Отмена</Button>
              {exportStep === 1 ? (
                <Button
                  type="primary"
                  disabled={exportVia === 'email' && !smtpOk}
                  onClick={() => setExportStep(2)}
                >
                  Далее →
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={exportVia === 'email' ? <SendOutlined /> : <DownloadOutlined />}
                  loading={exporting}
                  disabled={selectedFields.length === 0}
                  onClick={handleExport}
                >
                  {exportVia === 'email' ? 'Отправить' : 'Скачать'}
                </Button>
              )}
            </Space>
          </div>
        }
      >
        {/* ШАГ 1 */}
        {exportStep === 1 && (
          <div>
            <div style={{ display: 'flex', gap: 12 }}>
              {/* Файл */}
              <div
                onClick={() => setExportVia('file')}
                style={{
                  flex: 1, border: `2px solid ${exportVia === 'file' ? '#1677ff' : '#d9d9d9'}`,
                  borderRadius: 8, padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                  background: exportVia === 'file' ? '#e6f4ff' : '#fafafa', transition: 'all 0.2s',
                }}
              >
                <DownloadOutlined style={{ fontSize: 28, color: '#217346', marginBottom: 8, display: 'block' }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Скачать файл</div>
                <div style={{ fontSize: 12, color: '#888' }}>Сохранить Excel на компьютер</div>
              </div>
              {/* Email */}
              <div
                onClick={() => { if (smtpOk !== false) setExportVia('email'); }}
                style={{
                  flex: 1,
                  border: `2px solid ${exportVia === 'email' ? '#1677ff' : smtpOk === false ? '#ffccc7' : '#d9d9d9'}`,
                  borderRadius: 8, padding: '20px 16px',
                  cursor: smtpOk === false ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  background: exportVia === 'email' ? '#e6f4ff' : smtpOk === false ? '#fff2f0' : '#fafafa',
                  transition: 'all 0.2s',
                }}
              >
                <MailOutlined style={{ fontSize: 28, color: smtpOk === false ? '#ffccc7' : '#1677ff', marginBottom: 8, display: 'block' }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Отправить на Email</div>
                {smtpOk === false
                  ? <div style={{ fontSize: 12, color: '#ff4d4f' }}>SMTP не настроен.<br />Заполните в разделе «Настройки»</div>
                  : <div style={{ fontSize: 12, color: '#888' }}>Отправить Excel на почту</div>
                }
              </div>
            </div>

            {exportVia === 'email' && smtpOk && (
              <div style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13 }}>Email для отправки:</Text>
                <Input
                  style={{ marginTop: 6 }}
                  placeholder="example@mail.ru"
                  prefix={<MailOutlined style={{ color: '#ccc' }} />}
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* ШАГ 2 */}
        {exportStep === 2 && (
          <div>
            {/* Кнопки быстрого выбора */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
              <Button size="small" onClick={() => setSelectedFields(ALL_FIELD_KEYS)}>Выбрать все</Button>
              <Button size="small" onClick={() => setSelectedFields([])}>Снять все</Button>
            </div>

            {/* Обычные группы с дочерними полями */}
            {FIELD_GROUPS.map(group => (
              <FieldGroup
                key={group.key}
                group={group}
                selected={selectedFields}
                onChange={setSelectedFields}
              />
            ))}

            <Divider style={{ margin: '12px 0' }} />

            {/* Провайдеры — только целиком */}
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Провайдеры выгружаются разделом целиком:
              </Text>
            </div>
            {PROVIDER_GROUPS.map(group => (
              <div key={group.key} style={{ marginBottom: 10 }}>
                <Checkbox
                  checked={selectedFields.includes(group.key)}
                  onChange={() => {
                    if (selectedFields.includes(group.key)) {
                      setSelectedFields(selectedFields.filter(k => k !== group.key));
                    } else {
                      setSelectedFields([...selectedFields, group.key]);
                    }
                  }}
                  style={{ fontWeight: 600, fontSize: 13 }}
                >
                  {group.label}
                </Checkbox>
                <div style={{ fontSize: 12, color: '#aaa', marginLeft: 24, marginTop: 2 }}>
                  Провайдер, Тип подключения, Тариф, Лицевой счёт, № договора, Номер модема, ICCID, Оборудование
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
