import React from 'react';
import { Card, Descriptions, Space, Tag, Button, Empty, Typography } from 'antd';
import { WifiOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { CopyField, CONNECTION_LABELS, CONNECTION_COLORS } from './helpers';

const { Text } = Typography;

function ProviderCard({ title, color, providerData, client, connectionType, tariff, personalAccount,
  contractNumber, providerSettings, modemNumber, modemIccid, providerEquipment, borderColor }) {
  return (
    <Card
      title={<Space><WifiOutlined style={{ color }} /><span>{title}</span></Space>}
      style={{ marginBottom: 16, ...(borderColor ? { borderColor } : {}) }}
    >
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Название" span={2}>
          <Text strong>{providerData.name}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Тип подключения">
          {connectionType
            ? <Tag color={CONNECTION_COLORS[connectionType]}>{CONNECTION_LABELS[connectionType]}</Tag>
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Тариф">
          {tariff
            ? <><Text strong>{tariff}</Text> <Text type="secondary">Мбит/с</Text></>
            : '—'}
        </Descriptions.Item>
        {['modem', 'mrnet'].includes(connectionType) && (
          <>
            <Descriptions.Item label="Номер (модем/SIM)">
              {modemNumber ? <CopyField value={modemNumber} /> : <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="ICCID модема">
              {modemIccid ? <CopyField value={modemIccid} /> : <Text type="secondary">—</Text>}
            </Descriptions.Item>
          </>
        )}
        <Descriptions.Item label="Лицевой счёт">
          <CopyField value={personalAccount} />
        </Descriptions.Item>
        <Descriptions.Item label="№ договора">
          <CopyField value={contractNumber} />
        </Descriptions.Item>
        <Descriptions.Item label="Настройки провайдера" span={2}>
          {providerSettings
            ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{providerSettings}</pre>
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Телефоны техподдержки" span={2}>
          <CopyField value={providerData.support_phones}>
            {providerData.support_phones
              ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{providerData.support_phones}</pre>
              : null}
          </CopyField>
        </Descriptions.Item>
        <Descriptions.Item label="Оборудование провайдера" span={2}>
          {providerEquipment
            ? <Tag color="green" style={{ fontSize: 13 }}>✓ Присутствует</Tag>
            : <Tag color="red" style={{ fontSize: 13 }}>✗ Отсутствует</Tag>}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export default function ClientDetailProviders({ client }) {
  const navigate = useNavigate();
  const id = client.id;

  return (
    <>
      {client.provider_data ? (
        <ProviderCard
          title="Провайдер 1"
          color="#1677ff"
          providerData={client.provider_data}
          client={client}
          connectionType={client.connection_type}
          tariff={client.tariff}
          personalAccount={client.personal_account}
          contractNumber={client.contract_number}
          providerSettings={client.provider_settings}
          modemNumber={client.modem_number}
          modemIccid={client.modem_iccid}
          providerEquipment={client.provider_equipment}
        />
      ) : (
        <Card
          title={<Space><WifiOutlined style={{ color: '#1677ff' }} /><span>Провайдер 1</span></Space>}
          style={{ marginBottom: 16 }}
        >
          <Empty description="Провайдер не указан" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="link" onClick={() => navigate(`/clients/${id}/edit`, { state: { tab: 'providers' } })}>
              Указать провайдера
            </Button>
          </Empty>
        </Card>
      )}

      {client.provider2_data && (
        <ProviderCard
          title="Провайдер 2"
          color="#4096ff"
          borderColor="#91caff"
          providerData={client.provider2_data}
          client={client}
          connectionType={client.connection_type2}
          tariff={client.tariff2}
          personalAccount={client.personal_account2}
          contractNumber={client.contract_number2}
          providerSettings={client.provider_settings2}
          modemNumber={client.modem_number2}
          modemIccid={client.modem_iccid2}
          providerEquipment={client.provider_equipment2}
        />
      )}
    </>
  );
}
