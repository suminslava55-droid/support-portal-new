import React, { useState, useEffect, useCallback } from 'react';
import { Card, Descriptions, Tag, Button, Space, Typography, Spin, Alert, Tooltip, Popconfirm, message } from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import api from '../../api';
import ChzIcon from '../../components/ChzIcon';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Text } = Typography;

// Статусы ЛМ ЧЗ (п. 2.6.2 руководства ЦРПТ)
const STATUS_MAP = {
  not_configured: { label: 'Не настроен',          color: 'default' },
  initialization: { label: 'Инициализация',        color: 'processing' },
  ready:          { label: 'Готов',                 color: 'success' },
  failure:        { label: 'Внутренняя ошибка',     color: 'error' },
  sync_error:     { label: 'Ошибка синхронизации',  color: 'error' },
};
const MODE_MAP = {
  active:  { label: 'Штатный',   color: 'green' },
  service: { label: 'Сервисный', color: 'gold' },
};

// lastUpdate / lastSync приходят как epoch в миллисекундах
function tsFmt(v) {
  if (!v) return '—';
  const d = dayjs(Number(v));
  return d.isValid() ? d.format('DD.MM.YYYY HH:mm:ss') : '—';
}
function tsRel(v) {
  if (!v) return '';
  const d = dayjs(Number(v));
  return d.isValid() ? d.fromNow() : '';
}
// Человеческая длительность из минут: «2 дн 5 ч» / «7 ч» / «40 мин»
function fmtDur(mins) {
  const m = Math.abs(mins);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d} дн ${h % 24} ч`;
  if (h >= 1) return `${h} ч`;
  return `${m} мин`;
}

// Здоровье офлайн-проверок: при отсутствии синхронизации >72ч ЛМ уходит
// в sync_error и касса не может проверять маркировку (п. 2.1 / 2.6.2 ЦРПТ).
function SyncHealth({ status, lastSync }) {
  const syncMs = lastSync ? Number(lastSync) : 0;

  if (status === 'not_configured' || syncMs <= 0) {
    return (
      <Alert
        type="error" showIcon style={{ marginBottom: 12 }}
        message="ЛМ не синхронизирован"
        description="Офлайн-проверки маркировки недоступны, пока ЛМ не пройдёт инициализацию и синхронизацию с ЦРПТ."
      />
    );
  }

  const sync = dayjs(syncMs);
  const deadline = sync.add(72, 'hour');
  const minsLeft = deadline.diff(dayjs(), 'minute');
  const syncLine = `Синхронизация: ${sync.format('DD.MM.YYYY HH:mm')} (${sync.fromNow()})`;

  if (status === 'sync_error' || minsLeft <= 0) {
    return (
      <Alert
        type="error" showIcon style={{ marginBottom: 12 }}
        message="Офлайн-проверки ОТКЛЮЧЕНЫ"
        description={<>Нет синхронизации с ЦРПТ более 72 часов — касса не может проверять маркировку в офлайне. {syncLine}. Нужно восстановить связь и переинициализировать ЛМ.</>}
      />
    );
  }

  if (minsLeft <= 24 * 60) {
    return (
      <Alert
        type="warning" showIcon style={{ marginBottom: 12 }}
        message={`Внимание: до отключения офлайн-проверок ~${fmtDur(minsLeft)}`}
        description={<>ЛМ давно не синхронизировался с ЦРПТ. Через 72 часа от последней синхронизации проверки отключатся. {syncLine}.</>}
      />
    );
  }

  return (
    <Alert
      type="success" showIcon style={{ marginBottom: 12 }}
      message={`Офлайн-проверки активны · запас ~${fmtDur(minsLeft)}`}
      description={<>{syncLine}. Отключение при отсутствии синхронизации: {deadline.format('DD.MM.YYYY HH:mm')}.</>}
    />
  );
}

export default function ClientDetailChz({ clientId }) {
  const [loading, setLoading]           = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [data, setData]                 = useState(null);
  const [error, setError]               = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/clients/${clientId}/chz/`);
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.error || 'ЛМ ЧЗ недоступен');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // Запрос только при заходе на вкладку; дальше — по кнопке «Обновить»
  useEffect(() => { load(); }, [load]);

  const doInit = async () => {
    setInitializing(true);
    try {
      const res = await api.post(`/clients/${clientId}/chz/`);
      message.success(res.data?.message || 'Запрос инициализации отправлен');
      load();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Ошибка инициализации', 6);
    } finally {
      setInitializing(false);
    }
  };

  const st   = data ? (STATUS_MAP[data.status] || { label: data.status || '—', color: 'default' }) : null;
  const mode = data ? (MODE_MAP[data.operation_mode] || { label: data.operation_mode || '—', color: 'default' }) : null;

  return (
    <Card
      title={
        <Space>
          <ChzIcon size={18} />
          <Text strong>Честный знак — Локальный модуль (ЛМ ЧЗ)</Text>
        </Space>
      }
      extra={
        <Space>
          <Popconfirm
            title="Инициализировать ЛМ ЧЗ?"
            description="На сервер аптеки будет отправлена команда для инициализации локального модуля."
            onConfirm={doInit}
            okText="Инициализировать"
            cancelText="Отмена"
            okButtonProps={{ loading: initializing }}
          >
            <Button icon={<ThunderboltOutlined />} loading={initializing}>
              Инициализация
            </Button>
          </Popconfirm>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            Обновить
          </Button>
        </Space>
      }
    >
      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : error ? (
        <Alert type="error" showIcon message="ЛМ ЧЗ недоступен" description={error} />
      ) : !data ? null : (
        <>
          <SyncHealth status={data.status} lastSync={data.last_sync} />
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 2 }}>
            <Descriptions.Item label="Статус">
              <Tooltip title={data.status || ''}>
                <Tag color={st.color}>{st.label}</Tag>
              </Tooltip>
            </Descriptions.Item>
            <Descriptions.Item label="Режим">
              <Tooltip title={data.operation_mode || ''}>
                <Tag color={mode.color}>{mode.label}</Tag>
              </Tooltip>
            </Descriptions.Item>
            <Descriptions.Item label="Версия ЛМ">
              <Tag color="blue">{data.version || '—'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="serviceUrl">
              {data.service_url || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Обновление БД">
              <Tooltip title={tsRel(data.last_update)}>{tsFmt(data.last_update)}</Tooltip>
            </Descriptions.Item>
            <Descriptions.Item label="Синхронизация с ЦРПТ">
              <Tooltip title={tsRel(data.last_sync)}>{tsFmt(data.last_sync)}</Tooltip>
            </Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Card>
  );
}
