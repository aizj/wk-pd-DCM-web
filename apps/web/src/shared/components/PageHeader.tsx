import type { ReactNode } from 'react';
import { Space, Tag, Typography } from 'antd';

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  badges?: readonly string[];
}

export function PageHeader({ title, description, eyebrow, actions, badges = [] }: PageHeaderProps) {
  return (
    <section className="page-header">
      <div>
        {eyebrow ? <Typography.Text className="eyebrow">{eyebrow}</Typography.Text> : null}
        <Typography.Title level={2}>{title}</Typography.Title>
        <Typography.Paragraph>{description}</Typography.Paragraph>
        <Space wrap>{badges.map((badge) => <Tag key={badge}>{badge}</Tag>)}</Space>
      </div>
      {actions ? <Space wrap>{actions}</Space> : null}
    </section>
  );
}

