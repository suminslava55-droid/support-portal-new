import React from 'react';
import { Skeleton, Card, Space } from 'antd';

export const SkeletonCard = ({ avatar = false, rows = 3, active = true, className }) => (
  <Card className={className}>
    <Skeleton active={active} avatar={avatar} paragraph={{ rows }} title={{ width: '60%' }} />
  </Card>
);

export const SkeletonCardList = ({ count = 4, avatar = false, rows = 3, active = true }) => (
  <Space direction="vertical" style={{ width: '100%' }} size="middle">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} avatar={avatar} rows={rows} active={active} />
    ))}
  </Space>
);

export const SkeletonTable = ({ columns = 5, rows = 5, active = true }) => {
  const cols = Array.from({ length: columns }, (_, i) => ({
    key: `col-${i}`,
    title: <Skeleton.Input active={active} size="small" style={{ width: 80 }} />,
    dataIndex: `col-${i}`,
    render: () => <Skeleton.Input active={active} size="small" style={{ width: 100 }} />,
  }));
  const data = Array.from({ length: rows }, (_, i) => ({ key: `row-${i}` }));
  return (
    <div style={{ pointerEvents: 'none' }}>
      {data.map((row) => (
        <div key={row.key} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
          {cols.map((col) => (
            <div key={col.key} style={{ flex: 1 }}>{col.render()}</div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonForm = ({ fields = 4, active = true }) => (
  <Space direction="vertical" style={{ width: '100%' }} size="large">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i}>
        <Skeleton.Input active={active} size="small" style={{ width: 120, marginBottom: 8 }} />
        <Skeleton.Input active={active} size="default" style={{ width: '100%' }} />
      </div>
    ))}
    <Skeleton.Button active={active} size="default" />
  </Space>
);

export const SkeletonStats = ({ count = 4 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i}>
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: '40%' }} />
      </Card>
    ))}
  </div>
);

export const SkeletonDetail = ({ active = true }) => (
  <Space direction="vertical" style={{ width: '100%' }} size="large">
    <Skeleton active={active} paragraph={{ rows: 0 }} title={{ width: '40%' }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} size="small">
          <Skeleton active={active} paragraph={{ rows: 2 }} title={{ width: '30%' }} />
        </Card>
      ))}
    </div>
    <Card>
      <Skeleton active={active} paragraph={{ rows: 0 }} title={{ width: '20%' }} />
      <div style={{ marginTop: 16 }}>
        <SkeletonTable columns={4} rows={3} active={active} />
      </div>
    </Card>
  </Space>
);

export const SkeletonList = ({ count = 5, active = true, avatar = true }) => (
  <Space direction="vertical" style={{ width: '100%' }} size="middle">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: '#fafafa' }}>
        <Skeleton active={active} avatar={avatar} paragraph={{ rows: 1, width: ['80%'] }} title={{ width: '30%' }} />
      </div>
    ))}
  </Space>
);

export const SkeletonLoader = ({ type = 'card', ...props }) => {
  switch (type) {
    case 'card': return <SkeletonCard {...props} />;
    case 'card-list': return <SkeletonCardList {...props} />;
    case 'table': return <SkeletonTable {...props} />;
    case 'form': return <SkeletonForm {...props} />;
    case 'stats': return <SkeletonStats {...props} />;
    case 'detail': return <SkeletonDetail {...props} />;
    case 'list': return <SkeletonList {...props} />;
    default: return <SkeletonCard {...props} />;
  }
};

export default SkeletonLoader;
