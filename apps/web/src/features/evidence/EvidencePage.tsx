import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { DeliveryEvidenceDetail, DeliveryEvidenceSummary, EvidenceEventSummary, EvidenceGrade } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const evidenceGradeOptions: readonly EvidenceGrade[] = ['F0', 'F1', 'F2', 'F3', 'UNKNOWN'];
const stageLabel: Readonly<Record<EvidenceEventSummary['stage'], string>> = { DELIVERY: '投递', RECEIVE: '接收', DISPLAY: '展示', INTERACTION: '交互' };
const eventStatusLabel: Readonly<Record<EvidenceEventSummary['status'], string>> = { CONFIRMED: '已确认', UNKNOWN: '未知', FAILED: '失败' };
const eventStatusColor: Readonly<Record<EvidenceEventSummary['status'], string>> = { CONFIRMED: 'green', UNKNOWN: 'default', FAILED: 'red' };

function EvidenceChain({ record }: { record: DeliveryEvidenceSummary }) {
  return <div className="evidence-chain">
    <div className="evidence-chain-row"><span>接收</span><StatusTag value={record.receiveGrade} /></div>
    <div className="evidence-chain-row"><span>展示</span><StatusTag value={record.displayGrade} /></div>
    <div className="evidence-chain-row"><span>交互</span><StatusTag value={record.interactionGrade} /></div>
  </div>;
}

