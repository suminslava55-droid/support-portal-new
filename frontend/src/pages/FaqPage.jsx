import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Input, Button, Modal, Form, Select, Space,
  Popconfirm, message, Spin, Empty, Tag, Tooltip, Upload,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  BookOutlined, FolderOutlined, FileTextOutlined, SaveOutlined, CloseOutlined,
  BoldOutlined, ItalicOutlined, UnderlineOutlined, OrderedListOutlined,
  UnorderedListOutlined, LinkOutlined, PaperClipOutlined, DownloadOutlined,
  PictureOutlined, ImportOutlined, ExpandOutlined, PrinterOutlined,
} from '@ant-design/icons';
import api from '../api/axios';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import dayjs from 'dayjs';

// Санитизация HTML — разрешаем только безопасные теги и атрибуты
const ALLOWED_TAGS = new Set([
  'p','h1','h2','h3','h4','strong','em','u','s','ul','ol','li',
  'a','img','pre','code','br','hr','div','span','table','thead',
  'tbody','tr','th','td','blockquote',
]);
const ALLOWED_ATTRS = {
  'a':   ['href','target','rel'],
  'img': ['src','alt','style','width','height'],
  '*':   ['style','class'],
};

function sanitizeHTML(dirty) {
  const doc = new DOMParser().parseFromString(dirty, 'text/html');
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // Заменяем запрещённый элемент его текстовым содержимым
        node.replaceWith(document.createTextNode(node.textContent));
        return;
      }
      // Убираем запрещённые атрибуты
      const allowed = new Set([...(ALLOWED_ATTRS[tag] || []), ...(ALLOWED_ATTRS['*'] || [])]);
      [...node.attributes].forEach(attr => {
        if (!allowed.has(attr.name)) {
          node.removeAttribute(attr.name);
          return;
        }
        // Блокируем javascript: в href/src
        if (['href','src'].includes(attr.name)) {
          const val = attr.value.trim().toLowerCase().replace(/\s/g, '');
          if (val.startsWith('javascript:') || val.startsWith('data:text')) {
            node.removeAttribute(attr.name);
          }
        }
        // Блокируем обработчики событий в style
        if (attr.name === 'style' && /expression\s*\(|javascript:/i.test(attr.value)) {
          node.removeAttribute('style');
        }
      });
    }
    [...node.childNodes].forEach(walk);
  };
  [...doc.body.childNodes].forEach(walk);
  return doc.body.innerHTML;
}

const { Title, Text } = Typography;

