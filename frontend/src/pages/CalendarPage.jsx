import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Modal, Popover, Spin, Select,
  Table, Tag, Space, Tooltip, Row, Col,
} from 'antd';
import { LeftOutlined, RightOutlined, BarChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import api from '../api';
import useAuthStore from '../store/authStore';

dayjs.locale('ru');

const { Title, Text } = Typography;

const DUTY_TYPES = [
  { value: 'phone',     label: 'Телефон',         color: '#00FF00', textColor: '#000' },
  { value: 'day',       label: 'Работа днём',      color: '#0000FF', textColor: '#fff' },
  { value: 'phone_day', label: 'Телефон + день',   color: '#00FF00', textColor: '#000' },
  { value: 'vacation',  label: 'Отпуск',           color: '#FFFF00', textColor: '#000' },
  { value: 'busy',      label: 'Занят',            color: '#FF0000', textColor: '#fff' },
];

const DUTY_MAP = Object.fromEntries(DUTY_TYPES.map(d => [d.value, d]));
const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function isWeekend(date) {
  const d = dayjs(date).day();
  return d === 0 || d === 6;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [users, setUsers] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(null);
  const [reportModal, setReportModal] = useState(false);
  const [report, setReport] = useState(null);
  const [reportLabels, setReportLabels] = useState({});
  const permissions = useAuthStore((s) => s.permissions);
  const canEdit = permissions.can_edit_client;

  const year = currentDate.year();
  const month = currentDate.month();
  const daysInMonth = currentDate.daysInMonth();
  const days = Array.from({ length: daysInMonth }, (_, i) => currentDate.date(i + 1));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, scheduleRes] = await Promise.all([
        api.get('/auth/users/'),
        api.get('/clients/events/', { params: { year, month: month + 1 } }),
      ]);
      setUsers(usersRes.data.results || usersRes.data);
      const map = {};
      const items = scheduleRes.data.results || scheduleRes.data;
      items.forEach(item => {
        map[`${item.user}_${item.date}`] = item.duty_type;
      });
      setSchedule(map);
    } catch {}
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSetDuty = async (userId, date, dutyType) => {
    const key = `${userId}_${date}`;
    setPopoverOpen(null);
    setSaving(key);
    try {
      await api.post('/clients/events/set_duty/', { user_id: userId, date, duty_type: dutyType });
      setSchedule(prev => {
        const next = { ...prev };
        if (!dutyType) delete next[key];
        else next[key] = dutyType;
        return next;
      });
    } catch {}
    finally { setSaving(null); }
  };

  const openReport = async () => {
    try {
      const { data } = await api.get('/clients/events/report/', { params: { year, month: month + 1 } });
      setReport(data.report);
      setReportLabels(data.labels);
      setReportModal(true);
    } catch {}
  };

  const DutyPopoverContent = ({ userId, date }) => {
    const key = `${userId}_${date}`;
    const current = schedule[key];
    return (
      <div style={{ width: 185 }}>
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          {dayjs(date).format('D MMMM')}
        </div>
        {DUTY_TYPES.map(d => (
          <div
            key={d.value}
            onClick={() => handleSetDuty(userId, date, d.value)}
            style={{
              padding: '6px 10px', borderRadius: 4, marginBottom: 4, cursor: 'pointer',
              background: current === d.value ? d.color : '#f5f5f5',
              color: current === d.value ? d.textColor : '#333',
              fontWeight: current === d.value ? 600 : 400,
              border: `2px solid ${current === d.value ? d.color : 'transparent'}`,
              fontSize: 13,
            }}
          >
            {d.label}
          </div>
        ))}
        {current && (
          <div
            onClick={() => handleSetDuty(userId, date, '')}
            style={{
              padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
              background: '#fff1f0', color: '#ff4d4f',
              border: '1px solid #ffa39e', fontSize: 12, textAlign: 'center', marginTop: 4,
            }}
          >
            ✕ Очистить
          </div>
        )}
      </div>
    );
  };

  const nameCol = {
    title: 'Сотрудник',
    dataIndex: 'name',
    key: 'name',
    fixed: 'left',
    width: 160,
    render: (name) => <Text strong style={{ fontSize: 13 }}>{name}</Text>,
  };

  const dayCols = days.map(day => {
    const dateStr = day.format('YYYY-MM-DD');
    const weekend = isWeekend(day);
    return {
      title: (
        <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
          <div style={{ fontSize: 13, fontWeight: weekend ? 700 : 500, color: weekend ? '#FF9900' : '#333' }}>
            {day.date()}
          </div>
          <div style={{ fontSize: 10, color: weekend ? '#FF9900' : '#999' }}>
            {WEEKDAY_SHORT[day.day()]}
          </div>
        </div>
      ),
      key: dateStr,
      width: 44,
      align: 'center',
      onHeaderCell: () => ({ style: { background: weekend ? '#fff8ee' : '#fafafa', padding: '4px 2px' } }),
      render: (_, record) => {
        const key = `${record.id}_${dateStr}`;
        const dutyType = schedule[key];
        const duty = dutyType ? DUTY_MAP[dutyType] : null;
        const isSaving = saving === key;

        const cell = (
          <div style={{
            width: 36, height: 28, borderRadius: 4, margin: '0 auto',
            background: duty ? duty.color : (weekend ? '#fff8ee' : 'transparent'),
            cursor: canEdit ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: duty ? duty.textColor : '#ccc',
            border: duty ? 'none' : '1px dashed #e0e0e0',
          }}>
            {isSaving
              ? <Spin size="small" />
              : (duty ? <span style={{ fontSize: 9, fontWeight: 600 }}>{duty.label.slice(0, 3)}</span> : '')
            }
          </div>
        );

        if (!canEdit) return cell;
        return (
          <Popover
            content={<DutyPopoverContent userId={record.id} date={dateStr} />}
            trigger="click"
            open={popoverOpen === key}
            onOpenChange={(open) => setPopoverOpen(open ? key : null)}
            placement="bottom"
          >
            <Tooltip title={duty ? duty.label : 'Нажмите для выбора'} mouseEnterDelay={0.6}>
              {cell}
            </Tooltip>
          </Popover>
        );
      },
    };
  });

  const tableData = users.map(u => ({ key: u.id, id: u.id, name: u.full_name || u.email }));

  const reportColumns = [
    { title: 'Сотрудник', dataIndex: 'user_name', key: 'user_name', fixed: 'left', width: 160 },
    ...Object.entries(reportLabels).map(([k, label]) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: DUTY_MAP[k]?.color, margin: '0 auto 2px', border: '1px solid #ddd' }} />
          <span style={{ fontSize: 11 }}>{label}</span>
        </div>
      ),
      dataIndex: ['totals', k],
      key: k,
      align: 'center',
      width: 100,
      render: v => v > 0 ? <Tag color="blue">{v} дн.</Tag> : <Text type="secondary">—</Text>,
    })),
    { title: 'Итого', dataIndex: 'total', key: 'total', align: 'center', width: 70,
      render: v => <Text strong>{v}</Text> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => setCurrentDate(d => d.subtract(1, 'month'))} />
          <Title level={4} style={{ margin: 0, minWidth: 220, textAlign: 'center' }}>
            {MONTH_NAMES[month]} {year}
          </Title>
          <Button icon={<RightOutlined />} onClick={() => setCurrentDate(d => d.add(1, 'month'))} />
          <Button size="small" onClick={() => setCurrentDate(dayjs())} style={{ marginLeft: 8 }}>Сегодня</Button>
        </Space>
        <Button icon={<BarChartOutlined />} onClick={openReport}>Отчёт за месяц</Button>
      </div>

      <Card style={{ marginBottom: 12 }} styles={{ body: { padding: '8px 16px' } }}>
        <Space wrap size={16}>
          <Text type="secondary" style={{ fontSize: 12 }}>Обозначения:</Text>
          {DUTY_TYPES.map(d => (
            <Space key={d.value} size={6}>
              <div style={{ width: 16, height: 16, borderRadius: 3, background: d.color, border: '1px solid #ccc' }} />
              <Text style={{ fontSize: 12 }}>{d.label}</Text>
            </Space>
          ))}
          <Space size={6}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: '#fff8ee', border: '1px solid #FF9900' }} />
            <Text style={{ fontSize: 12, color: '#FF9900' }}>Выходной</Text>
          </Space>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={[nameCol, ...dayCols]}
          dataSource={tableData}
          loading={loading}
          pagination={false}
          scroll={{ x: 160 + daysInMonth * 44 }}
          size="small"
          bordered
          rowKey="id"
        />
      </Card>

      <Modal
        title={`Отчёт за ${MONTH_NAMES[month]} ${year}`}
        open={reportModal}
        onCancel={() => setReportModal(false)}
        footer={<Button onClick={() => setReportModal(false)}>Закрыть</Button>}
        width={720}
      >
        {report && (
          <Table
            columns={reportColumns}
            dataSource={report}
            rowKey="user_id"
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 500 }}
          />
        )}
      </Modal>
    </div>
  );
}
