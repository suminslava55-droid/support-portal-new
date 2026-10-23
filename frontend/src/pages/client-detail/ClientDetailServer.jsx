import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tag, Button, Space, Typography, Spin, Alert, Tooltip, Row, Col, Progress, Table, Empty, Descriptions } from 'antd';
import { ReloadOutlined, LinkOutlined, CheckCircleFilled, DesktopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import api from '../../api';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Text } = Typography;

const RED = '#ff4d4f';
const ORANGE = '#fa8c16';
const GREEN = '#52c41a';
const STALE_SEC = 2 * 86400;  // значение старше двух суток — серым
const GB = 1024 ** 3;

// Цвет тега по важности проблемы Zabbix (0–5)
export function severityColor(sev) {
  return ['default', 'blue', 'gold', 'orange', 'red', '#a8071a'][sev] || 'default';
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d ? `${d} дн ${h} ч` : `${h} ч ${Math.floor((sec % 3600) / 60)} мин`;
}
function fmtGb(bytes) {
  return `${(bytes / GB).toFixed(bytes < 10 * GB ? 1 : 0)} ГБ`;
}
function fmtSince(clock) {
  const d = dayjs.unix(clock);
  return `${d.format('DD.MM.YYYY HH:mm')} (${d.fromNow()})`;
}

// Значение метрики: цвет по порогу, серое если устарело, время замера в подсказке
function Val({ m, children, color, strong = true }) {
  if (!m || m.value === null || m.value === undefined) return <Text type="secondary">нет данных</Text>;
  const stale = dayjs().unix() - m.clock > STALE_SEC;
  return (
    <Tooltip title={`Данные от ${dayjs.unix(m.clock).format('DD.MM.YYYY HH:mm')}${stale ? ' — давно не обновлялось' : ''}`}>
      <Text strong={strong} type={stale ? 'secondary' : undefined} style={stale ? undefined : { color }}>
        {children}
      </Text>
    </Tooltip>
  );
}

function Tile({ title, children, hint }) {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{title}</Text>
      <div style={{ fontSize: 18, marginTop: 2 }}>{children}</div>
      {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
    </Card>
  );
}

function Row2({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' }}>
      <Text type="secondary">{label}</Text>
      <span style={{ textAlign: 'right' }}>{children}</span>
    </div>
  );
}

function DiskCard({ d }) {
  const life = d.lifetimeperc?.value;
  const lifePct = life === null || life === undefined ? null : Math.max(0, Math.min(100, Math.round(life)));
  const lifeColor = lifePct === null ? undefined : lifePct < 14 ? RED : lifePct < 30 ? ORANGE : GREEN;
  const temp = d.temperature?.value;
  const days = d.powerondays?.value;
  const years = days ? days / 365 : 0;
  const crc = d.crcerror?.value;
  const realloc = d.reallocsector?.value;
  return (
    <Card size="small" title={d.title} style={{ height: '100%' }}>
      <div style={{ marginBottom: 6 }}>
        <Text strong>{d.modelname?.value || 'Модель неизвестна'}</Text>
        {d.disktype?.value && <Tag style={{ marginLeft: 8 }}>{d.disktype.value}</Tag>}
      </div>
      <Row2 label="Ресурс">
        {lifePct === null ? <Text type="secondary">нет данных</Text> : (
          <Tooltip title={`Данные от ${dayjs.unix(d.lifetimeperc.clock).format('DD.MM.YYYY HH:mm')}`}>
            <Progress percent={lifePct} size="small" strokeColor={lifeColor} style={{ width: 150, margin: 0 }} />
          </Tooltip>
        )}
      </Row2>
      <Row2 label="Температура">
        <Val m={d.temperature} color={temp >= 50 ? ORANGE : undefined}>{temp} °C</Val>
      </Row2>
      <Row2 label="В работе">
        <Val m={d.powerondays} color={years > 7 ? RED : years > 5 ? ORANGE : undefined}>
          {days} дн ({years.toFixed(1)} г.)
        </Val>
      </Row2>
      {crc > 0 && (
        <Row2 label={<Tooltip title="Счётчик за всё время. Рост — признак проблем с кабелем или контроллером">Ошибки CRC</Tooltip>}>
          <Val m={d.crcerror} color={ORANGE}>{crc}</Val>
        </Row2>
      )}
      {realloc > 0 && (
        <Row2 label="Переназначенные секторы">
          <Val m={d.reallocsector} color={RED}>{realloc}</Val>
        </Row2>
      )}
    </Card>
  );
}

