import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Typography, message, Tag, Popconfirm, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { customFieldsAPI } from '../api';

const { Title } = Typography;

export default function CustomFieldsPage() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [optionsInput, setOptionsInput] = useState('');
  const [form] = Form.useForm();

  const fetchFields = async () => {
    setLoading(true);
    try {
      const { data } = await customFieldsAPI.list();
      setFields(data.results || data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFields(); }, []);

  const openModal = (field = null) => {
    setEditing(field);
    if (field) {
      form.setFieldsValue(field);
      setOptionsInput((field.options || []).join('\n'));
    } else {
      form.resetFields();
      setOptionsInput('');
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (values.field_type === 'select') {
      values.options = optionsInput.split('\n').map((o) => o.trim()).filter(Boolean);
    } else {
      values.options = [];
    }
    try {
      if (editing) {
        await customFieldsAPI.update(editing.id, values);
        message.success('Поле обновлено');
      } else {
        await customFieldsAPI.create(values);
        message.success('Поле создано');
      }
      setModalOpen(false);
      fetchFields();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id) => {
    try {
      await customFieldsAPI.delete(id);
      message.success('Поле удалено');
      fetchFields();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const columns = [
    { title: 'Название', dataIndex: 'name' },
    {
      title: 'Тип',
      dataIndex: 'field_type',
      render: (v) => v === 'select' ? <Tag color="blue">Список выбора</Tag> : <Tag>Текст</Tag>,
    },
    {
      title: 'Варианты',
      dataIndex: 'options',
      render: (opts) => opts?.length ? opts.join(', ') : '—',
    },
    {
      title: 'Обязательное',
      dataIndex: 'is_required',
      render: (v) => v ? <Tag color="red">Да</Tag> : '—',
    },
    { title: 'Порядок', dataIndex: 'order' },
    {
      title: 'Действия',
      render: (_, r) => (
        <>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} style={{ marginRight: 8 }} />
          <Popconfirm title="Удалить поле?" onConfirm={() => handleDelete(r.id)} okText="Да" cancelText="Нет" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Кастомные поля</Title>
          <Typography.Text type="secondary">Дополнительные поля в карточке клиента</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Добавить поле
        </Button>
      </div>

      <Table columns={columns} dataSource={fields} rowKey="id" loading={loading} bordered size="middle" />

      <Modal
        title={editing ? 'Редактировать поле' : 'Новое кастомное поле'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Название поля" rules={[{ required: true }]}>
            <Input placeholder="Например: Категория клиента" />
          </Form.Item>
          <Form.Item name="field_type" label="Тип поля" initialValue="select" rules={[{ required: true }]}>
            <Select options={[
              { value: 'select', label: 'Список выбора' },
              { value: 'text', label: 'Текст' },
            ]} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.field_type !== cur.field_type}
          >
            {({ getFieldValue }) => getFieldValue('field_type') === 'select' && (
              <Form.Item label="Варианты (каждый с новой строки)" required>
                <Input.TextArea
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  rows={5}
                  placeholder={"VIP\nОбычный\nКорпоративный"}
                />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="order" label="Порядок отображения" initialValue={0}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="is_required" label="Обязательное поле" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
