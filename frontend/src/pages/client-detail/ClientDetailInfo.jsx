import React from 'react';
import { Card, Descriptions, Space, Button, Tag, Tooltip, Typography } from 'antd';
import { GlobalOutlined, SyncOutlined } from '@ant-design/icons';
import { CopyField, PingStatus, copyToClipboard } from './helpers';
import { message } from 'antd';

const { Text } = Typography;

// Иконка WinBox (RouterOS логотип — стилизованная "W")
const WinBoxIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="14" height="14" rx="3" fill="#CC0000"/>
    <text x="2" y="11" fontSize="9" fontWeight="bold" fill="white" fontFamily="monospace">W</text>
  </svg>
);

// Иконка LiteManager (стилизованная "LM")
const LiteManagerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="14" height="14" rx="3" fill="#0066CC"/>
    <text x="1" y="11" fontSize="7" fontWeight="bold" fill="white" fontFamily="monospace">LM</text>
  </svg>
);

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
                <>
                  <Tooltip title="Скопировать">
                    <Button type="text" size="small"
                      icon={<span style={{ color: '#1677ff' }}>⎘</span>}
                      onClick={() => { copyToClipboard(client.mikrotik_ip); message.success('Скопировано!', 1); }}
                      style={{ padding: '0 2px', height: 'auto' }}
                    />
                  </Tooltip>
                  <Tooltip title={`Открыть в WinBox (${client.mikrotik_ip})`}>
                    <Button type="text" size="small"
                      icon={<WinBoxIcon />}
                      onClick={() => { window.location.href = `winbox://${client.mikrotik_ip}`; }}
                      style={{ padding: '0 2px', height: 'auto' }}
                    />
                  </Tooltip>
                </>
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
                <>
                  <Tooltip title="Скопировать">
                    <Button type="text" size="small"
                      icon={<span style={{ color: '#1677ff' }}>⎘</span>}
                      onClick={() => { copyToClipboard(client.server_ip); message.success('Скопировано!', 1); }}
                      style={{ padding: '0 2px', height: 'auto' }}
                    />
                  </Tooltip>
                  <Tooltip title={`Подключиться через LiteManager (${client.server_ip})`}>
                    <Button type="text" size="small"
                      icon={<LiteManagerIcon />}
                      onClick={() => { window.location.href = `litemanager://${client.server_ip}`; }}
                      style={{ padding: '0 2px', height: 'auto' }}
                    />
                  </Tooltip>
                </>
              )}
              <PingStatus status={pingResults.server_ip} ip={client.server_ip} />
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </>
  );
}