export function EvidencePage() {
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [grade, setGrade] = useState('ALL');
  const [selected, setSelected] = useState<DeliveryEvidenceSummary | null>(null);
  const query = useQuery({ queryKey: ['delivery-evidence', appliedKeyword], queryFn: () => subscriptionGateway.listEvidence(appliedKeyword) });
  const detailQuery = useQuery({ queryKey: ['delivery-evidence-detail', selected?.evidenceId], queryFn: () => subscriptionGateway.getEvidence(selected?.evidenceId ?? ''), enabled: Boolean(selected) });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) =>
    (environment === 'ALL' || item.environment === environment)
    && (grade === 'ALL' || item.receiveGrade === grade || item.displayGrade === grade || item.interactionGrade === grade),
  );
  const receiveConfirmed = allItems.filter((item) => ['F1', 'F2', 'F3'].includes(item.receiveGrade)).length;
  const displayConfirmed = allItems.filter((item) => ['F2', 'F3'].includes(item.displayGrade)).length;
  const unknownCount = allItems.filter((item) => [item.receiveGrade, item.displayGrade, item.interactionGrade].includes('UNKNOWN')).length;

  return <>
    <PageHeader eyebrow="运行监控" title="运行与交付证据" description="按投递、接收、展示、交互四个层级查看服务是否形成可核验的交付证据。" badges={['数据状态 · 以服务端为准']} />

    <div className="configuration-overview" aria-label="交付证据概览">
      <div><span>证据记录</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>条</small></div>
      <div><span>已确认接收</span><strong>{query.isPending ? '—' : receiveConfirmed}</strong><small>条</small></div>
      <div><span>已确认展示</span><strong>{query.isPending ? '—' : displayConfirmed}</strong><small>条</small></div>
      <div><span>仍有未知项</span><strong>{query.isPending ? '—' : unknownCount}</strong><small>条</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>证据等级逐级表达投递、接收、展示、交互；“未知”不等于失败，不能由订阅或发布状态直接推断车辆端事实。</span></div>

    <Card className="configuration-list-card" title={<Space size={8}><span>证据列表</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="证据编号 / 发布计划 / 订阅 / 服务" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="证据等级" value={grade} onChange={setGrade} options={[{ value: 'ALL', label: '全部等级' }, ...evidenceGradeOptions.map((value) => ({ value, label: value === 'UNKNOWN' ? '未知' : value }))]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setGrade('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的证据记录" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<DeliveryEvidenceSummary> rowKey="evidenceId" dataSource={items} pagination={false} scroll={{ x: 1120 }} columns={[
          { title: '证据记录', width: 210, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.evidenceId}</Typography.Text><span>{record.serviceName}</span><small>{environmentLabel[record.environment]}环境</small></div> },
          { title: '订阅 / 实例', width: 205, render: (_, record) => <div className="configuration-cell"><Link to={`/fr2/subscriptions/${record.subscriptionId}?instanceId=${record.instanceId}`}>{record.subscriptionId}</Link><span>{record.instanceId}</span><small>发布计划 {record.releasePlanId}</small></div> },
          { title: '证据链', width: 150, render: (_, record) => <EvidenceChain record={record} /> },
          { title: '最近观测 / 来源', width: 185, render: (_, record) => <div className="configuration-cell"><span>{record.lastObservedAt}</span><small>{record.sourceSystem}</small></div> },
          { title: '负责人 / 更新', width: 145, render: (_, record) => <div className="configuration-cell"><span>{record.ownerName}</span><small>{record.updatedAt}</small></div> },
          { title: '操作', width: 120, fixed: 'right', render: (_, record) => <Button type="link" onClick={() => setSelected(record)}>查看证据</Button> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.evidenceId}>
          <div className="mobile-configuration-head"><div><strong>{record.evidenceId}</strong><span>{record.serviceName}</span></div><span className="environment-label">{environmentLabel[record.environment]}环境</span></div>
          <div className="mobile-configuration-meta">{record.subscriptionId} · {record.instanceId}</div>
          <div className="mobile-configuration-meta">{environmentLabel[record.environment]}环境 · 发布计划 {record.releasePlanId}</div>
          <EvidenceChain record={record} />
          <div className="mobile-configuration-status">最近观测：{record.lastObservedAt} · {record.sourceSystem}</div>
          <div className="mobile-configuration-footer"><span>{record.ownerName} · {record.updatedAt}</span><Button type="link" onClick={() => setSelected(record)}>查看证据</Button></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `证据详情 · ${selected.evidenceId}` : '证据详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={760}>
      {selected ? <>
        <div className="drawer-status-line"><Tag color="blue">{environmentLabel[selected.environment] ?? selected.environment}环境</Tag><Typography.Text type="secondary">{selected.serviceName} · {selected.updatedAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="证据编号">{selected.evidenceId}</Descriptions.Item>
          <Descriptions.Item label="发布计划">{selected.releasePlanId}</Descriptions.Item>
          <Descriptions.Item label="所属订阅"><Link to={`/fr2/subscriptions/${selected.subscriptionId}?instanceId=${selected.instanceId}`} onClick={() => setSelected(null)}>{selected.subscriptionId}</Link></Descriptions.Item>
          <Descriptions.Item label="目标实例">{selected.instanceId}</Descriptions.Item>
          <Descriptions.Item label="服务 / 环境">{selected.serviceName} · {environmentLabel[selected.environment]}环境</Descriptions.Item>
          <Descriptions.Item label="证据链"><EvidenceChain record={selected} /></Descriptions.Item>
          <Descriptions.Item label="最近观测">{selected.lastObservedAt}</Descriptions.Item>
          <Descriptions.Item label="证据来源">{selected.sourceSystem}</Descriptions.Item>
          <Descriptions.Item label="负责人 / 更新">{selected.ownerName} · {selected.updatedAt}</Descriptions.Item>
        </Descriptions>
        {detailQuery.isPending ? <Typography.Paragraph type="secondary">证据事件加载中…</Typography.Paragraph> : detailQuery.isError ? <Alert type="error" showIcon title="证据详情加载失败" description="请稍后重试；当前证据摘要仍然可用。" /> : detailQuery.data ? <EvidenceEventDetail detail={detailQuery.data} /> : null}
        <div className="data-notice configuration-drawer-notice"><InfoCircleOutlined /><span>当前仅展示已接入的交付证据；证据需要来自对应系统回执、车端回传或车机展示/交互日志。</span></div>
      </> : null}
    </Drawer>
  </>;
}

function EvidenceEventDetail({ detail }: { detail: DeliveryEvidenceDetail }) {
  const chainLabel: Readonly<Record<DeliveryEvidenceDetail['chainStatus'], string>> = { COMPLETE: '完整', PARTIAL: '部分完成', UNKNOWN: '无法确认', BROKEN: '链路中断' };
  const chainColor: Readonly<Record<DeliveryEvidenceDetail['chainStatus'], string>> = { COMPLETE: 'green', PARTIAL: 'gold', UNKNOWN: 'default', BROKEN: 'red' };
  return <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 16 }}>
    <Card size="small" title="证据链摘要">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="证据链状态"><Tag color={chainColor[detail.chainStatus]}>{chainLabel[detail.chainStatus]}</Tag></Descriptions.Item>
        <Descriptions.Item label="内容摘要"><Typography.Text copyable>{detail.contentHash}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="链路追踪号"><Typography.Text copyable>{detail.traceId}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="事件数量">{detail.events.length} 条；未知事件不等于失败</Descriptions.Item>
      </Descriptions>
    </Card>
    <Card size="small" title={<Space size={8}><span>证据事件</span><span className="list-count">{detail.events.length}</span></Space>}>
      <Table<EvidenceEventSummary> rowKey="eventId" size="small" pagination={false} dataSource={detail.events} scroll={{ x: 760 }} columns={[
        { title: '阶段', width: 95, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{stageLabel[record.stage]}</Typography.Text><small>{record.eventId}</small></div> },
        { title: '状态 / 时间', width: 130, render: (_, record) => <div className="configuration-cell"><Tag color={eventStatusColor[record.status]}>{eventStatusLabel[record.status]}</Tag><small>{record.occurredAt}</small></div> },
        { title: '来源 / 关联号', width: 200, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.sourceSystem}</Typography.Text><small>{record.correlationId}</small></div> },
        { title: '内容 / 原因', width: 300, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.payloadSummary}</Typography.Text><small>{record.reason}</small></div> },
      ]} />
    </Card>
  </Space>;
}
