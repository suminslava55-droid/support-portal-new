import React, { useRef } from 'react';
import {
  Card, Button, Space, Modal, Alert, Progress, Table, Tag,
  Tabs, Row, Col, Statistic,
} from 'antd';
import {
  UploadOutlined, FileTextOutlined,
  CheckOutlined, WarningOutlined, StopOutlined,
} from '@ant-design/icons';
import useThemeStore from '../../store/themeStore';

export default function SettingsAutomation({
  importModal, setImportModal,
  importFile, setImportFile,
  importFileName, setImportFileName,
  importing,
  importProgress,
  importProgressText,
  importReport,
  reportModal, setReportModal,
  handleFileSelect,
  handleImport,
}) {
  const isDark = useThemeStore((s) => s.isDark);
  const fileInputRef = useRef(null);

  return (
    <>
      <Card title={<Space><UploadOutlined style={{ color: '#1677ff' }} /><span>Массовая загрузка клиентов</span></Space>}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div style={{ fontSize: 13, color: '#555' }}>
            Импорт клиентов из JSON-файла. Поддерживается загрузка тысяч записей за один раз.
          </div>
          <Space>
            <Button
              icon={<UploadOutlined />}
              type="primary"
              onClick={() => { setImportModal(true); setImportFile(null); setImportFileName(''); }}
            >
              Массовая загрузка клиентов
            </Button>
            {importReport && (
              <Button icon={<FileTextOutlined />} onClick={() => setReportModal(true)}>
                Последний отчёт
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {/* Модал: выбор файла и импорт */}
      <Modal
        title={<Space><UploadOutlined />Массовая загрузка клиентов</Space>}
        open={importModal}
        onCancel={() => { if (!importing) { setImportModal(false); setImportFile(null); setImportFileName(''); } }}
        footer={null}
        width={500}
        closable={!importing}
        maskClosable={!importing}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            icon={<UploadOutlined />}
            showIcon
            message="Формат файла"
            description={
              <div style={{ fontSize: 12 }}>
                JSON-массив объектов с полями: <b>id_pharm</b>, <b>address_pharm_zabbix</b>, <b>ip_pharm_ad</b>, <b>pharmacy_id</b>, <b>mail</b>, <b>organization_inn</b>, <b>telephone_number</b>, <b>cashbox[].kkt_reg_id</b>
              </div>
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <div
            onClick={() => !importing && fileInputRef.current?.click()}
            style={{
              border: '2px dashed #d9d9d9',
              borderRadius: 8,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: importing ? 'not-allowed' : 'pointer',
              background: importFileName ? '#f6ffed' : (isDark ? '#141414' : '#fafafa'),
              borderColor: importFileName ? '#52c41a' : '#d9d9d9',
              transition: 'all .2s',
            }}
          >
            {importFileName ? (
              <Space direction="vertical" size={4}>
                <CheckOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                <div style={{ fontWeight: 500 }}>{importFileName}</div>
                <div style={{ fontSize: 12, color: '#888' }}>Нажмите чтобы выбрать другой файл</div>
              </Space>
            ) : (
              <Space direction="vertical" size={4}>
                <UploadOutlined style={{ fontSize: 28, color: '#bbb' }} />
                <div style={{ fontWeight: 500 }}>Нажмите чтобы выбрать файл</div>
                <div style={{ fontSize: 12, color: '#888' }}>JSON файл с клиентами</div>
              </Space>
            )}
          </div>
          {importing && (
            <div>
              <div style={{ marginBottom: 6, fontSize: 13, color: '#555' }}>{importProgressText}</div>
              <Progress
                percent={importProgress}
                status={importProgress === 100 ? 'success' : 'active'}
                strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
              />
            </div>
          )}
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button
              onClick={() => { if (!importing) { setImportModal(false); setImportFile(null); setImportFileName(''); } }}
              disabled={importing}
            >
              Отмена
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={importing}
              disabled={!importFile || importing}
              onClick={handleImport}
            >
              Загрузить
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Модал: отчёт о загрузке */}
      <Modal
        title={<Space><FileTextOutlined />Отчёт о массовой загрузке</Space>}
        open={reportModal}
        onCancel={() => setReportModal(false)}
        footer={<Button onClick={() => setReportModal(false)}>Закрыть</Button>}
        width={780}
      >
        {importReport && (() => {
          const s = importReport.summary;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Row gutter={12}>
                <Col span={6}><Statistic title="Всего в файле" value={s.total} /></Col>
                <Col span={6}><Statistic title="Создано" value={s.created} valueStyle={{ color: '#52c41a' }} prefix={<CheckOutlined />} /></Col>
                <Col span={6}><Statistic title="Дублей" value={s.skipped_dup} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} /></Col>
                <Col span={6}><Statistic title="Ошибок" value={s.errors} valueStyle={{ color: s.errors ? '#ff4d4f' : undefined }} prefix={<StopOutlined />} /></Col>
              </Row>
              <Tabs
                size="small"
                items={[
                  {
                    key: 'created',
                    label: <span><Tag color="green">{s.created}</Tag>Создано</span>,
                    children: importReport.created.length === 0
                      ? <div style={{ color: '#888', padding: 8 }}>Нет созданных записей</div>
                      : <Table size="small" pagination={{ pageSize: 10, showSizeChanger: false }}
                          dataSource={importReport.created.map((r, i) => ({ ...r, key: i }))}
                          columns={[
                            { title: 'Код аптеки', dataIndex: 'pharmacy_code', width: 110 },
                            { title: 'Адрес', dataIndex: 'address', ellipsis: true },
                            { title: 'Компания', dataIndex: 'company', ellipsis: true },
                            { title: 'РНМ', dataIndex: 'rnm_count', width: 60, render: v => v > 0 ? <Tag color="blue">{v}</Tag> : <Tag>0</Tag> },
                          ]}
                        />,
                  },
                  {
                    key: 'dup',
                    label: <span><Tag color="orange">{s.skipped_dup}</Tag>Дубли</span>,
                    children: importReport.skipped_dup.length === 0
                      ? <div style={{ color: '#888', padding: 8 }}>Дублей нет</div>
                      : <Table size="small" pagination={{ pageSize: 10, showSizeChanger: false }}
                          dataSource={importReport.skipped_dup.map((r, i) => ({ ...r, key: i }))}
                          columns={[
                            { title: 'Код аптеки', dataIndex: 'pharmacy_code', width: 110 },
                            { title: 'Адрес', dataIndex: 'address', ellipsis: true },
                            { title: 'Причина', dataIndex: 'reason', render: v => <Tag color="orange">{v}</Tag> },
                          ]}
                        />,
                  },
                  {
                    key: 'errors',
                    label: <span><Tag color="red">{s.errors + s.skipped_null}</Tag>Ошибки / пропущено</span>,
                    children: (importReport.errors.length + importReport.skipped_null.length) === 0
                      ? <div style={{ color: '#888', padding: 8 }}>Ошибок нет</div>
                      : <Table size="small" pagination={{ pageSize: 10, showSizeChanger: false }}
                          dataSource={[
                            ...importReport.skipped_null.map((r, i) => ({ key: `n${i}`, pharmacy_code: `строка #${r.row}`, reason: r.reason })),
                            ...importReport.errors.map((r, i) => ({ key: `e${i}`, pharmacy_code: r.pharmacy_code || '—', reason: r.reason })),
                          ]}
                          columns={[
                            { title: 'Код аптеки / строка', dataIndex: 'pharmacy_code', width: 160 },
                            { title: 'Причина', dataIndex: 'reason', render: v => <Tag color="red">{v}</Tag> },
                          ]}
                        />,
                  },
                ]}
              />
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
