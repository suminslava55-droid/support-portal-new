import React from 'react';
import { Form, Input, Select, Checkbox, Button, Card, Row, Col, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const CONNECTION_OPTIONS = [
  { value: 'fiber',    label: '⚡ Оптоволокно' },
  { value: 'dsl',      label: '☎️ DSL' },
  { value: 'cable',    label: '🔌 Кабель' },
  { value: 'wireless', label: '📡 Беспроводное' },
  { value: 'modem',    label: '📶 Модем' },
  { value: 'mrnet',    label: '↔️ MR-Net' },
];

export default function ClientFormProviders({
  form, providers,
  connectionType, setConnectionType,
  connectionType2, setConnectionType2,
  showProvider2, setShowProvider2,
  isEdit, isDraftMode,
  handleOpenTransfer,
}) {
  const clearProvider1 = () => {
    form.setFieldsValue({
      provider: undefined, personal_account: '', contract_number: '',
      tariff: '', connection_type: undefined, modem_number: '', modem_iccid: '',
      provider_settings: '', provider_equipment: false,
    });
    setConnectionType('');
  };

  const clearProvider2 = () => {
    form.setFieldsValue({
      provider2: undefined, personal_account2: '', contract_number2: '',
      tariff2: '', connection_type2: undefined, modem_number2: '', modem_iccid2: '',
      provider_settings2: '', provider_equipment2: false,
    });
    setConnectionType2('');
    setShowProvider2(false);
  };

  return (
    <>
      {/* Провайдер 1 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>Провайдер 1</span>
            <Space>
              {!showProvider2 && (
                <Button size="small" type="dashed" onClick={() => setShowProvider2(true)} style={{ fontSize: 12 }}>
                  + Добавить провайдер 2
                </Button>
              )}
              <Button size="small" danger type="text" onClick={clearProvider1}>Очистить</Button>
            </Space>
          </div>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="provider" label="Провайдер">
              <Select placeholder="Выберите провайдера" allowClear showSearch optionFilterProp="label"
                options={providers.map(p => ({ value: p.id, label: p.name }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="personal_account" label="Лицевой счёт">
              <Input placeholder="12345678" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="contract_number" label="№ договора">
              <Input placeholder="ДГ-2024-001" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="connection_type"
              label={
                <Space size={8}>
                  <span>Тип подключения</span>
                  {isEdit && !isDraftMode && ['modem', 'mrnet'].includes(connectionType) && (
                    <Button size="small" type="primary" ghost icon={<SendOutlined />}
                      onClick={() => handleOpenTransfer('1')}
                      style={{ fontSize: 11, height: 22, padding: '0 8px' }}>
                      Передать
                    </Button>
                  )}
                </Space>
              }
            >
              <Select placeholder="Выберите тип" allowClear
                onChange={val => setConnectionType(val || '')}
                options={CONNECTION_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tariff" label="Тариф (Мбит/с)">
              <Input placeholder="100" suffix="Мбит/с" />
            </Form.Item>
          </Col>
          {['modem', 'mrnet'].includes(connectionType) && (
            <>
              <Col span={12}>
                <Form.Item name="modem_number" label="Номер (модем/SIM)">
                  <Input placeholder="+7 (999) 123-45-67" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="modem_iccid" label="ICCID модема">
                  <Input placeholder="89701xxxxxxxxxxxxxxx" />
                </Form.Item>
              </Col>
            </>
          )}
          <Col span={24}>
            <Form.Item name="provider_settings" label="Настройки провайдера">
              <Input.TextArea rows={4} placeholder={"IP: 192.168.1.1\nМаска: 255.255.255.0\nШлюз: 192.168.1.254\nDNS: 8.8.8.8"} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="provider_equipment" valuePropName="checked">
              <Checkbox>Оборудование провайдера на объекте</Checkbox>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Провайдер 2 */}
      {showProvider2 && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>Провайдер 2</span>
              <Button size="small" danger type="text" onClick={clearProvider2}>Очистить</Button>
            </div>
          }
          style={{ marginBottom: 16, borderColor: '#91caff' }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="provider2" label="Провайдер">
                <Select placeholder="Выберите провайдера" allowClear showSearch optionFilterProp="label"
                  options={providers.map(p => ({ value: p.id, label: p.name }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="personal_account2" label="Лицевой счёт">
                <Input placeholder="12345678" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contract_number2" label="№ договора">
                <Input placeholder="ДГ-2024-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="connection_type2"
                label={
                  <Space size={8}>
                    <span>Тип подключения</span>
                    {isEdit && !isDraftMode && ['modem', 'mrnet'].includes(connectionType2) && (
                      <Button size="small" type="primary" ghost icon={<SendOutlined />}
                        onClick={() => handleOpenTransfer('2')}
                        style={{ fontSize: 11, height: 22, padding: '0 8px' }}>
                        Передать
                      </Button>
                    )}
                  </Space>
                }
              >
                <Select placeholder="Выберите тип" allowClear
                  onChange={val => setConnectionType2(val || '')}
                  options={CONNECTION_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tariff2" label="Тариф (Мбит/с)">
                <Input placeholder="100" suffix="Мбит/с" />
              </Form.Item>
            </Col>
            {['modem', 'mrnet'].includes(connectionType2) && (
              <>
                <Col span={12}>
                  <Form.Item name="modem_number2" label="Номер (модем/SIM)">
                    <Input placeholder="+7 (999) 123-45-67" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="modem_iccid2" label="ICCID модема">
                    <Input placeholder="89701xxxxxxxxxxxxxxx" />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col span={24}>
              <Form.Item name="provider_settings2" label="Настройки провайдера">
                <Input.TextArea rows={4} placeholder={"IP: 192.168.1.1\nМаска: 255.255.255.0\nШлюз: 192.168.1.254\nDNS: 8.8.8.8"} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="provider_equipment2" valuePropName="checked">
                <Checkbox>Оборудование провайдера на объекте</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )}
    </>
  );
}
