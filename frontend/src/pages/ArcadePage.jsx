import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Typography, Segmented, Row, Col, Empty, Spin, App } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text, Paragraph } = Typography;

const RUNNER_CONTROLS = [
  ['Пробел / W / ↑', 'прыжок (в воздухе — ещё раз, двойной прыжок)'],
  ['S / ↓', 'подкат (держать)'],
  ['P / Esc', 'пауза'],
  ['M', 'звук'],
  ['Телефон', 'кнопки ПРЫЖОК / ПОДКАТ или свайпы вверх / вниз'],
];
const RUNNER_SCORING = [
  'Каждое пройденное препятствие — +1 × комбо, комбо растёт на 0.1 (до ×4).',
  'Комбо сбрасывается, если 3 секунды не проходить препятствий.',
  'Скорость постоянно растёт, новые уровни — на 30, 75 и 140 очках.',
];

// Игры — самостоятельные HTML-страницы в public/games/, результат присылают через postMessage
const GAMES = [
  {
    key: 'cat', label: '🐱 Cat Runner', src: '/games/catrunner.html',
    title: 'Cat Runner — Ночной забег',
    story: 'Рыжий кот бежит через ночную пустыню. Перепрыгивай кактусы, ныряй под дроны и собирай рыбку.',
    controls: RUNNER_CONTROLS,
    sections: [
      { title: 'Бонусы', items: [
        '🐟 Рыбка — +10 × комбо',
        '🛡️ Кибер-щит — выдерживает одно столкновение',
        '⚡ Мяу-турбо — 5 секунд ускорения: сносит препятствия (+25) и притягивает рыбку',
      ] },
      { title: 'Препятствия', items: [
        '🌵 Кактусы — перепрыгивать',
        '🛸 Летучие дроны (с 2-го уровня) — только подкатом, перепрыгнуть нельзя',
        '🔺 Лазерные барьеры (с 3-го уровня)',
      ] },
      { title: 'Очки', items: RUNNER_SCORING },
    ],
  },
  {
    key: 'meko', label: '⭐ Meko Runner', src: '/games/mekorunner.html',
    title: 'Meko Runner — Спецоперация: Побег',
    story: 'Меко уходит от спецслужб через город, шоссе и серверное крипто-ядро. Собирай крипто-пакеты и не попадись.',
    controls: RUNNER_CONTROLS,
    sections: [
      { title: 'Бонусы', items: [
        '💾 Крипто-пакет — +10 × комбо',
        '🛡️ Кибер-щит — выдерживает одно столкновение',
        '⚡ Турбо-прорыв — 5 секунд ускорения: сносит препятствия (+25) и притягивает пакеты',
      ] },
      { title: 'Препятствия', items: [
        '🕴️ Агенты спецслужб (мл. агент, оперативник, майор — разного роста) — перепрыгивать',
        '🛸 Дроны спецслужб (с 2-го уровня) — летят на уровне головы, уходить подкатом',
        '🔺 Лазерные барьеры (с 3-го уровня)',
      ] },
      { title: 'Очки', items: RUNNER_SCORING },
    ],
  },
  {
    key: 'tanks', label: '🪖 Танчики', src: '/games/tanks.html',
    title: 'Танчики — Защита ККТ',
    story: 'Ты — танк «ТП» (техподдержка). Внизу стоит ККТ с чековой лентой — её надо защитить от 20 проблем аптеки на каждом уровне. Сломают ККТ — смена окончена.',
    controls: [
      ['←↑→↓ / WASD', 'ехать'],
      ['Пробел / J', 'огонь'],
      ['P / Esc', 'пауза (клик мимо игры — тоже пауза)'],
      ['M', 'звуки игры: выстрелы, мотор, заставки (кнопка 🔊)'],
      ['N', 'фоновая музыка в бою (кнопка 🎵)'],
      ['Телефон', 'крестовина и кнопка ОГОНЬ'],
    ],
    sections: [
      { title: 'Проблемы аптеки', items: [
        'ФН — ФН истёк: медленный, 100 очков',
        'ОФД — Нет связи с ОФД: быстрый, 200',
        'ЧЗ — Ошибка маркировки: быстрые пули, 300',
        'ФНС — Налоговая проверка: 4 попадания, 400',
      ] },
      { title: 'Бонусы (из мигающих розовых танков, +500)', items: [
        '⭐ Прошивка — пушка мощнее, на v4 пробивает сейфы',
        '🛡️ Антивирус — неуязвимость',
        '🔄 Перезагрузка — все проблемы на поле взрываются',
        '☕ Обед — проблемы замирают',
        '🧱 ККТ в сейфе — стена вокруг кассы временно бетонная',
        '💰 Премия — +1 жизнь',
      ] },
      { title: 'Уровни и поле', items: [
        'Утро понедельника → Инвентаризация → Мокрый пол → Переход на ФФД 1.2 → Конец квартала → Налоговая неделя, дальше — второй круг, враги быстрее',
        '+1000 за каждую спасённую аптеку',
        'Кирпич трескается с первого попадания и рушится со второго; бетонные сейфы пробивает только прошивка v4; по мокрому полу заносит; лужи не проехать; за фикусами можно спрятаться',
        'Свои пули тоже ломают ККТ — вниз стреляй аккуратно',
      ] },
    ],
  },
];

