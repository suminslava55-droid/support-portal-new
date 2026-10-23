import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, DatePicker, Button, Space, Table, Tag, Alert, Typography, Statistic, Row, Col, Card, message,
} from 'antd';
import { FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { clientsAPI } from '../../api';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const PRESETS = [
  { label: 'Сегодня', value: [dayjs().startOf('day'), dayjs()] },
  { label: '7 дней', value: [dayjs().subtract(6, 'day'), dayjs()] },
  { label: '30 дней', value: [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs()] },
  {
    label: 'Прошлый месяц',
    value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
];

// Время приходит с поясом из настроек портала (+07:00 и т.п.) — показываем как есть, без пересчёта в пояс браузера
const fmtIso = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)}` : '—');

const fmtDuration = (sec) => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d} д`, h && `${h} ч`, `${m} мин`].filter(Boolean).join(' ');
};

/** «Проблемки» — пропадания связи аптеки по данным Zabbix за выбранный период. */
export default function ClientProblemsModal({ open, onClose, client }) {
  const [range, setRange] = useState(PRESETS[2].value);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const params = useCallback(() => ({
    date_from: range[0].format('YYYY-MM-DD'),
    date_to: range[1].format('YYYY-MM-DD'),
  }), [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await clientsAPI.getProblems(client.id, params());
      setReport(data);
    } catch (e) {
      setReport(null);
      setError(e.response?.data?.error || 'Не удалось получить данные из Zabbix');
    } finally {
      setLoading(false);
    }
  }, [client.id, params]);

  // Отчёт за 30 дней сразу при открытии
  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line

  const handleExport = async () => {
    setExporting(true);
    try {
      const p = params();
      const resp = await clientsAPI.exportProblems(client.id, p);
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `problemki_${client.pharmacy_code}_${p.date_from}_${p.date_to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ошибка приходит как Blob с JSON
      let text = 'Ошибка экспорта';
      try { text = JSON.parse(await e.response.data.text()).error || text; } catch { /* оставляем общий текст */ }
      message.error(text);
    } finally {
      setExporting(false);
    }
  };

  const openItem = report?.items.find((it) => it.open);

  const columns = [
    { title: '№', key: 'n', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Пропал', dataIndex: 'start', key: 'start',
      render: (v, r) => (
        <Space size={4}>
          {fmtIso(v)}
          {r.started_before && <Tag style={{ fontSize: 11 }}>до периода</Tag>}
        </Space>
      ),
    },
    {
      title: 'Появился', dataIndex: 'end', key: 'end',
      render: (v, r) => (r.open ? <Tag color="red">нет связи сейчас</Tag> : fmtIso(v)),
    },
    {
      title: 'Длительность', dataIndex: 'duration_sec', key: 'duration_sec', width: 150,
      sorter: (a, b) => a.duration_sec - b.duration_sec,
      render: (v) => {
        const color = v >= 3600 ? 'red' : v >= 900 ? 'orange' : undefined;
        return color ? <Tag color={color}>{fmtDuration(v)}</Tag> : fmtDuration(v);
      },
    },
  ];

  return (
    <Modal
      title={`Проблемки — ${client.pharmacy_code}${client.address ? ` · ${client.address}` : ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <RangePicker
          value={range}
          onChange={(v) => v && setRange(v)}
          presets={PRESETS}
          format="DD.MM.YYYY"
          allowClear={false}
          disabledDate={(d) => d.isAfter(dayjs(), 'day')}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={load} loading={loading}>
          Сформировать
        </Button>
        <Button icon={<FileExcelOutlined />} onClick={handleExport} loading={exporting} disabled={!report}>
          Экспорт в Excel
        </Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {report && (
        <>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Связь сейчас"
                  value={report.current_problem ? 'Нет' : 'Есть'}
                  valueStyle={{ color: report.current_problem ? '#ff4d4f' : '#52c41a', fontSize: 20 }}
                />
                {report.current_problem && openItem && (
                  <Text type="secondary" style={{ fontSize: 12 }}>с {fmtIso(openItem.start)}</Text>
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic title="Пропаданий" value={report.total_count} valueStyle={{ fontSize: 20 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Простой"
                  value={fmtDuration(report.total_sec)}
                  valueStyle={{ fontSize: 20 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>{report.percent}% времени</Text>
              </Card>
            </Col>
          </Row>

          <Table
            dataSource={report.items}
            columns={columns}
            rowKey="start"
            size="small"
            loading={loading}
            pagination={report.items.length > 10
              ? { defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }
              : false}
            locale={{ emptyText: 'За период пропаданий связи не было' }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Триггер Zabbix: {report.trigger}. Период: {fmtIso(report.period.from)} — {fmtIso(report.period.to)}.
          </Text>
        </>
      )}
    </Modal>
  );
}
