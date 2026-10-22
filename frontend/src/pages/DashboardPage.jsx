import React, { useState, useEffect } from 'react';
import { Typography, Spin, Tag, Tooltip, Button, Result, Tabs } from 'antd';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { comproxyAPI } from '../api';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

const { Title } = Typography;

const DUTY_LABELS = {
  phone:     { label: 'Телефон',        bg: '#00FF00', color: '#1a5200' },
  day:       { label: 'Работа днём',    bg: '#0000FF', color: '#fff' },
  phone_day: { label: 'Телефон + день', bg: '#00cc00', color: '#fff' },
  birthday:  { label: 'День рождения',  bg: '#eb2f96', color: '#fff' },
  vacation:  { label: 'Отпуск',         bg: '#13c2c2', color: '#fff' },
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
      <Tooltip title={label} placement="topLeft">
        <div style={{ width: 160, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'default' }}>
          {label}
        </div>
      </Tooltip>
      <div style={{ flex: 1, height: 8, background: 'rgba(128,128,128,0.15)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: label === 'Без провайдера' ? '#888' : '#378ADD', borderRadius: 4 }} />
      </div>
      <div style={{ width: 28, textAlign: 'right', color: '#888', flexShrink: 0 }}>{value}</div>
    </div>
  );
}

// Строка «адрес — дата» для ближайших замен ФН / окончаний договора ОФД
function KktDateRow({ address, date, daysLeft, clientId, regId }) {
  let badgeColor = 'orange';
  if (daysLeft < 0) badgeColor = 'red';
  else if (daysLeft <= 30) badgeColor = 'red';
  else if (daysLeft <= 60) badgeColor = 'orange';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '0.5px solid rgba(128,128,128,0.15)', fontSize: 13,
    }}>
      <Tooltip title={regId ? `РНМ ${regId}` : undefined} placement="topLeft">
        <Link to={`/clients/${clientId}?tab=kkt`} style={{ color: '#1677ff' }}>
          {address}
        </Link>
      </Tooltip>
      <Tooltip title={daysLeft === 0 ? 'сегодня' : `через ${daysLeft} дн.`}>
        <Tag color={badgeColor} style={{ margin: 0, fontSize: 11 }}>{date}</Tag>
      </Tooltip>
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
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13,
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

function ActivityRow({ userName, action, clientName, clientId, createdAt }) {
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
          <Link to={`/clients/${clientId}`} style={{ color: '#1677ff' }}>
            {clientName}
          </Link>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>{timeStr}</div>
    </div>
  );
}

/* ─── Дежурства: сегодня + завтра блоками-днями ── */

function DutyDay({ dayName, dateLabel, highlight, duty, birthdays, vacations }) {
  const isDark = useThemeStore((s) => s.isDark);
  const empty = !(duty || []).length && !(birthdays || []).length && !(vacations || []).length;
  // «Сегодня» — индиго-акцент слева и светлая подложка, «Завтра» — нейтральный фон
  const bg = highlight
    ? (isDark ? 'rgba(99,102,241,0.14)' : '#EEF2FF')
    : (isDark ? 'rgba(255,255,255,0.04)' : '#F7F7F8');
  return (
    <div style={{
      background: bg,
      borderLeft: `3px solid ${highlight ? '#4F46E5' : 'transparent'}`,
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: empty ? 0 : 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: highlight ? (isDark ? '#a5b4fc' : '#4F46E5') : '#888',
        }}>
          {dayName}
        </span>
        <span style={{ fontSize: 12, color: '#888' }}>{dateLabel}</span>
      </div>
      {empty
        ? <div style={{ fontSize: 13, color: '#aaa', marginTop: 6 }}>Нет событий</div>
        : <>
            {(duty || []).map((d, i) => (
              <DutyPerson key={`duty-${d.user_id}`} name={d.name} initials={d.initials} dutyType={d.duty_type} idx={i} />
            ))}
            {(birthdays || []).map((d, i) => (
              <DutyPerson key={`bday-${d.user_id}`} name={d.name} initials={d.initials} dutyType="birthday" idx={i} />
            ))}
            {(vacations || []).map((d, i) => (
              <DutyPerson key={`vac-${d.user_id}`} name={d.name} initials={d.initials} dutyType="vacation" idx={i} />
            ))}
          </>
      }
    </div>
  );
}

