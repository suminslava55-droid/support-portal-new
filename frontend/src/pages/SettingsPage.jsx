import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Form, Input, Button, Typography, message, Spin,
  Popconfirm, Space, Switch, InputNumber, Divider, Modal,
  Progress, Table, Tag, Alert, Tabs, Statistic, Row, Col,
  Checkbox, Select, TimePicker, Badge, Tooltip, Descriptions
} from 'antd';
import {
  SaveOutlined, EyeInvisibleOutlined, EyeTwoTone,
  SettingOutlined, DeleteOutlined, MailOutlined, SendOutlined,
  CheckCircleFilled, CloseCircleFilled, ReloadOutlined,
  UploadOutlined, RobotOutlined, FileTextOutlined,
  CheckOutlined, WarningOutlined, StopOutlined, InfoCircleOutlined,
  PlayCircleOutlined, ClockCircleOutlined, CalendarOutlined,
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
  MinusCircleOutlined
} from '@ant-design/icons';
import { settingsAPI } from '../api';
import api from '../api/axios';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [sshForm] = Form.useForm();
  const [smtpForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [savingSsh, setSavingSsh] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [hasSSHPassword, setHasSSHPassword] = useState(false);
  const [hasSMTPPassword, setHasSMTPPassword] = useState(false);
  const [useSsl, setUseSsl] = useState(true);
  const [useTls, setUseTls] = useState(false);
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [packages, setPackages] = useState(null);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Массовый импорт
  const [importModal, setImportModal]             = useState(false);
  const [importFile, setImportFile]               = useState(null);
  const [importFileName, setImportFileName]       = useState('');
  const [importing, setImporting]                 = useState(false);
  const [importProgress, setImportProgress]       = useState(0);
  const [importProgressText, setImportProgressText] = useState('');
  const [importReport, setImportReport]           = useState(null);
  const [reportModal, setReportModal]             = useState(false);
  const fileInputRef = useRef(null);

  // Регламентные задания
  const [tasks, setTasks]                   = useState([]);
  const [tasksLoading, setTasksLoading]     = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [applyingCron, setApplyingCron]     = useState(false);
  const [cronLine, setCronLine]             = useState({});      // {task_id: 'cron string'}
  const [scheduleLocal, setScheduleLocal]   = useState({});      // локальные значения до сохранения
  const [runModal, setRunModal]             = useState(false);
  const [runScope, setRunScope]             = useState(null); // 'all' | 'company'
  const [companies, setCompanies]           = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [polling, setPolling]               = useState(false);
  const pollRef                             = useRef(null);
  const [taskResult, setTaskResult]         = useState(null);
  const [resultModal, setResultModal]       = useState(false);
  const DAYS_OPTIONS = [
    { label: 'Пн', value: 0 }, { label: 'Вт', value: 1 },
    { label: 'Ср', value: 2 }, { label: 'Чт', value: 3 },
    { label: 'Пт', value: 4 }, { label: 'Сб', value: 5 },
    { label: 'Вс', value: 6 },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await settingsAPI.get();
        sshForm.setFieldsValue({ ssh_user: data.ssh_user });
        setHasSSHPassword(data.has_ssh_password);
        smtpForm.setFieldsValue({
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port || 465,
          smtp_user: data.smtp_user,
          smtp_from_email: data.smtp_from_email,
          smtp_from_name: data.smtp_from_name,
          smtp_use_ssl: data.smtp_use_ssl,
          smtp_use_tls: data.smtp_use_tls,
        });
        setHasSMTPPassword(data.has_smtp_password);
        setUseSsl(data.smtp_use_ssl);
        setUseTls(data.smtp_use_tls);
      } catch {
        message.error('Ошибка загрузки настроек');
      } finally {
        setLoading(false);
      }
    };
    load();
    loadPackages();
  }, [sshForm, smtpForm]);

  const loadPackages = async () => {
    setPackagesLoading(true);
    try {
      const { data } = await settingsAPI.checkPackages();
      setPackages(data);
    } catch {
      message.error('Не удалось проверить пакеты');
    } finally {
      setPackagesLoading(false);
    }
  };

  // ─── Регламентные задания ───────────────────────────────
  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const { data } = await api.get('/clients/scheduled-tasks/');
      setTasks(data);
      // Инициализируем локальные значения расписания
      const local = {};
      data.forEach(t => {
        local[t.task_id] = {
          enabled:       t.enabled,
          schedule_time: t.schedule_time,
          schedule_days: (t.schedule_days || '').split(',').filter(Boolean).map(Number),
        };
      });
      setScheduleLocal(local);
      // Читаем текущие cron-строки
      for (const t of data) {
        try {
          const { data: cronData } = await api.get(`/clients/scheduled-tasks/cron/?task_id=${t.task_id}`);
          setCronLine(prev => ({ ...prev, [t.task_id]: cronData.cron_line }));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setTasksLoading(false); }
  };

  useEffect(() => { loadTasks(); }, []); // eslint-disable-line

  const patchLocal = (task_id, patch) => {
    setScheduleLocal(prev => ({ ...prev, [task_id]: { ...(prev[task_id] || {}), ...patch } }));
  };

  const handleApplyCron = async (task_id) => {
    const local = scheduleLocal[task_id] || {};
    if (local.enabled && !local.schedule_time) {
      message.warning('Укажите время запуска');
      return;
    }
    if (local.enabled && (!local.schedule_days || local.schedule_days.length === 0)) {
      message.warning('Выберите хотя бы один день недели');
      return;
    }
    setApplyingCron(true);
    try {
      const { data } = await api.post('/clients/scheduled-tasks/cron/', {
        task_id,
        enabled:       local.enabled,
        schedule_time: local.schedule_time,
        schedule_days: local.schedule_days,
      });
      message.success(data.message);
      await loadTasks();
    } catch (e) {
      const err = e.response?.data?.error || 'Ошибка применения расписания';
      message.error(err);
    } finally {
      setApplyingCron(false);
    }
  };

  const startPolling = (task_id) => {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/clients/scheduled-tasks/${task_id}/progress/`);
        setTasks(prev => prev.map(t => t.task_id === task_id ? { ...t, ...data } : t));
        if (data.status !== 'running') {
          clearInterval(pollRef.current);
          setPolling(false);
          setTaskResult(data);
          setResultModal(true);
          loadTasks();
        }
      } catch { clearInterval(pollRef.current); setPolling(false); }
    }, 2000);
  };

  const handleRunTask = async () => {
    const payload = { task_id: 'update_rnm' };
    if (runScope === 'company') {
      if (!selectedCompany) { message.warning('Выберите компанию'); return; }
      payload.company_id = selectedCompany;
    }
    try {
      await api.post('/clients/scheduled-tasks/run/', payload);
      setRunModal(false);
      setRunScope(null);
      setSelectedCompany(null);
      await loadTasks();
      startPolling('update_rnm');
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка запуска');
    }
  };

  const openRunModal = async () => {
    // Загружаем список компаний для выбора
    try {
      const { data } = await api.get('/clients/ofd-companies/');
      setCompanies(Array.isArray(data) ? data : (data.results || []));
    } catch { setCompanies([]); }
    setRunScope(null);
    setSelectedCompany(null);
    setRunModal(true);
  };

  const handleClearSsh = async () => {
    try {
      await settingsAPI.clear('ssh');
      setHasSSHPassword(false);
      sshForm.setFieldsValue({ ssh_user: '', ssh_password: '' });
      message.success('SSH данные очищены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка очистки');
    }
  };

  const handleClearSmtp = async () => {
    try {
      await settingsAPI.clear('smtp');
      setHasSMTPPassword(false);
      setUseSsl(true);
      setUseTls(false);
      smtpForm.resetFields();
      smtpForm.setFieldsValue({ smtp_port: 465, smtp_use_ssl: true, smtp_use_tls: false });
      message.success('SMTP данные очищены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка очистки');
    }
  };

  const onSaveSsh = async (values) => {
    setSavingSsh(true);
    try {
      const { data } = await settingsAPI.save({ ...values, section: 'ssh' });
      setHasSSHPassword(data.has_ssh_password);
      sshForm.setFieldsValue({ ssh_password: '' });
      message.success('SSH настройки сохранены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingSsh(false);
    }
  };

  const onSaveSmtp = async (values) => {
    setSavingSmtp(true);
    try {
      const { data } = await settingsAPI.save({ ...values, section: 'smtp' });
      setHasSMTPPassword(data.has_smtp_password);
      smtpForm.setFieldsValue({ smtp_password: '' });
      message.success('SMTP настройки сохранены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) { message.warning('Введите email'); return; }
    setSendingTest(true);
    try {
      const { data } = await settingsAPI.testEmail(testEmail.trim());
      message.success(data.message);
      setTestEmailModal(false);
      setTestEmail('');
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка отправки');
    } finally {
      setSendingTest(false);
    }
  };

  // Авто-переключение SSL/TLS — включить одно, выключить другое
  const handleSslChange = (val) => {
    setUseSsl(val);
    if (val) { setUseTls(false); smtpForm.setFieldsValue({ smtp_use_tls: false, smtp_port: 465 }); }
    smtpForm.setFieldsValue({ smtp_use_ssl: val });
  };
  const handleTlsChange = (val) => {
    setUseTls(val);
    if (val) { setUseSsl(false); smtpForm.setFieldsValue({ smtp_use_ssl: false, smtp_port: 587 }); }
    smtpForm.setFieldsValue({ smtp_use_tls: val });
  };

  // ─── Массовый импорт ───────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportFileName(file.name);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importFile) { message.warning('Выберите файл'); return; }
    setImporting(true);
    setImportProgress(10);
    setImportProgressText('Читаем файл...');
    try {
      const text = await importFile.text();
      setImportProgress(25);
      setImportProgressText('Разбираем JSON...');

      let clients;
      try {
        const parsed = JSON.parse(text);
        clients = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // файл может быть без [] — попробуем обернуть
        try {
          clients = JSON.parse('[' + text.replace(/,\s*$/, '') + ']');
        } catch {
          message.error('Не удалось разобрать JSON файл');
          setImporting(false);
          setImportProgress(0);
          return;
        }
      }

      setImportProgress(50);
      setImportProgressText(`Отправляем ${clients.length} записей на сервер...`);

      const { data } = await api.post('/clients/bulk-import/', { clients });

      setImportProgress(100);
      setImportProgressText('Готово!');
      setImportReport(data);

      setTimeout(() => {
        setImporting(false);
        setImportModal(false);
        setImportFile(null);
        setImportFileName('');
        setImportProgress(0);
        setImportProgressText('');
        setReportModal(true);
      }, 600);

    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка импорта');
      setImporting(false);
      setImportProgress(0);
      setImportProgressText('');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <SettingOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>Настройки системы</Title>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>

        {/* ===== ПАКЕТЫ ===== */}
        <Card
          title={<Space><SettingOutlined style={{ color: '#1677ff' }} /><span>Зависимости Python</span></Space>}
          extra={
            <Button
              size="small"
              icon={<ReloadOutlined spin={packagesLoading} />}
              onClick={loadPackages}
              loading={packagesLoading}
            >
              Проверить
            </Button>
          }
        >
          {packagesLoading && !packages ? (
            <Spin size="small" />
          ) : packages ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'cryptography', label: 'cryptography', desc: 'Шифрование паролей' },
                { key: 'paramiko', label: 'paramiko', desc: 'SSH-подключение к Микротику' },
                { key: 'openpyxl', label: 'openpyxl', desc: 'Экспорт в Excel (.xlsx)' },
              ].map(({ key, label, desc }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {packages[key]
                    ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
                    : <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 18 }} />}
                  <span style={{ fontWeight: 500, minWidth: 120 }}>{label}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>
                  {!packages[key] && (
                    <Text type="danger" style={{ fontSize: 12, marginLeft: 'auto' }}>
                      pip install {key}
                    </Text>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Text type="secondary">Нажмите «Проверить»</Text>
          )}
        </Card>

        {/* ===== SSH ===== */}
        <Form form={sshForm} layout="vertical" onFinish={onSaveSsh}>
          <Card title="Подключение к Микротику по SSH">
            <Form.Item name="ssh_user" label="SSH пользователь">
              <Input placeholder="admin" />
            </Form.Item>
            <Form.Item
              name="ssh_password"
              label={
                <span>
                  SSH пароль{' '}
                  {hasSSHPassword && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      (задан — введите новый чтобы изменить)
                    </Text>
                  )}
                </span>
              }
            >
              <Input.Password
                placeholder={hasSSHPassword ? '••••••••' : 'Введите пароль'}
                iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={savingSsh} icon={<SaveOutlined />}>
                Сохранить
              </Button>
              <Popconfirm
                title="Очистить SSH данные?"
                description="Логин и пароль будут удалены из базы данных"
                onConfirm={handleClearSsh}
                okText="Очистить" okType="danger" cancelText="Отмена"
              >
                <Button danger icon={<DeleteOutlined />}>Очистить</Button>
              </Popconfirm>
            </Space>
          </Card>
        </Form>

        {/* ===== SMTP ===== */}
        <Form form={smtpForm} layout="vertical" onFinish={onSaveSmtp}>
          <Card
            title={<Space><MailOutlined style={{ color: '#1677ff' }} /><span>Настройки Email (SMTP)</span></Space>}
            extra={
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => setTestEmailModal(true)}
              >
                Тест отправки
              </Button>
            }
          >
            <Form.Item name="smtp_host" label="SMTP сервер">
              <Input placeholder="smtp.gmail.com  /  smtp.yandex.ru  /  smtp.mail.ru" />
            </Form.Item>

            <Space style={{ width: '100%' }} align="start">
              <Form.Item name="smtp_port" label="Порт" style={{ width: 120 }}>
                <InputNumber style={{ width: '100%' }} min={1} max={65535} />
              </Form.Item>
              <Form.Item label="SSL (порт 465)" style={{ marginLeft: 16 }}>
                <Switch
                  checked={useSsl}
                  onChange={handleSslChange}
                  checkedChildren="Вкл"
                  unCheckedChildren="Выкл"
                />
              </Form.Item>
              <Form.Item label="TLS / STARTTLS (порт 587)">
                <Switch
                  checked={useTls}
                  onChange={handleTlsChange}
                  checkedChildren="Вкл"
                  unCheckedChildren="Выкл"
                />
              </Form.Item>
            </Space>
            <Form.Item name="smtp_use_ssl" hidden><Input /></Form.Item>
            <Form.Item name="smtp_use_tls" hidden><Input /></Form.Item>

            <Divider style={{ margin: '4px 0 16px' }} />

            <Form.Item name="smtp_user" label="Логин (обычно совпадает с email отправителя)">
              <Input placeholder="noreply@mycompany.ru" />
            </Form.Item>
            <Form.Item
              name="smtp_password"
              label={
                <span>
                  Пароль{' '}
                  {hasSMTPPassword && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      (задан — введите новый чтобы изменить)
                    </Text>
                  )}
                </span>
              }
            >
              <Input.Password
                placeholder={hasSMTPPassword ? '••••••••' : 'Введите пароль'}
                iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Divider style={{ margin: '4px 0 16px' }} />

            <Form.Item name="smtp_from_email" label='Email отправителя (поле "From")'>
              <Input placeholder="noreply@mycompany.ru" />
            </Form.Item>
            <Form.Item name="smtp_from_name" label='Имя отправителя (поле "From name")'>
              <Input placeholder="Support Portal" />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={savingSmtp} icon={<SaveOutlined />}>
                Сохранить
              </Button>
              <Popconfirm
                title="Очистить SMTP данные?"
                description="Все SMTP настройки будут удалены"
                onConfirm={handleClearSmtp}
                okText="Очистить" okType="danger" cancelText="Отмена"
              >
                <Button danger icon={<DeleteOutlined />}>Очистить</Button>
              </Popconfirm>
            </Space>
          </Card>
        </Form>

        {/* ===== АВТОМАТИЗАЦИЯ ===== */}
        <Card title={<Space><RobotOutlined style={{ color: '#1677ff' }} /><span>Автоматизация</span></Space>}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Массовая загрузка клиентов</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                Импорт клиентов из JSON-файла. Поддерживается загрузка тысяч записей за один раз.
              </div>
              <Space>
                <Button
                  icon={<UploadOutlined />}
                  type="primary"
                  onClick={() => { setImportModal(true); setImportFile(null); setImportFileName(''); }}
                >
                  Массовая загрузка клиентов
                </Button>
                {importReport && (
                  <Button
                    icon={<FileTextOutlined />}
                    onClick={() => setReportModal(true)}
                  >
                    Последний отчёт
                  </Button>
                )}
              </Space>
            </div>
          </Space>
        </Card>

        {/* ===== РЕГЛАМЕНТНЫЕ ЗАДАНИЯ ===== */}
        <Card
          title={<Space><CalendarOutlined style={{ color: '#1677ff' }} /><span>Регламентные задания</span></Space>}
          loading={tasksLoading}
        >
          {tasks.map(task => {
            const isRunning = task.status === 'running';
            const dayList   = (task.schedule_days || '').split(',').filter(Boolean).map(Number);

            const statusIcon = {
              idle:    <MinusCircleOutlined style={{ color: '#bbb' }} />,
              running: <SyncOutlined spin style={{ color: '#1677ff' }} />,
              success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
              error:   <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
            }[task.status] || null;

            const statusColor = { idle: 'default', running: 'processing', success: 'success', error: 'error' }[task.status];
            const statusLabel = { idle: 'Ожидает', running: 'Выполняется', success: 'Успешно', error: 'Ошибка' }[task.status];

            return (
              <div key={task.task_id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Заголовок задания */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    {statusIcon}
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{task.name}</span>
                    <Badge status={statusColor} text={statusLabel} />
                  </Space>
                  <Space>
                    <Tooltip title={isRunning ? 'Задание выполняется' : 'Запустить вручную'}>
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        disabled={isRunning}
                        loading={isRunning && polling}
                        onClick={openRunModal}
                      >
                        Запустить
                      </Button>
                    </Tooltip>
                    {task.last_run_result && (
                      <Tooltip title="Результат последнего запуска">
                        <Button icon={<FileTextOutlined />} onClick={() => { setTaskResult(task); setResultModal(true); }}>
                          Результат
                        </Button>
                      </Tooltip>
                    )}
                  </Space>
                </div>

                {/* Прогресс — показываем только во время выполнения */}
                {isRunning && (
                  <div>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{task.progress_text || 'Выполняется...'}</div>
                    <Progress
                      percent={task.progress}
                      status="active"
                      strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                    />
                  </div>
                )}

                {/* Последний запуск */}
                {task.last_run_at && (
                  <div style={{ fontSize: 12, color: '#888' }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    Последний запуск: {new Date(task.last_run_at).toLocaleString('ru-RU')}
                  </div>
                )}

                <Divider style={{ margin: '4px 0' }} />

                {/* Настройки расписания */}
                {(() => {
                  const loc = scheduleLocal[task.task_id] || {};
                  const currentCron = cronLine[task.task_id];
                  return (
                    <div style={{ background: '#fafafa', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontWeight: 500, marginBottom: 12 }}>
                        <CalendarOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                        Расписание
                      </div>

                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {/* Включить/выключить */}
                        <Space>
                          <Switch
                            checked={!!loc.enabled}
                            onChange={val => patchLocal(task.task_id, { enabled: val })}
                            checkedChildren="Вкл"
                            unCheckedChildren="Выкл"
                          />
                          <span style={{ fontSize: 13 }}>
                            {loc.enabled ? 'Запускать по расписанию' : 'Только ручной запуск'}
                          </span>
                        </Space>

                        {loc.enabled && (
                          <Space wrap size={16} align="start">
                            {/* Время */}
                            <div>
                              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Время запуска</div>
                              <Input
                                style={{ width: 100 }}
                                placeholder="03:00"
                                value={loc.schedule_time || ''}
                                onChange={e => patchLocal(task.task_id, { schedule_time: e.target.value })}
                                maxLength={5}
                              />
                            </div>

                            {/* Дни недели */}
                            <div>
                              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Дни недели</div>
                              <Checkbox.Group
                                options={DAYS_OPTIONS}
                                value={loc.schedule_days || []}
                                onChange={val => patchLocal(task.task_id, { schedule_days: val })}
                              />
                            </div>
                          </Space>
                        )}

                        {/* Текущая cron-строка */}
                        {currentCron && (
                          <div style={{ fontSize: 12, color: '#888' }}>
                            <span style={{ marginRight: 6 }}>Активная cron-строка:</span>
                            <code style={{
                              background: '#f0f0f0', padding: '2px 8px',
                              borderRadius: 4, fontFamily: 'monospace',
                            }}>
                              {currentCron.split('#')[0].trim()}
                            </code>
                          </div>
                        )}

                        {/* Кнопка применить */}
                        <Button
                          type="primary"
                          icon={<CalendarOutlined />}
                          loading={applyingCron}
                          onClick={() => handleApplyCron(task.task_id)}
                        >
                          Применить расписание
                        </Button>

                        <div style={{ fontSize: 12, color: '#aaa' }}>
                          Изменения применяются к crontab сервера. Перед применением убедитесь что выполнен <code>python3 setup_scheduler.py</code>
                        </div>
                      </Space>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </Card>

      </div>

      {/* ─── Модал: запуск задания ─── */}
      <Modal
        title={<Space><PlayCircleOutlined />Запуск: Обновление данных по РНМ</Space>}
        open={runModal}
        onCancel={() => { setRunModal(false); setRunScope(null); setSelectedCompany(null); }}
        onOk={handleRunTask}
        okText="Запустить"
        cancelText="Отмена"
        okButtonProps={{ icon: <PlayCircleOutlined />, disabled: runScope === 'company' && !selectedCompany }}
        width={460}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Выберите область обновления:</div>

          <div
            onClick={() => setRunScope('all')}
            style={{
              border: `2px solid ${runScope === 'all' ? '#1677ff' : '#d9d9d9'}`,
              borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
              background: runScope === 'all' ? '#e6f4ff' : '#fafafa',
              transition: 'all .15s',
            }}
          >
            <Space>
              {runScope === 'all'
                ? <CheckCircleFilled style={{ color: '#1677ff', fontSize: 18 }} />
                : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #d9d9d9' }} />
              }
              <div>
                <div style={{ fontWeight: 500 }}>Все клиенты</div>
                <div style={{ fontSize: 12, color: '#888' }}>Обновить ККТ по РНМ у всех клиентов с привязанной компанией</div>
              </div>
            </Space>
          </div>

          <div
            onClick={() => setRunScope('company')}
            style={{
              border: `2px solid ${runScope === 'company' ? '#1677ff' : '#d9d9d9'}`,
              borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
              background: runScope === 'company' ? '#e6f4ff' : '#fafafa',
              transition: 'all .15s',
            }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space>
                {runScope === 'company'
                  ? <CheckCircleFilled style={{ color: '#1677ff', fontSize: 18 }} />
                  : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #d9d9d9' }} />
                }
                <div>
                  <div style={{ fontWeight: 500 }}>Отдельная компания</div>
                  <div style={{ fontSize: 12, color: '#888' }}>Только клиенты с выбранной компанией ОФД</div>
                </div>
              </Space>
              {runScope === 'company' && (
                <Select
                  style={{ width: '100%' }}
                  placeholder="Выберите компанию..."
                  showSearch
                  optionFilterProp="label"
                  value={selectedCompany}
                  onChange={val => setSelectedCompany(val)}
                  options={companies.map(c => ({ value: c.id, label: `${c.name} (ИНН: ${c.inn})` }))}
                  onClick={e => e.stopPropagation()}
                />
              )}
            </Space>
          </div>
        </div>
      </Modal>

      {/* ─── Модал: результат задания ─── */}
      <Modal
        title={<Space><FileTextOutlined />Результат выполнения</Space>}
        open={resultModal}
        onCancel={() => setResultModal(false)}
        footer={<Button onClick={() => setResultModal(false)}>Закрыть</Button>}
        width={560}
      >
        {taskResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Space>
              <Badge
                status={{ idle: 'default', running: 'processing', success: 'success', error: 'error' }[taskResult.status]}
                text={{ idle: 'Ожидает', running: 'Выполняется', success: 'Успешно', error: 'Ошибка' }[taskResult.status]}
              />
              {taskResult.last_run_at && (
                <span style={{ fontSize: 12, color: '#888' }}>
                  {new Date(taskResult.last_run_at).toLocaleString('ru-RU')}
                </span>
              )}
            </Space>
            <div style={{
              background: '#f5f5f5', borderRadius: 6,
              padding: '12px 14px', fontSize: 13,
              whiteSpace: 'pre-wrap', maxHeight: 340, overflowY: 'auto',
              fontFamily: 'monospace',
            }}>
              {taskResult.last_run_result || 'Нет данных'}
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Модал: выбор файла и импорт ─── */}
      <Modal
        title={<Space><UploadOutlined />Массовая загрузка клиентов</Space>}
        open={importModal}
        onCancel={() => { if (!importing) { setImportModal(false); setImportFile(null); setImportFileName(''); setImportProgress(0); } }}
        footer={null}
        width={500}
        closable={!importing}
        maskClosable={!importing}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            icon={<InfoCircleOutlined />}
            showIcon
            message="Формат файла"
            description={
              <div style={{ fontSize: 12 }}>
                JSON-массив объектов с полями: <b>id_pharm</b>, <b>address_pharm_zabbix</b>, <b>ip_pharm_ad</b>, <b>pharmacy_id</b>, <b>mail</b>, <b>organization_inn</b>, <b>telephone_number</b>, <b>cashbox[].kkt_reg_id</b>
              </div>
            }
          />

          {/* Скрытый file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <div
            onClick={() => !importing && fileInputRef.current?.click()}
            style={{
              border: '2px dashed #d9d9d9',
              borderRadius: 8,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: importing ? 'not-allowed' : 'pointer',
              background: importFileName ? '#f6ffed' : '#fafafa',
              borderColor: importFileName ? '#52c41a' : '#d9d9d9',
              transition: 'all .2s',
            }}
          >
            {importFileName ? (
              <Space direction="vertical" size={4}>
                <CheckCircleFilled style={{ fontSize: 28, color: '#52c41a' }} />
                <div style={{ fontWeight: 500 }}>{importFileName}</div>
                <div style={{ fontSize: 12, color: '#888' }}>Нажмите чтобы выбрать другой файл</div>
              </Space>
            ) : (
              <Space direction="vertical" size={4}>
                <UploadOutlined style={{ fontSize: 28, color: '#bbb' }} />
                <div style={{ fontWeight: 500 }}>Нажмите чтобы выбрать файл</div>
                <div style={{ fontSize: 12, color: '#888' }}>JSON файл с клиентами</div>
              </Space>
            )}
          </div>

          {importing && (
            <div>
              <div style={{ marginBottom: 6, fontSize: 13, color: '#555' }}>{importProgressText}</div>
              <Progress
                percent={importProgress}
                status={importProgress === 100 ? 'success' : 'active'}
                strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
              />
            </div>
          )}

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { if (!importing) { setImportModal(false); setImportFile(null); setImportFileName(''); setImportProgress(0); } }} disabled={importing}>
              Отмена
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={importing}
              disabled={!importFile || importing}
              onClick={handleImport}
            >
              Загрузить
            </Button>
          </Space>
        </div>
      </Modal>

      {/* ─── Модал: отчёт о загрузке ─── */}
      <Modal
        title={<Space><FileTextOutlined />Отчёт о массовой загрузке</Space>}
        open={reportModal}
        onCancel={() => setReportModal(false)}
        footer={<Button onClick={() => setReportModal(false)}>Закрыть</Button>}
        width={780}
      >
        {importReport && (() => {
          const s = importReport.summary;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Итоговые цифры */}
              <Row gutter={12}>
                <Col span={6}><Statistic title="Всего в файле" value={s.total} /></Col>
                <Col span={6}><Statistic title="Создано" value={s.created} valueStyle={{ color: '#52c41a' }} prefix={<CheckOutlined />} /></Col>
                <Col span={6}><Statistic title="Дублей" value={s.skipped_dup} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} /></Col>
                <Col span={6}><Statistic title="Ошибок" value={s.errors} valueStyle={{ color: s.errors ? '#ff4d4f' : undefined }} prefix={<StopOutlined />} /></Col>
              </Row>

              <Tabs
                size="small"
                items={[
                  {
                    key: 'created',
                    label: <span><Tag color="green">{s.created}</Tag>Создано</span>,
                    children: importReport.created.length === 0
                      ? <div style={{ color: '#888', padding: 8 }}>Нет созданных записей</div>
                      : <Table
                          size="small"
                          pagination={{ pageSize: 10, showSizeChanger: false }}
                          dataSource={importReport.created.map((r, i) => ({ ...r, key: i }))}
                          columns={[
                            { title: 'Код аптеки', dataIndex: 'pharmacy_code', width: 110 },
                            { title: 'Адрес', dataIndex: 'address', ellipsis: true },
                            { title: 'Компания', dataIndex: 'company', ellipsis: true },
                            { title: 'РНМ', dataIndex: 'rnm_count', width: 60, render: v => v > 0 ? <Tag color="blue">{v}</Tag> : <Tag>0</Tag> },
                          ]}
                        />,
                  },
                  {
                    key: 'dup',
                    label: <span><Tag color="orange">{s.skipped_dup}</Tag>Дубли</span>,
                    children: importReport.skipped_dup.length === 0
                      ? <div style={{ color: '#888', padding: 8 }}>Дублей нет</div>
                      : <Table
                          size="small"
                          pagination={{ pageSize: 10, showSizeChanger: false }}
                          dataSource={importReport.skipped_dup.map((r, i) => ({ ...r, key: i }))}
                          columns={[
                            { title: 'Код аптеки', dataIndex: 'pharmacy_code', width: 110 },
                            { title: 'Адрес', dataIndex: 'address', ellipsis: true },
                            { title: 'Причина', dataIndex: 'reason', render: v => <Tag color="orange">{v}</Tag> },
                          ]}
                        />,
                  },
                  {
                    key: 'errors',
                    label: <span><Tag color="red">{s.errors + s.skipped_null}</Tag>Ошибки / пропущено</span>,
                    children: (importReport.errors.length + importReport.skipped_null.length) === 0
                      ? <div style={{ color: '#888', padding: 8 }}>Ошибок нет</div>
                      : <Table
                          size="small"
                          pagination={{ pageSize: 10, showSizeChanger: false }}
                          dataSource={[
                            ...importReport.skipped_null.map((r, i) => ({ key: `n${i}`, pharmacy_code: `строка #${r.row}`, reason: r.reason })),
                            ...importReport.errors.map((r, i) => ({ key: `e${i}`, pharmacy_code: r.pharmacy_code || '—', reason: r.reason })),
                          ]}
                          columns={[
                            { title: 'Код аптеки / строка', dataIndex: 'pharmacy_code', width: 160 },
                            { title: 'Причина', dataIndex: 'reason', render: v => <Tag color="red">{v}</Tag> },
                          ]}
                        />,
                  },
                ]}
              />
            </div>
          );
        })()}
      </Modal>
      <Modal
        title={<Space><SendOutlined />Тестовая отправка письма</Space>}
        open={testEmailModal}
        onCancel={() => { setTestEmailModal(false); setTestEmail(''); }}
        onOk={handleTestEmail}
        okText="Отправить"
        cancelText="Отмена"
        okButtonProps={{ loading: sendingTest, icon: <SendOutlined /> }}
      >
        <p style={{ color: '#666', marginBottom: 12 }}>
          Введите email на который отправить тестовое письмо. Убедитесь что SMTP настройки сохранены.
        </p>
        <Input
          placeholder="test@example.com"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          onPressEnter={handleTestEmail}
          prefix={<MailOutlined style={{ color: '#ccc' }} />}
        />
      </Modal>
    </div>
  );
}