function ProblemsBlock({ problems }) {
  if (!problems.length) {
    return (
      <Alert type="success" showIcon icon={<CheckCircleFilled />} message="Проблем в Zabbix нет" style={{ marginBottom: 12 }} />
    );
  }
  const columns = [
    {
      title: 'Важность', dataIndex: 'severity', width: 140,
      render: (s, r) => <Tag color={severityColor(s)}>{r.severity_name}</Tag>,
    },
    { title: 'Проблема', dataIndex: 'name' },
    {
      title: 'С какого времени', dataIndex: 'since', width: 210,
      render: c => <Tooltip title={dayjs.unix(c).format('DD.MM.YYYY HH:mm:ss')}>{fmtSince(c)}</Tooltip>,
    },
    {
      title: 'Подтв.', dataIndex: 'acknowledged', width: 70, align: 'center',
      render: a => a ? <Tooltip title="Подтверждена в Zabbix"><CheckCircleFilled style={{ color: GREEN }} /></Tooltip> : '',
    },
  ];
  return (
    <Card size="small" title={`⚠ Проблемы в Zabbix: ${problems.length}`} style={{ marginBottom: 12 }} styles={{ body: { padding: 0 } }}>
      <Table rowKey={(r) => `${r.since}-${r.name}`} size="small" pagination={false} columns={columns} dataSource={problems} />
    </Card>
  );
}

// Железо сервера: живой опрос по WinRM — только по кнопке (2–5 с, иногда до 20)
function HardwareCard({ clientId }) {
  const [loading, setLoading] = useState(false);
  const [hw, setHw] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/clients/${clientId}/server/hardware/`, { timeout: 120000 });
      setHw({ ...res.data, at: dayjs() });
    } catch (e) {
      setError(e?.response?.data?.error || 'Сервер не ответил');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Слот', dataIndex: 'slot', render: (v, r) => <>{v}<Text type="secondary" style={{ fontSize: 12 }}> · {r.bank}</Text></> },
    { title: 'Объём', dataIndex: 'size_gb', width: 80, render: v => `${v} ГБ` },
    { title: 'Частота', dataIndex: 'speed', width: 100, render: v => v ? `${v} МГц` : '—' },
    { title: 'Модуль', dataIndex: 'part_number', render: (v, r) => <>{r.manufacturer} <Text type="secondary">{v}</Text></> },
  ];

  return (
    <Card
      size="small"
      title={<><DesktopOutlined style={{ marginRight: 6 }} />Железо сервера</>}
      style={{ marginTop: 12 }}
      extra={
        <Space size={8}>
          {hw && <Text type="secondary" style={{ fontSize: 12 }}>опрошен {hw.at.format('HH:mm:ss')}</Text>}
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
            {hw ? 'Обновить' : 'Опросить сервер'}
          </Button>
        </Space>
      }
    >
      {loading && !hw && <Text type="secondary">Опрос сервера по WinRM — обычно 2–5 секунд, иногда до 20…</Text>}
      {!loading && !hw && !error && <Text type="secondary">Плата, процессор, ОС и память по слотам — живой опрос сервера аптеки.</Text>}
      {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: hw ? 12 : 0 }} />}
      {hw && (
        <>
          <Descriptions size="small" column={{ xs: 1, md: 2 }} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Плата">{hw.board ? `${hw.board.manufacturer} ${hw.board.product}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Процессор">
              {hw.cpu ? <>{hw.cpu.name} <Text type="secondary">· {hw.cpu.cores} ядер / {hw.cpu.threads} потоков</Text></> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="ОС">
              {hw.os ? <>{hw.os.caption} <Text type="secondary">· {hw.os.version} · {hw.os.arch}</Text></> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Память">
              <Text strong>{hw.ram_total_gb} ГБ</Text>
              {hw.slots_total ? <Text type="secondary"> · занято слотов {hw.modules.length} из {hw.slots_total}</Text> : null}
              {hw.max_ram_gb ? <Text type="secondary"> · плата до {hw.max_ram_gb} ГБ</Text> : null}
            </Descriptions.Item>
          </Descriptions>
          <Table rowKey="slot" size="small" pagination={false} columns={columns} dataSource={hw.modules} />
        </>
      )}
    </Card>
  );
}

