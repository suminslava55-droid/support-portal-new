import React from 'react';
import { Card, Descriptions, Space, Button, Tag, Text, Tooltip, Typography } from 'antd';
import { GlobalOutlined, SyncOutlined } from '@ant-design/icons';
import { CopyField, PingStatus, copyToClipboard } from './helpers';
import { message } from 'antd';

const { Text } = Typography;

export default function ClientDetailInfo({ client, pingResults, pinging, checkPing }) {
  return (
    <>
      <Card title="Информация о клиенте" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Адрес" span={2}>{client.address || '—'}</Descriptions.Item>
          <Descriptions.Item label="Компания">{client.company || '—'}</Descriptions.Item>
          <Descriptions.Item label="ИНН"><CopyField value={client.inn} /></Descriptions.Item>
          <Descriptions.Item label="Телефон"><CopyField value={client.phone} /></Descriptions.Item>
          <Descriptions.Item label="ICCID"><CopyField value={client.iccid} /></Descriptions.Item>
          <Descriptions.Item label="Email"><CopyField value={client.email} /></Descriptions.Item>
          <Descriptions.Item label="Код аптеки (UT)"><CopyField value={client.pharmacy_code} /></Descriptions.Item>
          <Descriptions.Item label="Код склада"><CopyField value={client.warehouse_code} /></Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={<Space><GlobalOutlined style={{ color: '#1677ff' }} /><span>Сеть</span></Space>}
        extra={
          <Tooltip title="Проверить доступность IP">
            <Button size="small" icon={<SyncOutlined spin={pinging} />} onClick={checkPing} loading={pinging}>
              Проверить доступность
            </Button>
          </Tooltip>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Подсеть аптеки">
            <CopyField value={client.subnet} />
          </Descriptions.Item>
          <Descriptions.Item label="Внешний IP">
            <Space>
              {client.external_ip ? (
                <a href={`http://${client.external_ip}`} target="_blank" rel="noreferrer"
                  style={{ fontFamily: 'monospace', fontSize: 13 }}>
                  {client.external_ip}
                </a>
              ) : <Text type="secondary">—</Text>}
              {client.external_ip && (
                <Tooltip title="Скопировать">
                  <Button type="text" size="small"
                    icon={<span style={{ color: '#1677ff' }}>⎘</span>}
                    onClick={() => { copyToClipboard(client.external_ip); message.success('Скопировано!', 1); }}
                    style={{ padding: '0 2px', height: 'auto' }}
                  />
                </Tooltip>
              )}
              <PingStatus status={pingResults.external_ip} ip={client.external_ip} />
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Микротик IP">
            <Space>
              <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                {client.mikrotik_ip
                  ? <a href={`http://${client.mikrotik_ip}`} target="_blank" rel="noreferrer"
                      style={{ color: 'inherit' }}>{client.mikrotik_ip}</a>
                  : '—'}
              </Tag>
              {client.mikrotik_ip && (
                <Tooltip title="Скопировать">
                  <Button type="text" size="small"
                    onClick={() => { copyToClipboard(client.mikrotik_ip); message.success('Скопировано!', 1); }}
                    style={{ padding: '0 2px', height: 'auto' }}
                  />
                </Tooltip>
              )}
              <PingStatus status={pingResults.mikrotik_ip} ip={client.mikrotik_ip} />
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Сервер IP">
            <Space>
              <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                {client.server_ip || '—'}
              </Tag>
              {client.server_ip && (
                <Tooltip title="Скопировать">
                  <Button type="text" size="small"
                    onClick={() => { copyToClipboard(client.server_ip); message.success('Скопировано!', 1); }}
                    style={{ padding: '0 2px', height: 'auto' }}
                  />
                </Tooltip>
              )}
              <PingStatus status={pingResults.server_ip} ip={client.server_ip} />
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </>
  );
}
