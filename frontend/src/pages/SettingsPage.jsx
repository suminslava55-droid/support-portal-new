import React, { useState, useEffect, useRef } from 'react';
import { Spin, Space, Tabs, Typography, message } from 'antd';
import {
  SettingOutlined, CalendarOutlined, RobotOutlined,
} from '@ant-design/icons';
import { settingsAPI } from '../api';
import api from '../api/axios';
import SettingsAccounts    from './settings/SettingsAccounts';
import SettingsAutomation  from './settings/SettingsAutomation';
import SettingsScheduler   from './settings/SettingsScheduler';
import SettingsDiagnostics from './settings/SettingsDiagnostics';
import { Form } from 'antd';

const { Title } = Typography;

export default function SettingsPage() {
  const [sshForm]  = Form.useForm();
  const [smtpForm] = Form.useForm();
  const [loading, setLoading]           = useState(true);
  const [savingSsh, setSavingSsh]       = useState(false);
  const [savingSmtp, setSavingSmtp]     = useState(false);
  const [hasSSHPassword, setHasSSHPassword]   = useState(false);
  const [hasSMTPPassword, setHasSMTPPassword] = useState(false);
  const [useSsl, setUseSsl]             = useState(true);
  const [useTls, setUseTls]             = useState(false);
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testEmail, setTestEmail]       = useState('');
  const [sendingTest, setSendingTest]   = useState(false);
  const [packages, setPackages]         = useState(null);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Массовый импорт
  const [importModal, setImportModal]         = useState(false);
  const [importFile, setImportFile]           = useState(null);
  const [importFileName, setImportFileName]   = useState('');
  const [importing, setImporting]             = useState(false);
  const [importProgress, setImportProgress]   = useState(0);
  const [importProgressText, setImportProgressText] = useState('');
  const [importReport, setImportReport]       = useState(null);
  const [reportModal, setReportModal]         = useState(false);

  // Регламентные задания
  const [tasks, setTasks]                   = useState([]);
  const [tasksLoading, setTasksLoading]     = useState(false);
  const [applyingCron, setApplyingCron]     = useState(false);
  const [cronLine, setCronLine]             = useState({});
  const [scheduleLocal, setScheduleLocal]   = useState({});
  const [runModal, setRunModal]             = useState(false);
  const [runScope, setRunScope]             = useState(null);
  const [companies, setCompanies]           = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [polling, setPolling]               = useState(false);
  const pollRef                             = useRef(null);
  const [taskResult, setTaskResult]         = useState(null);
  const [resultModal, setResultModal]       = useState(false);
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  const [savingTimezone, setSavingTimezone] = useState(false);

  // ─── Загрузка ───────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await settingsAPI.get();
        sshForm.setFieldsValue({ ssh_user: data.ssh_user });
        setHasSSHPassword(data.has_ssh_password);
        smtpForm.setFieldsValue({
          smtp_host:       data.smtp_host,
          smtp_port:       data.smtp_port || 465,
          smtp_user:       data.smtp_user,
          smtp_from_email: data.smtp_from_email,
          smtp_from_name:  data.smtp_from_name,
          smtp_use_ssl:    data.smtp_use_ssl,
          smtp_use_tls:    data.smtp_use_tls,
        });
        setHasSMTPPassword(data.has_smtp_password);
        setUseSsl(data.smtp_use_ssl);
        setUseTls(data.smtp_use_tls);
        setTimezoneOffset(data.timezone_offset ?? 0);
      } catch {
        message.error('Ошибка загрузки настроек');
      } finally {
        setLoading(false);
      }
    };
    load();
    loadPackages();
  }, [sshForm, smtpForm]); // eslint-disable-line

  useEffect(() => { loadTasks(); }, []); // eslint-disable-line

  // ─── Диагностика ────────────────────────────────────────
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

  // ─── Учётные записи ─────────────────────────────────────
  const onSaveSsh = async (values) => {
    setSavingSsh(true);
    try {
      const { data } = await settingsAPI.save({ ...values, section: 'ssh' });
      setHasSSHPassword(data.has_ssh_password);
      sshForm.setFieldsValue({ ssh_password: '' });
      message.success('SSH настройки сохранены');
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.detail || 'Ошибка сохранения');
    } finally { setSavingSsh(false); }
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
    } finally { setSavingSmtp(false); }
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
    } finally { setSendingTest(false); }
  };

  // ─── Автоматизация ──────────────────────────────────────
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
        try { clients = JSON.parse('[' + text.replace(/,\s*$/, '') + ']'); }
        catch { message.error('Не удалось разобрать JSON файл'); setImporting(false); setImportProgress(0); return; }
      }
      setImportProgress(50);
      setImportProgressText(`Отправляем ${clients.length} записей на сервер...`);
      const { data } = await api.post('/clients/bulk-import/', { clients });
      setImportProgress(100);
      setImportProgressText('Готово!');
      setImportReport(data);
      setTimeout(() => {
        setImporting(false); setImportModal(false);
        setImportFile(null); setImportFileName('');
        setImportProgress(0); setImportProgressText('');
        setReportModal(true);
      }, 600);
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка импорта');
      setImporting(false); setImportProgress(0); setImportProgressText('');
    }
  };

  // ─── Регламентные задания ───────────────────────────────
  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const { data } = await api.get('/clients/scheduled-tasks/');
      setTasks(data);
      const local = {};
      data.forEach(t => {
        local[t.task_id] = {
          enabled:       t.enabled,
          schedule_time: t.schedule_time,
          schedule_days: (t.schedule_days || '').split(',').filter(Boolean).map(Number),
        };
      });
      setScheduleLocal(local);
      for (const t of data) {
        try {
          const { data: cronData } = await api.get(`/clients/scheduled-tasks/cron/?task_id=${t.task_id}`);
          setCronLine(prev => ({ ...prev, [t.task_id]: cronData.cron_line }));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setTasksLoading(false); }
  };

  const patchLocal = (task_id, patch) => {
    setScheduleLocal(prev => ({ ...prev, [task_id]: { ...(prev[task_id] || {}), ...patch } }));
  };

  const handleApplyCron = async (task_id) => {
    const local = scheduleLocal[task_id] || {};
    if (local.enabled && local.schedule_time === undefined) { message.warning('Укажите время запуска'); return; }
    if (local.enabled && (!local.schedule_days || local.schedule_days.length === 0)) { message.warning('Выберите хотя бы один день недели'); return; }
    setApplyingCron(true);
    try {
      const { data } = await api.post('/clients/scheduled-tasks/cron/', {
        task_id, enabled: local.enabled,
        schedule_time: local.schedule_time, schedule_days: local.schedule_days,
      });
      message.success(data.message);
      await loadTasks();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка применения расписания');
    } finally { setApplyingCron(false); }
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
      setRunModal(false); setRunScope(null); setSelectedCompany(null);
      await loadTasks();
      startPolling('update_rnm');
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка запуска');
    }
  };

  const handleRunTaskDirect = async (task_id) => {
    try {
      await api.post('/clients/scheduled-tasks/run/', { task_id });
      await loadTasks();
      startPolling(task_id);
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка запуска');
    }
  };

  const openRunModal = async () => {
    try {
      const { data } = await api.get('/clients/ofd-companies/');
      setCompanies(Array.isArray(data) ? data : (data.results || []));
    } catch { setCompanies([]); }
    setRunScope(null); setSelectedCompany(null); setRunModal(true);
  };

  const saveTimezone = async (val) => {
    setSavingTimezone(true);
    try {
      await api.post('/clients/system-settings/', { section: 'general', timezone_offset: val });
      setTimezoneOffset(val);
      message.success('Часовой пояс сохранён');
    } catch {
      message.error('Ошибка сохранения часового пояса');
    } finally { setSavingTimezone(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const tabItems = [
    {
      key: 'accounts',
      label: <Space><SettingOutlined />Учётные записи</Space>,
      children: (
        <SettingsAccounts
          sshForm={sshForm} smtpForm={smtpForm}
          hasSSHPassword={hasSSHPassword} hasSMTPPassword={hasSMTPPassword}
          useSsl={useSsl} useTls={useTls}
          savingSsh={savingSsh} savingSmtp={savingSmtp}
          testEmailModal={testEmailModal} setTestEmailModal={setTestEmailModal}
          testEmail={testEmail} setTestEmail={setTestEmail}
          sendingTest={sendingTest}
          onSaveSsh={onSaveSsh} onSaveSmtp={onSaveSmtp}
          handleClearSsh={handleClearSsh} handleClearSmtp={handleClearSmtp}
          handleSslChange={handleSslChange} handleTlsChange={handleTlsChange}
          handleTestEmail={handleTestEmail}
        />
      ),
    },
    {
      key: 'automation',
      label: <Space><RobotOutlined />Автоматизация</Space>,
      children: (
        <SettingsAutomation
          importModal={importModal} setImportModal={setImportModal}
          importFile={importFile} setImportFile={setImportFile}
          importFileName={importFileName} setImportFileName={setImportFileName}
          importing={importing}
          importProgress={importProgress}
          importProgressText={importProgressText}
          importReport={importReport}
          reportModal={reportModal} setReportModal={setReportModal}
          handleFileSelect={handleFileSelect}
          handleImport={handleImport}
        />
      ),
    },
    {
      key: 'scheduler',
      label: <Space><CalendarOutlined />Регламентные задания</Space>,
      children: (
        <SettingsScheduler
          tasks={tasks} tasksLoading={tasksLoading} polling={polling}
          scheduleLocal={scheduleLocal} cronLine={cronLine}
          timezoneOffset={timezoneOffset} savingTimezone={savingTimezone} saveTimezone={saveTimezone}
          patchLocal={patchLocal} handleApplyCron={handleApplyCron} applyingCron={applyingCron}
          openRunModal={openRunModal} handleRunTaskDirect={handleRunTaskDirect}
          setTaskResult={setTaskResult} setResultModal={setResultModal}
          taskResult={taskResult} resultModal={resultModal}
          runModal={runModal} setRunModal={setRunModal}
          runScope={runScope} setRunScope={setRunScope}
          companies={companies} selectedCompany={selectedCompany} setSelectedCompany={setSelectedCompany}
          handleRunTask={handleRunTask}
        />
      ),
    },
    {
      key: 'diagnostics',
      label: <Space><SettingOutlined />Диагностика</Space>,
      children: (
        <SettingsDiagnostics
          packages={packages}
          packagesLoading={packagesLoading}
          loadPackages={loadPackages}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <SettingOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>Настройки системы</Title>
      </div>
      <Tabs
        defaultActiveKey="accounts"
        type="card"
        size="middle"
        items={tabItems}
        style={{ maxWidth: 700 }}
      />
    </div>
  );
}
