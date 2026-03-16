import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Button, Space, Modal, Progress, Tag, Table, Select,
  Typography, Tabs, Badge, Tooltip, message, Popconfirm,
} from 'antd';
import {
  SyncOutlined, FileTextOutlined, PlusOutlined,
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import api from '../../api/axios';

const { Text } = Typography;

export default function SettingsRnmSync({ companies }) {
  const [status, setStatus]         = useState('idle');
  const [progress, setProgress]     = useState(0);
  const [progressText, setProgressText] = useState('');
  const [lastRunAt, setLastRunAt]   = useState(null);
  const [result, setResult]         = useState(null);
  const [resultModal, setResultModal] = useState(false);
  const [runModal, setRunModal]     = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [addingRnm, setAddingRnm]   = useState(null);
  const [deletingRnm, setDeletingRnm] = useState(null); // rnm которое добавляем
  const pollRef = useRef(null);

  // Загружаем текущий статус при монтировании
  useEffect(() => {
    loadStatus();
  }, []); // eslint-disable-line

  const loadStatus = async () => {
    try {
      const { data } = await api.get('/clients/rnm-sync/');
      setStatus(data.status || 'idle');
      setProgress(data.progress || 0);
      setProgressText(data.progress_text || '');
      setLastRunAt(data.last_run_at);
      if (data.result) setResult(data.result);
      if (data.status === 'running') startPolling();
    } catch {}
  };

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get('/clients/rnm-sync/');
        setStatus(data.status);
        setProgress(data.progress || 0);
        setProgressText(data.progress_text || '');
        setLastRunAt(data.last_run_at);
        if (data.result) setResult(data.result);
        if (data.status !== 'running') {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  };

  const handleRun = async () => {
    try {
      await api.post('/clients/rnm-sync/', {
        company_id: selectedCompany || null,
      });
      setRunModal(false);
      setSelectedCompany(null);
      setStatus('running');
      setProgress(0);
      setProgressText('Запуск...');
      startPolling();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка запуска');
    }
  };

  const handleDeleteRnm = async (item) => {
    setDeletingRnm(item.rnm);
    try {
      await api.delete('/clients/rnm-sync/', {
        data: { rnm: item.rnm, client_id: item.client_id },
      });
      message.success(`РНМ ${item.rnm} удалён`);
      setResult(prev => ({
        ...prev,
        missing_in_ofd: prev.missing_in_ofd.filter(r => r.rnm !== item.rnm),
      }));
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка удаления');
    } finally {
      setDeletingRnm(null);
    }
  };

  const handleAddRnm = async (item) => {
    setAddingRnm(item.rnm);
    try {
      // Находим клиента этой компании по адресу из ОФД
      // Используем endpoint добавления по РНМ — ищем подходящего клиента
      const clientsRes = await api.get(`/clients/?page_size=1000&ofd_company=${item.company_id}`);
      const clients = clientsRes.data.results || clientsRes.data;

      if (clients.length === 0) {
        message.error('Нет клиентов для этой компании');
        return;
      }

      // Пробуем найти клиента по адресу из ОФД
      let targetClient = null;
      if (item.address) {
        const addrLower = item.address.toLowerCase();
        targetClient = clients.find(c =>
          c.address && c.address.toLowerCase().includes(addrLower.substring(0, 15))
        );
      }

      if (!targetClient) {
        message.warning(`Не удалось автоматически определить клиента для РНМ ${item.rnm}. Добавьте вручную через карточку клиента.`);
        return;
      }

      // Добавляем ККТ через endpoint
      const res = await api.patch(`/clients/${targetClient.id}/ofd_kkt/`, {
        rnm_override: item.rnm,
      });
      message.success(res.data.message || `РНМ ${item.rnm} добавлен`);

      // Обновляем результат — убираем добавленный РНМ из списка
      if (result) {
        setResult(prev => ({
          ...prev,
          missing_in_us: prev.missing_in_us.filter(r => r.rnm !== item.rnm),
        }));
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка добавления');
    } finally {
      setAddingRnm(null);
    }
  };

  const isRunning = status === 'running';

  const statusIcon = {
    idle:    <MinusCircleOutlined style={{ color: '#bbb' }} />,
    running: <SyncOutlined spin style={{ color: '#1677ff' }} />,
    success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
    error:   <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  }[status] || null;

  const statusColor = { idle: 'default', running: 'processing', success: 'success', error: 'error' }[status];
  const statusLabel = { idle: 'Ожидает', running: 'Выполняется', success: 'Успешно', error: 'Ошибка' }[status];

  const missingInUs  = result?.missing_in_us  || [];
  const missingInOfd = result?.missing_in_ofd || [];
  const errors       = result?.errors         || [];

  return (
    <>
      <Card
        title={<Space><SyncOutlined style={{ color: '#722ed1' }} /><span>Сверка РНМ с ОФД</span></Space>}
        style={{ marginTop: 16 }}
      >
        {/* Статус и кнопки */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Space>
            {statusIcon}
            <Badge status={statusColor} text={statusLabel} />
          </Space>
          <Space>
            <Tooltip title={isRunning ? 'Сверка выполняется' : 'Запустить сверку'}>
              <Button
                type="primary"
                icon={<SyncOutlined />}
                disabled={isRunning}
                loading={isRunning}
                onClick={() => setRunModal(true)}
              >
                Выполнить
              </Button>
            </Tooltip>
            {result && (
              <Button icon={<FileTextOutlined />} onClick={() => setResultModal(true)}>
                Результат
                {missingInUs.length > 0 && (
                  <Tag color="red" style={{ marginLeft: 6 }}>{missingInUs.length}</Tag>
                )}
              </Button>
            )}
          </Space>
        </div>

        {/* Прогресс */}
        {isRunning && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{progressText}</div>
            <Progress percent={progress} status="active" strokeColor={{ '0%': '#722ed1', '100%': '#52c41a' }} />
          </div>
        )}

        {/* Последний запуск */}
        {lastRunAt && (
          <div style={{ fontSize: 12, color: '#888' }}>
            Последняя сверка: {new Date(lastRunAt).toLocaleString('ru-RU')}
            {result && (
              <span style={{ marginLeft: 12 }}>
                {missingInUs.length > 0 && <Tag color="orange">В ОФД, нет у нас: {missingInUs.length}</Tag>}
                {missingInOfd.length > 0 && <Tag color="blue">У нас, нет в ОФД: {missingInOfd.length}</Tag>}
                {missingInUs.length === 0 && missingInOfd.length === 0 && <Tag color="green">Расхождений нет</Tag>}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Модал: запуск */}
      <Modal
        title={<Space><SyncOutlined />Сверка РНМ с ОФД</Space>}
        open={runModal}
        onCancel={() => { setRunModal(false); setSelectedCompany(null); }}
        onOk={handleRun}
        okText="Запустить"
        cancelText="Отмена"
        okButtonProps={{ icon: <SyncOutlined /> }}
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            Сверка сравнивает РНМ в ОФД с нашей базой и показывает расхождения.
            При большом числе компаний может занять несколько минут.
          </div>
          <div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>Область сверки:</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Все компании"
              allowClear
              value={selectedCompany}
              onChange={setSelectedCompany}
              options={companies.map(c => ({ value: c.id, label: `${c.name} (ИНН: ${c.inn})` }))}
              showSearch
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Оставьте пустым чтобы проверить все компании
            </div>
          </div>
        </div>
      </Modal>

      {/* Модал: результат */}
      <Modal
        title={<Space><FileTextOutlined />Результат сверки РНМ</Space>}
        open={resultModal}
        onCancel={() => setResultModal(false)}
        footer={<Button onClick={() => setResultModal(false)}>Закрыть</Button>}
        width={860}
      >
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#888' }}>
              Дата: {lastRunAt ? new Date(lastRunAt).toLocaleString('ru-RU') : '—'} ·
              Проверено компаний: {result.companies_checked}
            </div>
            <Tabs
              size="small"
              items={[
                {
                  key: 'missing_us',
                  label: (
                    <span>
                      <Tag color="orange">{missingInUs.length}</Tag>
                      Есть в ОФД, нет у нас
                    </span>
                  ),
                  children: missingInUs.length === 0
                    ? <div style={{ color: '#888', padding: 8 }}>Расхождений нет</div>
                    : <Table
                        size="small"
                        pagination={{ pageSize: 20, showSizeChanger: false }}
                        dataSource={missingInUs.map((r, i) => ({ ...r, key: i }))}
                        columns={[
                          { title: 'РНМ', dataIndex: 'rnm', width: 170, render: v => <code>{v}</code> },
                          { title: 'Компания', dataIndex: 'company_name', ellipsis: true, width: 180 },
                          { title: 'Адрес в ОФД', dataIndex: 'address', ellipsis: true },
                          { title: 'Модель', dataIndex: 'model', width: 100, ellipsis: true },
                          {
                            title: '',
                            width: 100,
                            render: (_, row) => (
                              <Button
                                size="small"
                                type="primary"
                                icon={<PlusOutlined />}
                                loading={addingRnm === row.rnm}
                                onClick={() => handleAddRnm(row)}
                              >
                                Добавить
                              </Button>
                            ),
                          },
                        ]}
                      />,
                },
                {
                  key: 'missing_ofd',
                  label: (
                    <span>
                      <Tag color="blue">{missingInOfd.length}</Tag>
                      Есть у нас, нет в ОФД
                    </span>
                  ),
                  children: missingInOfd.length === 0
                    ? <div style={{ color: '#888', padding: 8 }}>Расхождений нет</div>
                    : <Table
                        size="small"
                        pagination={{ pageSize: 20, showSizeChanger: false }}
                        dataSource={missingInOfd.map((r, i) => ({ ...r, key: i }))}
                        columns={[
                          { title: 'РНМ', dataIndex: 'rnm', width: 170, render: v => <code>{v}</code> },
                          { title: 'Компания', dataIndex: 'company_name', ellipsis: true, width: 180 },
                          { title: 'Клиент', dataIndex: 'client_name', ellipsis: true },
                          { title: 'Модель', dataIndex: 'model', width: 100, ellipsis: true },
                          {
                            title: '',
                            width: 90,
                            render: (_, row) => (
                              <Popconfirm
                                title="Удалить ККТ?"
                                description={`РНМ ${row.rnm} будет удалён из системы`}
                                onConfirm={() => handleDeleteRnm(row)}
                                okText="Удалить"
                                cancelText="Отмена"
                                okButtonProps={{ danger: true }}
                              >
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={deletingRnm === row.rnm}
                                >
                                  Удалить
                                </Button>
                              </Popconfirm>
                            ),
                          },
                        ]}
                      />,
                },
                ...(errors.length > 0 ? [{
                  key: 'errors',
                  label: <span><Tag color="red">{errors.length}</Tag>Ошибки</span>,
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {errors.map((e, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#ff4d4f' }}>• {e}</div>
                      ))}
                    </div>
                  ),
                }] : []),
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
