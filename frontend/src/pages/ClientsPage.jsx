import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Typography, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { clientsAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const navigate = useNavigate();
  const permissions = useAuthStore((s) => s.permissions);

  const fetchClients = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await clientsAPI.list({
        page,
        search: search || undefined,
        status: status || undefined,
      });
      setClients(data.results);
      setPagination((p) => ({ ...p, total: data.count, current: page }));
    } catch {
      message.error('Ошибка загрузки клиентов');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { fetchClients(1); }, [fetchClients]);

  const columns = [
    {
      title: 'Адрес',
      dataIndex: 'address',
      render: (address, r) => (
        <Button type="link" onClick={() => navigate(`/clients/${r.id}`)} style={{ padding: 0, fontWeight: 500, textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}>
          {address || r.display_name || '—'}
        </Button>
      ),
    },
    { title: 'Компания', dataIndex: 'company', render: (v) => v || '—' },
    { title: 'ИНН', dataIndex: 'inn', render: (v) => v || '—' },
    { title: 'Провайдер', dataIndex: 'provider_name', render: (v) => v || '—' },
    { title: 'Телефон', dataIndex: 'phone', render: (v) => v || '—' },
    { title: 'Email', dataIndex: 'email', render: (v) => v || '—' },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (v) => (
        <Tag color={v === 'active' ? 'green' : 'default'}>
          {v === 'active' ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Клиенты</Title>
        {permissions.can_create_client && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clients/new')}>
            Добавить клиента
          </Button>
        )}
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Поиск по адресу, телефону, email, компании, ИНН..."
          style={{ width: 420 }}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={() => fetchClients(1)}
          allowClear
        />
        <Select
          placeholder="Статус" style={{ width: 160 }} allowClear
          value={status || undefined}
          onChange={(v) => setStatus(v || '')}
          options={[
            { value: 'active', label: 'Активен' },
            { value: 'inactive', label: 'Неактивен' },
          ]}
        />
      </Space>

      <Table
        columns={columns} dataSource={clients} rowKey="id"
        loading={loading} bordered size="middle"
        pagination={{
          ...pagination, showSizeChanger: false,
          showTotal: (total) => `Всего: ${total}`,
          onChange: fetchClients,
        }}
      />
    </div>
  );
}
