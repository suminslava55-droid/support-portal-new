import React, { useState, useEffect } from 'react';
import { Typography, Spin, Tag, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import useThemeStore from '../store/themeStore';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

const { Title } = Typography;

const DUTY_LABELS = {
  phone:     { label: 'Телефон',       bg: '#00FF00', color: '#1a5200' },
  day:       { label: 'Работа днём',   bg: '#0000FF', color: '#fff' },
  phone_day: { label: 'Телефон + день', bg: '#00cc00', color: '#fff' },
};

const AVATAR_COLORS = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FAECE7', color: '#993C1D' },
  { bg: '#EAF3DE', color: '#3B6D11' },
];

function getAvatarColor(idx) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function MetricCard({ label, value, sub, valueColor }) {
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <div style={{
      background: isDark ? '#1f1f1f' : '#f5f5f5',
      borderRadius: 8,
      padding: '12px 14px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: valueColor || 'inherit' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children, style }) {
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <div style={{
      background: isDark ? '#141414' : '#fff',
      border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 12,
      padding: '14px 16px',
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 500, color: '#888',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '0.5px solid rgba(128,128,128,0.2)', margin: '10px 0' }} />;
}

function BarRow({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
      <div style={{ width: 110, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 8, background: 'rgba(128,128,128,0.15)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: label === 'Без провайдера' ? '#888' : '#378ADD', borderRadius: 4 }} />
      </div>
      <div style={{ width: 28, textAlign: 'right', color: '#888', flexShrink: 0 }}>{value}</div>
    </div>
  );
}

function FnRow({ address, fnEndDate, daysLeft, clientId, navigate }) {
  let badgeColor = 'orange';
  if (daysLeft < 0) badgeColor = 'red';
  else if (daysLeft <= 30) badgeColor = 'red';
  else if (daysLeft <= 60) badgeColor = 'orange';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '0.5px solid rgba(128,128,128,0.15)', fontSize: 13,
    }}>
      <span
        onClick={() => navigate(`/clients/${clientId}`, { state: { tab: 'kkt' } })}
        style={{ color: '#1677ff', cursor: 'pointer' }}
      >
        {address}
      </span>
      <Tag color={badgeColor} style={{ margin: 0, fontSize: 11 }}>{fnEndDate}</Tag>
    </div>
  );
}

function TaskRow({ name, status, lastRunAt }) {
  const dotColor = { success: '#52c41a', error: '#ff4d4f', running: '#1677ff', idle: '#aaa' }[status] || '#aaa';
  const badgeProps = {
    success: { color: 'success', text: 'OK' },
    error:   { color: 'error',   text: 'Ошибка' },
    running: { color: 'processing', text: 'Выполняется' },
    idle:    { color: 'default',  text: 'Ожидает' },
  }[status] || { color: 'default', text: status };

  const timeStr = lastRunAt ? dayjs(lastRunAt).format('HH:mm') : '—';
  const dateStr = lastRunAt ? dayjs(lastRunAt).format('DD.MM') : '';
  const isToday = lastRunAt && dayjs(lastRunAt).isSame(dayjs(), 'day');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
      borderBottom: '0.5px solid rgba(128,128,128,0.15)', fontSize: 13,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>{name}</div>
      <Tag color={badgeProps.color} style={{ margin: 0, fontSize: 11 }}>{badgeProps.text}</Tag>
      <div style={{ fontSize: 11, color: '#aaa', minWidth: 36, textAlign: 'right' }}>
        {isToday ? timeStr : dateStr}
      </div>
    </div>
  );
}

function DutyPerson({ name, initials, dutyType, idx }) {
  const duty = DUTY_LABELS[dutyType] || {};
  const av = getAvatarColor(idx);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
      borderBottom: '0.5px solid rgba(128,128,128,0.15)', fontSize: 13,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: av.bg, color: av.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 500, flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1 }}>{name}</div>
      <span style={{
        fontSize: 11, padding: '2px 7px', borderRadius: 20,
        background: duty.bg, color: duty.color, fontWeight: 500,
      }}>
        {duty.label}
      </span>
    </div>
  );
}

