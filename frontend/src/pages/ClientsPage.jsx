import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Typography, Tooltip, message } from 'antd';
import { PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { clientsAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

const STATUS_COLOR = { active: 'green', inactive: 'default' };
const STATUS_LABEL = { active: 'Активен', inactive: 'Неактивен' };

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
      title: 'ФИО',
      dataIndex: 'full_name',
      render: (name, r) => (
        <Button type="link" onClick={() => navigate(`/clients/${r.id}`)} style={{ padding: 0, fontWeight: 500 }}>
          {name}
        </Button>
      ),
    },
    { title: 'Телефон', dataIndex: 'phone', render: (v) => v || '—' },
    { title: 'Email', dataIndex: 'email', render: (v) => v || '—' },
    { title: 'Компания', dataIndex: 'company', render: (v) => v || '—' },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: 'Ответственный',
      dataIndex: 'assigned_to_name',
      render: (v) => v ? <><UserOutlined /> {v}</> : '—',
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
          placeholder="Поиск по ФИО, телефону, email, компании..."
          style={{ width: 340 }}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={() => fetchClients(1)}
          allowClear
        />
        <Select
          placeholder="Статус"
          style={{ width: 160 }}
          allowClear
          value={status || undefined}
          onChange={(v) => setStatus(v || '')}
          options={[
            { value: 'active', label: 'Активен' },
            { value: 'inactive', label: 'Неактивен' },
          ]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={clients}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: false,
          showTotal: (total) => `Всего: ${total}`,
          onChange: fetchClients,
        }}
        bordered
        size="middle"
      />
    </div>
  );
}
