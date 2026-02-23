import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, Typography, message,
  Tooltip, Modal, Checkbox, Divider, Radio
} from 'antd';
import {
  PlusOutlined, FileExcelOutlined, SearchOutlined,
  DownloadOutlined, MailOutlined, SendOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { clientsAPI, settingsAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title, Text } = Typography;

// Определение групп и полей
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

  const fetchClients = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await clientsAPI.list({
        page,
        search: search || undefined,
        status: status || undefined,
      });
      setClients(data.results);
      setPagination((p) => ({ ...p, total: data.count, current: page }));
    } catch {
      message.error('Ошибка загрузки клиентов');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { fetchClients(1); }, [fetchClients]);

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

  const columns = [
    {
      title: 'Адрес', dataIndex: 'address',
      render: (address, r) => (
        <Button type="link" onClick={() => navigate(`/clients/${r.id}`)}
          style={{ padding: 0, fontWeight: 500, textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}>
          {address || r.display_name || '—'}
        </Button>
      ),
    },
    { title: 'Компания', dataIndex: 'company', render: v => v || '—' },
    { title: 'ИНН', dataIndex: 'inn', render: v => v || '—' },
    { title: 'Провайдер', dataIndex: 'provider_name', render: v => v || '—' },
    { title: 'Телефон', dataIndex: 'phone', render: v => v || '—' },
    { title: 'Email', dataIndex: 'email', render: v => v || '—' },
    {
      title: 'Статус', dataIndex: 'status',
      render: v => (
        <Tag color={v === 'active' ? 'green' : 'default'}>
          {v === 'active' ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
  ];

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
        <Tooltip title="Экспорт в Excel">
          <Button
            icon={<FileExcelOutlined />}
            onClick={openExportModal}
            style={{ color: '#217346', borderColor: '#217346' }}
          />
        </Tooltip>
      </Space>

      <Table
        columns={columns} dataSource={clients} rowKey="id"
        loading={loading} bordered size="middle"
        pagination={{
          ...pagination, showSizeChanger: false,
          showTotal: total => `Всего: ${total}`,
          onChange: fetchClients,
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
