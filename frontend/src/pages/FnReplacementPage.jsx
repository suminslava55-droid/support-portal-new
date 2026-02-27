import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tabs, Typography, Table, Input, Button, Space, Tooltip,
  Dropdown, Checkbox, DatePicker, Tag, message, Select,
  Modal, Radio,
} from 'antd';
import {
  FileSearchOutlined, CalendarOutlined, SearchOutlined,
  FileExcelOutlined, SettingOutlined, LeftOutlined, RightOutlined,
  DownloadOutlined, SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import api from '../api/axios';
import { settingsAPI } from '../api';

dayjs.locale('ru');
const { Title, Text } = Typography;

// ─── константы ───────────────────────────────────────────────────────────────

const COLS_KEY = 'fn_replacement_columns';

const COL_DEFS = [
  { key: 'address',           label: 'Адрес',              alwaysVisible: true },
  { key: 'company',           label: 'Компания' },
  { key: 'rnm',               label: 'РНМ' },
  { key: 'serial_number',     label: 'Серийный номер' },
  { key: 'fn_number',         label: 'Номер ФН' },
  { key: 'fn_end_date',       label: 'Конец срока ФН' },
  { key: 'contract_end_date', label: 'Конец договора ОФД' },
];
const DEFAULT_COLS = COL_DEFS.map(c => c.key);

const PAGE_SIZES = [
  { value: 20,  label: '20 записей' },
  { value: 50,  label: '50 записей' },
  { value: 100, label: '100 записей' },
  { value: 200, label: '200 записей' },
  { value: 500, label: '500 записей' },
];

const SORT_MAP = {
  address:           'client__address',
  company:           'client__ofd_company__name',
  rnm:               'kkt_reg_id',
  serial_number:     'serial_number',
  fn_number:         'fn_number',
  fn_end_date:       'fn_end_date',
  contract_end_date: 'contract_end_date',
};

// ─── утилиты ─────────────────────────────────────────────────────────────────

const fmt = iso => iso ? (dayjs(iso).isValid() ? dayjs(iso).format('DD.MM.YYYY') : '—') : '—';

function FnTag({ iso }) {
  if (!iso) return '—';
  const diff = dayjs(iso).diff(dayjs(), 'day');
  if (diff < 0)   return <Tag color="red">{fmt(iso)}</Tag>;
  if (diff <= 30) return <Tag color="orange">{fmt(iso)}</Tag>;
  if (diff <= 90) return <Tag color="gold">{fmt(iso)}</Tag>;
  return <span>{fmt(iso)}</span>;
}

// ─── настройка колонок ────────────────────────────────────────────────────────

function ColSettings({ visibleCols, onChange }) {
  const items = COL_DEFS.map(c => ({
    key: c.key,
    label: (
      <Checkbox
        checked={visibleCols.includes(c.key)}
        disabled={!!c.alwaysVisible}
        onChange={() => {
          if (c.alwaysVisible) return;
          const next = visibleCols.includes(c.key)
            ? visibleCols.filter(k => k !== c.key)
            : [...visibleCols, c.key];
          onChange(next);
        }}
        onClick={e => e.stopPropagation()}
      >
        {c.label}
      </Checkbox>
    ),
  }));
  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Tooltip title="Настройка колонок">
        <Button icon={<SettingOutlined />} />
      </Tooltip>
    </Dropdown>
  );
}

// ─── модал экспорта ───────────────────────────────────────────────────────────

