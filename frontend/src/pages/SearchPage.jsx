import React, { useState, useRef } from 'react';
import { Input, Spin, Empty, Tag, Typography, Space, Card, Divider } from 'antd';
import { SearchOutlined, UserOutlined, PrinterOutlined, HistoryOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const { Title, Text } = Typography;

const TYPE_CONFIG = {
  client:   { icon: <UserOutlined />,      color: 'blue',    label: 'Клиент' },
  kkt:      { icon: <PrinterOutlined />,   color: 'purple',  label: 'ККТ' },
  activity: { icon: <HistoryOutlined />,   color: 'orange',  label: 'История' },
  note:     { icon: <FileTextOutlined />,  color: 'green',   label: 'Заметка' },
};

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fff566', padding: 0 }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const doSearch = async (q) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/clients/search/?q=${encodeURIComponent(q)}`);
      setResults(data.results || []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleClick = (clientId) => {
    navigate(`/clients/${clientId}`);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <SearchOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>Поиск</Title>
      </div>

      <Input
        size="large"
        placeholder="Введите номер ФН, серийный номер, РНМ, адрес, телефон..."
        prefix={<SearchOutlined style={{ color: '#bbb' }} />}
        value={query}
        onChange={handleChange}
        allowClear
        onClear={() => { setQuery(''); setResults([]); setSearched(false); }}
        autoFocus
      />

      {query.length === 1 && (
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Введите минимум 2 символа
        </Text>
      )}

      <div style={{ marginTop: 20 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <Empty description={`Ничего не найдено по запросу «${query}»`} />
        )}

        {!loading && results.length > 0 && (
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Найдено результатов: {results.length}
            </Text>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r, i) => {
                const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.client;
                return (
                  <Card
                    key={i}
                    size="small"
                    hoverable
                    onClick={() => handleClick(r.client_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Space size={6} style={{ marginBottom: 4 }}>
                          <Tag color={cfg.color} icon={cfg.icon} style={{ margin: 0 }}>
                            {cfg.label}
                          </Tag>
                          <Text strong style={{ fontSize: 14 }}>
                            {highlight(r.client_name, query)}
                          </Text>
                          {r.company && r.company !== r.client_name && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {r.company}
                            </Text>
                          )}
                        </Space>
                        <div style={{ fontSize: 13, color: '#555', wordBreak: 'break-all' }}>
                          {highlight(r.snippet, query)}
                        </div>
                        {(r.date || r.user) && (
                          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                            {r.user && <span>{r.user}</span>}
                            {r.user && r.date && <span> · </span>}
                            {r.date && <span>{r.date}</span>}
                          </div>
                        )}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {r.source}
                      </Text>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
