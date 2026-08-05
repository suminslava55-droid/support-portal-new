import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Tabs, Table, Select, Input, Radio, Button, Modal, Form, message, Tag,
  Typography, Space, Progress, Upload, Alert, Tooltip, Descriptions,
} from 'antd';
import {
  DesktopOutlined, PlusOutlined, ReloadOutlined, UploadOutlined,
  PlayCircleOutlined, StopOutlined, EyeOutlined, FileTextOutlined, RedoOutlined,
} from '@ant-design/icons';
import { pcMgmtAPI } from '../api';

const { Title, Text, Paragraph } = Typography;

const MODE_LABEL = { server: 'Сервер', kassa: 'Кассы', both: 'Сервер + кассы' };

const JOB_STATUS_TAG = {
  pending: <Tag>Ожидает</Tag>,
  running: <Tag color="processing">Выполняется</Tag>,
  done: <Tag color="success">Завершено</Tag>,
  cancelled: <Tag color="warning">Отменено</Tag>,
  error: <Tag color="error">Ошибка</Tag>,
};

const TARGET_STATUS_TAG = {
  pending: <Tag>Ожидает</Tag>,
  running: <Tag color="processing">Выполняется</Tag>,
  success: <Tag color="success">Успех</Tag>,
  error: <Tag color="error">Ошибка</Tag>,
  unreachable: <Tag color="orange">Недоступен</Tag>,
  skipped: <Tag>Пропущено</Tag>,
};

const TARGET_STATUS_LABEL = {
  pending: 'Ожидает',
  running: 'Выполняется',
  success: 'Успех',
  error: 'Ошибка',
  unreachable: 'Недоступен',
  skipped: 'Пропущено',
};

