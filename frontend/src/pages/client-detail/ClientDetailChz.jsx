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
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 2 }}>
          <Descriptions.Item label="Статус">
            <Tag color={data.status === 'ready' ? 'green' : 'orange'}>{data.status || '—'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Режим">
            <Tag color={data.operation_mode === 'active' ? 'green' : 'default'}>{data.operation_mode || '—'}</Tag>
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
      )}
    </Card>
  );
}