// ── WYSIWYG редактор ──────────────────────────────────────
function WysiwygEditor({ value, onChange, isDark, articleId }) {
  const editorRef = useRef(null);
  const skipUpdate = useRef(false);
  const imgInputRef = useRef(null);
  const importInputRef = useRef(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (editorRef.current && !skipUpdate.current) {
      editorRef.current.innerHTML = value || '';
    }
    skipUpdate.current = false;
  }, [value]);

  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    skipUpdate.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const handleInput = () => {
    skipUpdate.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const insertLink = () => {
    const url = window.prompt('Введите URL:');
    if (url) exec('createLink', url);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!articleId) {
      message.warning('Сначала сохраните статью, затем добавляйте изображения');
      e.target.value = '';
      return;
    }
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post(`/clients/faq-articles/${articleId}/images/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      editorRef.current?.focus();
      document.execCommand('insertImage', false, data.url);
      skipUpdate.current = true;
      onChange(editorRef.current?.innerHTML || '');
      message.success('Изображение вставлено');
    } catch (err) {
      message.error(err.response?.data?.error || 'Ошибка загрузки изображения');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const btn = (onMD, icon, title) => (
    <Tooltip title={title}>
      <button onMouseDown={e => { e.preventDefault(); onMD(); }} style={{
        border: 'none', background: 'transparent', borderRadius: 4,
        padding: '3px 7px', cursor: 'pointer', height: 28,
        color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', fontSize: 13,
      }}>{icon}</button>
    </Tooltip>
  );

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!articleId) {
      message.warning('Сохраните статью перед импортом');
      e.target.value = '';
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`/clients/faq-articles/${articleId}/import/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Добавляем к существующему содержимому
      const current = editorRef.current?.innerHTML || '';
      const newContent = current ? current + sanitizeHTML(data.html) : sanitizeHTML(data.html);
      editorRef.current.innerHTML = newContent;
      skipUpdate.current = true;
      onChange(newContent);
      message.success('Файл импортирован');
    } catch (err) {
      message.error(err.response?.data?.error || 'Ошибка импорта');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const sep = <div style={{ width: 1, height: 18, background: isDark ? '#444' : '#e0e0e0', margin: '0 3px' }} />;

  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      try {
        const fd = new FormData();
        fd.append('image', file, `paste_${Date.now()}.png`);
        const { data } = await api.post(`/clients/faq-articles/${articleId}/images/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        document.execCommand('insertImage', false, data.url);
        skipUpdate.current = true;
        onChange(editorRef.current?.innerHTML || '');
      } catch {
        message.error('Ошибка загрузки изображения');
      }
    }
  };

  // Масштабирование картинок — кнопка + drag-ручка через overlay
  const selectedImg = useRef(null);
  const resizing = useRef(false);
  const [handlePos, setHandlePos] = useState(null); // {x, y}
  const wrapperRef = useRef(null);

  const updateHandlePos = (img) => {
    if (!img || !wrapperRef.current) return;
    const wRect = wrapperRef.current.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    setHandlePos({
      x: iRect.right - wRect.left - 7,
      y: iRect.bottom - wRect.top - 7,
    });
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onClick = (e) => {
      if (e.target.tagName === 'IMG') {
        if (selectedImg.current && selectedImg.current !== e.target) {
          selectedImg.current.style.outline = '';
        }
        selectedImg.current = e.target;
        e.target.style.outline = '2px solid #1677ff';
        e.target.style.cursor = 'pointer';
        e.target.style.maxWidth = '100%';
        updateHandlePos(e.target);
      } else {
        if (selectedImg.current) {
          selectedImg.current.style.outline = '';
          selectedImg.current = null;
        }
        setHandlePos(null);
      }
    };
    // Обновляем позицию ручки при скролле
    const onScroll = () => { if (selectedImg.current) updateHandlePos(selectedImg.current); };
    el.addEventListener('click', onClick);
    el.addEventListener('scroll', onScroll);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('scroll', onScroll); };
  }, []);

  const handleResizeImg = () => {
    if (!selectedImg.current) {
      message.warning('Сначала кликните на картинку в редакторе');
      return;
    }
    const img = selectedImg.current;
    const current = img.style.width || (img.offsetWidth ? img.offsetWidth + 'px' : '100%');
    const val = window.prompt('Введите ширину картинки (например: 300px или 50%):', current);
    if (!val) return;
    img.style.width = val;
    img.style.maxWidth = '100%';
    updateHandlePos(img);
    skipUpdate.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const onDragHandle = (ev) => {
    ev.preventDefault();
    const img = selectedImg.current;
    if (!img) return;
    resizing.current = true;
    const startX = ev.clientX;
    const startW = img.offsetWidth;
    const onMove = (mv) => {
      if (!resizing.current) return;
      img.style.width = Math.max(50, startW + mv.clientX - startX) + 'px';
      img.style.maxWidth = '100%';
      updateHandlePos(img);
    };
    const onUp = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      skipUpdate.current = true;
      onChange(editorRef.current?.innerHTML || '');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={wrapperRef} style={{ border: `1px solid ${isDark ? '#444' : '#d9d9d9'}`, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Drag-ручка поверх редактора */}
      {handlePos && (
        <div
          onMouseDown={onDragHandle}
          title="Потяни чтобы изменить размер"
          style={{
            position: 'absolute', left: handlePos.x, top: handlePos.y,
            width: 14, height: 14, background: '#1677ff',
            border: '2px solid #fff', borderRadius: '50%',
            cursor: 'se-resize', zIndex: 10,
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '5px 8px', flexWrap: 'wrap', background: isDark ? '#1f1f1f' : '#fafafa', borderBottom: `1px solid ${isDark ? '#333' : '#e8e8e8'}`, flexShrink: 0 }}>
        {btn(() => exec('bold'),      <BoldOutlined />,           'Жирный')}
        {btn(() => exec('italic'),    <ItalicOutlined />,         'Курсив')}
        {btn(() => exec('underline'), <UnderlineOutlined />,      'Подчёркнутый')}
        {sep}
        {btn(() => exec('formatBlock','h2'), <span style={{fontSize:12,fontWeight:700}}>H1</span>, 'Заголовок 1')}
        {btn(() => exec('formatBlock','h3'), <span style={{fontSize:12,fontWeight:600}}>H2</span>, 'Заголовок 2')}
        {btn(() => exec('formatBlock','p'),  <span style={{fontSize:11}}>Абзац</span>,             'Обычный текст')}
        {sep}
        {btn(() => exec('insertUnorderedList'), <UnorderedListOutlined />, 'Маркированный список')}
        {btn(() => exec('insertOrderedList'),   <OrderedListOutlined />,  'Нумерованный список')}
        {sep}
        {btn(insertLink, <LinkOutlined />, 'Вставить ссылку')}
        {btn(() => exec('removeFormat'), <span style={{fontSize:11}}>Очистить</span>, 'Убрать форматирование')}
        {sep}
        {btn(() => {
          // Вставляем блок кода
          const sel = window.getSelection();
          const text = sel && sel.toString() ? sel.toString() : 'код здесь';
          const pre = `<pre style="background:#1e1e1e;color:#d4d4d4;padding:10px 16px;border-radius:6px;font-family:monospace;font-size:13px;overflow-x:auto;display:inline-block;min-width:200px;margin:8px 0;">${text}</pre>`;
          exec('insertHTML', pre);
        }, <span style={{fontSize:11,fontFamily:'monospace',fontWeight:700}}>{'<>'}</span>, 'Блок кода')}
        {sep}
        <Tooltip title="Изменить размер картинки (кликни на картинку, затем нажми кнопку)">
          <button onMouseDown={e => { e.preventDefault(); handleResizeImg(); }} style={{
            border: 'none', background: 'transparent', borderRadius: 4,
            padding: '3px 7px', cursor: 'pointer', height: 28,
            color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', fontSize: 11, gap: 3,
          }}>
            <ExpandOutlined /><span>Размер</span>
          </button>
        </Tooltip>
        <Tooltip title="Вставить изображение">
          <button
            onMouseDown={e => { e.preventDefault(); imgInputRef.current?.click(); }}
            disabled={uploadingImg}
            style={{
              border: 'none', background: 'transparent', borderRadius: 4,
              padding: '3px 7px', cursor: 'pointer', height: 28,
              color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', fontSize: 13, gap: 4,
            }}
          >
            <PictureOutlined />
            {uploadingImg && <span style={{fontSize:10}}>...</span>}
          </button>
        </Tooltip>
        <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        {sep}
        <Tooltip title="Импорт из Word (.docx) или PDF (.pdf)">
          <button
            onMouseDown={e => { e.preventDefault(); importInputRef.current?.click(); }}
            disabled={importing}
            style={{
              border: 'none', background: 'transparent', borderRadius: 4,
              padding: '3px 7px', cursor: 'pointer', height: 28,
              color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', fontSize: 13, gap: 4,
            }}
          >
            <ImportOutlined />
            <span style={{ fontSize: 11 }}>{importing ? 'Импорт...' : 'Импорт'}</span>
          </button>
        </Tooltip>
        <input ref={importInputRef} type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        style={{ minHeight: 300, height: 420, overflowY: 'auto', padding: '14px 16px', outline: 'none', fontSize: 14, lineHeight: 1.7,
          background: isDark ? '#141414' : '#fff', color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}
      />
    </div>
  );
}

// ── Блок файлов ───────────────────────────────────────────
function HistoryBlock({ articleId, isDark }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/clients/faq-articles/${articleId}/history/`)
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [articleId]);

  if (loading || history.length === 0) return null;

  const COLORS = ['#CECBF6/#3C3489', '#9FE1CB/#085041', '#B5D4F4/#0C447C',
                  '#FAC775/#633806', '#F4C0D1/#72243E', '#C0DD97/#27500A'];
  const colorFor = (name) => {
    const c = COLORS[(name?.charCodeAt(0) || 0) % COLORS.length].split('/');
    return { bg: c[0], text: c[1] };
  };

  const actionColor = {
    created:  { bg: '#B5D4F4', text: '#0C447C' },
    title:    { bg: '#C0DD97', text: '#27500A' },
    content:  { bg: '#C0DD97', text: '#27500A' },
    category: { bg: '#FAC775', text: '#633806' },
  };

  return (
    <div style={{ borderTop: `0.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, paddingTop: 14, marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: isDark ? 'rgba(255,255,255,0.4)' : '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        История изменений
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.map(h => {
          const col = colorFor(h.user_name);
          const ac = actionColor[h.action] || actionColor.content;
          return (
            <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: col.bg, color: col.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                {h.user_initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? 'rgba(255,255,255,0.85)' : '#333' }}>{h.user_name}</span>
                  <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#888' }}>{dayjs(h.created_at).format('DD.MM.YYYY · HH:mm')}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: ac.bg, color: ac.text }}>{h.action_label}</span>
                </div>
                {h.old_value && h.new_value && (
                  <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#888', marginTop: 3 }}>
                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                      {h.old_value.length > 60 ? h.old_value.slice(0, 60) + '…' : h.old_value}
                    </span>
                    <span style={{ margin: '0 6px' }}>→</span>
                    <span>
                      {h.new_value.length > 60 ? h.new_value.slice(0, 60) + '…' : h.new_value}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function FilesBlock({ articleId, isDark, readOnly }) {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.is_superuser || user?.role_data?.name === 'admin';
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const loadFiles = async () => {
    if (!articleId) return;
    const { data } = await api.get(`/clients/faq-articles/${articleId}/files/`);
    setFiles(data);
  };

  useEffect(() => { loadFiles(); }, [articleId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/clients/faq-articles/${articleId}/files/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Файл прикреплён');
      loadFiles();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/faq-files/${id}/`);
      message.success('Файл удалён');
      loadFiles();
    } catch (e) {
      message.error(e.response?.data?.error || 'Ошибка удаления');
    }
  };

  const formatSize = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${bytes} Б`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, color: '#888' }}>
          <PaperClipOutlined style={{ marginRight: 4 }} />Вложения ({files.length})
        </Text>
        {!readOnly && articleId && (
          <>
            <Button size="small" icon={<PlusOutlined />} loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Прикрепить файл
            </Button>
            <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
          </>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 6,
              background: isDark ? '#1f1f1f' : '#f5f5f5',
              fontSize: 13,
            }}>
              <PaperClipOutlined style={{ color: '#1677ff', flexShrink: 0 }} />
              <a href={f.url} target="_blank" rel="noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </a>
              <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>{formatSize(f.size)}</Text>
              <a href={f.url} download={f.name}>
                <Button size="small" type="text" icon={<DownloadOutlined />} />
              </a>
              {!readOnly && (
                <Popconfirm title="Удалить файл?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(f.id)}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Редактор статьи ───────────────────────────────────────
function ArticleEditor({ article, categories, onSave, onCancel, isDark }) {
  const [form] = Form.useForm();
  const [content, setContent] = useState(article?.content || '');
  const [saving, setSaving] = useState(false);
  const [savedArticleId, setSavedArticleId] = useState(article?.id || null);
  const isDraft = useRef(false); // флаг что статья создана как черновик

  useEffect(() => {
    form.setFieldsValue({ title: article?.title || '', category: article?.category || categories[0]?.id });
    setContent(article?.content || '');
    setSavedArticleId(article?.id || null);
    isDraft.current = false;

    // Для новой статьи — сразу создаём черновик чтобы были доступны изображения и файлы
    if (!article?.id && categories.length > 0) {
      const catId = article?.category || categories[0]?.id;
      api.post('/clients/faq-articles/', { title: '...', category: catId, content: '' })
        .then(({ data }) => {
          setSavedArticleId(data.id);
          isDraft.current = true;
        })
        .catch(() => {});
    }
  }, [article]);

  const handleCancel = async () => {
    // Если была создана черновик-статья и пользователь отменил — удаляем её
    if (isDraft.current && savedArticleId) {
      try { await api.delete(`/clients/faq-articles/${savedArticleId}/`); } catch {}
    }
    onCancel();
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = { ...values, content };
      const id = savedArticleId;
      if (id) {
        await api.put(`/clients/faq-articles/${id}/`, payload);
      } else {
        const { data } = await api.post('/clients/faq-articles/', payload);
        setSavedArticleId(data.id);
      }
      isDraft.current = false;
      message.success(article?.id ? 'Статья обновлена' : 'Статья создана');
      onSave();
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Form form={form} layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
          <Form.Item name="title" label="Заголовок" rules={[{ required: true, message: 'Введите заголовок' }]} style={{ margin: 0 }}>
            <Input placeholder="Заголовок статьи" size="large" />
          </Form.Item>
          <Form.Item name="category" label="Категория" rules={[{ required: true }]} style={{ margin: 0 }}>
            <Select options={categories.map(c => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        </div>
      </Form>
      <div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>Содержимое</div>
        <WysiwygEditor value={content} onChange={setContent} isDark={isDark} articleId={savedArticleId} />
      </div>

      <div style={{ borderTop: `0.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, paddingTop: 14 }}>
        <FilesBlock articleId={savedArticleId} isDark={isDark} readOnly={false} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<CloseOutlined />} onClick={handleCancel}>Отмена</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          {article?.id ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </div>
  );
}