/* ─── Иконки вкладок ComProxy (currentColor, 18px) ── */

const svgProps = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
};

// Прошивка — микросхема
const FirmwareIcon = () => (
  <svg {...svgProps}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="0.8" />
    <path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
  </svg>
);

// ФФД — фискальный документ (чек)
const FfdIcon = () => (
  <svg {...svgProps}>
    <path d="M6 2.5h12v19l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
    <path d="M9 7.5h6M9 11h6M9 14.5h3.5" />
  </svg>
);

// Батарея
const BatteryIcon = () => (
  <svg {...svgProps}>
    <rect x="2.5" y="7" width="17" height="10" rx="2" />
    <path d="M21.5 10.5v3" />
    <rect x="5" y="9.5" width="5" height="5" rx="0.6" fill="currentColor" stroke="none" />
  </svg>
);

// Не отправлено в ОФД — облако со стрелкой вверх
const UnsentOfdIcon = () => (
  <svg {...svgProps}>
    <path d="M7 18.5H6.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 16.6 8.6 4.5 4.5 0 0 1 17.5 18.5H17" />
    <path d="M12 21v-8M9 15.5l3-3 3 3" />
  </svg>
);

/* ─── Карточка ComProxy ────────────────────────────── */

function ComProxyCountBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
      background: '#ff4d4f', color: '#fff', fontSize: 11, lineHeight: '18px', textAlign: 'center',
    }}>
      {count}
    </span>
  );
}

function ComProxyDeviceRow({ item, tag }) {
  const address = item.client_id
    ? <Link to={`/clients/${item.client_id}?tab=kkt`} style={{ color: '#1677ff' }}>{item.address}</Link>
    : <span>{item.address}</span>;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      padding: '7px 0', borderBottom: '0.5px solid rgba(128,128,128,0.15)', fontSize: 13,
    }}>
      <Tooltip title={item.registry_number ? `РНМ ${item.registry_number}` : undefined} placement="topLeft">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {address}
        </span>
      </Tooltip>
      {tag}
    </div>
  );
}

function ComProxyListFooter({ count, shown }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginTop: 8 }}>
      <span>{count > shown ? `Показано ${shown} из ${count}` : `Всего: ${count}`}</span>
      <Link to="/comproxy">Все устройства →</Link>
    </div>
  );
}

const COMPROXY_TABS = {
  firmware: 'Прошивка',
  ffd: 'ФФД',
  battery: 'Батарея',
  unsent_ofd: 'Не отправлено в ОФД',
};

