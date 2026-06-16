import React from 'react';
import { Card, Space, Button, Tag, Empty, Descriptions, Popconfirm, Typography, Divider, Tooltip } from 'antd';
import { ReloadOutlined, SyncOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import { CopyField } from './helpers';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Text } = Typography;

function ShiftTag({ proxy }) {
  if (!proxy || !proxy.shift_status) return <Text type="secondary">—</Text>;
  if (proxy.shift_exceeded_24h) {
    return <Tag color="red">Открыта &gt; 24ч</Tag>;
  }
  if (proxy.shift_status === 'OPEN') {
    return <Tag color="orange">Открыта</Tag>;
  }
  return <Tag color="green">Закрыта</Tag>;
}

function ProxySection({ proxy }) {
  if (!proxy) {
    return (
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        <ApiOutlined /> ComProxy не подключён
      </Text>
    );
  }

  const lastSeen = proxy.last_seen_at ? dayjs(proxy.last_seen_at) : null;
  const isOffline = lastSeen && dayjs().diff(lastSeen, 'minute') > 5;

  return (
    <>
      <Divider orientation="left" orientationMargin={0} style={{ margin: '12px 0 8px' }}>
        <Space size={4}>
          <ApiOutlined />
          <Text type="secondary" style={{ fontSize: 13 }}>ComProxy</Text>
          {isOffline && <Tag color="default">офлайн</Tag>}
        </Space>
      </Divider>
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3, lg: 3 }}>
        <Descriptions.Item label="ComProxy">
          <Tag color="blue">{proxy.comproxy_version || '—'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Прошивка">
          <Tag color="cyan">{proxy.firmware_version || '—'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="ФФД">
          {proxy.ffd_version || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Смена">
          <ShiftTag proxy={proxy} />
        </Descriptions.Item>
        <Descriptions.Item label="IP">
          {proxy.ip_address || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Последний отклик">
          {lastSeen ? (
            <Tooltip title={lastSeen.format('DD.MM.YYYY HH:mm:ss')}>
              <Text type={isOffline ? 'secondary' : undefined}>
                {lastSeen.fromNow()}
              </Text>
            </Tooltip>
          ) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Не отправлено в ОФД">
          {proxy.unsent_ofd_count > 0
            ? <Tag color="warning">{proxy.unsent_ofd_count}</Tag>
            : <Tag color="green">0</Tag>}
        </Descriptions.Item>
        {proxy.kkt_flags_fatal > 0 && (
          <Descriptions.Item label="Фатальные ошибки" span={3}>
            <Tag color="red">Есть фатальные ошибки (flags: {proxy.kkt_flags_fatal})</Tag>
          </Descriptions.Item>
        )}
      </Descriptions>
    </>
  );
}

export default function ClientDetailKkt({ kktData, kktFetching, kktRefreshing, fetchKktFromOfd, refreshKktByRnm, deleteKkt }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16 }}>🧾 Кассовая техника</Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshKktByRnm}
            loading={kktRefreshing}
            disabled={kktData.length === 0}
          >
            Обновить по РНМ
          </Button>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={fetchKktFromOfd}
            loading={kktFetching}
          >
            Получить данные с ОФД
          </Button>
        </Space>
      </div>

      {kktData.length === 0 ? (
        <Empty
          description={
            <span>
              Нет данных ККТ.<br />
              Для загрузки нажмите «Получить данные с ОФД».
            </span>
          }
          style={{ padding: '40px 0' }}
        />
      ) : (
        kktData.map((kkt) => (
          <Card
            key={kkt.id}
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <span>🖨️ {kkt.kkt_model || 'ККТ'}</span>
                <Tag color="blue">РНМ: {kkt.kkt_reg_id}</Tag>
              </Space>
            }
            extra={
              <Space>
                {kkt.fetched_at && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Обновлено: {dayjs(kkt.fetched_at).format('DD.MM.YYYY HH:mm')}
                  </Text>
                )}
                <Popconfirm
                  title="Удалить ККТ?"
                  description="Данные этой ККТ будут удалены из системы."
                  onConfirm={() => deleteKkt(kkt.id)}
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                >
                  <Button icon={<DeleteOutlined />} size="small" danger type="text" />
                </Popconfirm>
              </Space>
            }
          >
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 2, lg: 3 }}>
              <Descriptions.Item label="Модель ККТ">
                <Text strong>{kkt.kkt_model || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="РНМ">
                <CopyField value={kkt.kkt_reg_id}>{kkt.kkt_reg_id || '—'}</CopyField>
              </Descriptions.Item>
              <Descriptions.Item label="Серийный номер">
                <CopyField value={kkt.serial_number}>{kkt.serial_number || '—'}</CopyField>
              </Descriptions.Item>
              <Descriptions.Item label="Номер ФН">
                <CopyField value={kkt.fn_number}>{kkt.fn_number || '—'}</CopyField>
              </Descriptions.Item>
              <Descriptions.Item label="Конец срока ФН">
                {kkt.fn_end_date ? (
                  <Tag color={dayjs(kkt.fn_end_date).isBefore(dayjs().add(90, 'day')) ? 'red' : 'green'}>
                    {dayjs(kkt.fn_end_date).format('DD.MM.YYYY')}
                  </Tag>
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Конец договора ОФД">
                {kkt.contract_end_date ? (
                  <Tag color={dayjs(kkt.contract_end_date).isBefore(dayjs().add(30, 'day')) ? 'red' : 'green'}>
                    {dayjs(kkt.contract_end_date).format('DD.MM.YYYY')}
                  </Tag>
                ) : '—'}
              </Descriptions.Item>
              {kkt.fiscal_address && (
                <Descriptions.Item label="Адрес установки" span={3}>
                  {kkt.fiscal_address}
                </Descriptions.Item>
              )}
            </Descriptions>
            <ProxySection proxy={kkt.proxy} />
          </Card>
        ))
      )}
    </div>
  );
}
