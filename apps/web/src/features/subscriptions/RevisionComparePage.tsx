import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Select, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import type { RevisionDiffCategory, SubscriptionRevisionDiff, SubscriptionRevisionSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const categoryLabel: Readonly<Record<RevisionDiffCategory, string>> = { ADDED: '新增', MODIFIED: '修改', REMOVED: '移除', NARROWED: '收窄', UNCHANGED: '未变化' };
const fieldLabel: Readonly<Record<string, string>> = { validPeriod: '服务期限', qualityProfile: '服务质量' };

function revisionLabel(revision: SubscriptionRevisionSummary) {
  return `V${revision.revision} · ${statusLabel(revision.status)}`;
}

export function RevisionComparePage() {
  const [params] = useSearchParams();
  const [subscriptionId, setSubscriptionId] = useState(params.get('subscriptionId') ?? 'SUB-JN-0001');
  const [fromRevision, setFromRevision] = useState<number>();
  const [toRevision, setToRevision] = useState<number>();
  const subscriptionsQuery = useQuery({ queryKey: ['subscriptions-for-revision-compare'], queryFn: () => subscriptionGateway.listSubscriptions() });
  const revisionsQuery = useQuery({ queryKey: ['subscription-revisions', subscriptionId], queryFn: () => subscriptionGateway.listSubscriptionRevisions(subscriptionId), enabled: Boolean(subscriptionId) });
  const revisions = revisionsQuery.data?.items ?? [];

  useEffect(() => {
    if (!revisions.length) {
      setFromRevision(undefined);
      setToRevision(undefined);
      return;
    }
    const sorted = [...revisions].sort((a, b) => a.revision - b.revision);
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
    if (!latest) return;
    setToRevision((value) => value && sorted.some((item) => item.revision === value) ? value : latest.revision);
    setFromRevision((value) => value && sorted.some((item) => item.revision === value) ? value : previous?.revision);
  }, [revisions]);

  const diffQuery = useQuery({
    queryKey: ['subscription-revision-diff', subscriptionId, fromRevision, toRevision],
    queryFn: () => subscriptionGateway.listRevisionDiffs(subscriptionId, fromRevision as number, toRevision as number),
    enabled: Boolean(subscriptionId && fromRevision && toRevision && fromRevision !== toRevision),
  });
  const selectedSubscription = subscriptionsQuery.data?.items.find((item) => item.subscriptionId === subscriptionId);
  const from = revisions.find((item) => item.revision === fromRevision);
  const to = revisions.find((item) => item.revision === toRevision);
  const diffs = diffQuery.data?.items ?? [];
  const highImpactCount = diffs.filter((item) => item.impact === 'HIGH').length;
  const requalificationCount = diffs.filter((item) => item.requiresRequalification).length;
  const loading = subscriptionsQuery.isPending || revisionsQuery.isPending;
  const hasError = subscriptionsQuery.isError || revisionsQuery.isError;

  return <>
    <PageHeader eyebrow="订阅运营" title="版本比较" description="查看订阅版本之间的字段变化、影响程度和是否需要重新测试，避免只看版本号做判断。" badges={['数据状态 · 以服务端为准']} actions={<Link className="ant-btn ant-btn-default" to={selectedSubscription ? `/fr2/subscriptions/${selectedSubscription.subscriptionId}` : '/fr2/subscriptions'}><ArrowLeftOutlined /> 返回订阅实例</Link>} />

    <StateBoundary state={loading ? 'loading' : hasError ? 'error' : 'ready'} onRetry={() => { void subscriptionsQuery.refetch(); void revisionsQuery.refetch(); }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className="data-notice detail-notice"><InfoCircleOutlined /><span>版本比较只解释字段差异，不执行变更、不切换生效版本；是否可发布仍需重新经过配置、测试和发布门禁。</span></div>

        <Card className="configuration-list-card" title="选择比较对象">
          <div className="revision-compare-toolbar">
            <Select aria-label="订阅" value={subscriptionId} onChange={(value) => { setSubscriptionId(value); setFromRevision(undefined); setToRevision(undefined); }} options={(subscriptionsQuery.data?.items ?? []).map((item) => ({ value: item.subscriptionId, label: `${item.subscriptionId} · ${item.serviceName}` }))} />
            <Select aria-label="基准版本" placeholder="选择基准版本" value={fromRevision} onChange={setFromRevision} options={revisions.map((item) => ({ value: item.revision, label: revisionLabel(item) }))} />
            <Select aria-label="目标版本" placeholder="选择目标版本" value={toRevision} onChange={setToRevision} options={revisions.map((item) => ({ value: item.revision, label: revisionLabel(item) }))} />
            <Typography.Text type="secondary">{selectedSubscription ? `${environmentLabel[selectedSubscription.environment]}环境 · 当前获批 V${selectedSubscription.currentRevision}` : '加载订阅信息'}</Typography.Text>
          </div>
        </Card>

        {revisions.length < 2 ? <Alert type="info" showIcon title="当前订阅暂无可比较的历史版本" description="版本比较需要至少两个已登记版本；首次审批版本仍可在订阅详情中查看。" /> : null}
        {from && to ? <Card className="subscription-detail-card" title={`V${from.revision} → V${to.revision}`} extra={<Space><StatusTag value={from.status} /><StatusTag value={to.status} /></Space>}>
          <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
            <Descriptions.Item label="基准版本">{from.revisionId}</Descriptions.Item>
            <Descriptions.Item label="目标版本">{to.revisionId}</Descriptions.Item>
            <Descriptions.Item label="服务 / 环境">{to.serviceName} · {environmentLabel[to.environment]}环境</Descriptions.Item>
            <Descriptions.Item label="变更说明">{to.changeSummary}</Descriptions.Item>
            <Descriptions.Item label="服务范围" span={2}><span className={from.scopeSummary === to.scopeSummary ? 'revision-value' : 'revision-value revision-value-changed'}>{to.scopeSummary}</span></Descriptions.Item>
            <Descriptions.Item label="适用车型能力" span={2}><span className={from.capabilitySummary === to.capabilitySummary ? 'revision-value' : 'revision-value revision-value-changed'}>{to.capabilitySummary}</span></Descriptions.Item>
            <Descriptions.Item label="有效期" span={2}><span className={from.validPeriod === to.validPeriod ? 'revision-value' : 'revision-value revision-value-changed'}>{to.validPeriod}</span></Descriptions.Item>
            <Descriptions.Item label="接入方式">{to.channelType === 'UU_A' ? '企业云接入' : to.channelType}</Descriptions.Item>
            <Descriptions.Item label="版本负责人">{to.ownerName}</Descriptions.Item>
          </Descriptions>
        </Card> : null}

        {from && to && from.revision !== to.revision ? <div className="configuration-overview" aria-label="版本差异概览">
          <div><span>差异字段</span><strong>{diffQuery.isPending ? '—' : diffs.length}</strong><small>项</small></div>
          <div><span>高影响差异</span><strong>{diffQuery.isPending ? '—' : highImpactCount}</strong><small>项</small></div>
          <div><span>需重新测试</span><strong>{diffQuery.isPending ? '—' : requalificationCount}</strong><small>项</small></div>
          <div><span>基准 / 目标</span><strong>V{from.revision}→V{to.revision}</strong><small>版本</small></div>
        </div> : null}

        {from && to && from.revision !== to.revision ? <Card className="configuration-list-card" title={<Space size={8}><span>字段差异</span><span className="list-count">{diffs.length}</span></Space>} extra={<Typography.Text type="secondary">差异时间：{diffQuery.data?.dataTime ?? '加载中'}</Typography.Text>}>
          <StateBoundary state={diffQuery.isPending ? 'loading' : diffQuery.isError ? 'error' : diffs.length ? 'ready' : 'empty'} emptyTitle="两个版本没有登记字段差异" onRetry={() => void diffQuery.refetch()}>
            <div className="desktop-configuration-table"><Table<SubscriptionRevisionDiff> rowKey="diffId" dataSource={diffs} pagination={false} scroll={{ x: 1100 }} columns={[
              { title: '变更类型', width: 110, render: (_, record) => <Tag color={record.category === 'NARROWED' ? 'orange' : record.category === 'REMOVED' ? 'red' : 'blue'}>{categoryLabel[record.category]}</Tag> },
              { title: '字段', width: 160, render: (_, record) => fieldLabel[record.field] ?? record.field },
              { title: '变更前', width: 260, dataIndex: 'beforeValue' },
              { title: '变更后', width: 260, dataIndex: 'afterValue' },
              { title: '影响 / 测试', width: 160, render: (_, record) => <div className="configuration-cell"><StatusTag value={record.impact} /><small>{record.requiresRequalification ? '需重新联合测试' : '无需重新测试'}</small></div> },
            ]} /></div>
          </StateBoundary>
        </Card> : null}
      </Space>
    </StateBoundary>
  </>;
}
