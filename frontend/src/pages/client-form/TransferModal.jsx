import React from 'react';
import { Modal, Select, Button, Space, Tooltip, Typography } from 'antd';

const { Text } = Typography;

const CONNECTION_LABELS = {
  fiber: '⚡ Оптоволокно', dsl: '☎️ DSL', cable: '🔌 Кабель',
  wireless: '📡 Беспроводное', modem: '📶 Модем', mrnet: '↔️ MR-Net',
};

function SlotCard({ slot, isSelected, onSelect }) {
  const hasData = !!(slot.provider || slot.personal_account || slot.contract_number);
  const tooltipContent = hasData ? (
    <div style={{ fontSize: 12 }}>
      <div><b>Провайдер:</b> {slot.provider?.name || '—'}</div>
      <div><b>Тип:</b> {CONNECTION_LABELS[slot.connection_type] || '—'}</div>
      <div><b>Лицевой счёт:</b> {slot.personal_account || '—'}</div>
      <div><b>№ договора:</b> {slot.contract_number || '—'}</div>
    </div>
  ) : null;

  const card = (
    <div
      onClick={() => onSelect(slot.key)}
      style={{
        flex: 1,
        border: `2px solid ${isSelected ? '#1677ff' : hasData ? '#52c41a' : '#d9d9d9'}`,
        borderRadius: 8, padding: '16px 12px', cursor: 'pointer',
        background: isSelected ? '#e6f4ff' : hasData ? '#f6ffed' : '#fafafa',
        textAlign: 'center', transition: 'all 0.2s', userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{slot.label}</div>
      {hasData ? (
        <>
          <div style={{ color: '#52c41a', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>● Заполнен</div>
          <div style={{ fontSize: 12, color: '#555' }}>{slot.provider?.name || '—'}</div>
          {slot.connection_type && (
            <div style={{ fontSize: 11, color: '#888' }}>{CONNECTION_LABELS[slot.connection_type]}</div>
          )}
        </>
      ) : (
        <div style={{ color: '#bbb', fontSize: 12 }}>○ Пустой</div>
      )}
      {isSelected && <div style={{ marginTop: 8, color: '#1677ff', fontSize: 12, fontWeight: 500 }}>✓ Выбран</div>}
    </div>
  );

  return hasData ? <Tooltip title={tooltipContent} placement="top">{card}</Tooltip> : card;
}

export default function TransferModal({
  open, onClose,
  transferStep, setTransferStep,
  transferFromSlot,
  clients, selectedClient, onSelectClient,
  selectedClientDetail, selectedToSlot, setSelectedToSlot,
  transferring, onTransfer,
}) {
  const slots = selectedClientDetail ? [
    {
      key: '1', label: 'Провайдер 1',
      provider: selectedClientDetail.provider_data,
      connection_type: selectedClientDetail.connection_type,
      personal_account: selectedClientDetail.personal_account,
      contract_number: selectedClientDetail.contract_number,
    },
    {
      key: '2', label: 'Провайдер 2',
      provider: selectedClientDetail.provider2_data,
      connection_type: selectedClientDetail.connection_type2,
      personal_account: selectedClientDetail.personal_account2,
      contract_number: selectedClientDetail.contract_number2,
    },
  ] : [];

  const selectedSlot = slots.find(s => s.key === selectedToSlot);
  const clientName = selectedClientDetail
    ? (selectedClientDetail.company || selectedClientDetail.address || `Клиент #${selectedClientDetail.id}`)
    : '';

  return (
    <Modal
      title={
        transferStep === 1
          ? 'Шаг 1 из 2 — Выберите клиента'
          : `Шаг 2 из 2 — Куда записать провайдер ${transferFromSlot}?`
      }
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {transferStep === 2 && (
              <Button onClick={() => { setTransferStep(1); setSelectedToSlot(null); }}>← Назад</Button>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>Отмена</Button>
            {transferStep === 1 ? (
              <Button type="primary" disabled={!selectedClient} onClick={() => setTransferStep(2)}>
                Далее →
              </Button>
            ) : (
              <Button type="primary" danger disabled={!selectedToSlot} loading={transferring} onClick={onTransfer}>
                Передать
              </Button>
            )}
          </Space>
        </div>
      }
      width={500}
    >
      {/* Шаг 1 — выбор клиента */}
      {transferStep === 1 && (
        <div>
          <p style={{ marginBottom: 12, color: '#666' }}>
            После передачи все поля провайдера {transferFromSlot} у текущего клиента будут очищены.
          </p>
          <Select
            showSearch placeholder="Начните вводить адрес или компанию..."
            style={{ width: '100%' }}
            optionFilterProp="label"
            value={selectedClient}
            onChange={onSelectClient}
            options={clients.map(c => ({
              value: c.id,
              label: c.company ? `${c.company} — ${c.address || ''}` : (c.address || `Клиент #${c.id}`)
            }))}
          />
        </div>
      )}

      {/* Шаг 2 — выбор слота */}
      {transferStep === 2 && (
        <div>
          {!selectedClientDetail ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>Загрузка данных клиента...</div>
          ) : (
            <>
              <p style={{ marginBottom: 16, color: '#666' }}>
                Клиент: <strong>{clientName}</strong>. Выберите слот для записи:
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {slots.map(slot => (
                  <SlotCard key={slot.key} slot={slot} isSelected={selectedToSlot === slot.key} onSelect={setSelectedToSlot} />
                ))}
              </div>
              {selectedToSlot && selectedSlot?.provider && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, fontSize: 12, color: '#d46b08' }}>
                  ⚠️ Данные в слоте «{selectedSlot.label}» будут перезаписаны
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
