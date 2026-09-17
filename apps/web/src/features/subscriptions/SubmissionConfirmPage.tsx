import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { App, Alert, Button, Card, Checkbox, Collapse, Descriptions, Divider, Input, Result, Space, Table, Tag } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import type { SubmissionContext } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { useAuth } from '../../core/auth/AuthProvider';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const changeLabels: Readonly<Record<string, string>> = {
  ADDED: '新增',
  MODIFIED: '修改',
  NARROWED: '范围收窄',
  REMOVED: '删除',
  UNKNOWN: '待确认',
};

const fieldLabels: Readonly<Record<string, string>> = {
  endpointRevision: '接入端点版本',
  feedbackProfile: '反馈配置',
  validTo: '有效期截止日期',
};
const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };

export function SubmissionConfirmPage() {
  const { requestId = 'REQ-240916-003' } = useParams();
  const { modal, message } = App.useApp();
  const { actor } = useAuth();
  const [truthDeclared, setTruthDeclared] = useState(false);
  const [authorityDeclared, setAuthorityDeclared] = useState(false);
  const [remark, setRemark] = useState('');
  const idempotencyKey = useRef(`SUBMIT-${requestId}-R1-${actor.actorId}-${actor.environment}`);
  useEffect(() => {
    // 环境或工作身份切换后，提交申请不得继续使用旧上下文的幂等键。
    idempotencyKey.current = `SUBMIT-${requestId}-R1-${actor.actorId}-${actor.environment}`;
  }, [actor.actorId, actor.environment, requestId]);
  const query = useQuery({ queryKey: ['submission-context', requestId], queryFn: () => subscriptionGateway.getSubmissionContext(requestId) });
  const receiptQuery = useQuery({ queryKey: ['submission-receipt', requestId], queryFn: () => subscriptionGateway.getSubmissionReceipt(requestId) });
  const submit = useMutation({
    mutationFn: () => subscriptionGateway.submitRequest(requestId, idempotencyKey.current),
  });

  const context = query.data;
  const receipt = submit.data ?? receiptQuery.data;
  const submittable = Boolean(
    context
      && !receiptQuery.isPending
      && !receipt
      && context.summaryValidity === 'CURRENT'
      && context.precheck.runStatus === 'COMPLETED'
      && context.precheck.validity === 'CURRENT'
      && (context.precheck.outcome === 'PASS' || context.precheck.outcome === 'PASS_WITH_CONDITIONS')
      && truthDeclared
      && authorityDeclared,
  );

  function confirmSubmit() {
    if (!context || !submittable) return;
    modal.confirm({
      title: '确认提交这份订阅申请？',
      content: `申请企业：${context.oemName}；接入应用：${context.applicationName}；服务：${context.serviceName}；服务范围：${context.coverage}；申请期限：${context.validPeriod}。提交后将进入审批流程，如需修改须创建新版本。`,
      okText: '确认提交',
      cancelText: '继续核对',
      onOk: async () => {
        await submit.mutateAsync();
      },
    });
  }

  if (receipt) {
    return (
      <Card>
        <Result
          status="success"
          title="申请已提交"
          subTitle="系统已生成正式申请版本并进入审批流程。审批通过后仍需完成配置、测试和发布，服务才可正式开通。"
          extra={[
            <Link key="approval" className="ant-btn ant-btn-primary" to={`/fr2/approvals/${receipt.approvalCaseId}`}>查看审批进度</Link>,
            <Link key="list" className="ant-btn ant-btn-default" to="/fr2/requests">返回申请列表</Link>,
          ]}
        >
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="申请编号 / 版本">{receipt.requestId} / V{receipt.requestRevision}</Descriptions.Item>
            <Descriptions.Item label="流程状态"><StatusTag value={receipt.requestStatus} /></Descriptions.Item>
            <Descriptions.Item label="内容校验码">{receipt.contentHash}</Descriptions.Item>
            <Descriptions.Item label="审批单号">{receipt.approvalCaseId}</Descriptions.Item>
            <Descriptions.Item label="请求流水号">{receipt.idempotencyKey}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{receipt.submittedAt}</Descriptions.Item>
          </Descriptions>
        </Result>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="订阅申请"
        title="确认并提交申请"
        description="请核对申请内容、变更项和检查结果。提交后进入审批流程，如需修改须创建新的申请版本。"
        badges={context ? [`草稿版本 V${context.draftRevision}`, '检查结果有效', environmentLabel[context.environment] ?? context.environment] : []}
        actions={[
          <Link key="back" className="ant-btn ant-btn-default" to={`/fr2/requests/new?requestId=${requestId}`}><ArrowLeftOutlined /> 查看申请信息</Link>,
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>刷新检查结果</Button>,
        ]}
      />
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : context ? 'ready' : 'empty'} onRetry={() => void query.refetch()}>
        {context ? <SubmissionContent context={context} remark={remark} setRemark={setRemark} truthDeclared={truthDeclared} setTruthDeclared={setTruthDeclared} authorityDeclared={authorityDeclared} setAuthorityDeclared={setAuthorityDeclared} submittable={submittable} submitting={submit.isPending} submitError={submit.isError} onSubmit={confirmSubmit} onCopy={() => { void navigator.clipboard.writeText(JSON.stringify({ requestId: context.requestId, revision: context.draftRevision, contentHash: context.contentHash, scopeHash: context.scopeHash, precheckRunId: context.precheck.runId })).then(() => message.success('技术信息已复制')).catch(() => message.error('复制失败，请检查浏览器权限')); }} /> : null}
      </StateBoundary>
    </>
  );
}

