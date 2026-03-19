import React from 'react';
import {
  Card, Button, Space, Switch, Select, Progress, Badge,
  Tooltip, Divider, Modal, Checkbox, Typography,
} from 'antd';
import {
  CalendarOutlined, ClockCircleOutlined, PlayCircleOutlined,
  FileTextOutlined, SyncOutlined, SettingOutlined,
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import useThemeStore from '../../store/themeStore';

const { Text } = Typography;

const TIMEZONE_OPTIONS = [
  { label: 'UTC−12', value: -12 }, { label: 'UTC−11', value: -11 },
  { label: 'UTC−10', value: -10 }, { label: 'UTC−9', value: -9 },
  { label: 'UTC−8 (США/Запад)', value: -8 }, { label: 'UTC−7', value: -7 },
  { label: 'UTC−6 (США/Центр)', value: -6 }, { label: 'UTC−5 (США/Восток)', value: -5 },
  { label: 'UTC−4', value: -4 }, { label: 'UTC−3', value: -3 },
  { label: 'UTC−2', value: -2 }, { label: 'UTC−1', value: -1 },
  { label: 'UTC+0 (Лондон)', value: 0 },
  { label: 'UTC+1 (Берлин, Варшава)', value: 1 },
  { label: 'UTC+2 (Калининград, Хельсинки)', value: 2 },
  { label: 'UTC+3 (Москва)', value: 3 },
  { label: 'UTC+4 (Самара, Баку)', value: 4 },
  { label: 'UTC+5 (Екатеринбург)', value: 5 },
  { label: 'UTC+6 (Омск, Нур-Султан)', value: 6 },
  { label: 'UTC+7 (Красноярск, Новосибирск)', value: 7 },
  { label: 'UTC+8 (Иркутск, Пекин)', value: 8 },
  { label: 'UTC+9 (Якутск, Токио)', value: 9 },
  { label: 'UTC+10 (Владивосток)', value: 10 },
  { label: 'UTC+11 (Магадан)', value: 11 },
  { label: 'UTC+12 (Камчатка)', value: 12 },
];

const DAYS_OPTIONS = [
  { label: 'Пн', value: 0 }, { label: 'Вт', value: 1 },
  { label: 'Ср', value: 2 }, { label: 'Чт', value: 3 },
  { label: 'Пт', value: 4 }, { label: 'Сб', value: 5 },
  { label: 'Вс', value: 6 },
];

function TaskCard({
  taskId, title, icon, onRun,
  tasks, tasksLoading, polling,
  scheduleLocal, cronLine, timezoneOffset,
  patchLocal, handleApplyCron, applyingCron,
  setTaskResult, setResultModal,
  isDark,
}) {
  const task = tasks.find(t => t.task_id === taskId);
  if (!task && tasksLoading) return <Card loading />;
  if (!task) return null;

  const isRunning = task.status === 'running';
  const statusIcon = {
    idle:    <MinusCircleOutlined style={{ color: '#bbb' }} />,
    running: <SyncOutlined spin style={{ color: '#1677ff' }} />,
    success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
    error:   <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  }[task.status] || null;
  const statusColor = { idle: 'default', running: 'processing', success: 'success', error: 'error' }[task.status];
  const statusLabel = { idle: 'Ожидает', running: 'Выполняется', success: 'Успешно', error: 'Ошибка' }[task.status];
  const loc = scheduleLocal[taskId] || {};
  const currentCron = cronLine[taskId];

  return (
    <Card title={<Space>{icon}<span>{title}</span></Space>} style={{ marginBottom: 16 }}>
      {/* Статус и кнопки */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Space>
          {statusIcon}
          <Badge status={statusColor} text={statusLabel} />
        </Space>
        <Space>
          <Tooltip title={isRunning ? 'Задание выполняется' : 'Запустить вручную'}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled={isRunning}
              loading={isRunning && polling}
              onClick={onRun}
            >
              Запустить
            </Button>
          </Tooltip>
          {task.last_run_at && (
            <Tooltip title="Результат последнего запуска">
              <Button icon={<FileTextOutlined />} onClick={() => { setTaskResult(task); setResultModal(true); }}>
                Результат
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Прогресс */}
      {isRunning && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{task.progress_text || 'Выполняется...'}</div>
          <Progress percent={task.progress} status="active" strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }} />
        </div>
      )}

      {/* Последний запуск */}
      {task.last_run_at && (
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          Последний запуск: {new Date(task.last_run_at).toLocaleString('ru-RU')}
        </div>
      )}

      <Divider style={{ margin: '4px 0 14px' }} />

      {/* Расписание */}
      <div style={{ background: isDark ? '#141414' : '#fafafa', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ fontWeight: 500, marginBottom: 12 }}>
          <CalendarOutlined style={{ marginRight: 6, color: '#1677ff' }} />
          Расписание
        </div>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space>
            <Switch
              checked={!!loc.enabled}
              onChange={val => patchLocal(taskId, { enabled: val })}
              checkedChildren="Вкл"
              unCheckedChildren="Выкл"
            />
            <span style={{ fontSize: 13 }}>
              {loc.enabled ? 'Запускать по расписанию' : 'Только ручной запуск'}
            </span>
          </Space>
          {loc.enabled && (() => {
            const [selHH, selMM] = (loc.schedule_time || '00:00').split(':');
            const hourOptions = Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }));
            const minuteOptions = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(v => ({ value: v, label: v }));
            const onHourChange = v => patchLocal(taskId, { schedule_time: `${v}:${selMM || '00'}` });
            const onMinChange  = v => patchLocal(taskId, { schedule_time: `${selHH || '00'}:${v}` });
            return (
              <Space wrap size={16} align="start">
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                    Время запуска
                    {timezoneOffset !== 0 && (
                      <span style={{ marginLeft: 6, color: '#1677ff' }}>
                        (UTC{timezoneOffset > 0 ? '+' : ''}{timezoneOffset})
                      </span>
                    )}
                  </div>
                  <Space size={6}>
                    <Select value={selHH || '00'} onChange={onHourChange} options={hourOptions} style={{ width: 72 }} size="middle" />
                    <span style={{ color: '#888', fontWeight: 600 }}>:</span>
                    <Select value={selMM || '00'} onChange={onMinChange} options={minuteOptions} style={{ width: 72 }} size="middle" />
                  </Space>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Дни недели</div>
                  <Checkbox.Group
                    options={DAYS_OPTIONS}
                    value={loc.schedule_days || []}
                    onChange={val => patchLocal(taskId, { schedule_days: val })}
                  />
                </div>
              </Space>
            );
          })()}
          {currentCron && (
            <div style={{ fontSize: 12, color: '#888' }}>
              <span style={{ marginRight: 6 }}>Активная cron-строка:</span>
              <code style={{ background: isDark ? '#2a2a2a' : '#f0f0f0', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                {currentCron.split('#')[0].trim()}
              </code>
            </div>
          )}
          <Button type="primary" icon={<CalendarOutlined />} loading={applyingCron} onClick={() => handleApplyCron(taskId)}>
            Применить расписание
          </Button>
          <div style={{ fontSize: 12, color: '#aaa' }}>
            Изменения применяются к crontab сервера. Перед применением убедитесь что выполнен <code>python3 setup_scheduler.py</code>
          </div>
        </Space>
      </div>
    </Card>
  );
}

