import { ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, List, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import type { DashboardMetric, SubscriptionRequestSummary } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const toneClass = {
  default: 'metric-default', success: 'metric-success', warning: 'metric-warning', danger: 'metric-danger',
} as const;

function metricIcon(key: string) {
  if (key === 'approval') return <ClockCircleOutlined />;
  if (key === 'remediation') return <ExclamationCircleOutlined />;
  return <CheckCircleOutlined />;
}

function nextAction(record: SubscriptionRequestSummary) {
  if (record.requestStatus === 'DRAFT') return { label: '核对并提交', href: `/fr2/requests/${record.requestId}/submit` };
  if (record.requestStatus === 'SUBMITTED') return { label: '查看提交结果', href: `/fr2/requests/${record.requestId}/submit` };
  return { label: '查看审批', href: `/fr2/approvals/APR-${record.requestId.replace(/^REQ-/, '')}` };
}

export function WorkbenchPage() {
  const navigate = useNavigate();
  const { actor, authorize } = useAuth();
  const metrics = useQuery({ queryKey: ['dashboard', 'metrics'], queryFn: subscriptionGateway.dashboardMetrics });
  const requests = useQuery({ queryKey: ['subscription-requests', 'recent'], queryFn: () => subscriptionGateway.listRequests() });
  const metricItems = metrics.data ?? [];
  const isApprover = actor.roles.includes('APPROVER');
  const canReadApprovals = authorize({ permission: 'FR2.APPROVAL.READ' }).allowed;
  const canReadPrechecks = authorize({ permission: 'FR2.PRECHECK.READ' }).allowed;
  const canRemediate = authorize({ permission: 'FR2.PRECHECK.REMEDIATE' }).allowed;
  const todoItems: { title: string; detail: string; status: string; href: string; tone: 'warning' | 'processing' | 'default'; action: 'PROCESS' | 'VIEW' }[] = [
    ...(canReadApprovals ? [{
      title: isApprover ? '处理我的审批' : '查看审批队列',
      detail: isApprover ? '核对申请范围、准入结论和附加条件' : '当前账号仅可查看审批事项，审批决定由独立审批人完成',
      status: isApprover ? '待处理' : '供查看',
      href: '/fr2/approvals',
      tone: 'warning' as const,
      action: isApprover ? 'PROCESS' as const : 'VIEW' as const,
    }] : []),
    ...(canReadPrechecks ? [{
      title: canRemediate ? '处理补正材料' : '查看补正任务',
      detail: canRemediate ? '处理人已提交，等待独立复核' : '当前账号仅可查看补正状态和材料记录',
      status: canRemediate ? '待核验' : '供查看',
      href: '/fr2/remediations/REM-240916-001',
      tone: 'processing' as const,
      action: canRemediate ? 'PROCESS' as const : 'VIEW' as const,
    }, {
      title: '查看准入检查', detail: '存在一项范围收窄要求', status: '需关注', href: '/fr2/prechecks/PCR-240916-001', tone: 'default' as const, action: 'VIEW' as const,
    }] : []),
  ];

  return <>
    <PageHeader eyebrow="运营工作台" title="我的工作台" description="从这里开始处理订阅申请、准入检查和审批事项。" badges={['当前身份与数据范围']} actions={<Button type="primary" onClick={() => navigate('/fr2/requests')}>进入申请管理</Button>} />

    <div className="data-notice"><span className="notice-dot" />当前页面汇总平台业务状态；审批通过、发布成功和车辆端展示不会在此页面被推断。</div>

    <StateBoundary state={metrics.isPending ? 'loading' : metrics.isError ? 'error' : 'ready'} onRetry={() => void metrics.refetch()}>
      <div className="workbench-metrics">
        {metricItems.map((metric: DashboardMetric) => <Card className={`workbench-metric ${toneClass[metric.tone]}`} key={metric.key}>
          <div className="workbench-metric-head"><span>{metricIcon(metric.key)} {metric.label}</span><Typography.Text type="secondary">{metric.unit}</Typography.Text></div>
          <Statistic value={metric.value} />
          <Typography.Text type="secondary">{metric.description}</Typography.Text>
        </Card>)}
      </div>
    </StateBoundary>

    <Row gutter={[16, 16]} className="section-gap">
      <Col xs={24} xl={16}>
        <Card className="workbench-panel" title="最近申请" extra={<Link to="/fr2/requests">查看全部 <ArrowRightOutlined /></Link>}>
          <StateBoundary state={requests.isPending ? 'loading' : requests.isError ? 'error' : requests.data?.items.length ? 'ready' : 'empty'} onRetry={() => void requests.refetch()}>
            <Table<SubscriptionRequestSummary> rowKey={(record) => `${record.requestId}-${record.requestRevision}`} pagination={false} dataSource={requests.data?.items ?? []} columns={[
              { title: '申请', width: 210, render: (_, record) => <div className="workbench-request"><Typography.Text strong>{record.requestId}</Typography.Text><span>版本 V{record.requestRevision} · {record.oemName}</span><small>{record.applicationName}</small></div> },
              { title: '服务与范围', width: 240, render: (_, record) => <div className="workbench-request"><Typography.Text>{record.serviceName}</Typography.Text><span>{record.coverageSummary}</span><small>{record.channelType === 'UU_A' ? '企业云接入' : record.channelType}</small></div> },
              { title: '当前状态', width: 130, render: (_, record) => <Space orientation="vertical" size={3}><StatusTag value={record.requestStatus} /><StatusTag value={record.precheckOutcome} /></Space> },
              { title: '更新时间', dataIndex: 'updatedAt', width: 145, render: (value) => <Typography.Text type="secondary">{value}</Typography.Text> },
              { title: '下一步', width: 110, fixed: 'right', render: (_, record) => { const action = nextAction(record); return <Link to={action.href}>{action.label}</Link>; } },
            ]} />
          </StateBoundary>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="workbench-panel" title="待处理事项" extra={<Tag color="blue">{todoItems.length} 项</Tag>}>
          <List className="workbench-todo-list" dataSource={todoItems} renderItem={(item) => <List.Item actions={[<Link key="open" to={item.href}>{item.action === 'PROCESS' ? '处理' : '查看'}</Link>]}> 
            <List.Item.Meta title={item.title} description={item.detail} />
            <StatusTag value={item.tone === 'warning' ? 'IN_REVIEW' : item.tone === 'processing' ? 'PENDING_VERIFY' : 'HAS_UNKNOWN'} />
          </List.Item>} />
        </Card>
      </Col>
    </Row>

    <Card className="workbench-flow section-gap" title="办理进度" extra={<Typography.Text type="secondary">当前申请流程</Typography.Text>}>
      <div className="workbench-flow-track">
        {[['01', '填写申请', '已完成', 'done'], ['02', '准入检查', '有条件通过', 'done'], ['03', '审批处理', '审批中', 'active'], ['04', '配置与测试', '待开始', 'wait'], ['05', '发布开通', '待开始', 'wait']].map(([number, title, detail, state]) => <div className={`flow-node flow-${state}`} key={number}><span className="flow-number">{number}</span><div><strong>{title}</strong><small>{detail}</small></div></div>)}
      </div>
      <Alert className="section-gap-bottomless" showIcon type="info" title="审批通过不等于服务已开通" description="还需完成配置、联合测试和发布；车辆端是否接收或展示，以对应系统的实际证据为准。" />
    </Card>
  </>;
}