interface SubmissionContentProps {
  context: SubmissionContext;
  remark: string;
  setRemark: (value: string) => void;
  truthDeclared: boolean;
  setTruthDeclared: (value: boolean) => void;
  authorityDeclared: boolean;
  setAuthorityDeclared: (value: boolean) => void;
  submittable: boolean;
  submitting: boolean;
  submitError: boolean;
  onSubmit: () => void;
  onCopy: () => void;
}

function SubmissionContent(props: SubmissionContentProps) {
  const { context } = props;
  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card title="申请信息" extra={<Space><StatusTag value={context.summaryValidity} /><Tag>更新于 {context.generatedAt}</Tag></Space>}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="申请编号 / 草稿版本">{context.requestId} / V{context.draftRevision}</Descriptions.Item>
          <Descriptions.Item label="授权依据">{context.entitlementRevision}</Descriptions.Item>
          <Descriptions.Item label="接入应用">{context.applicationName}</Descriptions.Item>
          <Descriptions.Item label="申请环境">{environmentLabel[context.environment] ?? context.environment}</Descriptions.Item>
          <Descriptions.Item label="申请企业">{context.oemName}</Descriptions.Item>
          <Descriptions.Item label="服务名称">{context.serviceName}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="申请内容">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="使用目的" span={2}>{context.purpose}</Descriptions.Item>
          <Descriptions.Item label="适用车型">{context.capabilityGroup}</Descriptions.Item>
          <Descriptions.Item label="服务区域">{context.coverage}</Descriptions.Item>
          <Descriptions.Item label="服务时段">{context.schedule}</Descriptions.Item>
          <Descriptions.Item label="接入方式">{context.channelProfile}</Descriptions.Item>
          <Descriptions.Item label="服务质量">{context.qualityProfile}</Descriptions.Item>
          <Descriptions.Item label="反馈要求">{context.feedbackProfile}</Descriptions.Item>
          <Descriptions.Item label="申请期限" span={2}>{context.validPeriod}</Descriptions.Item>
          <Descriptions.Item label="双方责任" span={2}>{context.responsibility}</Descriptions.Item>
          <Descriptions.Item label="到期退出要求" span={2}>{context.exitObligation}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Collapse items={[{
        key: 'technical',
        label: '系统校验信息（技术人员查看）',
        children: (
          <Card extra={<Button type="text" icon={<CopyOutlined />} onClick={props.onCopy}>复制技术信息</Button>}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="服务版本">{context.serviceName}</Descriptions.Item>
              <Descriptions.Item label="范围校验码">{context.scopeHash}</Descriptions.Item>
              <Descriptions.Item label="内容校验码">{context.contentHash}</Descriptions.Item>
              <Descriptions.Item label="检查数据快照">{context.precheck.inputSnapshotId}</Descriptions.Item>
              <Descriptions.Item label="检查规则版本">{context.precheck.ruleSetVersion}</Descriptions.Item>
              <Descriptions.Item label="原因码版本">{context.reasonCodeVersion}</Descriptions.Item>
              <Descriptions.Item label="系统约束">有效期截止日不包含当天；无法确认的关键项禁止提交；当前仅支持企业应用级接入。</Descriptions.Item>
            </Descriptions>
          </Card>
        ),
      }]} />

      {context.changes.length > 0 ? <Card title={`相较上一正式版本 V${context.previousRevision ?? '—'} 的变更`}>
        <Table pagination={false} rowKey={(row) => `${row.category}-${row.field}`} dataSource={context.changes} columns={[
          { title: '变更类型', dataIndex: 'category', render: (value) => <Tag color={value === 'UNKNOWN' ? 'red' : value === 'NARROWED' ? 'orange' : 'blue'}>{changeLabels[String(value)] ?? String(value)}</Tag> },
          { title: '变更内容', dataIndex: 'field', render: (value) => fieldLabels[String(value)] ?? String(value) },
          { title: '变更前', dataIndex: 'before' },
          { title: '变更后', dataIndex: 'after' },
        ]} />
      </Card> : <Alert type="info" showIcon title="首次申请，无历史版本变更" />}

      <Card title="提交前检查" extra={<Space><StatusTag value={context.precheck.outcome} /><StatusTag value={context.precheck.validity} /></Space>}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="检查状态"><StatusTag value={context.precheck.runStatus} /></Descriptions.Item>
          <Descriptions.Item label="检查批次">{context.precheck.runId}</Descriptions.Item>
          <Descriptions.Item label="未通过项">0 项</Descriptions.Item>
        </Descriptions>
        <Link className="ant-btn ant-btn-link" style={{ paddingInline: 0 }} to={`/fr2/prechecks/${context.precheck.runId}`}>查看准入检查明细</Link>
        <Divider />
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Checkbox checked={props.truthDeclared} onChange={(event) => props.setTruthDeclared(event.target.checked)}>我确认申请材料、使用目的、服务范围及责任说明真实准确。</Checkbox>
          <Checkbox checked={props.authorityDeclared} onChange={(event) => props.setAuthorityDeclared(event.target.checked)}>我确认已获得申请企业授权，并有权提交本申请。</Checkbox>
          <Input.TextArea value={props.remark} onChange={(event) => props.setRemark(event.target.value)} maxLength={300} showCount placeholder="补充说明（选填）" />
          {props.submitError ? <Alert type="error" showIcon title="提交失败" description="申请内容可能已发生变化，请刷新检查结果后重试。" /> : null}
          {!props.submittable ? <Alert type="info" showIcon title="请完成两项确认后提交" description="如果检查结果过期或存在未通过项，系统将阻止提交。" /> : null}
          <Button type="primary" size="large" icon={<CheckCircleOutlined />} disabled={!props.submittable} loading={props.submitting} onClick={props.onSubmit}>提交申请</Button>
        </Space>
      </Card>
    </Space>
  );
}