// ── Главная страница ───────────────────────────────────────
export default function FaqPage() {
  const isDark = useThemeStore(s => s.isDark);
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.is_superuser || user?.role_data?.name === 'admin';

  const [categories, setCategories]     = useState([]);
  const [articles, setArticles]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle]   = useState(null);
  const [editing, setEditing]           = useState(false);
  const [editingArticle, setEditingArticle]     = useState(null);
  const [search, setSearch]             = useState('');
  const [catModal, setCatModal]         = useState(false);
  const [catForm]                       = Form.useForm();
  const searchTimer = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadCategories = async () => {
    const { data } = await api.get('/clients/faq-categories/');
    const cats = data.results || data;
    setCategories(cats);
    return cats;
  };

  const loadArticles = async (catId, q) => {
    setLoading(true);
    try {
      const params = {};
      if (catId) params.category = catId;
      if (q) params.search = q;
      const { data } = await api.get('/clients/faq-articles/', { params });
      setArticles(data.results || data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const articleId = searchParams.get('article');
    loadCategories().then(cats => {
      if (articleId) {
        // Открываем конкретную статью из поиска
        api.get(`/clients/faq-articles/${articleId}/`).then(({ data }) => {
          setSelectedArticle(data);
          setSelectedCategory(data.category);
          loadArticles(data.category, '');
          setSearchParams({});
        }).catch(() => {
          if (cats.length > 0) { setSelectedCategory(cats[0].id); loadArticles(cats[0].id, ''); }
          else setLoading(false);
        });
      } else {
        if (cats.length > 0) { setSelectedCategory(cats[0].id); loadArticles(cats[0].id, ''); }
        else setLoading(false);
      }
    });
  }, []);

  const handleSearch = val => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadArticles(val ? null : selectedCategory, val), 400);
  };

  const handleSelectCategory = id => { setSelectedCategory(id); setSearch(''); setSelectedArticle(null); loadArticles(id, ''); };
  const handleShowAll = () => { setSelectedCategory(null); setSearch(''); setSelectedArticle(null); loadArticles(null, ''); };
  const handleSaveArticle = () => { setEditing(false); setEditingArticle(null); loadArticles(selectedCategory, search); loadCategories(); };

  const handleDeleteArticle = async id => {
    try {
      await api.delete(`/clients/faq-articles/${id}/`);
      message.success('Статья удалена');
      if (selectedArticle?.id === id) setSelectedArticle(null);
      loadArticles(selectedCategory, search); loadCategories();
    } catch (e) { message.error(e.response?.data?.error || 'Ошибка удаления'); }
  };

  const handleSaveCategory = async () => {
    const values = await catForm.validateFields();
    try {
      await api.post('/clients/faq-categories/', values);
      message.success('Категория создана'); setCatModal(false); catForm.resetFields(); loadCategories();
    } catch { message.error('Ошибка'); }
  };

  const handleDeleteCategory = async id => {
    try {
      await api.delete(`/clients/faq-categories/${id}/`);
      message.success('Категория удалена');
      const cats = await loadCategories();
      const first = cats[0]?.id || null;
      setSelectedCategory(first); setSelectedArticle(null); loadArticles(first, '');
    } catch (e) { message.error(e.response?.data?.error || 'Ошибка удаления'); }
  };

  const cardStyle = {
    background: isDark ? '#141414' : '#fff',
    border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 12,
  };

  if (editing) return (
    <div>
      <Title level={3} style={{ marginBottom: 20 }}>
        <BookOutlined style={{ marginRight: 8 }} />
        {editingArticle?.id ? 'Редактировать статью' : 'Новая статья'}
      </Title>
      <div style={{ ...cardStyle, padding: 24 }}>
        <ArticleEditor article={editingArticle} categories={categories}
          onSave={handleSaveArticle}
          onCancel={() => { setEditing(false); setEditingArticle(null); }}
          isDark={isDark}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}><BookOutlined style={{ marginRight: 8 }} />База знаний</Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditingArticle({ category: selectedCategory }); setEditing(true); }}
        >Новая статья</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'start' }}>
        <div style={{ ...cardStyle, padding: '12px 0' }}>
          <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Категории</Text>
            {isAdmin && <Tooltip title="Добавить категорию"><Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setCatModal(true)} /></Tooltip>}
          </div>
          <div onClick={handleShowAll} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, background: !selectedCategory && !search ? (isDark ? '#1677ff22' : '#e6f4ff') : 'transparent', color: !selectedCategory && !search ? '#1677ff' : 'inherit' }}>
            <FolderOutlined style={{ marginRight: 6 }} />Все статьи
          </div>
          {categories.map(cat => (
            <div key={cat.id} onClick={() => handleSelectCategory(cat.id)} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, background: selectedCategory === cat.id && !search ? (isDark ? '#1677ff22' : '#e6f4ff') : 'transparent', color: selectedCategory === cat.id && !search ? '#1677ff' : 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><FolderOutlined style={{ marginRight: 6 }} />{cat.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Tag style={{ margin: 0, fontSize: 10 }}>{cat.articles_count}</Tag>
                {isAdmin && (
                  <Popconfirm title="Удалить категорию?" description="Все статьи в ней тоже удалятся" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={() => handleDeleteCategory(cat.id)} onClick={e => e.stopPropagation()}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} style={{ width: 20, height: 20, padding: 0, fontSize: 10 }} />
                  </Popconfirm>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input prefix={<SearchOutlined />} placeholder="Поиск по статьям..." allowClear value={search} onChange={e => handleSearch(e.target.value)} />

          {selectedArticle ? (
            <div style={{ ...cardStyle, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{selectedArticle.title}</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedArticle.author_name} · {dayjs(selectedArticle.updated_at).format('DD.MM.YYYY HH:mm')} · {categories.find(c => c.id === selectedArticle.category)?.name}
                  </Text>
                </div>
                <Space>
                  <Button icon={<EditOutlined />} onClick={() => { setEditingArticle(selectedArticle); setEditing(true); }}>Редактировать</Button>
                  {selectedArticle.can_delete && (
                    <Popconfirm title="Удалить статью?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={() => { handleDeleteArticle(selectedArticle.id); setSelectedArticle(null); setSearchParams({}); }}>
                      <Button danger icon={<DeleteOutlined />}>Удалить</Button>
                    </Popconfirm>
                  )}
                  <Tooltip title="Скачать как Word (.docx)">
                    <Button icon={<DownloadOutlined />} onClick={() => {
                      const token = localStorage.getItem('access_token');
                      const url = `/api/clients/faq-articles/${selectedArticle.id}/export/?type=docx`;
                      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.blob())
                        .then(blob => {
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `${selectedArticle.title}.docx`;
                          a.click();
                        });
                    }}>Word</Button>
                  </Tooltip>
                  <Tooltip title="Открыть для печати / сохранить как PDF">
                    <Button icon={<PrinterOutlined />} onClick={() => {
                      const token = localStorage.getItem('access_token');
                      const url = `/api/clients/faq-articles/${selectedArticle.id}/export/?type=pdf`;
                      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.text())
                        .then(html => {
                          const w = window.open('', '_blank');
                          w.document.write(html);
                          w.document.close();
                        });
                    }}>PDF</Button>
                  </Tooltip>
                  <Button onClick={() => { setSelectedArticle(null); setSearchParams({}); }}>← Назад</Button>
                </Space>
              </div>
              <div style={{ borderTop: `0.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, paddingTop: 16, marginBottom: 16 }}>
                <style>{`
                  .faq-content pre {
                    background: #1e1e1e !important;
                    color: #d4d4d4 !important;
                    padding: 10px 42px 10px 16px !important;
                    border-radius: 6px !important;
                    font-family: monospace !important;
                    font-size: 13px !important;
                    overflow-x: auto !important;
                    display: inline-block !important;
                    min-width: 200px !important;
                    position: relative !important;
                    margin: 8px 0 !important;
                    white-space: pre-wrap !important;
                    word-break: break-all !important;
                  }
                  .faq-content pre .copy-btn {
                    position: absolute; top: 6px; right: 6px;
                    background: rgba(255,255,255,0.12); border: none;
                    color: #ccc; border-radius: 4px; padding: 2px 8px;
                    font-size: 11px; cursor: pointer;
                    transition: background 0.15s;
                  }
                  .faq-content pre .copy-btn:hover { background: rgba(255,255,255,0.25); color: #fff; }
                `}</style>
                <div
                  className="faq-content"
                  ref={el => {
                    if (!el) return;
                    el.innerHTML = sanitizeHTML(selectedArticle.content);
                    // Добавляем кнопки копирования к блокам кода
                    el.querySelectorAll('pre').forEach(pre => {
                      if (pre.querySelector('.copy-btn')) return;
                      const btn = document.createElement('button');
                      btn.className = 'copy-btn';
                      btn.textContent = 'Копировать';
                      btn.onclick = () => {
                        navigator.clipboard.writeText(pre.innerText.replace('Копировать', '').trim());
                        btn.textContent = 'Скопировано!';
                        setTimeout(() => { btn.textContent = 'Копировать'; }, 1500);
                      };
                      pre.appendChild(btn);
                    });
                    // Стили для картинок
                    el.querySelectorAll('img').forEach(img => {
                      img.style.maxWidth = '100%';
                      img.style.borderRadius = '6px';
                      img.style.marginTop = '8px';
                    });
                  }}
                  style={{ fontSize: 14, lineHeight: 1.7 }}
                />
              </div>
              <div style={{ borderTop: `0.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, paddingTop: 14 }}>
                <FilesBlock articleId={selectedArticle.id} isDark={isDark} readOnly={true} />
              </div>
              <HistoryBlock articleId={selectedArticle.id} isDark={isDark} />
            </div>
          ) : (
            <div style={cardStyle}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
              ) : articles.length === 0 ? (
                <Empty description="Статей нет. Нажмите «Новая статья» чтобы добавить." style={{ padding: 60 }} />
              ) : (
                articles.map((art, i) => (
                  <div key={art.id} onClick={() => { setSelectedArticle(art); setSearchParams({ article: art.id }); }} style={{ padding: '14px 20px', cursor: 'pointer', borderBottom: i < articles.length - 1 ? `0.5px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <FileTextOutlined style={{ color: '#1677ff', flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>{art.author_name} · {dayjs(art.updated_at).format('DD.MM.YYYY')}</Text>
                        {(!selectedCategory || search) && <Tag style={{ margin: 0, fontSize: 10 }}>{categories.find(c => c.id === art.category)?.name}</Tag>}
                      </div>
                    </div>
                    {art.content && <div style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 22, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{art.content.replace(/<[^>]+>/g, '').substring(0, 120)}</div>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Modal title="Новая категория" open={catModal} onCancel={() => { setCatModal(false); catForm.resetFields(); }} onOk={handleSaveCategory} okText="Создать" cancelText="Отмена">
        <Form form={catForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}><Input placeholder="Например: Работа с ККТ" /></Form.Item>
          <Form.Item name="order" label="Порядок отображения" initialValue={0}><Input type="number" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
