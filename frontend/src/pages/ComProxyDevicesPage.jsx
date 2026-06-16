import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Tag, Input, Space, Button, Select, Card,
  Statistic, Row, Col, Modal, message, Tooltip, Popconfirm,
  Tabs, Upload, Form, Switch, Badge,
} from 'antd';
import {
  ApiOutlined, SearchOutlined, LinkOutlined, DisconnectOutlined,
  ReloadOutlined, WarningOutlined, CheckCircleOutlined,
  UploadOutlined, CloudUploadOutlined, SendOutlined,
  CloseCircleOutlined, ClockCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import { comproxyAPI } from '../api';
import api from '../api';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Title, Text } = Typography;

/* ─── Модалка привязки к ККТ ─────────────────────── */

function MatchModal({ visible, onClose, device, onMatched }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);

  const doSearch = useCallback(async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get('/clients/kkt-list/', {
        params: { search: search.trim(), page_size: 20 },
      });
      setResults(data.results || []);
    } catch {
      message.error('Ошибка поиска');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const handleMatch = async (kktId) => {
    setMatching(true);
    try {
      await comproxyAPI.matchDevice(device.uuid, kktId);
      message.success('Устройство привязано');
      onMatched();
      onClose();
    } catch {
      message.error('Ошибка привязки');
    } finally {
      setMatching(false);
    }
  };

  return (
    <Modal
      title={`Привязать ${device?.uuid?.slice(0, 8)}... к ККТ`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          placeholder="Поиск по РНМ, адресу, серийному номеру..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={doSearch}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={doSearch} loading={loading}>
          Найти
        </Button>
      </Space.Compact>
      <Table
        dataSource={results}
        rowKey="id"
        size="small"
        pagination={false}
        loading={loading}
        columns={[
          { title: 'РНМ', dataIndex: 'rnm', width: 180 },
          { title: 'Адрес', dataIndex: 'address', ellipsis: true },
          { title: 'Компания', dataIndex: 'company', width: 160, ellipsis: true },
          {
            title: '',
            width: 100,
            render: (_, row) => (
              <Button type="primary" size="small" icon={<LinkOutlined />}
                loading={matching} onClick={() => handleMatch(row.id)}>
                Привязать
              </Button>
            ),
          },
        ]}
      />
    </Modal>
  );
}

/* ─── Модалка отправки обновления ─────────────────── */

function DeployModal({ visible, onClose, targetUuids, allDevices, preselectedPkgId, onDeployed }) {
  const [updates, setUpdates] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedPkg(preselectedPkgId || null);
      comproxyAPI.getUpdates({ product_type: '' }).then(({ data }) => setUpdates(data));
    }
  }, [visible, preselectedPkgId]);

  const handleDeploy = async () => {
    if (!selectedPkg) return;
    setDeploying(true);
    try {
      const body = allDevices
        ? { all_devices: true }
        : { device_uuids: targetUuids };
      const { data } = await comproxyAPI.deployUpdate(selectedPkg, body);
      message.success(data.message);
      onDeployed();
      onClose();
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setDeploying(false);
    }
  };

  const label = allDevices
    ? 'Все устройства'
    : `${targetUuids.length} устройств(а)`;

  return (
    <Modal
      title={<><CloudUploadOutlined /> Отправить обновление</>}
      open={visible}
      onCancel={onClose}
      onOk={handleDeploy}
      okText="Отправить"
      confirmLoading={deploying}
      okButtonProps={{ disabled: !selectedPkg }}
      width={520}
    >
      <div style={{ marginBottom: 16 }}>
        <Text>Цель: <Text strong>{label}</Text></Text>
      </div>
      <Select
        placeholder="Выберите обновление"
        style={{ width: '100%' }}
        value={selectedPkg}
        onChange={setSelectedPkg}
        loading={loading}
        options={updates.filter(u => u.enabled).map(u => ({
          value: u.id,
          label: `${u.product_type === 'COMPROXY' ? 'ComProxy' : 'Прошивка'} ${u.version} (${u.filename})`,
        }))}
      />
    </Modal>
  );
}

/* ─── Модалка загрузки обновления ──────────────────── */

