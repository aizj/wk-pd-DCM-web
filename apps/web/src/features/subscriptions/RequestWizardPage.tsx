import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Descriptions, Form, Input, Row, Select, Space, Steps, Typography } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { SubscriptionDraftInput } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';

const draftSchema = z.object({
  entitlementId: z.string().min(1, '请选择权益'),
  applicationClientId: z.string().min(1, '请选择应用'),
  serviceVersionId: z.string().min(1, '请选择服务版本'),
  capabilityGroupId: z.string().min(1, '请选择能力组'),
  coverageId: z.string().min(1, '请选择服务区域'),
  channelType: z.enum(['UU_A']),
  validTo: z.string().min(1, '请选择有效期'),
});

type DraftForm = z.infer<typeof draftSchema>;

function draftErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    PERMISSION_DENIED: '当前账号缺少创建订阅申请的权限，请切换到已授权身份或联系管理员。',
    IDEMPOTENCY_KEY_CONFLICT: '本次请求编号已用于另一份草稿，请刷新页面后重试。',
    DRAFT_SERVICE_NOT_FOUND: '服务版本不存在，请从服务目录重新选择。',
    DRAFT_SERVICE_UNAVAILABLE: '该服务当前暂停申请，不能创建草稿。',
    DRAFT_ENTITLEMENT_MISMATCH: '所选服务与企业权益不匹配，请返回目录重新选择。',
    DRAFT_OUT_OF_SCOPE: '当前身份无权在该租户或环境下创建草稿，请切换到具有授权的工作环境。',
    DRAFT_ENTITLEMENT_NOT_ACTIVE: '企业权益不是有效状态，不能创建草稿。',
    DRAFT_ENVIRONMENT_UNSUPPORTED: '当前权益环境不在服务版本支持范围内。',
    DRAFT_CHANNEL_UNSUPPORTED: '当前接入方式不在服务版本支持范围内。',
    DRAFT_REQUIRED_INPUT_MISSING: '请补齐申请必填信息后再创建草稿。',
    DRAFT_CAPABILITY_MISMATCH: '车型能力组与企业权益不一致，请重新选择。',
    DRAFT_COVERAGE_NOT_FOUND: '服务区域未登记，请从已授权区域中选择。',
    DRAFT_VALIDITY_OUT_OF_ENTITLEMENT: '服务截止日期超出企业权益有效期。',
  };
  return messages[code] ?? '草稿创建失败，请刷新后重新核对申请信息。';
}

const steps = ['服务与授权', '适用车型', '服务区域', '接入方式', '申请期限'];

