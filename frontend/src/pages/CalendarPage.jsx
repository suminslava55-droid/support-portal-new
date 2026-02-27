import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Modal, Popover, Spin,
  Table, Tag, Space, Tooltip, Input, Select, Popconfirm, message,
  Dropdown, Checkbox, Divider,
} from 'antd';
import { LeftOutlined, RightOutlined, BarChartOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import api from '../api';
import useAuthStore from '../store/authStore';

dayjs.locale('ru');

const { Text } = Typography;
const HIDDEN_USERS_KEY = 'calendar_hidden_users';
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

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [users, setUsers] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [holidays, setHolidays] = useState({}); // { 'YYYY-MM-DD': {is_holiday, note} }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(null);
  // Модал редактирования дня (вместо поповера — не закрывается при клике внутри)
  const [holidayModalDate, setHolidayModalDate] = useState(null);

  const openHolidayModal = (dateStr) => {
    if (holidayModalDate === dateStr) return; // уже открыт
    setHolidayNote(holidays[dateStr]?.note || '');
    setHolidayModalDate(dateStr);
  };

  const closeHolidayModal = () => {
    setHolidayModalDate(null);
    setHolidayNote('');
  };
  const [holidayNote, setHolidayNote] = useState('');
  const [reportModal, setReportModal] = useState(false);
  const [report, setReport] = useState(null);
  const [reportLabels, setReportLabels] = useState({});

  // Мультивыделение ячеек (Ctrl+клик, любые строки)
  const [selection, setSelection] = useState(null); // Set<"userId_dateStr"> | null
  const [selectionModal, setSelectionModal] = useState(false);
  const [hiddenUsers, setHiddenUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_USERS_KEY) || '[]'); }
    catch { return []; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role_data?.name === 'admin' || user?.is_superuser;
  const canEdit = permissions.can_edit_client;

  const year = currentDate.year();
  const month = currentDate.month();
  const daysInMonth = currentDate.daysInMonth();
  const days = Array.from({ length: daysInMonth }, (_, i) => currentDate.date(i + 1));

  // Escape — снять выделение
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') setSelection(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Определяем является ли день выходным (с учётом кастомных)
  const isDayHoliday = (dateStr) => {
    if (holidays[dateStr] !== undefined) {
      return holidays[dateStr].is_holiday;
    }
    const d = dayjs(dateStr).day();
    return d === 0 || d === 6;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, scheduleRes, holidaysRes] = await Promise.all([
        api.get('/auth/users/for_calendar/'),
        api.get('/clients/events/', { params: { year, month: month + 1 } }),
        api.get('/clients/events/holidays/', { params: { year, month: month + 1 } }),
      ]);
      setUsers(usersRes.data.results || usersRes.data);

      const map = {};
      const items = scheduleRes.data.results || scheduleRes.data;
      items.forEach(item => { map[`${item.user}_${item.date}`] = item.duty_type; });
      setSchedule(map);

      const hmap = {};
      (holidaysRes.data || []).forEach(h => {
        hmap[h.date] = { is_holiday: h.is_holiday, note: h.note };
      });
      setHolidays(hmap);
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

  // Ctrl+клик — добавить/убрать ячейку из выделения
  const handleCellClick = (userId, dateStr, e) => {
    if (!canEdit) return;
    if (!e.ctrlKey && !e.metaKey) {
      // Обычный клик — сбрасываем выделение, открываем поповер
      if (selection) { setSelection(null); return; }
      return; // поповер откроется через Popover onOpenChange
    }
    // Ctrl зажат — добавляем/убираем ячейку
    e.preventDefault();
    e.stopPropagation();
    setPopoverOpen(null);
    const key = `${userId}_${dateStr}`;
    setSelection(prev => {
      const next = new Set(prev || []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size > 0 ? next : null;
    });
  };

  // Применить тип ко всем выделенным ячейкам
  const handleApplyToSelection = async (dutyType) => {
    if (!selection || selection.size === 0) return;
    const cells = Array.from(selection).map(key => {
      const [userId, ...dateParts] = key.split('_');
      return { user_id: parseInt(userId), date: dateParts.join('_') };
    });
    setSelectionModal(false);
    setSelection(null);
    try {
      await api.post('/clients/events/bulk_set_duty/', { cells, duty_type: dutyType });
      setSchedule(prev => {
        const next = { ...prev };
        cells.forEach(({ user_id, date }) => {
          const key = `${user_id}_${date}`;
          if (!dutyType) delete next[key];
          else next[key] = dutyType;
        });
        return next;
      });
      message.success(`Применено к ${cells.length} ${cells.length === 1 ? 'ячейке' : cells.length < 5 ? 'ячейкам' : 'ячейкам'}`);
    } catch {
      message.error('Ошибка при сохранении');
    }
  };

  const handleToggleHoliday = async (date, isHoliday, note = '') => {
    try {
      if (isHoliday === null) {
        await api.post('/clients/events/toggle_holiday/', { date, is_holiday: null });
        setHolidays(prev => { const n = { ...prev }; delete n[date]; return n; });
      } else {
        await api.post('/clients/events/toggle_holiday/', { date, is_holiday: isHoliday, note });
        setHolidays(prev => ({ ...prev, [date]: { is_holiday: isHoliday, note } }));
      }
    } catch (e) {
      console.error('toggle_holiday error:', e?.response?.data || e);
    }
  };

  const openReport = async () => {
    try {
      const { data } = await api.get('/clients/events/report/', { params: { year, month: month + 1 } });
      setReport(data.report);
      setReportLabels(data.labels);
      setReportModal(true);
    } catch {}
  };

  const clearMonth = async () => {
    try {
      await api.post('/clients/events/clear_month/', { year, month: month + 1 });
      setSchedule({});
      message.success(`Таблица за ${MONTH_NAMES[month]} ${year} очищена`);
    } catch {
      message.error('Ошибка очистки');
    }
  };

  // Поповер для ячейки дежурства
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

  // Колонки таблицы
  const nameCol = {
    title: 'Сотрудник',
    dataIndex: 'name',
    key: 'name',
    fixed: 'left',
    width: 160,
    sorter: (a, b) => a.name.localeCompare(b.name, 'ru'),
    defaultSortOrder: 'ascend',
    render: (name) => <Text strong style={{ fontSize: 13 }}>{name}</Text>,
  };

  const dayCols = days.map(day => {
    const dateStr = day.format('YYYY-MM-DD');
    const weekend = isDayHoliday(dateStr);
    const custom = holidays[dateStr];
    const monthDay = day.format('MM-DD'); // для сравнения с днём рождения
    return {
      title: (
          <div
            style={{
              textAlign: 'center', lineHeight: 1.3,
              cursor: isAdmin ? 'pointer' : 'default',
              padding: '2px 0',
            }}
            onClick={(e) => { e.stopPropagation(); if (isAdmin) openHolidayModal(dateStr); }}
            title={undefined}
          >
            <div style={{ fontSize: 13, fontWeight: weekend ? 700 : 500, color: weekend ? '#FF9900' : '#333' }}>
              {day.date()}
            </div>
            <div style={{ fontSize: 10, color: weekend ? '#FF9900' : '#999' }}>
              {WEEKDAY_SHORT[day.day()]}
            </div>
            {custom && (
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF9900', margin: '1px auto 0' }} />
            )}
          </div>
      ),
      key: dateStr,
      width: 44,
      align: 'center',
      onHeaderCell: () => ({ style: { background: weekend ? '#fff8ee' : '#fafafa', padding: '2px 1px' } }),
      render: (_, record) => {
        const key = `${record.id}_${dateStr}`;
        const dutyType = schedule[key];
        const duty = dutyType ? DUTY_MAP[dutyType] : null;
        const isSaving = saving === key;
        const isBirthday = record.birthday === monthDay;
        const isSelected = selection?.has(key);

        const cell = (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {isBirthday && (
              <div style={{
                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                fontSize: 14, lineHeight: 1, zIndex: 10, pointerEvents: 'none',
                animation: 'birthdayPop 0.6s ease',
              }}>🎉</div>
            )}
            <div style={{
              width: 36, height: 28, borderRadius: 4, margin: '0 auto',
              background: isSelected ? '#bae0ff' : (duty ? duty.color : (weekend ? '#fff8ee' : 'transparent')),
              cursor: canEdit ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: isSelected ? '2px solid #1677ff' : (isBirthday && !duty ? '2px solid #ff85c2' : (duty ? 'none' : '1px dashed #e0e0e0')),
              boxShadow: isSelected ? '0 0 0 1px #1677ff' : (isBirthday ? '0 0 6px rgba(255,133,194,0.6)' : 'none'),
              userSelect: 'none',
            }}>
              {isSaving
                ? <Spin size="small" />
                : isSelected
                  ? <span style={{ fontSize: 10, color: '#1677ff' }}>✓</span>
                  : duty
                    ? <span style={{ fontSize: 9, fontWeight: 600, color: duty.textColor }}>{duty.label.slice(0, 3)}</span>
                    : isBirthday ? <span style={{ fontSize: 11 }}>🎂</span> : null
              }
            </div>
          </div>
        );

        if (!canEdit) return cell;
        return (
          <div
            onClick={(e) => handleCellClick(record.id, dateStr, e)}
            style={{ display: 'inline-block' }}
          >
            <Popover
              content={<DutyPopoverContent userId={record.id} date={dateStr} />}
              trigger="click"
              open={popoverOpen === key && !selection}
              onOpenChange={(open) => { if (!selection) setPopoverOpen(open ? key : null); }}
              placement="bottom"
            >
              <Tooltip title={isSelected ? null : (duty ? duty.label : 'Клик — выбор, Ctrl+клик — мультивыделение')} mouseEnterDelay={0.6}>
                {cell}
              </Tooltip>
            </Popover>
          </div>
        );
      },
    };
  });

  const toggleHideUser = (userId) => {
    setHiddenUsers(prev => {
      const next = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      localStorage.setItem(HIDDEN_USERS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const showAllUsers = () => {
    setHiddenUsers([]);
    localStorage.setItem(HIDDEN_USERS_KEY, '[]');
  };

  const tableData = users
    .filter(u => !hiddenUsers.includes(u.id))
    .map(u => ({ key: u.id, id: u.id, name: u.full_name || u.email, birthday: u.birthday }));

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
      width: 110,
      render: v => v > 0 ? <Tag color="blue">{v} дн.</Tag> : <Text type="secondary">—</Text>,
    })),
    {
      title: 'Итого',
      dataIndex: 'total',
      key: 'total',
      align: 'center',
      width: 70,
      render: v => <Text strong>{v}</Text>,
    },
  ];

  return (
    <div>
      <style>{`
        @keyframes birthdayPop {
          0% { transform: translateX(-50%) scale(0) rotate(-20deg); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: translateX(-50%) scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => setCurrentDate(d => d.subtract(1, 'month'))} />
          <Select
            value={month}
            onChange={m => setCurrentDate(d => d.month(m))}
            style={{ width: 130 }}
            options={MONTH_NAMES.map((name, i) => ({ value: i, label: name }))}
          />
          <Select
            value={year}
            onChange={y => setCurrentDate(d => d.year(y))}
            style={{ width: 90 }}
            options={Array.from({ length: 10 }, (_, i) => {
              const y = dayjs().year() - 5 + i;
              return { value: y, label: y };
            })}
          />
          <Button icon={<RightOutlined />} onClick={() => setCurrentDate(d => d.add(1, 'month'))} />
          <Button size="small" onClick={() => setCurrentDate(dayjs())} style={{ marginLeft: 4 }}>Сегодня</Button>
        </Space>
        <Space>
          {isAdmin && (
            <Popconfirm
              title={`Очистить таблицу за ${MONTH_NAMES[month]} ${year}?`}
              description="Все записи дежурств за этот месяц будут удалены."
              onConfirm={clearMonth}
              okText="Очистить"
              cancelText="Отмена"
              okType="danger"
            >
              <Button danger icon={<DeleteOutlined />}>Очистить таблицу</Button>
            </Popconfirm>
          )}
          <Button icon={<BarChartOutlined />} onClick={openReport}>Отчёт за месяц</Button>
          <Dropdown
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            trigger={['click']}
            dropdownRender={() => (
              <div style={{
                background: '#fff', borderRadius: 8, padding: '12px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220,
                border: '1px solid #f0f0f0',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
                  ⚙️ Настройки отображения
                </div>
                <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
                  Сотрудники в календаре:
                </div>
                {users.map(u => (
                  <div key={u.id} style={{ marginBottom: 6 }}>
                    <Checkbox
                      checked={!hiddenUsers.includes(u.id)}
                      onChange={() => toggleHideUser(u.id)}
                    >
                      <span style={{
                        fontSize: 13,
                        textDecoration: hiddenUsers.includes(u.id) ? 'line-through' : 'none',
                        color: hiddenUsers.includes(u.id) ? '#bbb' : '#333',
                      }}>
                        {u.full_name || u.email}
                      </span>
                    </Checkbox>
                  </div>
                ))}
                {hiddenUsers.length > 0 && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <Button size="small" block onClick={showAllUsers}>
                      Показать всех
                    </Button>
                  </>
                )}
              </div>
            )}
          >
            <Button icon={<SettingOutlined />} />
          </Dropdown>
        </Space>
      </div>

      {/* Легенда — без "Выходного" */}
      <Card style={{ marginBottom: 12 }} styles={{ body: { padding: '8px 16px' } }}>
        <Space wrap size={16}>
          <Text type="secondary" style={{ fontSize: 12 }}>Обозначения:</Text>
          {DUTY_TYPES.map(d => (
            <Space key={d.value} size={6}>
              <div style={{ width: 16, height: 16, borderRadius: 3, background: d.color, border: '1px solid #ccc' }} />
              <Text style={{ fontSize: 12 }}>{d.label}</Text>
            </Space>
          ))}
          {isAdmin && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              · Нажмите на число в заголовке чтобы изменить тип дня
            </Text>
          )}
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        {selection && selection.size > 0 && (
          <div style={{
            padding: '8px 16px', background: '#e6f4ff',
            borderBottom: '1px solid #91caff',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 13, color: '#1677ff', fontWeight: 600 }}>
              ✓ Выбрано ячеек: {selection.size}
            </span>
            <Button
              type="primary"
              size="small"
              onClick={() => setSelectionModal(true)}
            >
              Применить тип…
            </Button>
            <Button
              size="small"
              onClick={() => setSelection(null)}
            >
              Снять выделение
            </Button>
            <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
              Ctrl+клик для добавления ячеек · Esc для отмены
            </span>
          </div>
        )}
        <Table
          columns={[nameCol, ...dayCols]}
          dataSource={tableData}
          loading={loading}
          pagination={false}
          scroll={{ x: 160 + daysInMonth * 44 }}
          virtual={false}
          size="small"
          bordered
          rowKey="id"
        />
      </Card>

      {/* Модал отчёта */}
      <Modal
        title={`Отчёт за ${MONTH_NAMES[month]} ${year}`}
        open={reportModal}
        onCancel={() => setReportModal(false)}
        footer={<Button onClick={() => setReportModal(false)}>Закрыть</Button>}
        width={740}
      >
        {report && (
          <Table
            columns={reportColumns}
            dataSource={report}
            rowKey="user_id"
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 550 }}
          />
        )}
      </Modal>
      {/* Модал редактирования дня */}
      {holidayModalDate && (
        <Modal
          title={`${dayjs(holidayModalDate).format('D MMMM YYYY')} — тип дня`}
          open={!!holidayModalDate}
          onCancel={closeHolidayModal}
          footer={null}
          width={320}
        >
          <div style={{ marginBottom: 12 }}>
            {holidays[holidayModalDate] && (
              <Tag color="orange" style={{ marginBottom: 8 }}>Изменён вручную</Tag>
            )}
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              Текущий статус: <strong>{isDayHoliday(holidayModalDate) ? '🔴 Выходной' : '✅ Рабочий день'}</strong>
            </div>
            <Input
              placeholder="Примечание (напр: Праздник, Перенос)"
              value={holidayNote}
              onChange={e => setHolidayNote(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Space direction="vertical" style={{ width: '100%' }}>
              {isDayHoliday(holidayModalDate) ? (
                <Button type="primary" block onClick={() => { handleToggleHoliday(holidayModalDate, false, holidayNote); closeHolidayModal(); }}>
                  ✅ Сделать рабочим
                </Button>
              ) : (
                <Button danger block onClick={() => { handleToggleHoliday(holidayModalDate, true, holidayNote); closeHolidayModal(); }}>
                  🔴 Сделать выходным
                </Button>
              )}
              {holidays[holidayModalDate] && (
                <Button block onClick={() => { handleToggleHoliday(holidayModalDate, null); closeHolidayModal(); }}>
                  ↩ Сбросить к стандарту
                </Button>
              )}
              <Button block onClick={closeHolidayModal}>Отмена</Button>
            </Space>
          </div>
        </Modal>
      )}

      {/* ===== МОДАЛ МУЛЬТИВЫДЕЛЕНИЯ ===== */}
      <Modal
        title={`Применить тип для ${selection?.size || 0} ячеек`}
        open={selectionModal}
        onCancel={() => { setSelectionModal(false); setSelection(null); }}
        footer={
          <Button onClick={() => { setSelectionModal(false); setSelection(null); }}>Отмена</Button>
        }
        width={300}
      >
        <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
          Выбрано ячеек: <b>{selection?.size || 0}</b>
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          {DUTY_TYPES.map(d => (
            <div
              key={d.value}
              onClick={() => handleApplyToSelection(d.value)}
              style={{
                padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                background: d.color, color: d.textColor,
                fontWeight: 600, fontSize: 13,
                border: `2px solid ${d.color}`,
                transition: 'opacity .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {d.label}
            </div>
          ))}
          <div
            onClick={() => handleApplyToSelection('')}
            style={{
              padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
              background: '#fff1f0', color: '#ff4d4f',
              border: '1px solid #ffa39e', fontSize: 13, textAlign: 'center',
            }}
          >
            ✕ Очистить выбранные дни
          </div>
        </Space>
      </Modal>
    </div>
  );
}