function ExportModal({ open, onClose, exportParams, visibleCols }) {
  const [via,      setVia]      = useState('file');
  const [email,    setEmail]    = useState('');
  const [smtpOk,   setSmtpOk]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!open) return;
    setVia('file'); setEmail(''); setLoading(false);
    settingsAPI.get().then(({ data }) => {
      setSmtpOk(!!(data.smtp_host && data.smtp_user && data.has_smtp_password && data.smtp_from_email));
    }).catch(() => setSmtpOk(false));
  }, [open]);

  const handle = async () => {
    if (via === 'email' && !email.trim()) {
      message.warning('Введите email'); return;
    }
    setLoading(true);
    try {
      const payload = {
        ...exportParams,
        cols: visibleCols.join(','),
        send_via: via,
        to_email: via === 'email' ? email.trim() : undefined,
      };
      if (via === 'email') {
        const { data } = await api.post('/clients/kkt-export/', payload);
        message.success(data.message);
        onClose();
      } else {
        const resp = await api.post('/clients/kkt-export/', payload, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([resp.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `fn_replacement_${dayjs().format('YYYY-MM-DD')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка экспорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Экспорт — Замена ФН"
      open={open}
      onCancel={onClose}
      width={460}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="primary"
            loading={loading}
            icon={via === 'email' ? <SendOutlined /> : <DownloadOutlined />}
            disabled={via === 'email' && !smtpOk}
            onClick={handle}
          >
            {via === 'email' ? 'Отправить' : 'Скачать'}
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {/* Файл */}
        <div
          onClick={() => setVia('file')}
          style={{
            flex: 1, border: `2px solid ${via === 'file' ? '#1677ff' : '#d9d9d9'}`,
            borderRadius: 8, padding: '18px 12px', cursor: 'pointer', textAlign: 'center',
            background: via === 'file' ? '#e6f4ff' : '#fafafa', transition: 'all .2s',
          }}
        >
          <DownloadOutlined style={{ fontSize: 26, color: '#217346', marginBottom: 6, display: 'block' }} />
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Скачать файл</div>
          <div style={{ fontSize: 12, color: '#888' }}>Excel на компьютер</div>
        </div>
        {/* Email */}
        <div
          onClick={() => { if (smtpOk !== false) setVia('email'); }}
          style={{
            flex: 1, border: `2px solid ${via === 'email' ? '#1677ff' : '#d9d9d9'}`,
            borderRadius: 8, padding: '18px 12px',
            cursor: smtpOk === false ? 'not-allowed' : 'pointer',
            textAlign: 'center', opacity: smtpOk === false ? 0.5 : 1,
            background: via === 'email' ? '#e6f4ff' : '#fafafa', transition: 'all .2s',
          }}
        >
          <SendOutlined style={{ fontSize: 26, color: '#1677ff', marginBottom: 6, display: 'block' }} />
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Отправить на почту</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {smtpOk === null ? 'Проверка SMTP…' : smtpOk ? 'SMTP настроен' : 'SMTP не настроен'}
          </div>
        </div>
      </div>

      {via === 'email' && smtpOk && (
        <Input
          placeholder="email@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          prefix={<SendOutlined style={{ color: '#bbb' }} />}
        />
      )}
    </Modal>
  );
}

// ─── таблица ──────────────────────────────────────────────────────────────────

function KktTable({ rows, loading, total, pagination, onPageChange, onSortChange, visibleCols, onNavigate }) {
  const show = k => visibleCols.includes(k);

  const columns = [
    show('address') && {
      title: 'Адрес', dataIndex: 'address', key: 'address', sorter: true, ellipsis: true,
      render: (val, row) => (
        <a style={{ color: '#1677ff' }} onClick={e => { e.stopPropagation(); onNavigate(row.client_id); }}>
          {val}
        </a>
      ),
    },
    show('company') && { title: 'Компания', dataIndex: 'company', key: 'company', sorter: true, ellipsis: true },
    show('rnm') && { title: 'РНМ', dataIndex: 'rnm', key: 'rnm', sorter: true, width: 185 },
    show('serial_number') && { title: 'Серийный номер', dataIndex: 'serial_number', key: 'serial_number', sorter: true, width: 160 },
    show('fn_number') && { title: 'Номер ФН', dataIndex: 'fn_number', key: 'fn_number', sorter: true, width: 170 },
    show('fn_end_date') && {
      title: 'Конец срока ФН', dataIndex: 'fn_end_date', key: 'fn_end_date', sorter: true, width: 155,
      render: val => <FnTag iso={val} />,
    },
    show('contract_end_date') && {
      title: 'Конец договора ОФД', dataIndex: 'contract_end_date', key: 'contract_end_date', sorter: true, width: 180,
      render: val => fmt(val),
    },
  ].filter(Boolean);

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={rows}
      loading={loading}
      size="small"
      scroll={{ x: 'max-content' }}
      rowClassName={() => 'fn-row'}
      onRow={row => ({ onClick: () => onNavigate(row.client_id), style: { cursor: 'pointer' } })}
      onChange={(_, __, sorter) => {
        const bf = SORT_MAP[sorter.field] || 'fn_end_date';
        onSortChange(sorter.order ? (sorter.order === 'descend' ? `-${bf}` : bf) : 'fn_end_date');
      }}
      pagination={{
        current: pagination.page,
        pageSize: pagination.pageSize,
        total,
        showSizeChanger: false,
        showTotal: t => `Всего: ${t}`,
        onChange: onPageChange,
      }}
    />
  );
}

// ─── хук загрузки (БЕЗ extraRef — явные параметры) ───────────────────────────

function useKktData(month, year) {
  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [ordering, setOrdering] = useState('fn_end_date');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });
  const searchTimer = useRef(null);

  // Сбрасываем страницу при смене месяца/года
  useEffect(() => {
    setPagination(p => ({ ...p, page: 1 }));
  }, [month, year]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/clients/kkt-list/', {
        params: {
          search:    search || undefined,
          ordering,
          page:      pagination.page,
          page_size: pagination.pageSize,
          month:     month || undefined,
          year:      year  || undefined,
        },
      });
      setRows(data.results);
      setTotal(data.count);
    } catch {
      message.error('Ошибка загрузки данных ККТ');
    } finally {
      setLoading(false);
    }
  }, [search, ordering, pagination.page, pagination.pageSize, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearchChange = val => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPagination(p => ({ ...p, page: 1 }));
    }, 400);
  };
  const handleSort     = ord  => { setOrdering(ord); setPagination(p => ({ ...p, page: 1 })); };
  const handlePage     = page => setPagination(p => ({ ...p, page }));
  const handlePageSize = size => setPagination({ page: 1, pageSize: size });

  return { rows, total, loading, pagination, handleSearchChange, handleSort, handlePage, handlePageSize };
}

// ─── Toolbar (поиск + кнопки) ─────────────────────────────────────────────────

function Toolbar({ total, pageSize, onPageSize, onSearch, visibleCols, onColsChange, onExport }) {
  return (
    <Space wrap>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Поиск по адресу, РНМ, номеру ФН, компании…"
        allowClear
        onChange={e => onSearch(e.target.value)}
        style={{ width: 340 }}
      />
      <Select value={pageSize} onChange={onPageSize} options={PAGE_SIZES} style={{ width: 148 }} />
      <Tooltip title="Экспорт в Excel">
        <Button icon={<FileExcelOutlined />} onClick={onExport} style={{ color: '#217346', borderColor: '#217346' }} />
      </Tooltip>
      <ColSettings visibleCols={visibleCols} onChange={onColsChange} />
      <Text type="secondary" style={{ fontSize: 12 }}>Всего: {total}</Text>
    </Space>
  );
}

// ─── Вкладка «Общий» ─────────────────────────────────────────────────────────

function GeneralTab({ visibleCols, onColsChange }) {
  const navigate = useNavigate();
  const { rows, total, loading, pagination, handleSearchChange, handleSort, handlePage, handlePageSize } =
    useKktData(null, null);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleSearch = val => { setSearch(val); handleSearchChange(val); };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Toolbar
        total={total}
        pageSize={pagination.pageSize}
        onPageSize={handlePageSize}
        onSearch={handleSearch}
        visibleCols={visibleCols}
        onColsChange={onColsChange}
        onExport={() => setExportOpen(true)}
      />
      <KktTable
        rows={rows} loading={loading} total={total} pagination={pagination}
        onPageChange={handlePage} onSortChange={handleSort}
        visibleCols={visibleCols}
        onNavigate={id => navigate(`/clients/${id}`, { state: { tab: 'kkt' } })}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        exportParams={{ search: search || undefined }}
        visibleCols={visibleCols}
      />
    </Space>
  );
}

// ─── Вкладка «По месяцам» ─────────────────────────────────────────────────────

function MonthTab({ visibleCols, onColsChange }) {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const m = selectedMonth.month() + 1;
  const y = selectedMonth.year();

  const { rows, total, loading, pagination, handleSearchChange, handleSort, handlePage, handlePageSize } =
    useKktData(m, y);

  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const handleSearch = val => { setSearch(val); handleSearchChange(val); };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* Выбор месяца */}
      <Space align="center" style={{ background: '#f5f5f5', padding: '10px 16px', borderRadius: 8, flexWrap: 'wrap' }}>
        <Button icon={<LeftOutlined />} size="small"
          onClick={() => setSelectedMonth(d => d.subtract(1, 'month'))} />
        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={val => val && setSelectedMonth(val)}
          format="MMMM YYYY"
          allowClear={false}
          style={{ width: 165 }}
        />
        <Button icon={<RightOutlined />} size="small"
          onClick={() => setSelectedMonth(d => d.add(1, 'month'))} />
        {loading ? null : total > 0
          ? <Tag color="blue"   style={{ fontSize: 13, padding: '3px 12px' }}>{total} ккт требуют замены ФН</Tag>
          : <Tag color="green"  style={{ fontSize: 13, padding: '3px 12px' }}>Нет замен ФН в этом месяце</Tag>
        }
      </Space>

      <Toolbar
        total={total}
        pageSize={pagination.pageSize}
        onPageSize={handlePageSize}
        onSearch={handleSearch}
        visibleCols={visibleCols}
        onColsChange={onColsChange}
        onExport={() => setExportOpen(true)}
      />
      <KktTable
        rows={rows} loading={loading} total={total} pagination={pagination}
        onPageChange={handlePage} onSortChange={handleSort}
        visibleCols={visibleCols}
        onNavigate={id => navigate(`/clients/${id}`, { state: { tab: 'kkt' } })}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        exportParams={{ search: search || undefined, month: m, year: y }}
        visibleCols={visibleCols}
      />
    </Space>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function FnReplacementPage() {
  const [activeTab, setActiveTab] = useState('general');

  const [visibleCols, setVisibleCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COLS_KEY)) || DEFAULT_COLS; }
    catch { return DEFAULT_COLS; }
  });

  const handleColsChange = cols => {
    const mandatory = COL_DEFS.filter(c => c.alwaysVisible).map(c => c.key);
    const next = [...new Set([...mandatory, ...cols])];
    setVisibleCols(next);
    localStorage.setItem(COLS_KEY, JSON.stringify(next));
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 20 }}>🔄 Замена ФН</Title>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: 'general',
            label: <span><FileSearchOutlined style={{ marginRight: 6 }} />Общий</span>,
            children: <GeneralTab visibleCols={visibleCols} onColsChange={handleColsChange} />,
          },
          {
            key: 'by-month',
            label: <span><CalendarOutlined style={{ marginRight: 6 }} />По месяцам</span>,
            children: <MonthTab visibleCols={visibleCols} onColsChange={handleColsChange} />,
          },
        ]}
      />
      <style>{`.fn-row:hover td { background: #e6f4ff !important; }`}</style>
    </div>
  );
}
