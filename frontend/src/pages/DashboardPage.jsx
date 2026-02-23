import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Tag, Spin, Empty } from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, CloseCircleOutlined,
  RiseOutlined, CalendarOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';

const { Title, Text } = Typography;

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];

function StatCard({ icon, title, value, color, sub }) {
  return (
    <Card style={{ height: '100%' }} styles={{ body: { padding: '20px 24px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ fontSize: 32, fontWeight: 700, color: color || '#222', lineHeight: 1.2, marginTop: 4 }}>
            {value ?? <Spin size="small" />}
          </div>
          {sub && <Text type="secondary" style={{ fontSize: 12 }}>{sub}</Text>}
        </div>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon, { style: { fontSize: 24, color } })}
        </div>
      </div>
    </Card>
  );
}

function ActivityIcon({ action }) {
  if (action.includes('создана')) return '🆕';
  if (action.includes('заметка')) return '💬';
  if (action.includes('Провайдер')) return '🌐';
  if (action.includes('Статус')) return '🔄';
  if (action.includes('передан')) return '📤';
  if (action.includes('IP') || action.includes('Подсеть')) return '🖧';
  return '✏️';
}

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/clients/dashboard/')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) return <Empty description="Не удалось загрузить статистику" />;

  return (
    <div>
      <Title level={4} style={{ margin: '0 0 20px' }}>Дашборд</Title>

      {/* ===== КАРТОЧКИ СТАТИСТИКИ ===== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<TeamOutlined />}
            title="Всего клиентов"
            value={stats.total}
            color="#1677ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CheckCircleOutlined />}
            title="Активных"
            value={stats.active}
            color="#52c41a"
            sub={stats.total ? `${Math.round(stats.active / stats.total * 100)}% от общего числа` : ''}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CloseCircleOutlined />}
            title="Неактивных"
            value={stats.inactive}
            color="#ff4d4f"
            sub={stats.total ? `${Math.round(stats.inactive / stats.total * 100)}% от общего числа` : ''}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<RiseOutlined />}
            title="Новых за месяц"
            value={stats.new_month}
            color="#faad14"
            sub={`За неделю: ${stats.new_week}`}
          />
        </Col>
      </Row>

      {/* ===== ГРАФИКИ ===== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* График новых клиентов по месяцам */}
        <Col xs={24} lg={14}>
          <Card title={<><CalendarOutlined style={{ marginRight: 8, color: '#1677ff' }} />Новые клиенты по месяцам</>} style={{ height: '100%' }}>
            {stats.monthly?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.monthly} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartTooltip
                    formatter={(v) => [v, 'Клиентов']}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="count" fill="#1677ff" radius={[4, 4, 0, 0]} name="Клиентов" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных" />}
          </Card>
        </Col>

        {/* Круговая — по типу подключения */}
        <Col xs={24} lg={10}>
          <Card title="По типу подключения" style={{ height: '100%' }}>
            {stats.by_connection?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.by_connection}
                    cx="50%" cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    labelLine={false}
                    label={CustomPieLabel}
                  >
                    {stats.by_connection.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartTooltip
                    formatter={(v, n) => [v, n]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Провайдеры */}
        <Col xs={24} lg={12}>
          <Card title="Клиенты по провайдерам" style={{ height: '100%' }}>
            {stats.by_provider?.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={stats.by_provider}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category" dataKey="name"
                    tick={{ fontSize: 12 }} width={130}
                    tickFormatter={v => v.length > 16 ? v.slice(0, 16) + '…' : v}
                  />
                  <RechartTooltip
                    formatter={(v) => [v, 'Клиентов']}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="value" fill="#1677ff" radius={[0, 4, 4, 0]} name="Клиентов" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных" />}
          </Card>
        </Col>

        {/* Последние активности */}
        <Col xs={24} lg={12}>
          <Card title="Последние изменения" style={{ height: '100%' }}>
            {stats.recent_activities?.length ? (
              <div style={{ maxHeight: 264, overflowY: 'auto' }}>
                {stats.recent_activities.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/clients/${a.client_id}`)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '8px 4px', borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f7ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>
                      <ActivityIcon action={a.action} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        strong
                        style={{ fontSize: 12, color: '#1677ff', display: 'block',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {a.client_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#333', display: 'block',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.action.split('\n')[0].replace('Изменено: ', '')}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {a.user_name} · {dayjs(a.created_at).format('DD.MM.YYYY HH:mm')}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет активности" />}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
