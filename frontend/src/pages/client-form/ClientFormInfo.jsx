import React from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Space, Tooltip, List, Upload, Typography } from 'antd';
import { SyncOutlined, UploadOutlined, DownloadOutlined, DeleteFilled } from '@ant-design/icons';
import { getFileIcon, formatSize } from '../client-detail/helpers';

const { Text } = Typography;

export default function ClientFormInfo({
  id, form, ofdCompanies, mikrotikIP, serverIP,
  fetchingIP, handleGetExternalIP,
  files, uploading, handleUpload, handleDeleteFile,
  saveDraftField,
}) {
  return (
    <>
      <Card title="Основная информация" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="address" label="Адрес" rules={[{ required: true, message: '' }]}>
              <Input.TextArea
                rows={2}
                placeholder="г. Новосибирск, ул. Примерная, д. 1"
                onBlur={e => saveDraftField('address', e.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ofd_company" label="Компания">
              <Select
                placeholder="Выберите компанию"
                allowClear showSearch optionFilterProp="label"
                onChange={value => saveDraftField('ofd_company', value || null)}
                options={ofdCompanies.map(c => ({ value: c.id, label: `${c.name} (ИНН: ${c.inn})` }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="Телефон">
              <Input placeholder="+7 (999) 123-45-67" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="iccid" label="ICCID">
              <Input placeholder="89701xxxxxxxxxxxxxxx" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Некорректный email' }]}>
              <Input placeholder="example@mail.ru" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="pharmacy_code" label="Код аптеки (UT)">
              <Input placeholder="UT000001" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="warehouse_code" label="Код склада">
              <Input placeholder="81174669" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label="Статус" initialValue="active">
              <Select options={[
                { value: 'active', label: 'Активен' },
                { value: 'inactive', label: 'Неактивен' },
              ]} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title="Сеть" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="subnet" label="Подсеть аптеки">
              <Input placeholder="10.1.5.0/24" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="external_ip"
              label={
                <Space size={8}>
                  <span>Внешний IP</span>
                  <Tooltip title="Получить внешний IP с Микротика по SSH">
                    <Button
                      size="small" type="primary" ghost
                      icon={<SyncOutlined spin={fetchingIP} />}
                      loading={fetchingIP}
                      onClick={handleGetExternalIP}
                      style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                    >
                      Получить
                    </Button>
                  </Tooltip>
                </Space>
              }
            >
              <Input placeholder="1.2.3.4" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Микротик IP">
              <Input value={mikrotikIP || '—'} disabled style={{ background: '#f5f5f5', color: '#333' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Сервер IP">
              <Input value={serverIP || '—'} disabled style={{ background: '#f5f5f5', color: '#333' }} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {id && (
        <Card
          title={
            <Space>
              <UploadOutlined />Файлы
              <span style={{ marginLeft: 8, background: '#f0f0f0', borderRadius: 10, padding: '0 8px', fontSize: 12 }}>
                {files.length}
              </span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Upload customRequest={handleUpload} showUploadList={false} multiple>
            <Button icon={<UploadOutlined />} loading={uploading} style={{ marginBottom: 12 }}>
              Загрузить файл (макс. 5 МБ)
            </Button>
          </Upload>
          {files.length === 0 ? (
            <div style={{ color: '#999', padding: '8px 0' }}>Файлов нет</div>
          ) : (
            <List dataSource={files} renderItem={(file) => (
              <List.Item actions={[
                <Tooltip title="Скачать">
                  <Button type="link" size="small" icon={<DownloadOutlined />}
                    href={file.url} target="_blank" rel="noreferrer" />
                </Tooltip>,
                <Tooltip title="Удалить">
                  <Button type="link" danger size="small" icon={<DeleteFilled />}
                    onClick={() => handleDeleteFile(file.id, file.name)} />
                </Tooltip>,
              ]}>
                <List.Item.Meta
                  avatar={getFileIcon(file.name)}
                  title={file.name}
                  description={<span style={{ fontSize: 11 }}>{formatSize(file.size)} · {file.uploaded_by_name}</span>}
                />
              </List.Item>
            )} />
          )}
        </Card>
      )}
    </>
  );
}
