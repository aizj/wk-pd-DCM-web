import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AccessReviewRequestInput, AccessReviewRequestReceipt, AccessReviewResult, AccessReviewStatus, AccessReviewSummary, RoleAssignmentSubjectType, RoleCode } from '@vrc/contracts';
import { roleCatalog } from '../../core/auth/permissions';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';

const environmentLabel = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' } as const;
const subjectLabel: Record<RoleAssignmentSubjectType, string> = { USER: '用户', SERVICE_ACCOUNT: '服务账号', ORGANIZATION: '组织' };
const statusLabel: Record<AccessReviewStatus, string> = { OPEN: '待复核', IN_REVIEW: '复核中', COMPLETED: '已完成', OVERDUE: '已逾期' };
const statusColor: Record<AccessReviewStatus, string> = { OPEN: 'blue', IN_REVIEW: 'orange', COMPLETED: 'green', OVERDUE: 'red' };
const resultLabel: Record<AccessReviewResult, string> = { RETAIN: '保留', NARROW: '收窄', REVOKE: '撤销', PENDING: '待决定' };
const reasonOptions = [
  { value: 'PERIODIC_REVIEW', label: '定期访问复核' },
  { value: 'ROLE_CHANGE', label: '岗位或职责变化' },
  { value: 'PROJECT_CLOSURE', label: '项目或合作结束' },
  { value: 'SECURITY_RISK', label: '安全风险处置' },
];

function reviewErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    PERMISSION_DENIED: '当前账号没有发起访问复核的权限。',
    IDEMPOTENCY_KEY_CONFLICT: '请求流水号已用于其他复核申请，请重新打开表单后重试。',
    ACCESS_REVIEW_NOT_FOUND: '复核对象不存在或已被移出当前数据范围。',
    ACCESS_REVIEW_OUT_OF_SCOPE: '复核对象不在当前租户或环境范围内。',
    ACCESS_REVIEW_SELF_ACTION: '不能由被复核主体本人提交访问复核结论。',
    ACCESS_REVIEW_INPUT_INVALID: '复核结论、原因或说明不完整，请检查后重试。',
  } as Record<string, string>)[code] ?? '访问复核申请提交失败，请稍后重试。';
}

type ReviewForm = Pick<AccessReviewRequestInput, 'result' | 'reasonCode' | 'comment'>;

