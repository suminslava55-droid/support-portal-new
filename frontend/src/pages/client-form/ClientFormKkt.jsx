import React from 'react';
import { Card, Button, Space, Input, Tag, Empty, Descriptions, Popconfirm, Typography } from 'antd';
import {
  CloudDownloadOutlined, ReloadOutlined, PlusOutlined,
  MinusCircleOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

function KktCard({ kkt, onDelete }) {
  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <Space>
          <span>🖨️ {kkt.kkt_model || 'ККТ'}</span>
          <Tag color="blue">РНМ: {kkt.kkt_reg_id}</Tag>
        </Space>
      }
      extra={
        <Space>
          {kkt.fetched_at && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Обновлено: {dayjs(kkt.fetched_at).format('DD.MM.YYYY HH:mm')}
            </Text>
          )}
          <Popconfirm
            title="Удалить ККТ?"
            description="Данные этой ККТ будут удалены из системы."
            onConfirm={onDelete}
            okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger type="text" />
          </Popconfirm>
        </Space>
      }
    >
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 2, lg: 3 }}>
        <Descriptions.Item label="Модель ККТ">
          <Text strong>{kkt.kkt_model || '—'}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="РНМ">{kkt.kkt_reg_id || '—'}</Descriptions.Item>
        <Descriptions.Item label="Серийный номер">{kkt.serial_number || '—'}</Descriptions.Item>
        <Descriptions.Item label="Номер ФН">{kkt.fn_number || '—'}</Descriptions.Item>
        <Descriptions.Item label="Конец срока ФН">
          {kkt.fn_end_date ? (
            <Tag color={dayjs(kkt.fn_end_date).isBefore(dayjs().add(90, 'day')) ? 'red' : 'green'}>
              {dayjs(kkt.fn_end_date).format('DD.MM.YYYY')}
            </Tag>
          ) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Конец договора ОФД">
          {kkt.contract_end_date ? (
            <Tag color={dayjs(kkt.contract_end_date).isBefore(dayjs().add(30, 'day')) ? 'red' : 'green'}>
              {dayjs(kkt.contract_end_date).format('DD.MM.YYYY')}
            </Tag>
          ) : '—'}
        </Descriptions.Item>
        {kkt.fiscal_address && (
          <Descriptions.Item label="Адрес установки" span={3}>
            {kkt.fiscal_address}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
}

export default function ClientFormKkt({
  isDraftMode, isEdit,
  kktData, kktFetching, kktRefreshing,
  fetchKktFromOfd, refreshKktByRnm, deleteKkt, fetchKktByRnmList,
  rnmFields, setRnmFields,
  addByRnmVisible, setAddByRnmVisible,
  addByRnmValue, setAddByRnmValue,
  addByRnmLoading, addKktByRnm,
}) {
  return (
    <div>
      {/* Режим создания (черновик) */}
      {isDraftMode && (
        <div>
          <Card style={{ marginBottom: 16, borderStyle: 'dashed' }} bodyStyle={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Получить данные ККТ по</Text>
            </div>
            <Space wrap>
              <Button type="primary" icon={<CloudDownloadOutlined />} onClick={fetchKktFromOfd} loading={kktFetching}>
                ИНН (поиск по адресу)
              </Button>
              <Button type="primary" icon={<CloudDownloadOutlined />} onClick={fetchKktByRnmList} loading={kktRefreshing}
                disabled={!rnmFields.some(r => r.trim())}>
                РНМ (поиск по номеру)
              </Button>
            </Space>
          </Card>

          <Card
            title={<Text strong>Регистрационные номера ККТ (РНМ)</Text>}
            style={{ marginBottom: 16 }}
            extra={
              <Button type="dashed" icon={<PlusOutlined />} size="small"
                onClick={() => setRnmFields([...rnmFields, ''])}>
                Добавить РНМ
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {rnmFields.map((val, idx) => (
                <Space key={idx} style={{ width: '100%' }}>
                  <Input
                    placeholder="0001234567890123 (16 цифр)"
                    value={val}
                    maxLength={16}
                    style={{ width: 260 }}
                    onChange={e => {
                      const next = [...rnmFields];
                      next[idx] = e.target.value;
                      setRnmFields(next);
                    }}
                  />
                  {rnmFields.length > 1 && (
                    <Button icon={<MinusCircleOutlined />} size="small" danger type="text"
                      onClick={() => setRnmFields(rnmFields.filter((_, i) => i !== idx))} />
                  )}
                </Space>
              ))}
            </Space>
          </Card>

          {kktData.length > 0 && kktData.map(kkt => (
            <KktCard key={kkt.id} kkt={kkt} onDelete={() => deleteKkt(kkt.id)} />
          ))}
        </div>
      )}

      {/* Режим редактирования */}
      {isEdit && !isDraftMode && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16 }}>🧾 Кассовая техника</Text>
            <Space direction="vertical" align="end" size={8}>
              <Space>
                <Button type="primary" icon={<CloudDownloadOutlined />} onClick={fetchKktFromOfd} loading={kktFetching}>
                  Получить данные ККТ по ИНН
                </Button>
                <Button type="primary" icon={<ReloadOutlined />} onClick={refreshKktByRnm}
                  loading={kktRefreshing} disabled={kktData.length === 0}>
                  Обновить по РНМ
                </Button>
                <Button type="primary" icon={<PlusOutlined />}
                  onClick={() => { setAddByRnmVisible(v => !v); setAddByRnmValue(''); }}>
                  Добавить по РНМ
                </Button>
              </Space>
              {addByRnmVisible && (
                <Space>
                  <Input
                    placeholder="16 цифр РНМ"
                    value={addByRnmValue}
                    onChange={e => setAddByRnmValue(e.target.value)}
                    onPressEnter={addKktByRnm}
                    style={{ width: 200 }}
                    maxLength={16}
                    autoFocus
                  />
                  <Button type="primary" loading={addByRnmLoading} onClick={addKktByRnm}>Найти</Button>
                  <Button onClick={() => { setAddByRnmVisible(false); setAddByRnmValue(''); }}>Отмена</Button>
                </Space>
              )}
            </Space>
          </div>

          {kktData.length === 0 ? (
            <Empty
              description={<span>Нет данных ККТ.<br />Нажмите «Получить данные ККТ по ИНН» для загрузки.</span>}
              style={{ padding: '40px 0' }}
            />
          ) : (
            kktData.map(kkt => (
              <KktCard key={kkt.id} kkt={kkt} onDelete={() => deleteKkt(kkt.id)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