const MEDALS = ['🥇', '🥈', '🥉'];

// Скрытый раздел с игрушками для сотрудников.
// Вход: 5 быстрых кликов по надписи «Портал поддержки» в сайдбаре.
export default function ArcadePage() {
  const { message } = App.useApp();
  const [game, setGame] = useState('cat');
  const [period, setPeriod] = useState('all');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/arcade/leaderboard/', { params: { game, period } });
      setBoard(data);
    } catch {
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [game, period]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    const onMessage = async (e) => {
      if (e.origin !== window.location.origin) return;
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const d = e.data;
      if (!d || d.type !== 'arcade:gameover' || d.game !== game) return;
      try {
        const { data } = await api.post('/arcade/scores/', { game: d.game, score: d.score });
        if (data.saved && data.personal_best) message.success(`Новый личный рекорд: ${d.score}! 🎉`);
        loadBoard();
      } catch {
        message.error('Не удалось сохранить результат');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [game, loadBoard, message]);

  const current = GAMES.find(g => g.key === game);

  const me = board?.me;
  const meInTop = board?.top.some(r => r.is_me);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px', marginBottom: 12 }}>
        <div style={{ marginRight: 'auto' }}>
          <Title level={3} style={{ margin: 0 }}>🕹️ Аркада</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Секретный раздел для перерыва. Никому не говори 🤫</Text>
        </div>
        <Segmented
          value={game}
          onChange={setGame}
          options={GAMES.map(g => ({ value: g.key, label: g.label }))}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <Card styles={{ body: { padding: 0 } }} style={{ flex: '1 1 600px', minWidth: 0, overflow: 'hidden' }}>
          <iframe
            key={current.key}
            ref={iframeRef}
            src={current.src}
            title={current.label}
            onLoad={() => iframeRef.current?.focus()}
            style={{ display: 'block', width: '100%', height: 'clamp(480px, calc(100vh - 190px), 900px)', border: 0 }}
          />
        </Card>

        <Card size="small" style={{ flex: '1 0 240px', maxWidth: 300 }} styles={{ body: { padding: '4px 8px 8px' } }}
          title={<span style={{ fontSize: 13 }}><TrophyOutlined style={{ color: '#faad14', marginRight: 6 }} />Рейтинг</span>}
          extra={
            <Segmented
              size="small"
              value={period}
              onChange={setPeriod}
              options={[{ value: 'all', label: 'Всё' }, { value: 'month', label: '30 дн' }]}
            />
          }
        >
          <Spin spinning={loading} size="small">
            {board?.top.length ? board.top.map(r => (
              <div key={r.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', fontSize: 13,
                borderRadius: 4, background: r.is_me ? 'rgba(22,119,255,0.1)' : undefined,
              }}>
                <span style={{ width: 22, textAlign: 'center', flex: '0 0 auto' }}>{MEDALS[r.rank - 1] || r.rank}</span>
                <Text ellipsis style={{ flex: 1, minWidth: 0, fontSize: 13 }} strong={r.is_me} title={r.name}>{r.name}</Text>
                <Text strong style={{ fontSize: 13 }}>{r.score}</Text>
              </div>
            )) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока никто не играл" style={{ margin: '8px 0' }} />
            )}
          </Spin>
          {me && !meInTop && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(128,128,128,0.2)', fontSize: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Вы: </Text>
              <Text strong style={{ fontSize: 12 }}>{me.rank}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}> место из {board.players} · </Text>
              <Text strong style={{ fontSize: 12 }}>{me.score}</Text>
            </div>
          )}
        </Card>
      </div>

      <Card title={`Как играть: ${current.title}`} style={{ marginTop: 16 }}>
        <Paragraph>{current.story}</Paragraph>
        <Row gutter={[24, 8]}>
          <Col xs={24} md={12} xl={6}>
            <Text strong>Управление</Text>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              {current.controls.map(([keys, action]) => (
                <li key={keys} style={{ marginBottom: 4 }}><Text keyboard>{keys}</Text> — {action}</li>
              ))}
            </ul>
          </Col>
          {current.sections.map(s => (
            <Col key={s.title} xs={24} md={12} xl={6}>
              <Text strong>{s.title}</Text>
              <ul style={{ paddingLeft: 18, marginTop: 8 }}>
                {s.items.map(item => <li key={item} style={{ marginBottom: 4 }}>{item}</li>)}
              </ul>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
