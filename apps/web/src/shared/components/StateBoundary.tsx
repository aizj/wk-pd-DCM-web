import type { PropsWithChildren, ReactNode } from 'react';
import { Button, Result, Skeleton } from 'antd';

export type ViewState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict';

interface StateBoundaryProps extends PropsWithChildren {
  state: ViewState;
  emptyTitle?: string;
  errorTitle?: string;
  onRetry?: () => void;
  extra?: ReactNode;
}

export function StateBoundary({
  state,
  children,
  emptyTitle = '暂无数据',
  errorTitle = '加载失败',
  onRetry,
  extra,
}: StateBoundaryProps) {
  if (state === 'loading') return <Skeleton active paragraph={{ rows: 7 }} />;
  if (state === 'ready') return children;
  if (state === 'empty') return <Result status="info" title={emptyTitle} extra={extra} />;
  if (state === 'forbidden') return <Result status="403" title="暂无查看权限" subTitle="如需访问，请联系平台管理员。" />;
  if (state === 'conflict') return <Result status="warning" title="内容已更新" subTitle="请加载最新内容后再继续操作。" extra={onRetry ? <Button onClick={onRetry}>加载最新内容</Button> : extra} />;
  return <Result status="error" title={errorTitle} subTitle="请稍后重试；若问题持续，请联系平台管理员并提供业务编号。" extra={onRetry ? <Button onClick={onRetry}>重试</Button> : extra} />;
}