export default function SettingsScheduler({
  tasks, tasksLoading, polling,
  scheduleLocal, cronLine,
  timezoneOffset, savingTimezone, saveTimezone,
  patchLocal, handleApplyCron, applyingCron,
  openRunModal, handleRunTaskDirect,
  setTaskResult, setResultModal,
  taskResult, resultModal,
  runModal, setRunModal,
  runScope, setRunScope,
  companies, selectedCompany, setSelectedCompany,
  handleRunTask,
}) {
  const isDark = useThemeStore((s) => s.isDark);

  const taskCardProps = {
    tasks, tasksLoading, polling,
    scheduleLocal, cronLine, timezoneOffset,
    patchLocal, handleApplyCron, applyingCron,
    setTaskResult, setResultModal,
    isDark,
  };

  return (
    <div>
      {/* Часовой пояс */}
      <div style={{ marginBottom: 16, padding: '12px 16px', background: isDark ? '#1f1f1f' : '#f8f9fa', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <ClockCircleOutlined style={{ color: '#1677ff', fontSize: 16 }} />
        <span style={{ fontWeight: 500 }}>Часовой пояс расписания:</span>
        <Select
          value={timezoneOffset}
          onChange={saveTimezone}
          loading={savingTimezone}
          style={{ width: 260 }}
          options={TIMEZONE_OPTIONS}
          showSearch
          filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Время вводится по выбранному поясу, конвертируется в UTC для cron
        </Text>
      </div>

      <TaskCard
        {...taskCardProps}
        taskId="update_rnm"
        title="Обновление данных по ККТ"
        icon={<SyncOutlined style={{ color: '#1677ff' }} />}
        onRun={openRunModal}
      />
      <TaskCard
        {...taskCardProps}
        taskId="fetch_external_ip"
        title="Обновление внешнего IP"
        icon={<SettingOutlined style={{ color: '#52c41a' }} />}
        onRun={() => handleRunTaskDirect('fetch_external_ip')}
      />
      <TaskCard
        {...taskCardProps}
        taskId="backup_system"
        title="Резервное копирование"
        icon={<DatabaseOutlined style={{ color: '#722ed1' }} />}
        onRun={() => handleRunTaskDirect('backup_system')}
      />

      {/* Модал: результат */}
      <Modal
        title={<Space><FileTextOutlined />Результат: {taskResult?.name}</Space>}
        open={resultModal}
        onCancel={() => setResultModal(false)}
        footer={<Button onClick={() => setResultModal(false)}>Закрыть</Button>}
        width={600}
      >
        {taskResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#888' }}>
              Запуск: {taskResult.last_run_at ? new Date(taskResult.last_run_at).toLocaleString('ru-RU') : '—'}
            </div>
            <pre style={{
              background: isDark ? '#1f1f1f' : '#f5f5f5',
              borderRadius: 6, padding: '12px 14px',
              fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
            }}>
              {taskResult.last_run_result || 'Нет данных'}
            </pre>
          </div>
        )}
      </Modal>

      {/* Модал: запуск update_rnm */}
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
              background: runScope === 'all' ? (isDark ? '#111d2c' : '#e6f4ff') : (isDark ? '#141414' : '#fafafa'),
              transition: 'all .15s',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 2 }}>Все клиенты</div>
            <div style={{ fontSize: 12, color: '#888' }}>Обновить ККТ у всех клиентов всех компаний</div>
          </div>
          <div
            onClick={() => setRunScope('company')}
            style={{
              border: `2px solid ${runScope === 'company' ? '#1677ff' : '#d9d9d9'}`,
              borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
              background: runScope === 'company' ? (isDark ? '#111d2c' : '#e6f4ff') : (isDark ? '#141414' : '#fafafa'),
              transition: 'all .15s',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 2 }}>Отдельная компания</div>
            <div style={{ fontSize: 12, color: '#888' }}>Обновить ККТ только у клиентов выбранной компании</div>
          </div>
          {runScope === 'company' && (
            <Select
              placeholder="Выберите компанию"
              style={{ width: '100%' }}
              value={selectedCompany}
              onChange={setSelectedCompany}
              options={companies.map(c => ({ value: c.id, label: `${c.name} (ИНН: ${c.inn})` }))}
              showSearch
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