export default function ClientDetailServer({ clientId, onProblems, canQueryHardware }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/clients/${clientId}/server/`);
      setData(res.data);
      onProblems?.(res.data.problems);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.error || 'Zabbix недоступен');
    } finally {
      setLoading(false);
    }
  }, [clientId, onProblems]);

  // Запрос только при заходе на вкладку; дальше — по кнопке «Обновить»
  useEffect(() => { load(); }, [load]);

  const toolbar = (
    <Space style={{ marginBottom: 12 }} wrap>
      <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Обновить</Button>
      {data?.zabbix_link && (
        <Button icon={<LinkOutlined />} href={data.zabbix_link} target="_blank" rel="noopener noreferrer">Открыть в Zabbix</Button>
      )}
      {data && <Text type="secondary" style={{ fontSize: 12 }}>Узел {data.host} · {data.host_name}</Text>}
    </Space>
  );

  const hardware = canQueryHardware ? <HardwareCard clientId={clientId} /> : null;

  if (loading && !data) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
  if (error) return <>{toolbar}<Alert type="warning" showIcon message={error} />{hardware}</>;
  if (!data) return <Empty />;

  const ram = data.ram_available?.value;
  const uptime = data.uptime?.value;
  const agentOk = data.agent_ping?.value === 1;
  const v = data.volumes;
  const eTotal = v.e_free && v.e_used ? v.e_free.value + v.e_used.value : null;
  const eFreePct = eTotal ? (v.e_free.value / eTotal) * 100 : null;
  const { rx, tx, fleet } = data.iperf;

  return (
    <Spin spinning={loading}>
      {toolbar}
      <ProblemsBlock problems={data.problems} />

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Tile title="Аптайм" hint={uptime > 30 * 86400 ? 'давно не перезагружался' : null}>
            <Val m={data.uptime} color={uptime > 30 * 86400 ? ORANGE : undefined}>{fmtUptime(uptime)}</Val>
          </Tile>
        </Col>
        <Col xs={24} sm={8}>
          <Tile title="Память свободно">
            <Val m={data.ram_available} color={ram < 5 ? RED : ram < 15 ? ORANGE : undefined}>{Math.round(ram)}%</Val>
          </Tile>
        </Col>
        <Col xs={24} sm={8}>
          <Tile title="Агент Zabbix" hint={data.agent_version?.value ? `версия ${data.agent_version.value}` : null}>
            <Val m={data.agent_ping} color={agentOk ? GREEN : RED}>{agentOk ? 'На связи' : 'Недоступен'}</Val>
          </Tile>
        </Col>
      </Row>

      {data.disks.length > 0 && (
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          {data.disks.map(d => (
            <Col key={d.title} xs={24} md={12}><DiskCard d={d} /></Col>
          ))}
        </Row>
      )}

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card size="small" title="Место на дисках" style={{ height: '100%' }}>
            <Row2 label="C: (система), свободно">
              <Val m={v.c_free} color={v.c_free?.value < 10 * GB ? RED : undefined}>{v.c_free && fmtGb(v.c_free.value)}</Val>
            </Row2>
            <Row2 label="D: (бэкапы), свободно">
              <Val m={v.d_free} color={v.d_free?.value < 10 * GB ? RED : undefined}>{v.d_free && fmtGb(v.d_free.value)}</Val>
            </Row2>
            <Row2 label="E: (база)">
              {eTotal ? (
                <Tooltip title={`Занято ${fmtGb(v.e_used.value)} из ${fmtGb(eTotal)}`}>
                  <Space size={8}>
                    <Progress percent={Math.round(100 - eFreePct)} size="small" showInfo={false}
                      strokeColor={eFreePct < 10 ? RED : undefined} style={{ width: 100, margin: 0 }} />
                    <Text strong style={{ color: eFreePct < 10 ? RED : undefined }}>
                      свободно {fmtGb(v.e_free.value)} ({Math.round(eFreePct)}%)
                    </Text>
                  </Space>
                </Tooltip>
              ) : <Text type="secondary">нет данных</Text>}
            </Row2>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="Канал связи" style={{ height: '100%' }}>
            <Row2 label={<Tooltip title="Замер iperf раз в сутки">Скорость: приём</Tooltip>}>
              <Val m={rx} color={rx?.value < 5 ? RED : undefined}>{rx && `${rx.value.toFixed(1)} Мбит/с`}</Val>
              {fleet.rx && <Text type="secondary" style={{ fontSize: 12 }}> · медиана сети {fleet.rx}</Text>}
            </Row2>
            <Row2 label="Скорость: отдача">
              <Val m={tx} color={tx?.value < 5 ? RED : undefined}>{tx && `${tx.value.toFixed(1)} Мбит/с`}</Val>
              {fleet.tx && <Text type="secondary" style={{ fontSize: 12 }}> · медиана сети {fleet.tx}</Text>}
            </Row2>
            {rx && (
              <Row2 label="Замер">
                <Text type="secondary">{dayjs.unix(rx.clock).format('DD.MM.YYYY HH:mm')}</Text>
              </Row2>
            )}
            <Row2 label="Сервер авторизации">
              {data.auth_ping
                ? <Val m={data.auth_ping} color={data.auth_ping.value === 1 ? GREEN : RED}>{data.auth_ping.value === 1 ? 'Доступен' : 'Недоступен'}</Val>
                : <Text type="secondary">не проверяется</Text>}
            </Row2>
          </Card>
        </Col>
      </Row>
      {hardware}
    </Spin>
  );
}