function ComProxyCard() {
  const [cp, setCp] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('firmware');

  useEffect(() => {
    comproxyAPI.getDashboard()
      .then(({ data }) => setCp(data))
      .catch(() => setFailed(true));
  }, []);

  const tabLabel = (key, Icon, count) => (
    <Tooltip title={COMPROXY_TABS[key]}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 2px' }}>
        <Icon />
        <ComProxyCountBadge count={count} />
      </span>
    </Tooltip>
  );

  const distribution = (rows) => {
    const max = Math.max(...rows.map((r) => r.value), 1);
    return rows.length === 0
      ? <div style={{ fontSize: 13, color: '#aaa' }}>Нет данных</div>
      : rows.slice(0, 8).map((r) => <BarRow key={r.name} label={r.name} value={r.value} max={max} />);
  };

  let body;
  if (failed) body = <div style={{ fontSize: 13, color: '#aaa' }}>Не удалось загрузить данные ComProxy</div>;
  else if (!cp) body = <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;

  const items = cp ? [
    { key: 'firmware', label: tabLabel('firmware', FirmwareIcon), children: distribution(cp.firmware) },
    { key: 'ffd', label: tabLabel('ffd', FfdIcon), children: distribution(cp.ffd) },
    {
      key: 'battery',
      label: tabLabel('battery', BatteryIcon, cp.battery.count),
      children: cp.battery.count === 0
        ? <div style={{ fontSize: 13, color: '#aaa' }}>Все батарейки в норме (≥ 3.0 В)</div>
        : <>
            {cp.battery.items.map((it) => (
              <ComProxyDeviceRow key={it.uuid} item={it} tag={
                <Tooltip title={it.value >= 2700 ? 'Садится' : 'Требуется замена'}>
                  <Tag color={it.value >= 2700 ? 'orange' : 'red'} style={{ margin: 0, fontSize: 11 }}>
                    {(it.value / 1000).toFixed(2)} В
                  </Tag>
                </Tooltip>
              } />
            ))}
            <ComProxyListFooter count={cp.battery.count} shown={cp.battery.items.length} />
          </>,
    },
    {
      key: 'unsent_ofd',
      label: tabLabel('unsent_ofd', UnsentOfdIcon, cp.unsent_ofd.count),
      children: cp.unsent_ofd.count === 0
        ? <div style={{ fontSize: 13, color: '#aaa' }}>Все документы отправлены в ОФД</div>
        : <>
            {cp.unsent_ofd.items.map((it) => (
              <ComProxyDeviceRow key={it.uuid} item={it} tag={
                <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>{it.value}</Tag>
              } />
            ))}
            <ComProxyListFooter count={cp.unsent_ofd.count} shown={cp.unsent_ofd.items.length} />
          </>,
    },
  ] : [];

  return (
    <Card title={`ComProxy · ${COMPROXY_TABS[tab]}`}>
      {body || <Tabs size="small" activeKey={tab} onChange={setTab} style={{ marginTop: -8 }} items={items} />}
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdminOrSysadmin = user?.is_superuser || ['admin', 'sysadmin'].includes(user?.role_data?.name);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setError(null);
    setLoading(true);
    api.get('/clients/dashboard/')
      .then(({ data }) => setData(data))
      .catch(() => setError('Ошибка загрузки дашборда'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  );

  if (error) return (
    <Result status="error" title={error}
      extra={<Button type="primary" onClick={loadData}>Повторить</Button>} />
  );

  if (!data) return null;

  const maxProvider = Math.max(...(data.by_provider || []).map(p => p.value), 1);

  const todayLabel = dayjs().format('D MMMM, dd');
  const tomorrowLabel = dayjs().add(1, 'day').format('D MMMM, dd');

  return (
    <div>
      <Title level={3} style={{ marginBottom: 20 }}>Дашборд</Title>

      {/* ── Метрики ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
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

        {/* Ближайшие замены ФН / окончания договора ОФД */}
        <Card>
          <Tabs
            size="small"
            style={{ marginTop: -8 }}
            items={[
              {
                key: 'fn',
                label: 'Ближайшие замены ФН',
                children: (data.fn_nearest || []).length === 0
                  ? <div style={{ fontSize: 13, color: '#aaa' }}>Нет ближайших замен</div>
                  : (data.fn_nearest || []).map((fn, i) => (
                    <KktDateRow
                      key={i}
                      address={fn.address}
                      date={fn.fn_end_date}
                      daysLeft={fn.days_left}
                      clientId={fn.client_id}
                      regId={fn.kkt_reg_id}
                    />
                  )),
              },
              {
                key: 'ofd',
                label: 'Конец договора ОФД',
                children: (data.ofd_nearest || []).length === 0
                  ? <div style={{ fontSize: 13, color: '#aaa' }}>Нет ближайших окончаний договора</div>
                  : (data.ofd_nearest || []).map((o, i) => (
                    <KktDateRow
                      key={i}
                      address={o.address}
                      date={o.contract_end_date}
                      daysLeft={o.days_left}
                      clientId={o.client_id}
                      regId={o.kkt_reg_id}
                    />
                  )),
              },
            ]}
          />
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

      {/* ── Дежурства + ComProxy + активность ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isAdminOrSysadmin ? 3 : 2}, minmax(0,1fr))`, gap: 10 }}>

        {/* Сегодня + завтра */}
        <Card title="Дежурства">
          <DutyDay
            dayName="Сегодня"
            dateLabel={todayLabel}
            highlight
            duty={data.duty_today}
            birthdays={data.birthdays_today}
            vacations={data.vacations_today}
          />
          <div style={{ height: 10 }} />
          <DutyDay
            dayName="Завтра"
            dateLabel={tomorrowLabel}
            duty={data.duty_tomorrow}
            birthdays={data.birthdays_tomorrow}
            vacations={data.vacations_tomorrow}
          />
        </Card>

        {/* ComProxy — только для ролей с доступом к разделу */}
        {isAdminOrSysadmin && <ComProxyCard />}

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
            />
          ))}
        </Card>

      </div>
    </div>
  );
}
