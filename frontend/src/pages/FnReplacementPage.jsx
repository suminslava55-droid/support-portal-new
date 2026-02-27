import React, { useState } from 'react';
import { Tabs, Typography, Card } from 'antd';
import { FileSearchOutlined, CalendarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function FnReplacementPage() {
  const [activeTab, setActiveTab] = useState('general');

  const items = [
    {
      key: 'general',
      label: (
        <span>
          <FileSearchOutlined style={{ marginRight: 6 }} />
          Общий
        </span>
      ),
      children: (
        <Card style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <FileSearchOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
            <Title level={4} type="secondary">Общий список замен ФН</Title>
            <Text type="secondary">Содержимое будет добавлено позже</Text>
          </div>
        </Card>
      ),
    },
    {
      key: 'by-month',
      label: (
        <span>
          <CalendarOutlined style={{ marginRight: 6 }} />
          По месяцам
        </span>
      ),
      children: (
        <Card style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <CalendarOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
            <Title level={4} type="secondary">Замены ФН по месяцам</Title>
            <Text type="secondary">Содержимое будет добавлено позже</Text>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        🔄 Замена ФН
      </Title>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        size="large"
        type="card"
      />
    </div>
  );
}