export function RequestWizardPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { actor } = useAuth();
  const { message } = App.useApp();
  const requestIdParam = params.get('requestId');
  // 该编号对应服务端返回的既有草稿；不将其作为特殊流程处理。
  const isSeededRequest = requestIdParam === 'REQ-240916-003';
  const draftQuery = useQuery({
    queryKey: ['subscription-draft', requestIdParam],
    queryFn: () => subscriptionGateway.getSubscriptionDraft(requestIdParam ?? ''),
    enabled: Boolean(requestIdParam && !isSeededRequest),
  });
  const loadedDraft = draftQuery.data;
  const requestedServiceId = loadedDraft?.serviceId ?? params.get('serviceId') ?? 'SVC-SPAT-2.3';
  const requestedEntitlementId = loadedDraft?.entitlementId ?? params.get('entitlementId') ?? 'ENT-JN-SANDBOX-001';
  const requestedRequestId = requestIdParam ?? 'REQ-240916-003';
  const requestedEnvironmentLabel = requestedEntitlementId.includes('-TEST-') ? '测试环境' : '沙盒环境';
  const isVruService = requestedServiceId === 'SVC-VRU-1.5';
  const requestedServiceLabel = isVruService ? '超视距弱势交通参与者碰撞预警 · v1.5' : '信号灯提醒服务 · v2.3';
  const requestedApplicationLabel = isVruService ? '弱势交通参与者预警' : '智行交通助手';
  const requestedCapabilityId = isVruService ? 'CAP-VRU-CONFIRMED-02' : 'CAP-OEM-CONFIRMED-01';
  const requestedCoverageId = isVruService ? 'COV-JINAN-WEST-001' : 'COV-JINGSHI-038';
  const requestedCoverageLabel = isVruService ? '济南西站示范区' : '经十路示范走廊 · 38个路口';
  const requestedValidTo = loadedDraft?.validTo ?? (isVruService ? '2026-10-15' : '2026-11-30');
  const validToParts = requestedValidTo.split('-');
  const requestedValidToHint = validToParts.length === 3
    ? `${Number(validToParts[1])}月${Number(validToParts[2])}日零时截止，不包含${Number(validToParts[1])}月${Number(validToParts[2])}日当天。`
    : '服务截止时间以申请有效期为准。';
  const isNewDraft = !params.get('requestId') && !params.get('base');
  const [current, setCurrent] = useState(0);
  const [validated, setValidated] = useState(false);
  // 每次打开新建页代表一次新的草稿意图；同一页内重试仍复用该键，避免重复创建。
  const idempotencyKey = useRef(`DRAFT-${actor.actorId}-${requestedServiceId}-${requestedEntitlementId}-${Date.now()}`);
  useEffect(() => {
    // 环境或工作身份切换后，不能复用旧会话的创建请求流水号。
    idempotencyKey.current = `DRAFT-${actor.actorId}-${actor.environment}-${requestedServiceId}-${requestedEntitlementId}-${Date.now()}`;
  }, [actor.actorId, actor.environment, requestedEntitlementId, requestedServiceId]);
  const { control, getValues, reset, setError, formState: { errors } } = useForm<DraftForm>({
    defaultValues: {
      entitlementId: requestedEntitlementId,
      applicationClientId: isVruService ? 'APP-QILU-VRU-01' : 'APP-QILU-TRAFFIC-01',
      serviceVersionId: requestedServiceId,
      capabilityGroupId: requestedCapabilityId,
      coverageId: requestedCoverageId,
      channelType: 'UU_A',
      validTo: requestedValidTo,
    },
  });

  useEffect(() => {
    if (!loadedDraft) return;
    reset({
      entitlementId: loadedDraft.entitlementId,
      applicationClientId: loadedDraft.applicationClientId,
      serviceVersionId: loadedDraft.serviceId,
      capabilityGroupId: loadedDraft.capabilityGroupId,
      coverageId: loadedDraft.coverageId,
      channelType: loadedDraft.channelType === 'UU_A' ? loadedDraft.channelType : 'UU_A',
      validTo: loadedDraft.validTo,
    });
  }, [loadedDraft, reset]);

  const mode = requestIdParam ? '查看申请草稿' : params.get('base') ? '查看退回材料入口' : '新建申请草稿';
  const snapshot = useMemo(() => getValues(), [current, validated, loadedDraft]);

  const createDraft = useMutation({
    mutationFn: async () => {
      const values = draftSchema.parse(getValues());
      const input: SubscriptionDraftInput = { ...values, serviceId: requestedServiceId };
      return subscriptionGateway.createSubscriptionDraft(input, idempotencyKey.current);
    },
    onSuccess: (receipt) => {
      message.success(`草稿 ${receipt.requestId} 已创建`);
      navigate(`/fr2/requests/${receipt.requestId}/submit`);
    },
  });

  function validateAndContinue() {
    const result = draftSchema.safeParse(getValues());
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof DraftForm | undefined;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }
    setValidated(true);
    setCurrent((value) => Math.min(value + 1, steps.length - 1));
  }

  function createDraftFromForm() {
    const result = draftSchema.safeParse(getValues());
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof DraftForm | undefined;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }
    createDraft.mutate();
  }

  if (params.get('base')) {
    return <>
      <PageHeader eyebrow="订阅申请" title="退回后补充材料"
        description="原申请版本保留为只读记录。申请人需根据退回要求创建新的草稿版本，并重新完成准入检查。"
        badges={['退回处理', requestedEnvironmentLabel]}
        actions={<Link className="ant-btn ant-btn-default" to="/fr2/requests">返回申请管理</Link>} />
      <Card>
        <Alert type="warning" showIcon title="当前未生成可编辑的后继草稿"
          description={`来源申请：${params.get('base')}。本阶段只展示退回路径，不会将其他申请草稿当作本申请的后继版本。后续请创建新的申请版本并重新完成准入检查。`} />
      </Card>
    </>;
  }

  if (requestIdParam && !isSeededRequest && !draftQuery.isPending && !loadedDraft) {
    return <>
      <PageHeader eyebrow="订阅申请" title="申请草稿不存在" description="当前申请编号不在申请服务记录中，无法继续办理。" badges={['申请不可用']} actions={<Link className="ant-btn ant-btn-default" to="/fr2/requests">返回申请管理</Link>} />
      <Card><Alert type="warning" showIcon title="未找到申请草稿" description={`申请编号 ${requestIdParam} 可能已过期或无权查看。请从申请管理重新创建草稿。`} /></Card>
    </>;
  }

  return (
    <>
      <PageHeader
        eyebrow="订阅申请"
        title="申请信息"
        description={isNewDraft ? '按步骤填写服务、车型、区域、接入方式和期限，创建当前环境申请草稿后进入提交前检查。' : '按步骤查看已创建申请草稿的服务、车型、区域、接入方式和期限。'}
        badges={isNewDraft ? ['新建草稿', requestedEnvironmentLabel] : ['申请草稿', requestedEnvironmentLabel]}
        actions={<Link className="ant-btn ant-btn-default" to="/fr2/requests">返回申请管理</Link>}
      />
      {requestIdParam && !isSeededRequest && draftQuery.isPending ? <Alert showIcon type="info" title="正在加载申请草稿" description="正在读取申请服务记录，请稍候。" className="section-gap-bottom" /> : null}
      <Alert showIcon type={isNewDraft ? 'info' : 'warning'} title={isNewDraft ? `创建${requestedEnvironmentLabel}草稿` : '查看申请草稿'} description={isNewDraft ? `创建后由申请服务生成草稿编号，并把服务、权益、车型和区域上下文带入${requestedEnvironmentLabel}提交前检查；申请内容以申请服务记录为准。` : '当前申请草稿为只读查看入口；如需修改，请从申请管理重新创建申请版本。'} className="section-gap-bottom" />
      {createDraft.isError ? <Alert showIcon type="error" title="草稿创建失败" description={draftErrorMessage(createDraft.error)} className="section-gap-bottom" /> : null}
      <Card>
        <Steps current={current} items={steps.map((title) => ({ title }))} className="wizard-steps" />
        <Row gutter={32}>
          <Col xs={24} xl={15}>
            <Form layout="vertical" className="wizard-form">
              <Typography.Title level={4}>{steps[current]}</Typography.Title>
              {current === 0 ? (
                <Row gutter={16}>
                  <Col span={24}><Controller control={control} name="entitlementId" render={({ field }) => <Form.Item label="已授权服务" required validateStatus={errors.entitlementId ? 'error' : ''} help={errors.entitlementId?.message}><Select {...field} disabled={!isNewDraft} options={[{ value: requestedEntitlementId, label: `${requestedServiceLabel} · 企业权益` }]} /></Form.Item>} /></Col>
                  <Col xs={24} md={12}><Controller control={control} name="applicationClientId" render={({ field }) => <Form.Item label="接入应用" required><Select {...field} disabled={!isNewDraft} options={[{ value: field.value, label: requestedApplicationLabel }]} /></Form.Item>} /></Col>
                  <Col xs={24} md={12}><Controller control={control} name="serviceVersionId" render={({ field }) => <Form.Item label="服务版本" required><Select {...field} disabled={!isNewDraft} options={[{ value: requestedServiceId, label: requestedServiceLabel }]} /></Form.Item>} /></Col>
                </Row>
              ) : null}
              {current === 1 ? <Controller control={control} name="capabilityGroupId" render={({ field }) => <Form.Item label="适用车型能力组" required><Select {...field} disabled={!isNewDraft} options={[{ value: requestedCapabilityId, label: isVruService ? '齐鲁智行已确认车型 · 2个车型系列' : '齐鲁智行已确认车型 · 3个车型系列' }]} /></Form.Item>} /> : null}
              {current === 2 ? <Controller control={control} name="coverageId" render={({ field }) => <Form.Item label="服务区域" required><Select {...field} disabled={!isNewDraft} options={[{ value: requestedCoverageId, label: requestedCoverageLabel }]} /></Form.Item>} /> : null}
              {current === 3 ? <Controller control={control} name="channelType" render={({ field }) => <Form.Item label="接入方式" required><Select {...field} disabled options={[{ value: 'UU_A', label: '平台向车企云提供数据' }]} /></Form.Item>} /> : null}
              {current === 4 ? (
                <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                  <Controller control={control} name="validTo" render={({ field }) => <Form.Item label="服务截止日期" extra={requestedValidToHint} required><Input {...field} type="date" disabled /></Form.Item>} />
                  <Alert type="info" showIcon title="核对申请前，系统已完成准入检查" description="下一步请检查申请摘要、服务范围和责任声明。" />
                </Space>
              ) : null}
              <Space className="wizard-actions">
                <Button disabled={current === 0} onClick={() => setCurrent((value) => Math.max(value - 1, 0))}>上一步</Button>
                {current < steps.length - 1 ? <Button type="primary" onClick={validateAndContinue}>下一步</Button> : isNewDraft ? <PermissionGate permission="FR2.REQUEST.CREATE" fallback={<Button type="primary" disabled>无权限创建草稿</Button>}><Button type="primary" loading={createDraft.isPending} onClick={createDraftFromForm}>创建草稿并核对</Button></PermissionGate> : <Link className="ant-btn ant-btn-primary" to={`/fr2/requests/${requestedRequestId}/submit`}>核对申请</Link>}
              </Space>
            </Form>
          </Col>
          <Col xs={24} xl={9}>
            <Card type="inner" title={isNewDraft ? '申请概览' : '申请草稿概览'} className="context-preview">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="当前模式">{mode}</Descriptions.Item>
                <Descriptions.Item label="申请状态">草稿 V{loadedDraft?.requestRevision ?? 1}</Descriptions.Item>
                <Descriptions.Item label="授权服务">{requestedServiceLabel}</Descriptions.Item>
                <Descriptions.Item label="接入应用">{requestedApplicationLabel}</Descriptions.Item>
                <Descriptions.Item label="服务版本">{snapshot.serviceVersionId}</Descriptions.Item>
                <Descriptions.Item label="适用车型">{isVruService ? '2个已确认车型系列' : '3个已确认车型系列'}</Descriptions.Item>
                <Descriptions.Item label="服务区域">{requestedCoverageLabel}</Descriptions.Item>
                <Descriptions.Item label="接入方式">企业云接入</Descriptions.Item>
                <Descriptions.Item label="申请期限">至 {snapshot.validTo}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Card>
    </>
  );
}