function ActivityRow({ userName, action, clientName, clientId, createdAt, navigate }) {
  const firstLine = action.split('\n')[0];
  const timeStr = dayjs(createdAt).isSame(dayjs(), 'day')
    ? dayjs(createdAt).format('HH:mm')
    : dayjs(createdAt).format('DD.MM');

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '6px 0',
      borderBottom: '0.5px solid rgba(128,128,128,0.15)', fontSize: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{userName}</div>
        <div style={{ color: '#888' }}>
          {firstLine} ·{' '}
          <span
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => navigate(`/clients/${clientId}`)}
          >
            {clientName}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>{timeStr}</div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/clients/dashboard/')
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  );

  if (!data) return null;

  const maxProvider = Math.max(...(data.by_provider || []).map(p => p.value), 1);

  const todayLabel = dayjs().format('D MMMM, dd');
  const tomorrowLabel = dayjs().add(1, 'day').format('D MMMM, dd');

  return (
    <div>
      <Title level={3} style={{ marginBottom: 20 }}>Дашборд</Title>

      {/* ── Метрики ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
        <MetricCard label="Всего клиентов" value={data.total} sub={`+${data.new_month} за месяц`} />
        <MetricCard label="Активных" value={data.active} sub={`${data.total ? Math.round(data.active / data.total * 100) : 0}%`} valueColor="#3B6D11" />
        <MetricCard label="ФН просрочен" value={data.fn_expired} sub="срок истёк" valueColor="#A32D2D" />
        <MetricCard label={`Замена ФН — ${data.fn_this_month_name}`} value={data.fn_this_month} sub="этот месяц" valueColor="#E24B4A" />
        <MetricCard label={`Замена ФН — ${data.fn_next_month_name}`} value={data.fn_next_month} sub="следующий месяц" valueColor="#BA7517" />
      </div>

      {/* ── Три карточки ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>

        {/* Провайдеры */}
        <Card title="Клиенты по провайдерам">
          {(data.by_provider || []).map(p => (
            <BarRow key={p.name} label={p.name} value={p.value} max={maxProvider} />
          ))}
        </Card>

        {/* Ближайшие замены ФН */}
        <Card title="Ближайшие замены ФН">
          {(data.fn_nearest || []).length === 0
            ? <div style={{ fontSize: 13, color: '#aaa' }}>Нет ближайших замен</div>
            : (data.fn_nearest || []).map((fn, i) => (
              <FnRow
                key={i}
                address={fn.address}
                fnEndDate={fn.fn_end_date}
                daysLeft={fn.days_left}
                clientId={fn.client_id}
                navigate={navigate}
              />
            ))
          }
        </Card>

        {/* Задания + бэкап */}
        <Card title="Регламентные задания">
          {(data.tasks || []).map(t => (
            <TaskRow key={t.task_id} name={t.name} status={t.status} lastRunAt={t.last_run_at} />
          ))}
          {data.backup && (
            <>
              <Divider />
              <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Бэкапы
              </div>
              {[
                ['Последний', data.backup.last_backup || '—'],
                ['Размер', data.backup.size_str || '—'],
                ['Хранится копий', `${data.backup.count} из 7`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#888' }}>{label}</span>
                  <span>{val}</span>
                </div>
              ))}
            </>
          )}
        </Card>

      </div>

      {/* ── Дежурства + активность ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>

        {/* Сегодня */}
        <Card title={`Сегодня · ${todayLabel}`}>
          {(data.duty_today || []).length === 0
            ? <div style={{ fontSize: 13, color: '#aaa' }}>Нет дежурных</div>
            : (data.duty_today || []).map((d, i) => (
              <DutyPerson key={d.user_id} name={d.name} initials={d.initials} dutyType={d.duty_type} idx={i} />
            ))
          }
        </Card>

        {/* Завтра */}
        <Card title={`Завтра · ${tomorrowLabel}`}>
          {(data.duty_tomorrow || []).length === 0
            ? <div style={{ fontSize: 13, color: '#aaa' }}>Нет дежурных</div>
            : (data.duty_tomorrow || []).map((d, i) => (
              <DutyPerson key={d.user_id} name={d.name} initials={d.initials} dutyType={d.duty_type} idx={i} />
            ))
          }
        </Card>

        {/* Последние изменения */}
        <Card title="Последние изменения">
          {(data.recent_activities || []).slice(0, 6).map(a => (
            <ActivityRow
              key={a.id}
              userName={a.user_name}
              action={a.action}
              clientName={a.client_name}
              clientId={a.client_id}
              createdAt={a.created_at}
              navigate={navigate}
            />
          ))}
        </Card>

      </div>
    </div>
  );
}
