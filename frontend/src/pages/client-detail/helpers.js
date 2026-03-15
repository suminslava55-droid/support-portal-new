import React from 'react';
import { Space, Button, Tooltip, Typography } from 'antd';
import {
  CopyOutlined, CheckCircleFilled, CloseCircleFilled,
  SyncOutlined, MinusCircleOutlined,
  FileOutlined, FilePdfOutlined, FileImageOutlined,
} from '@ant-design/icons';
import { message } from 'antd';

const { Text } = Typography;

export const CONNECTION_LABELS = {
  fiber: '⚡ Оптоволокно',
  dsl: '☎️ DSL',
  cable: '🔌 Кабель',
  wireless: '📡 Беспроводное',
  modem: '📶 Модем',
  mrnet: '↔️ MR-Net',
};

export const CONNECTION_COLORS = {
  fiber: 'blue', dsl: 'orange', cable: 'green', wireless: 'purple',
  modem: 'cyan', mrnet: 'geekblue',
};

export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

export function CopyField({ value, children }) {
  const handleCopy = () => {
    if (!value) return;
    copyToClipboard(value);
    message.success('Скопировано!', 1);
  };
  return (
    <Space size={6}>
      <span>{children || value || '—'}</span>
      {value && (
        <Tooltip title="Скопировать">
          <Button type="text" size="small"
            icon={<CopyOutlined style={{ color: '#1677ff' }} />}
            onClick={handleCopy} style={{ padding: '0 2px', height: 'auto' }}
          />
        </Tooltip>
      )}
    </Space>
  );
}

export function PingStatus({ status, ip }) {
  if (!ip) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
  if (status === 'checking') return <SyncOutlined spin style={{ color: '#1677ff' }} />;
  if (status === true) return (
    <Tooltip title={`${ip} — доступен`}>
      <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
    </Tooltip>
  );
  if (status === false) return (
    <Tooltip title={`${ip} — недоступен`}>
      <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />
    </Tooltip>
  );
  return (
    <Tooltip title="Не проверено">
      <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
    </Tooltip>
  );
}

export function ActivityIcon({ action }) {
  if (action.includes('Удалена ККТ')) return '🗑️';
  if (action.includes('Добавлена ККТ')) return '🖨️';
  return '✏️';
}

export function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <FileImageOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
  return <FileOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
}

export function formatSize(bytes) {
  if (!bytes) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