function UploadModal({ visible, onClose, onUploaded }) {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);

  const handleUpload = async () => {
    const values = await form.validateFields();
    if (!fileList.length) {
      message.error('Выберите файл');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', fileList[0].originFileObj);
      fd.append('product_type', values.product_type);
      fd.append('version', values.version);
      if (values.version_from) fd.append('version_from', values.version_from);
      if (values.info) fd.append('info', values.info);
      // project/product захардкожены на бэкенде
      await comproxyAPI.uploadUpdate(fd);
      message.success('Обновление загружено');
      onUploaded();
      onClose();
      form.resetFields();
      setFileList([]);
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title={<><UploadOutlined /> Загрузить обновление</>}
      open={visible}
      onCancel={() => { onClose(); form.resetFields(); setFileList([]); }}
      onOk={handleUpload}
      okText="Загрузить"
      confirmLoading={uploading}
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="product_type" label="Тип" rules={[{ required: true, message: 'Выберите тип' }]}>
          <Select options={[
            { value: 'COMPROXY', label: 'ComProxy' },
            { value: 'FIRMWARE', label: 'Прошивка ККТ' },
          ]} />
        </Form.Item>
        <Form.Item name="version" label="Версия" rules={[{ required: true, message: 'Введите версию' }]}>
          <Input placeholder="3.4.0" />
        </Form.Item>
        <Form.Item name="version_from" label="Совместимо с версии">
          <Input placeholder="Минимальная версия (необязательно)" />
        </Form.Item>
        {/* project/product определяются автоматически на бэкенде */}
        <Form.Item name="info" label="Описание">
          <Input.TextArea rows={2} placeholder="Changelog / описание" />
        </Form.Item>
        <Form.Item label="Файл" required>
          <Upload
            fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
            beforeUpload={() => false}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>Выбрать файл</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
}

/* ─── Вкладка «Устройства» ────────────────────────── */

function DevicesTab() {
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [matchedFilter, setMatchedFilter] = useState(undefined);
  const [shiftFilter, setShiftFilter] = useState(undefined);
  const [matchModal, setMatchModal] = useState({ visible: false, device: null });
  const [selectedUuids, setSelectedUuids] = useState([]);
  const [deployModal, setDeployModal] = useState({ visible: false, uuids: [], all: false });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (matchedFilter !== undefined) params.matched = matchedFilter;
      if (shiftFilter) params.shift_exceeded = 'true';
      const [devRes, statsRes] = await Promise.all([
        comproxyAPI.getDevices(params),
        comproxyAPI.getStats(),
      ]);
      setDevices(devRes.data);
      setStats(statsRes.data);
    } catch {
      message.error('Ошибка загрузки данных ComProxy');
    } finally {
      setLoading(false);
    }
  }, [search, matchedFilter, shiftFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUnmatch = async (uuid) => {
    try {
      await comproxyAPI.unmatchDevice(uuid);
      message.success('Устройство отвязано');
      fetchData();
    } catch {
      message.error('Ошибка отвязки');
    }
  };

  const columns = [
    {
      title: 'Устройство', dataIndex: 'uuid', width: 110,
      render: (uuid) => (
        <Tooltip title={uuid}>
          <Text code style={{ fontSize: 12 }}>{uuid.slice(0, 8)}...</Text>
        </Tooltip>
      ),
    },
    {
      title: 'РНМ', dataIndex: 'registry_number', width: 180,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Модель', dataIndex: 'kkt_name', width: 140, ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Адрес', key: 'address', ellipsis: true,
      render: (_, r) => r.client_address || r.fiscal_address || <Text type="secondary">—</Text>,
    },
    {
      title: 'Компания', dataIndex: 'client_company', width: 150, ellipsis: true,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'ComProxy', dataIndex: 'comproxy_version', width: 90,
      render: (v) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    {
      title: 'Прошивка', dataIndex: 'firmware_version', width: 100,
      render: (v) => v ? <Tag color="cyan">{v}</Tag> : '—',
    },
    {
      title: 'ФФД', dataIndex: 'ffd_version', width: 60,
      render: (v) => v || '—',
    },
    {
      title: 'Смена', key: 'shift', width: 120,
      render: (_, r) => {
        const t = r.telemetry;
        if (!t || !t.shift_status) return <Text type="secondary">—</Text>;
        if (t.shift_exceeded_24h) return <Tag color="red">Открыта &gt; 24ч</Tag>;
        if (t.shift_status === 'OPEN') return <Tag color="orange">Открыта</Tag>;
        return <Tag color="green">Закрыта</Tag>;
      },
    },
    {
      title: 'Не отпр. ОФД', key: 'unsent_ofd', width: 100,
      render: (_, r) => {
        const count = r.telemetry?.unsent_ofd_count;
        if (count === undefined || count === null) return <Text type="secondary">—</Text>;
        if (count > 0) return <Tag color="warning">{count}</Tag>;
        return <Tag color="green">0</Tag>;
      },
    },
    {
      title: 'Последний отклик', dataIndex: 'last_seen_at', width: 140,
      render: (v) => {
        if (!v) return '—';
        const d = dayjs(v);
        const isOffline = dayjs().diff(d, 'minute') > 5;
        return (
          <Tooltip title={d.format('DD.MM.YYYY HH:mm:ss')}>
            <Text type={isOffline ? 'secondary' : undefined}>{d.fromNow()}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Привязка', key: 'match', width: 120,
      render: (_, r) => {
        if (r.is_matched) {
          return (
            <Space>
              <Tag color="green" icon={<CheckCircleOutlined />}>
                {r.match_method === 'auto' ? 'Авто' : 'Вручную'}
              </Tag>
              <Popconfirm title="Отвязать устройство?" onConfirm={() => handleUnmatch(r.uuid)}
                okText="Да" cancelText="Нет">
                <Button size="small" type="text" icon={<DisconnectOutlined />} danger />
              </Popconfirm>
            </Space>
          );
        }
        return (
          <Button size="small" type="primary" ghost icon={<LinkOutlined />}
            onClick={() => setMatchModal({ visible: true, device: r })}>
            Привязать
          </Button>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedUuids,
    onChange: (keys) => setSelectedUuids(keys),
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Всего устройств" value={stats.total || 0} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Привязано" value={stats.matched || 0} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Не привязано" value={stats.unmatched || 0} valueStyle={{ color: stats.unmatched > 0 ? '#faad14' : undefined }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Смена > 24ч" value={stats.shift_exceeded_24h || 0}
              valueStyle={{ color: stats.shift_exceeded_24h > 0 ? '#ff4d4f' : undefined }}
              prefix={stats.shift_exceeded_24h > 0 ? <WarningOutlined /> : null} />
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input.Search placeholder="Поиск по РНМ, UUID, ИНН, адресу..." allowClear
            style={{ width: 320 }} onSearch={(v) => setSearch(v)} enterButton />
          <Select placeholder="Привязка" allowClear style={{ width: 160 }}
            value={matchedFilter} onChange={setMatchedFilter}
            options={[
              { label: 'Привязанные', value: 'true' },
              { label: 'Не привязанные', value: 'false' },
            ]} />
          <Button type={shiftFilter ? 'primary' : 'default'} danger={shiftFilter}
            icon={<WarningOutlined />} onClick={() => setShiftFilter(!shiftFilter)}>
            Смена &gt; 24ч
          </Button>
        </Space>
        <Space>
          {selectedUuids.length > 0 && (
            <Button type="primary" icon={<SendOutlined />}
              onClick={() => setDeployModal({ visible: true, uuids: selectedUuids, all: false })}>
              Обновить выбранные ({selectedUuids.length})
            </Button>
          )}
          <Button icon={<CloudUploadOutlined />}
            onClick={() => setDeployModal({ visible: true, uuids: [], all: true })}>
            Обновить все
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Обновить
          </Button>
        </Space>
      </div>

      <Table
        dataSource={devices}
        columns={columns}
        rowKey="uuid"
        loading={loading}
        size="small"
        rowSelection={rowSelection}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
        scroll={{ x: 1400 }}
        rowClassName={(r) => r.telemetry?.shift_exceeded_24h ? 'row-shift-exceeded' : ''}
      />

      <MatchModal visible={matchModal.visible} device={matchModal.device}
        onClose={() => setMatchModal({ visible: false, device: null })} onMatched={fetchData} />

      <DeployModal visible={deployModal.visible}
        targetUuids={deployModal.uuids} allDevices={deployModal.all}
        onClose={() => setDeployModal({ visible: false, uuids: [], all: false })}
        onDeployed={() => { fetchData(); setSelectedUuids([]); }} />
    </div>
  );
}

/* ─── Вкладка «Обновления» ─────────────────────────── */

function UpdatesTab() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await comproxyAPI.getUpdates();
      setUpdates(data);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async (id) => {
    try {
      await comproxyAPI.deleteUpdate(id);
      message.success('Удалено');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      await comproxyAPI.updatePackage(id, { enabled });
      fetch();
    } catch {
      message.error('Ошибка');
    }
  };

  const columns = [
    {
      title: 'Тип', dataIndex: 'product_type', width: 120,
      render: (v) => <Tag color={v === 'COMPROXY' ? 'blue' : 'purple'}>
        {v === 'COMPROXY' ? 'ComProxy' : 'Прошивка'}
      </Tag>,
    },
    { title: 'Версия', dataIndex: 'version', width: 100 },
    { title: 'Мин. версия', dataIndex: 'version_from', width: 100, render: (v) => v || '—' },
    { title: 'Файл', dataIndex: 'filename', ellipsis: true },
    {
      title: 'Размер', dataIndex: 'file_size', width: 90,
      render: (v) => v ? `${(v / 1024 / 1024).toFixed(1)} МБ` : '—',
    },
    { title: 'Описание', dataIndex: 'info', ellipsis: true, width: 200 },
    {
      title: 'Активен', dataIndex: 'enabled', width: 80,
      render: (v, r) => <Switch size="small" checked={v} onChange={(c) => handleToggle(r.id, c)} />,
    },
    {
      title: 'Задачи', key: 'tasks', width: 160,
      render: (_, r) => {
        const s = r.tasks_summary || {};
        return (
          <Space size={4}>
            {s.pending > 0 && <Tag color="blue">{s.pending} ожид.</Tag>}
            {s.sent > 0 && <Tag color="orange">{s.sent} отпр.</Tag>}
            {s.success > 0 && <Tag color="green">{s.success} ок</Tag>}
            {s.error > 0 && <Tag color="red">{s.error} ош.</Tag>}
            {!s.pending && !s.sent && !s.success && !s.error && <Text type="secondary">—</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Дата', dataIndex: 'created_at', width: 110,
      render: (v) => v ? dayjs(v).format('DD.MM.YY HH:mm') : '—',
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_, r) => (
        <Popconfirm title="Удалить обновление?" onConfirm={() => handleDelete(r.id)}
          okText="Удалить" cancelText="Нет" okButtonProps={{ danger: true }}>
          <Button size="small" type="text" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
          Загрузить обновление
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>Обновить</Button>
      </div>

      <Table dataSource={updates} columns={columns} rowKey="id" loading={loading}
        size="small" pagination={false} />

      <UploadModal visible={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={fetch} />
    </div>
  );
}

/* ─── Вкладка «Задачи» ────────────────────────────── */

function TasksTab() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await comproxyAPI.getTasks(params);
      setTasks(data);
    } catch {
      message.error('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCancel = async (taskId) => {
    try {
      await comproxyAPI.cancelTask(taskId);
      message.success('Задача отменена');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка');
    }
  };

  const statusColors = {
    PENDING: 'blue', SENT: 'orange', SUCCESS: 'green', ERROR: 'red', CANCELLED: 'default',
  };
  const statusLabels = {
    PENDING: 'Ожидает', SENT: 'Отправлена', SUCCESS: 'Успешно', ERROR: 'Ошибка', CANCELLED: 'Отменена',
  };

  const columns = [
    {
      title: 'Устройство', key: 'device', width: 110,
      render: (_, r) => (
        <Tooltip title={r.device_uuid}>
          <Text code style={{ fontSize: 12 }}>{r.device_uuid?.slice(0, 8)}...</Text>
        </Tooltip>
      ),
    },
    { title: 'РНМ', dataIndex: 'device_registry_number', width: 180, render: (v) => v || '—' },
    {
      title: 'Тип', dataIndex: 'update_product_type', width: 100,
      render: (v) => v ? <Tag color={v === 'COMPROXY' ? 'blue' : 'purple'}>
        {v === 'COMPROXY' ? 'ComProxy' : 'Прошивка'}
      </Tag> : '—',
    },
    { title: 'Версия', dataIndex: 'update_version', width: 90, render: (v) => v || '—' },
    {
      title: 'Статус', dataIndex: 'status', width: 110,
      render: (v) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: 'Результат', dataIndex: 'result_message', ellipsis: true,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Создана', dataIndex: 'created_at', width: 130,
      render: (v) => v ? dayjs(v).format('DD.MM.YY HH:mm') : '—',
    },
    {
      title: 'Отправлена', dataIndex: 'sent_at', width: 130,
      render: (v) => v ? dayjs(v).format('DD.MM.YY HH:mm') : '—',
    },
    {
      title: 'Завершена', dataIndex: 'completed_at', width: 130,
      render: (v) => v ? dayjs(v).format('DD.MM.YY HH:mm') : '—',
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_, r) => r.status === 'PENDING' ? (
        <Popconfirm title="Отменить задачу?" onConfirm={() => handleCancel(r.task_id)}
          okText="Да" cancelText="Нет">
          <Button size="small" type="text" icon={<CloseCircleOutlined />} danger />
        </Popconfirm>
      ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Select placeholder="Фильтр по статусу" allowClear style={{ width: 180 }}
          value={statusFilter} onChange={setStatusFilter}
          options={Object.entries(statusLabels).map(([k, v]) => ({ value: k, label: v }))} />
        <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>Обновить</Button>
      </div>

      <Table dataSource={tasks} columns={columns} rowKey="id" loading={loading}
        size="small" pagination={{ pageSize: 50 }} scroll={{ x: 1200 }} />
    </div>
  );
}

/* ─── Главная страница ComProxy ────────────────────── */

export default function ComProxyDevicesPage() {
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <ApiOutlined /> ComProxy
      </Title>
      <Tabs defaultActiveKey="devices" items={[
        {
          key: 'devices',
          label: 'Устройства',
          children: <DevicesTab />,
        },
        {
          key: 'updates',
          label: 'Обновления',
          children: <UpdatesTab />,
        },
        {
          key: 'tasks',
          label: 'Задачи',
          children: <TasksTab />,
        },
      ]} />
    </div>
  );
}
