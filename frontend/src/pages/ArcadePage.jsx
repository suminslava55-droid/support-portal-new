import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Typography, Segmented, Row, Col, Table, Empty, Tag, App } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text } = Typography;

// Игры — самостоятельные HTML-страницы в public/games/, результат присылают через postMessage
const GAMES = [
  { key: 'cat',  label: '🐱 Cat Runner',  src: '/games/catrunner.html' },
  { key: 'meko', label: '⭐ Meko Runner', src: '/games/mekorunner.html' },
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

  const columns = [
    {
      title: '#', dataIndex: 'rank', width: 48, align: 'center',
      render: r => MEDALS[r - 1] || r,
    },
    {
      title: 'Сотрудник', dataIndex: 'name', ellipsis: true,
      render: (name, row) => row.is_me ? <Text strong>{name} <Tag color="blue">вы</Tag></Text> : name,
    },
    { title: 'Счёт', dataIndex: 'score', width: 80, align: 'right', render: s => <Text strong>{s}</Text> },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 4 }}>🕹️ Аркада</Title>
      <Text type="secondary">Секретный раздел для перерыва. Никому не говори 🤫</Text>

      <div style={{ margin: '16px 0' }}>
        <Segmented
          value={game}
          onChange={setGame}
          options={GAMES.map(g => ({ value: g.key, label: g.label }))}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
            <iframe
              key={current.key}
              ref={iframeRef}
              src={current.src}
              title={current.label}
              onLoad={() => iframeRef.current?.focus()}
              style={{ display: 'block', width: '100%', height: 'min(600px, 75vh)', border: 0 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card
            title={<><TrophyOutlined style={{ color: '#faad14', marginRight: 8 }} />Рейтинг</>}
            extra={
              <Segmented
                size="small"
                value={period}
                onChange={setPeriod}
                options={[{ value: 'all', label: 'Всё время' }, { value: 'month', label: '30 дней' }]}
              />
            }
          >
            <Table
              rowKey="user_id"
              size="small"
              pagination={false}
              loading={loading}
              columns={columns}
              dataSource={board?.top || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока никто не играл — будь первым!" /> }}
            />
            {board?.me && !board.top.some(r => r.is_me) && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">Ваше место: </Text>
                <Text strong>{board.me.rank}</Text>
                <Text type="secondary"> из {board.players}, лучший счёт </Text>
                <Text strong>{board.me.score}</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
