import React from 'react';
import { Card, Button, Spin, Typography } from 'antd';
import { SettingOutlined, ReloadOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

const { Text } = Typography;

export default function SettingsDiagnostics({ packages, packagesLoading, loadPackages }) {
  return (
    <Card
      title={<span><SettingOutlined style={{ color: '#1677ff', marginRight: 8 }} />Зависимости Python</span>}
      extra={
        <Button size="small" icon={<ReloadOutlined />} onClick={loadPackages} loading={packagesLoading}>
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
            { key: 'paramiko',     label: 'paramiko',     desc: 'SSH-подключение к Микротику' },
            { key: 'openpyxl',    label: 'openpyxl',     desc: 'Экспорт в Excel (.xlsx)' },
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
  );
}