export function AccessReviewPage() {
  const navigate = useNavigate();
  const { actor, authorize } = useAuth();
  const canRequest = authorize({ permission: 'GOVERNANCE.ACCESS_REVIEW.REQUEST' }).allowed;
  const [keyword, setKeyword] = useState('');
  const [subjectType, setSubjectType] = useState<RoleAssignmentSubjectType | 'ALL'>('ALL');
  const [roleCode, setRoleCode] = useState<RoleCode | 'ALL'>('ALL');
  const [tenantId, setTenantId] = useState('ALL');
  const [environment, setEnvironment] = useState<keyof typeof environmentLabel | 'ALL'>('ALL');
  const [status, setStatus] = useState<AccessReviewStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<AccessReviewSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<AccessReviewRequestReceipt | null>(null);
  const [form] = Form.useForm<ReviewForm>();
  const sequence = useRef(1);

  const reviewsQuery = useQuery({ queryKey: ['access-reviews', keyword], queryFn: () => subscriptionGateway.listAccessReviews(keyword) });
  const requestsQuery = useQuery({ queryKey: ['access-review-requests'], queryFn: () => subscriptionGateway.listAccessReviewRequests() });
  const tenantOptions = [...new Set((reviewsQuery.data?.items ?? []).map((item) => item.tenantId))].sort();
  const items = (reviewsQuery.data?.items ?? []).filter((item) => (
    (subjectType === 'ALL' || item.subjectType === subjectType)
    && (roleCode === 'ALL' || item.roleCodes.includes(roleCode))
    && (tenantId === 'ALL' || item.tenantId === tenantId)
    && (environment === 'ALL' || item.environment === environment)
    && (status === 'ALL' || item.status === status)
  ));
  const overdueCount = (reviewsQuery.data?.items ?? []).filter((item) => item.status === 'OVERDUE').length;
  const inReviewCount = (reviewsQuery.data?.items ?? []).filter((item) => item.status === 'IN_REVIEW').length;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('ACCESS_REVIEW_NOT_FOUND');
      const values = await form.validateFields();
      sequence.current += 1;
      return subscriptionGateway.requestAccessReview({ reviewId: selected.reviewId, ...values }, `ACCESS-REVIEW-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`);
    },
    onSuccess: (nextReceipt) => {
      setReceipt(nextReceipt);
      void requestsQuery.refetch();
    },
  });

  function openReview(item: AccessReviewSummary) {
    mutation.reset();
    setReceipt(null);
    form.resetFields();
    form.setFieldsValue({ result: item.reviewResult === 'PENDING' ? 'RETAIN' : item.reviewResult, reasonCode: 'PERIODIC_REVIEW', comment: '' });
    setSelected(item);
    setOpen(true);
  }

  return <>
    <PageHeader eyebrow="安全与审计 / 访问控制" title="访问复核" description="按身份、租户、角色、环境、资源和数据分类复核访问权限，形成保留、收窄或撤销的待审批结论；复核不会直接改变有效授权。" actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/governance/permissions')}>返回访问控制总览</Button>} badges={[canRequest ? '可提交复核结论' : '当前账号只读', `当前租户 ${actor.tenantId}`, `当前环境 ${environmentLabel[actor.environment]}`]} />
    <div className="data-notice"><SafetyCertificateOutlined /><span>访问复核与“主体授权”分工：主体授权维护角色绑定，访问复核检查授权是否仍然必要、是否需要收窄或撤销。所有变更仍需服务端审批和审计。</span></div>
    <div className="configuration-overview permission-overview">
      <div><span>复核对象</span><strong>{reviewsQuery.data?.total ?? 0}</strong><small>当前范围</small></div>
      <div><span>待复核</span><strong>{reviewsQuery.data?.items.filter((item) => item.status === 'OPEN').length ?? 0}</strong><small>需处理</small></div>
      <div><span>复核中</span><strong>{inReviewCount}</strong><small>已发起</small></div>
      <div><span>已逾期</span><strong>{overdueCount}</strong><small>高风险</small></div>
      <div><span>待审批申请</span><strong>{requestsQuery.data?.total ?? 0}</strong><small>不改变授权</small></div>
    </div>
    <Card className="configuration-list-card" title="访问复核清单" extra={<Typography.Text type="secondary">复核结果由安全管理员审批后生效</Typography.Text>}>
      <div className="configuration-filter-row access-review-filter-row">
        <Input.Search allowClear placeholder="搜索主体、租户、资源、动作或数据分类" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <Select aria-label="主体类型" value={subjectType} onChange={setSubjectType} options={[{ value: 'ALL', label: '全部主体类型' }, ...Object.entries(subjectLabel).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="租户" value={tenantId} onChange={setTenantId} options={[{ value: 'ALL', label: '全部租户' }, ...tenantOptions.map((value) => ({ value, label: value }))]} />
        <Select aria-label="角色" value={roleCode} onChange={setRoleCode} options={[{ value: 'ALL', label: '全部角色' }, ...roleCatalog.map((role) => ({ value: role.code, label: role.label }))]} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, ...Object.entries(environmentLabel).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="复核状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} />
        <Button onClick={() => { setKeyword(''); setSubjectType('ALL'); setRoleCode('ALL'); setTenantId('ALL'); setEnvironment('ALL'); setStatus('ALL'); }}>重置</Button>
      </div>
      <StateBoundary state={reviewsQuery.isPending ? 'loading' : reviewsQuery.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="暂无符合条件的访问复核对象" onRetry={() => void reviewsQuery.refetch()}>
        <Table rowKey="reviewId" dataSource={items} pagination={{ pageSize: 8 }} scroll={{ x: 1420 }} columns={[{ title: '主体', width: 220, render: (_: unknown, item: AccessReviewSummary) => <div className="configuration-cell"><Typography.Text strong>{item.subjectName}</Typography.Text><small>{subjectLabel[item.subjectType]} · {item.subjectId}</small></div> }, { title: '租户 / 角色', width: 200, render: (_: unknown, item: AccessReviewSummary) => <div className="configuration-cell"><Typography.Text>{item.tenantId}</Typography.Text><small>{item.roleCodes.map((code) => roleCatalog.find((role) => role.code === code)?.label ?? code).join('、')}</small></div> }, { title: '环境', width: 90, render: (_: unknown, item: AccessReviewSummary) => environmentLabel[item.environment] }, { title: '资源 / 动作', width: 280, render: (_: unknown, item: AccessReviewSummary) => <div className="configuration-cell"><Typography.Text>{item.resourceSummary}</Typography.Text><small>{item.actionSummary}</small></div> }, { title: '数据分类', dataIndex: 'dataClassification', width: 140 }, { title: '有效期 / 最近使用', width: 220, render: (_: unknown, item: AccessReviewSummary) => <div className="configuration-cell"><Typography.Text>{item.expiresAt}</Typography.Text><small>最近使用 {item.lastUsedAt}</small></div> }, { title: '状态 / 结论', width: 150, render: (_: unknown, item: AccessReviewSummary) => <Space direction="vertical" size={2}><Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag><Typography.Text type="secondary">{resultLabel[item.reviewResult]}</Typography.Text></Space> }, { title: '复核人', width: 130, dataIndex: 'reviewerName' }, { title: '操作', width: 100, fixed: 'right' as const, render: (_: unknown, item: AccessReviewSummary) => <Button type="link" onClick={() => openReview(item)}>查看 / 复核</Button> }]} />
      </StateBoundary>
    </Card>
    <Card className="section-gap" title="访问复核申请记录" extra={<Typography.Text type="secondary">申请与授权事实分离</Typography.Text>}>
      <StateBoundary state={requestsQuery.isPending ? 'loading' : requestsQuery.isError ? 'error' : requestsQuery.data?.items.length ? 'ready' : 'empty'} emptyTitle="暂无访问复核申请" onRetry={() => void requestsQuery.refetch()}>
        <Table rowKey="requestId" dataSource={requestsQuery.data?.items ?? []} pagination={{ pageSize: 5 }} scroll={{ x: 800 }} columns={[{ title: '申请编号', dataIndex: 'requestId' }, { title: '复核对象', render: (_: unknown, item: AccessReviewRequestReceipt) => item.reviewId }, { title: '申请结论', render: (_: unknown, item: AccessReviewRequestReceipt) => resultLabel[item.result] }, { title: '状态', render: () => <Tag color="blue">待审批</Tag> }, { title: '提交时间', dataIndex: 'submittedAt' }]} />
      </StateBoundary>
    </Card>
    <Drawer title={selected ? `访问复核详情 · ${selected.reviewId}` : '访问复核详情'} open={open} onClose={() => { if (!mutation.isPending) setOpen(false); }} width={650}>
      {selected ? <>
        <Descriptions bordered column={1} size="small"><Descriptions.Item label="主体">{selected.subjectName}（{subjectLabel[selected.subjectType]} · {selected.subjectId}）</Descriptions.Item><Descriptions.Item label="租户 / 环境">{selected.tenantId} · {environmentLabel[selected.environment]}</Descriptions.Item><Descriptions.Item label="角色">{selected.roleCodes.map((code) => roleCatalog.find((role) => role.code === code)?.label ?? code).join('、')}</Descriptions.Item><Descriptions.Item label="资源范围">{selected.resourceSummary}</Descriptions.Item><Descriptions.Item label="允许动作">{selected.actionSummary}</Descriptions.Item><Descriptions.Item label="数据分类">{selected.dataClassification}</Descriptions.Item><Descriptions.Item label="有效期 / 最近使用">{selected.expiresAt} · {selected.lastUsedAt}</Descriptions.Item><Descriptions.Item label="当前状态"><Tag color={statusColor[selected.status]}>{statusLabel[selected.status]}</Tag> · {resultLabel[selected.reviewResult]}</Descriptions.Item></Descriptions>
        <Alert type="info" showIcon className="section-gap-bottom" style={{ marginTop: 16 }} title="复核结论不会立即生效" description="保留、收窄或撤销均需进入审批；审批服务通过后才生成授权变更和逐项执行回执。" />
        {receipt ? <Alert type="success" showIcon title="复核结论已提交" description={<Space direction="vertical"><span>申请编号：{receipt.requestId}，当前状态：待审批。</span><span>{receipt.nextStep}</span></Space>} /> : <PermissionGate permission="GOVERNANCE.ACCESS_REVIEW.REQUEST" fallback={<Button block disabled>当前账号无复核提交权限</Button>}><Form form={form} layout="vertical" onFinish={() => mutation.mutate()}><Form.Item name="result" label="复核结论" rules={[{ required: true }]}><Select options={[{ value: 'RETAIN', label: '保留访问' }, { value: 'NARROW', label: '收窄范围或动作' }, { value: 'REVOKE', label: '撤销访问' }]} /></Form.Item><Form.Item name="reasonCode" label="复核原因" rules={[{ required: true }]}><Select options={reasonOptions} /></Form.Item><Form.Item name="comment" label="复核说明" rules={[{ required: true, min: 10, message: '请填写不少于10个字' }]}><Input.TextArea rows={4} maxLength={500} showCount placeholder="说明最近使用情况、业务目的、收窄范围或撤销依据" /></Form.Item>{mutation.isError ? <Alert type="error" showIcon className="section-gap-bottom" title="复核提交失败" description={reviewErrorMessage(mutation.error)} /> : null}<Button type="primary" htmlType="submit" loading={mutation.isPending}>提交复核结论</Button></Form></PermissionGate>}
      </> : null}
    </Drawer>
  </>;
}
