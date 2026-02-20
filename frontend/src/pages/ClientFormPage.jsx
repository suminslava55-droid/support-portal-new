import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Typography, message, Spin, Checkbox, Upload, List, Tooltip, Space } from 'antd';
import { UploadOutlined, FileOutlined, FilePdfOutlined, FileImageOutlined, DeleteFilled, DownloadOutlined } from '@ant-design/icons';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { clientsAPI } from '../api';
import api from '../api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

function calcMikrotikIP(subnet, ending = '1') {
  if (!subnet) return '';
  try {
    const network = subnet.split('/')[0];
    const parts = network.split('.');
    if (parts.length === 4) { parts[3] = ending; return parts.join('.'); }
  } catch (e) {}
  return '';
}

export default function ClientFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const isDraftMode = new URLSearchParams(location.search).get('draft') === '1';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [mikrotikIP, setMikrotikIP] = useState('');
  const [serverIP, setServerIP] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const permissions = useAuthStore((s) => s.permissions);

  // Удаляем черновик если ушли без сохранения
  useEffect(() => {
    return () => {
      if (isDraft && id) {
        clientsAPI.discardDraft(id).catch(() => {});
      }
    };
  }, [isDraft, id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const providersRes = await api.get('/clients/providers/');
        setProviders(providersRes.data.results || providersRes.data);
        if (isEdit && !new URLSearchParams(window.location.search).get('draft')) {
          const { data } = await clientsAPI.get(id);
          form.setFieldsValue(data);
          setMikrotikIP(calcMikrotikIP(data.subnet, '1'));
          setServerIP(calcMikrotikIP(data.subnet, '2'));
          const filesRes = await clientsAPI.getFiles(id);
          setFiles(filesRes.data);
        } else if (!isEdit) {
          // Создаём черновик сразу при открытии формы и редиректим на его URL
          const { data } = await clientsAPI.createDraft();
          setIsDraft(true);
          navigate(`/clients/${data.id}/edit?draft=1`, { replace: true });
        } else {
          // Это черновик - просто загружаем файлы если есть
          try {
            const filesRes = await clientsAPI.getFiles(id);
            setFiles(filesRes.data);
            setIsDraft(true);
          } catch (e) {}
        }
      } catch {
        message.error('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEdit, form]);

  const handleUpload = async ({ file }) => {
    const currentId = id;
    if (!currentId) {
      message.warning('Сначала сохраните клиента, затем загрузите файлы');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Файл слишком большой. Максимум 5 МБ');
      return false;
    }
    setUploading(true);
    try {
      const { data } = await clientsAPI.uploadFile(currentId, file);
      setFiles((prev) => [data, ...prev]);
      message.success(`Файл «${file.name}» загружен`);
    } catch (e) {
      message.error(e.response?.data?.detail || 'Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDeleteFile = async (fileId, fileName) => {
    const currentId = id;
    try {
      await clientsAPI.deleteFile(currentId, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      message.success(`Файл «${fileName}» удалён`);
    } catch {
      message.error('Ошибка удаления файла');
    }
  };

  const getFileIcon = (name) => {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <FileImageOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
    if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
    return <FileOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      if (isEdit) {
        await clientsAPI.update(id, values);
        message.success('Клиент обновлён');
        navigate(`/clients/${id}`);
      } else {
        const { data } = await clientsAPI.create(values);
        setClientId(data.id);
        message.success('Клиент создан');
        navigate(`/clients/${data.id}`);
      }
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = permissions.can_edit_client || permissions.can_create_client;
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <Title level={4} style={{ margin: 0 }}>{isDraftMode ? 'Новый клиент' : isEdit ? 'Редактирование клиента' : 'Новый клиент'}</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} disabled={!canEdit}>
        <Card title="Основная информация" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Адрес">
                <Input.TextArea rows={2} placeholder="г. Новосибирск, ул. Примерная, д. 1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Компания / организация">
                <Input placeholder="ООО «Название»" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inn" label="ИНН">
                <Input placeholder="123456789012" maxLength={12} />
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
              <Form.Item name="pharmacy_code" label="Код аптеки">
                <Input placeholder="APT-001" />
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

        <Card title="Провайдер" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="provider" label="Провайдер">
                <Select
                  placeholder="Выберите провайдера" allowClear showSearch optionFilterProp="label"
                  options={providers.map((p) => ({ value: p.id, label: p.name }))}
                />
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
              <Form.Item name="connection_type" label="Тип подключения">
                <Select placeholder="Выберите тип" allowClear options={[
                  { value: 'fiber', label: 'Оптоволокно' },
                  { value: 'dsl', label: 'DSL' },
                  { value: 'cable', label: 'Кабель' },
                  { value: 'wireless', label: 'Беспроводное' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tariff" label="Тариф (Мбит/с)">
                <Input placeholder="100" suffix="Мбит/с" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="provider_settings" label="Настройки провайдера">
                <Input.TextArea rows={4} placeholder={"IP: 192.168.1.1\nМаска: 255.255.255.0\nШлюз: 192.168.1.254\nDNS: 8.8.8.8"} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subnet" label="Подсеть аптеки">
                <Input placeholder="10.1.5.0/24" onChange={(e) => { setMikrotikIP(calcMikrotikIP(e.target.value, '1')); setServerIP(calcMikrotikIP(e.target.value, '2')); }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="external_ip" label="Внешний IP">
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
            <Col span={24}>
              <Form.Item name="provider_equipment" valuePropName="checked">
                <Checkbox>Оборудование провайдера на объекте</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {id && (
          <Card
            title={<Space><UploadOutlined />Файлы<span style={{marginLeft:8, background:'#f0f0f0', borderRadius:10, padding:'0 8px', fontSize:12}}>{files.length}</span></Space>}
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
              <List
                dataSource={files}
                renderItem={(file) => (
                  <List.Item
                    actions={[
                      <Tooltip title="Скачать">
                        <Button type="link" size="small" icon={<DownloadOutlined />}
                          href={file.url} target="_blank" rel="noreferrer" />
                      </Tooltip>,
                      <Tooltip title="Удалить">
                        <Button type="link" danger size="small" icon={<DeleteFilled />}
                          onClick={() => handleDeleteFile(file.id, file.name)} />
                      </Tooltip>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getFileIcon(file.name)}
                      title={file.name}
                      description={<span style={{fontSize:11}}>{formatSize(file.size)} · {file.uploaded_by_name}</span>}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        )}

        {canEdit && (
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
            {isDraftMode ? 'Создать клиента' : isEdit ? 'Сохранить изменения' : 'Создать клиента'}
          </Button>
        )}
      </Form>
    </div>
  );
}