// Колонки таблицы целей (не зависят от состояния — на уровне модуля)
const targetColumns = [
  { title: 'Адрес', dataIndex: 'client_address', ellipsis: true },
  { title: 'Роль', dataIndex: 'role', width: 90 },
  { title: 'IP', dataIndex: 'ip', width: 130 },
  { title: 'Транспорт', dataIndex: 'transport', width: 100, render: (t) => t ? <Tag>{t}</Tag> : '—' },
  { title: 'Статус', dataIndex: 'status', width: 120, render: (s) => TARGET_STATUS_TAG[s] || s },
  { title: 'Код', dataIndex: 'exit_code', width: 70, render: (v) => (v ?? '') === '' ? '—' : v },
  { title: 'Результат', dataIndex: 'result_message',
    render: (v) => v ? <Tooltip title={<pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', margin: 0 }}>{v}</pre>}>
      <Text code style={{ cursor: 'pointer' }}>{v.split('\n')[0].slice(0, 80) || '(пусто)'}</Text></Tooltip> : '—' },
];

// ───────────────────────────────────────────────────────────────────────────
// Подсветка синтаксиса PowerShell/cmd — без внешних зависимостей
// ───────────────────────────────────────────────────────────────────────────
const CE_COLORS = { cm: '#6a737d', st: '#22863a', va: '#e36209', pa: '#6f42c1', kw: '#d73a49', nu: '#005cc5', la: '#005cc5' };
const PS_RE = /(<#[\s\S]*?#>|#[^\n]*)|("(?:[^"`]|`[\s\S])*"|'(?:[^']|'')*')|(\$(?:\{[^}]*\}|[A-Za-z_][\w:]*)|\$[$?^])|(-[A-Za-z][A-Za-z0-9]*)|\b(if|elseif|else|switch|foreach|for|while|do|function|filter|workflow|return|try|catch|finally|throw|param|begin|process|end|in|break|continue|class|enum|using|default|exit)\b|\b(\d+(?:\.\d+)?)\b/gi;
const PS_GRP = ['cm', 'st', 'va', 'pa', 'kw', 'nu'];
const CMD_RE = /(^[ \t]*(?:rem\b[^\n]*|::[^\n]*))|("[^"\n]*")|(%[^%\n]*%|%%[A-Za-z])|(\/[A-Za-z?]+)|\b(set|echo|if|else|for|goto|call|exit|do|in|not|exist|defined|errorlevel|start|pushd|popd|copy|xcopy|del|move|type|pause|setlocal|endlocal|net|sc|reg|netsh|winrm)\b|(^[ \t]*:[A-Za-z_]\w*)/gim;
const CMD_GRP = ['cm', 'st', 'va', 'pa', 'kw', 'la'];

const ceEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function ceHighlight(code, lang) {
  const re = lang === 'cmd' ? CMD_RE : PS_RE;
  const grp = lang === 'cmd' ? CMD_GRP : PS_GRP;
  re.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out += ceEsc(code.slice(last, m.index));
    let cls = 'kw';
    for (let g = 1; g <= grp.length; g++) if (m[g] != null) { cls = grp[g - 1]; break; }
    out += `<span style="color:${CE_COLORS[cls]}">${ceEsc(m[0])}</span>`;
    last = re.lastIndex;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  out += ceEsc(code.slice(last));
  return out;
}

const CE_FONT = { fontFamily: 'Consolas, "Courier New", monospace', fontSize: 13, lineHeight: '1.5', tabSize: 2 };
// Общий бокс для textarea и <pre> — размеры/шрифт/отступы должны совпадать пиксель-в-пиксель
const CE_BOX = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 10, border: 0,
  boxSizing: 'border-box', whiteSpace: 'pre', wordWrap: 'normal', overflowWrap: 'normal', ...CE_FONT,
};

// Редактор кода: прозрачная textarea поверх подсвеченного <pre>. Без переноса строк —
// длинные строки прокручиваются по горизонтали. Совместим с antd Form (value/onChange).
function CodeEditor({ value = '', onChange, language = 'powershell', placeholder = '', height = 300 }) {
  const taRef = useRef(null);
  const preRef = useRef(null);

  const sync = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  const html = useMemo(() => {
    if (!value) return `<span style="color:#bbb">${ceEsc(placeholder)}</span>`;
    return ceHighlight(value, language) + (value.endsWith('\n') ? '\n' : '');
  }, [value, language, placeholder]);

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const s = el.selectionStart, en = el.selectionEnd;
      onChange && onChange(value.slice(0, s) + '  ' + value.slice(en));
      requestAnimationFrame(() => { try { el.selectionStart = el.selectionEnd = s + 2; } catch { /* ignore */ } });
    }
  };

  return (
    <div style={{ position: 'relative', height, minHeight: 140, resize: 'vertical', overflow: 'hidden',
      border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff' }}>
      <pre ref={preRef} aria-hidden="true"
        style={{ ...CE_BOX, overflow: 'hidden', color: '#24292e', pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: html }} />
      <textarea ref={taRef} value={value} spellCheck={false} wrap="off"
        onChange={(e) => onChange && onChange(e.target.value)}
        onScroll={sync} onKeyDown={onKeyDown}
        style={{ ...CE_BOX, overflow: 'auto', resize: 'none', outline: 'none',
          background: 'transparent', color: 'transparent', caretColor: '#24292e' }} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Тело одного прогона задания + фильтр целей по статусу
// ───────────────────────────────────────────────────────────────────────────
function RunPanel({ run }) {
  const [statusFilter, setStatusFilter] = useState(undefined);
  const targets = run.targets || [];

  // Доступные статусы с количеством — только те, что реально есть в прогоне
  const statusOptions = useMemo(() => {
    const counts = {};
    targets.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.keys(counts).map((s) => ({
      value: s,
      label: `${TARGET_STATUS_LABEL[s] || s} (${counts[s]})`,
    }));
  }, [targets]);

  const filteredTargets = statusFilter
    ? targets.filter((t) => t.status === statusFilter)
    : targets;

  return (
    <>
      {run.error_message && (
        <Alert type={run.status === 'error' ? 'error' : 'warning'} showIcon
          style={{ marginBottom: 12 }} message={run.error_message} />
      )}
      <Descriptions size="small" column={3} bordered style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Статус">{JOB_STATUS_TAG[run.status]}</Descriptions.Item>
        <Descriptions.Item label="Режим">{run.target_mode_display}</Descriptions.Item>
        <Descriptions.Item label="Прогресс">{run.progress}%</Descriptions.Item>
        <Descriptions.Item label="Всего">{run.total_targets}</Descriptions.Item>
        <Descriptions.Item label="Успех">{run.ok_targets}</Descriptions.Item>
        <Descriptions.Item label="Ошибок">{run.err_targets}</Descriptions.Item>
        <Descriptions.Item label="Кем">{run.created_by_name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Создано" span={2}>{fmtDate(run.created_at)}</Descriptions.Item>
      </Descriptions>

      {run.job_type === 'run_script' ? (
        <div style={{ marginBottom: 12 }}>
          <Text strong><FileTextOutlined /> Скрипт ({run.script_kind === 'cmd' ? 'cmd' : 'PowerShell'}):</Text>
          <pre style={{ background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 6,
            maxHeight: 260, overflow: 'auto', margin: '6px 0 0', whiteSpace: 'pre',
            fontFamily: 'Consolas, "Courier New", monospace', fontSize: 13, lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: ceHighlight(run.script_text || '(пусто)', run.script_kind === 'cmd' ? 'cmd' : 'powershell') }} />
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <Text strong><FileTextOutlined /> Копирование файла:</Text>
          <div style={{ marginTop: 6 }}>
            <Tag color="blue">{run.filename || 'файл'}</Tag>
            <Text type="secondary"> → </Text>
            <Text code>{run.dest_path}</Text>
          </div>
        </div>
      )}

      <Space style={{ marginBottom: 6 }} wrap>
        <Text strong>Статус:</Text>
        <Select allowClear size="small" placeholder="Фильтр по статусу" style={{ width: 220 }}
          value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
        {statusFilter && <Text type="secondary">Показано: {filteredTargets.length}</Text>}
      </Space>
      <Table size="small" rowKey="id" columns={targetColumns} style={{ marginTop: 6 }}
        dataSource={filteredTargets} pagination={{ pageSize: 50 }} scroll={{ y: 340 }} />
    </>
  );
}

const fmtDate = (s) => (s ? new Date(s).toLocaleString('ru-RU') : '—');

// ───────────────────────────────────────────────────────────────────────────
// Вкладка «Клиенты» — выбор аптек + режим цели (хранится в родителе)
// ───────────────────────────────────────────────────────────────────────────
function ClientsTab({ selectedIds, setSelectedIds, targetMode, setTargetMode, onNewTask }) {
  const [clients, setClients] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState(undefined);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (companyFilter) params.company = companyFilter;
      if (search.trim()) params.search = search.trim();
      const { data } = await pcMgmtAPI.listClients(params);
      setClients(data);
    } catch {
      message.error('Ошибка загрузки клиентов');
    } finally {
      setLoading(false);
    }
  }, [companyFilter, search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => {
    pcMgmtAPI.companies().then(({ data }) => {
      setCompanies(Array.isArray(data) ? data : (data.results || []));
    }).catch(() => {});
  }, []);

  const columns = [
    { title: 'Адрес аптеки', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: 'Компания', dataIndex: 'company', key: 'company', width: 180, ellipsis: true },
    { title: 'IP сервера', dataIndex: 'server_ip', key: 'server_ip', width: 130,
      render: (v, r) => (r.has_subnet ? (v || '—') : <Tag color="default">нет подсети</Tag>) },
  ];

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Radio.Group value={targetMode} onChange={(e) => setTargetMode(e.target.value)} optionType="button" buttonStyle="solid">
          <Radio.Button value="server">Сервер</Radio.Button>
          <Radio.Button value="kassa">Кассы</Radio.Button>
          <Radio.Button value="both">Сервер + кассы</Radio.Button>
        </Radio.Group>
        <Select
          allowClear showSearch placeholder="Компания" style={{ minWidth: 220 }}
          value={companyFilter} onChange={setCompanyFilter}
          optionFilterProp="label"
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Input.Search placeholder="Поиск по адресу" allowClear style={{ width: 240 }}
          onSearch={setSearch} onChange={(e) => !e.target.value && setSearch('')} />
        <Button icon={<ReloadOutlined />} onClick={fetchClients}>Обновить</Button>
      </Space>

      <Space style={{ marginBottom: 8 }} wrap>
        {selectedIds.length > 0 && (
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onNewTask}>
            Новое задание ({selectedIds.length})
          </Button>
        )}
        <Button size="small" type="primary" ghost
          onClick={() => setSelectedIds(clients.map((c) => c.id))}>
          Выбрать всех ({clients.length})
        </Button>
        <Button size="small" disabled={!selectedIds.length}
          onClick={() => setSelectedIds([])}>Снять выделение</Button>
        <Text strong>Выбрано: {selectedIds.length}</Text>
        <Text type="secondary">· режим «{MODE_LABEL[targetMode]}»</Text>
      </Space>

      <Table
        size="small"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={clients}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: setSelectedIds,
          preserveSelectedRowKeys: true,
          selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
        }}
        pagination={{
          defaultPageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['50', '100', '200', '500'],
          showTotal: (total) => `Всего: ${total}`,
        }}
        scroll={{ y: 460 }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Вкладка «Задания» — запуск + история + live-статус + drill-in
// ───────────────────────────────────────────────────────────────────────────
function TasksTab({ selectedIds, targetMode, openCreateSignal }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const jobType = Form.useWatch('job_type', form) || 'run_script';
  const scriptKind = Form.useWatch('script_kind', form) || 'powershell';
  const [file, setFile] = useState(null);
  const [detail, setDetail] = useState(null);
  const pollRef = useRef(null);

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await pcMgmtAPI.listJobs();
      setJobs(data);
      return data;
    } catch {
      message.error('Ошибка загрузки заданий');
      return [];
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJobs().finally(() => setLoading(false));
  }, [fetchJobs]);

  // Автообновление списка пока есть активные задания
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'running' || j.status === 'pending');
    if (!hasActive) return;
    const t = setInterval(fetchJobs, 2500);
    return () => clearInterval(t);
  }, [jobs, fetchJobs]);

  // Открытие формы создания по сигналу с вкладки «Клиенты»
  useEffect(() => {
    if (openCreateSignal) { setFile(null); setOpen(true); }
  }, [openCreateSignal]);

  // Загрузка скрипта из файла в поле ввода
  const loadScriptFromFile = async (f) => {
    try {
      const text = await f.text();
      const lower = f.name.toLowerCase();
      const kind = (lower.endsWith('.cmd') || lower.endsWith('.bat')) ? 'cmd' : 'powershell';
      form.setFieldsValue({ script_text: text, script_kind: kind });
      message.success(`Загружено из ${f.name}`);
    } catch {
      message.error('Не удалось прочитать файл');
    }
    return false;
  };

  const submit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    if (values.job_type === 'copy_file' && !file) {
      message.error('Загрузите файл'); return;
    }
    Modal.confirm({
      title: 'Запустить задание?',
      content: `Будет выполнено на ${selectedIds.length} аптеках в режиме «${MODE_LABEL[targetMode]}». Точное число ПК определится при запуске (кассы опрашиваются онлайн).`,
      okText: 'Запустить', cancelText: 'Отмена',
      onOk: async () => {
        setSubmitting(true);
        try {
          const fd = new FormData();
          fd.append('name', (values.name || '').trim());
          fd.append('job_type', values.job_type);
          fd.append('target_mode', targetMode);
          fd.append('client_ids', JSON.stringify(selectedIds));
          if (values.job_type === 'run_script') {
            fd.append('script_kind', values.script_kind);
            fd.append('script_text', values.script_text);
          } else {
            fd.append('file', file);
            fd.append('dest_path', values.dest_path);
          }
          await pcMgmtAPI.createJob(fd);
          message.success('Задание запущено');
          setOpen(false);
          form.resetFields();
          setFile(null);
          fetchJobs();
        } catch (e) {
          message.error(e?.response?.data?.error || 'Ошибка запуска');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const openDetail = async (id) => {
    const load = async () => {
      try {
        const { data } = await pcMgmtAPI.getJob(id);
        setDetail(data);
        if (data.status === 'running' || data.status === 'pending') {
          pollRef.current = setTimeout(load, 2000);
        }
      } catch {}
    };
    await load();
  };

  const closeDetail = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
    setDetail(null);
  };

  const cancelJob = async (id) => {
    try { await pcMgmtAPI.cancelJob(id); message.success('Запрошена отмена'); fetchJobs(); }
    catch { message.error('Ошибка'); }
  };

  const repeatJob = (job) => {
    Modal.confirm({
      title: `Повторить задание #${job.id}?`,
      content: `Новый запуск с теми же параметрами (${job.job_type_display}, режим «${MODE_LABEL[job.target_mode] || job.target_mode_display}»). На ПК, где уже выполнено успешно, повторно не запустится; кассы опрашиваются заново — недоступные ранее будут добавлены, если появился IP.`,
      okText: 'Повторить', cancelText: 'Отмена',
      onOk: async () => {
        try {
          await pcMgmtAPI.repeatJob(job.id);
          message.success('Задание запущено повторно');
          closeDetail();
          fetchJobs();
        } catch {
          message.error('Ошибка повторного запуска');
        }
      },
    });
  };

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Название', dataIndex: 'name', width: 220, ellipsis: true,
      render: (v) => v ? <Text strong>{v}</Text> : <Text type="secondary">—</Text> },
    { title: 'Тип', dataIndex: 'job_type_display', width: 150 },
    { title: 'Режим', dataIndex: 'target_mode_display', width: 130 },
    { title: 'Статус', dataIndex: 'status', width: 130, render: (s) => JOB_STATUS_TAG[s] || s },
    { title: 'Прогресс', dataIndex: 'progress', width: 170,
      render: (p, r) => <Progress percent={p} size="small" status={r.status === 'error' ? 'exception' : (r.status === 'running' ? 'active' : 'normal')} /> },
    { title: 'Успех/Ошибки', key: 'oe', width: 130,
      render: (_, r) => <span><Text type="success">{r.ok_targets}</Text> / <Text type="danger">{r.err_targets}</Text> из {r.total_targets}</span> },
    { title: 'Кем', dataIndex: 'created_by_name', width: 150, ellipsis: true },
    { title: 'Создано', dataIndex: 'created_at', width: 160, render: fmtDate },
    { title: '', key: 'act', width: 240, fixed: 'right', render: (_, r) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>Подробно</Button>
        {(r.status === 'running' || r.status === 'pending') ? (
          <Tooltip title="Отменить"><Button size="small" danger icon={<StopOutlined />} onClick={() => cancelJob(r.id)} /></Tooltip>
        ) : (
          <Tooltip title="Повторить"><Button size="small" icon={<RedoOutlined />} onClick={() => repeatJob(r)} /></Tooltip>
        )}
      </Space>
    ) },
  ];

  return (
    <div>
      <Alert
        style={{ marginBottom: 12 }}
        type={selectedIds.length ? 'info' : 'warning'}
        showIcon
        message={selectedIds.length
          ? `Выбрано ${selectedIds.length} клиентов · режим «${MODE_LABEL[targetMode]}»`
          : 'Не выбрано ни одного клиента — перейдите на вкладку «Клиенты»'}
      />
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} disabled={!selectedIds.length}
          onClick={() => { setFile(null); setOpen(true); }}>Добавить задание</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchJobs}>Обновить</Button>
      </Space>

      <Table size="small" rowKey="id" loading={loading} columns={columns} dataSource={jobs}
        pagination={{ pageSize: 20 }} scroll={{ x: 1370 }} />

      {/* Модалка создания */}
      <Modal
        title="Новое задание"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Запустить"
        okButtonProps={{ loading: submitting, icon: <PlayCircleOutlined /> }}
        width={900}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ job_type: 'run_script', script_kind: 'powershell' }}>
          <Form.Item name="name" label="Название задания">
            <Input placeholder="Напр. «Открыть порты SMB/WinRM на кассах»" maxLength={200} allowClear />
          </Form.Item>
          <Form.Item name="job_type" label="Тип задания">
            <Select options={[
              { value: 'run_script', label: 'Выполнить скрипт' },
              { value: 'copy_file', label: 'Скопировать файл' },
            ]} />
          </Form.Item>

          {jobType === 'run_script' ? (
            <>
              <Form.Item name="script_kind" label="Вид скрипта">
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value="powershell">PowerShell</Radio.Button>
                  <Radio.Button value="cmd">cmd</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                label={
                  <Space>
                    <span>Текст скрипта</span>
                    <Upload accept=".ps1,.cmd,.bat,.txt" showUploadList={false}
                      beforeUpload={loadScriptFromFile}>
                      <Button size="small" icon={<UploadOutlined />}>Загрузить из файла</Button>
                    </Upload>
                  </Space>
                }
                required
              >
                <Form.Item name="script_text" noStyle
                  rules={[{ required: true, message: 'Введите скрипт или загрузите из файла' }]}>
                  <CodeEditor language={scriptKind} placeholder="hostname" />
                </Form.Item>
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item label="Файл" required>
                <Upload beforeUpload={(f) => { setFile(f); return false; }}
                  maxCount={1} fileList={file ? [file] : []}
                  onRemove={() => setFile(null)}>
                  <Button icon={<UploadOutlined />}>Выбрать файл</Button>
                </Upload>
              </Form.Item>
              <Form.Item name="dest_path" label="Путь назначения на ПК"
                rules={[{ required: true, message: 'Укажите путь' }]}>
                <Input placeholder="C:\Temp\" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Модалка «Подробно» — параметры задания + цели */}
      <Modal
        title={detail ? `Задание #${detail.id}${detail.name ? ` — ${detail.name}` : ''} — ${detail.job_type_display}` : ''}
        open={!!detail}
        onCancel={closeDetail}
        footer={detail ? [
          (detail.status === 'running' || detail.status === 'pending')
            ? <Button key="x" danger icon={<StopOutlined />} onClick={() => cancelJob(detail.id)}>Отменить</Button>
            : <Button key="r" type="primary" icon={<RedoOutlined />} onClick={() => repeatJob(detail)}>Повторить</Button>,
          <Button key="c" onClick={closeDetail}>Закрыть</Button>,
        ] : null}
        width={1000}
      >
        {detail && (() => {
          const runs = (detail.runs && detail.runs.length) ? detail.runs : [detail];
          if (runs.length <= 1) return <RunPanel run={runs[0]} />;
          const activeKey = String(detail.current_run_id ?? runs[runs.length - 1].id);
          return (
            <Tabs
              defaultActiveKey={activeKey}
              items={runs.map((r, i) => ({
                key: String(r.id),
                label: (
                  <span>
                    Прогон {i + 1}{' '}
                    {r.err_targets > 0
                      ? <Tag color="error" style={{ marginInlineEnd: 0 }}>{r.ok_targets}/{r.total_targets}</Tag>
                      : <Tag color="success" style={{ marginInlineEnd: 0 }}>{r.ok_targets}/{r.total_targets}</Tag>}
                  </span>
                ),
                children: <RunPanel run={r} />,
              }))}
            />
          );
        })()}
      </Modal>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
export default function PcManagementPage() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [targetMode, setTargetMode] = useState('server');
  const [activeTab, setActiveTab] = useState('clients');
  const [createSignal, setCreateSignal] = useState(0);

  // С вкладки «Клиенты»: перейти на «Задания» и сразу открыть форму создания
  const goCreateTask = () => {
    setActiveTab('tasks');
    setCreateSignal((n) => n + 1);
  };

  const items = [
    {
      key: 'clients', label: 'Клиенты',
      children: <ClientsTab selectedIds={selectedIds} setSelectedIds={setSelectedIds}
        targetMode={targetMode} setTargetMode={setTargetMode} onNewTask={goCreateTask} />,
    },
    {
      key: 'tasks', label: 'Задания',
      children: <TasksTab selectedIds={selectedIds} targetMode={targetMode} openCreateSignal={createSignal} />,
    },
  ];

  return (
    <div>
      <Title level={3}><DesktopOutlined /> Управление ПК аптек</Title>
      <Paragraph type="secondary">
        Удалённое выполнение PowerShell/cmd-скриптов и копирование файлов на серверы и кассы аптек.
      </Paragraph>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </div>
  );
}
