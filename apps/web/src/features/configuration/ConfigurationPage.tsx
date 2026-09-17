import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Result, Select, Space, Table, Tag, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import type { ConfigurationChangeInput, ConfigurationChangeReceipt, ConfigurationDetail, ConfigurationParameterSummary, ConfigurationSummary } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const changeTypeLabel: Readonly<Record<ConfigurationChangeInput['changeType'], string>> = { CREATE: '新建配置版本', UPDATE: '调整配置参数', ROLLBACK: '回退至历史版本' };
const changeReasonLabel: Readonly<Record<string, string>> = {
  NEW_INSTANCE: '新增服务实例',
  SERVICE_ONBOARDING: '服务接入上线',
  PARAMETER_CORRECTION: '参数纠正',
  SERVICE_POLICY_UPDATE: '服务策略更新',
  OEM_CAPABILITY_CHANGE: '车型能力变化',
  ROLLBACK_AFTER_FAILURE: '发布失败回退',
  EMERGENCY_DEGRADATION: '紧急降级',
};
const changeReasonsByType: Readonly<Record<ConfigurationChangeInput['changeType'], readonly { value: string; label: string }[]>> = {
  CREATE: [{ value: 'NEW_INSTANCE', label: '新增服务实例' }, { value: 'SERVICE_ONBOARDING', label: '服务接入上线' }],
  UPDATE: [{ value: 'PARAMETER_CORRECTION', label: '参数纠正' }, { value: 'SERVICE_POLICY_UPDATE', label: '服务策略更新' }, { value: 'OEM_CAPABILITY_CHANGE', label: '车型能力变化' }],
  ROLLBACK: [{ value: 'ROLLBACK_AFTER_FAILURE', label: '发布失败回退' }, { value: 'EMERGENCY_DEGRADATION', label: '紧急降级' }],
};
const changeErrorLabel: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '当前账号缺少配置变更申请权限，请切换到已授权身份或联系配置负责人。',
  IDEMPOTENCY_KEY_REQUIRED: '请求流水号缺失，请重新打开申请表单后重试。',
  IDEMPOTENCY_KEY_CONFLICT: '请求流水号已被其他申请占用，请重新打开申请表单后重试。',
  CONFIGURATION_NOT_FOUND: '配置版本不存在或已不在当前授权范围内，请重新选择。',
  CONFIGURATION_CHANGE_INPUT_INVALID: '配置版本、订阅实例、基线版本、变更说明或环境信息无效。',
  CONFIGURATION_CHANGE_ENVIRONMENT_MISMATCH: '配置版本与目标环境不一致；请在对应环境创建新的配置版本申请。',
  CONFIGURATION_CHANGE_REASON_INVALID: '申请原因与变更类型不匹配，请重新选择。',
};
type ConfigurationChangeFormValues = Pick<ConfigurationChangeInput, 'changeType' | 'configurationId' | 'targetEnvironment' | 'changeSummary' | 'reasonCode' | 'justification' | 'requiresRequalification'>;

function configurationChangeErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return changeErrorLabel[code] ?? '配置变更申请提交失败，请稍后重试；如果问题持续，请联系配置负责人。';
}

export function ConfigurationPage() {
  const { actor, authorize } = useAuth();
  const [searchParams] = useSearchParams();
  const initialConfigurationId = searchParams.get('configurationId') ?? '';
  const [keyword, setKeyword] = useState(initialConfigurationId);
  const [appliedKeyword, setAppliedKeyword] = useState(initialConfigurationId);
  const [environment, setEnvironment] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<ConfigurationSummary | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeReceipt, setChangeReceipt] = useState<ConfigurationChangeReceipt | null>(null);
  const [changeTarget, setChangeTarget] = useState<ConfigurationSummary | null>(null);
  const [changeType, setChangeType] = useState<ConfigurationChangeInput['changeType']>('UPDATE');
  const [changeForm] = Form.useForm<ConfigurationChangeFormValues>();
  const changeSequence = useRef(1);
  const changeIdempotencyKey = useRef('CFG-CHANGE-' + actor.actorId + '-' + actor.environment + '-01');
  useEffect(() => {
    changeIdempotencyKey.current = 'CFG-CHANGE-' + actor.actorId + '-' + actor.environment + '-01';
  }, [actor.actorId, actor.environment]);
  const query = useQuery({ queryKey: ['configurations', appliedKeyword], queryFn: () => subscriptionGateway.listConfigurations(appliedKeyword) });
  const detailQuery = useQuery({ queryKey: ['configuration-detail', selected?.configurationId], queryFn: () => subscriptionGateway.getConfiguration(selected?.configurationId ?? ''), enabled: Boolean(selected) });
  const canRequestChange = authorize({ permission: 'FR3.CONFIGURATION.REQUEST' }).allowed;
  const changeRequestsQuery = useQuery({ queryKey: ['configuration-change-requests'], queryFn: () => subscriptionGateway.listConfigurationChangeRequests(), enabled: canRequestChange });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) => (environment === 'ALL' || item.environment === environment) && (status === 'ALL' || item.status === status));
  const readyCount = allItems.filter((item) => item.status === 'READY_FOR_TEST').length;
  const blockedCount = allItems.filter((item) => item.status === 'BLOCKED').length;
  const pendingFields = allItems.reduce((sum, item) => sum + item.pendingRequiredFields, 0);
  const changeRequests = changeRequestsQuery.data?.items ?? [];
  const changeMutation = useMutation({
    mutationFn: async () => {
      const values = await changeForm.validateFields();
      const target = allItems.find((item) => item.configurationId === values.configurationId) ?? changeTarget;
      if (!target) throw new Error('CONFIGURATION_NOT_FOUND');
      return subscriptionGateway.requestConfigurationChange({
        ...values,
        subscriptionId: target.subscriptionId,
        instanceId: target.instanceId,
        baseRevision: target.revision,
      }, changeIdempotencyKey.current);
    },
    onSuccess: (receipt) => {
      setChangeReceipt(receipt);
      void changeRequestsQuery.refetch();
    },
  });

  useEffect(() => {
    const currentReason = changeForm.getFieldValue('reasonCode');
    if (currentReason && !changeReasonsByType[changeType].some((option) => option.value === currentReason)) {
      changeForm.setFieldValue('reasonCode', undefined);
    }
  }, [changeForm, changeType]);

  function openChangeRequest(target?: ConfigurationSummary) {
    setChangeTarget(target ?? null);
    setChangeReceipt(null);
    changeMutation.reset();
    changeSequence.current += 1;
    changeIdempotencyKey.current = 'CFG-CHANGE-' + actor.actorId + '-' + (changeTarget?.environment ?? actor.environment) + '-' + String(changeSequence.current).padStart(2, '0');
    const nextType: ConfigurationChangeInput['changeType'] = target?.status === 'BLOCKED' ? 'ROLLBACK' : 'UPDATE';
    setChangeType(nextType);
    changeForm.resetFields();
    changeForm.setFieldsValue({
      changeType: nextType,
      targetEnvironment: target?.environment ?? 'SANDBOX',
      changeSummary: '',
      reasonCode: nextType === 'ROLLBACK' ? 'ROLLBACK_AFTER_FAILURE' : 'PARAMETER_CORRECTION',
      justification: '',
      requiresRequalification: true,
      ...(target ? { configurationId: target.configurationId } : {}),
    });
    setChangeOpen(true);
  }

  return <>
    <PageHeader eyebrow="参数配置" title="配置管理" description="为已批准的订阅实例维护参数配置，完成后进入联合测试。配置变更先提交申请，审批后生成新版本。" badges={canRequestChange ? ['数据状态 · 以服务端为准', '配置变更权限 · 已授权'] : ['数据状态 · 以服务端为准']} actions={<PermissionGate permission="FR3.CONFIGURATION.REQUEST" fallback={<Button disabled>申请配置变更</Button>}><Button type="primary" onClick={() => openChangeRequest()}>申请配置变更</Button></PermissionGate>} />
    <div className="configuration-overview" aria-label="配置概览">
      <div><span>配置版本</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>项</small></div>
      <div><span>待联合测试</span><strong>{query.isPending ? '—' : readyCount}</strong><small>项</small></div>
      <div><span>待补参数</span><strong>{query.isPending ? '—' : pendingFields}</strong><small>项</small></div>
      <div><span>存在阻断</span><strong>{query.isPending ? '—' : blockedCount}</strong><small>项</small></div>
    </div>
    <div className="data-notice"><InfoCircleOutlined /><span>配置变更不会直接生效；完成配置校验后，还需通过联合测试和发布流程。</span></div>
    <Card className="configuration-list-card" title={<Space size={8}><span>配置版本</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="配置编号 / 订阅 / 实例 / 服务" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="配置状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, { value: 'DRAFT', label: '草稿' }, { value: 'READY_FOR_TEST', label: '待联合测试' }, { value: 'IN_TEST', label: '联合测试中' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'BLOCKED', label: '存在阻断' }]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setStatus('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的配置版本" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<ConfigurationSummary> rowKey="configurationId" dataSource={items} pagination={false} scroll={{ x: 1160 }} columns={[
          { title: '配置版本', width: 210, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.configurationId}</Typography.Text><span>V{record.revision} · {record.serviceName}</span><small>{record.applicationName}</small></div> },
          { title: '订阅 / 实例', width: 205, render: (_, record) => <div className="configuration-cell"><Link to={`/fr2/subscriptions/${record.subscriptionId}?instanceId=${record.instanceId}`}>{record.subscriptionId}</Link><span>{record.instanceId}</span><small>{environmentLabel[record.environment]}环境 · {record.coverageSummary}</small></div> },
          { title: '配置状态', width: 135, render: (_, record) => <div className="configuration-status-cell"><StatusTag value={record.status} /><small>{record.pendingRequiredFields ? String(record.pendingRequiredFields) + ' 项必填参数待补充' : String(record.parameterCount) + ' 项参数已配置'}</small></div> },
          { title: '负责人 / 更新', width: 145, render: (_, record) => <div className="configuration-cell"><span>{record.ownerName}</span><small>{record.updatedAt}</small></div> },
          { title: '操作', width: 180, fixed: 'right', render: (_, record) => <Space size={0}><Button type="link" onClick={() => setSelected(record)}>查看配置项</Button><PermissionGate permission="FR3.CONFIGURATION.REQUEST" fallback={<Button type="link" disabled>申请变更</Button>}><Button type="link" onClick={() => openChangeRequest(record)}>申请变更</Button></PermissionGate></Space> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.configurationId}>
          <div className="mobile-configuration-head"><div><strong>{record.configurationId}</strong><span>V{record.revision} · {record.serviceName}</span></div><StatusTag value={record.status} /></div>
          <div className="mobile-configuration-meta">{record.subscriptionId} · {record.instanceId}</div>
          <div className="mobile-configuration-meta">{environmentLabel[record.environment]}环境 · {record.coverageSummary}</div>
          <div className="mobile-configuration-status">{record.pendingRequiredFields ? String(record.pendingRequiredFields) + ' 项必填参数待补充' : String(record.parameterCount) + ' 项参数已配置'}</div>
          <div className="mobile-configuration-footer"><span>{record.ownerName} · {record.updatedAt}</span><Space size={0}><Button type="link" onClick={() => setSelected(record)}>查看配置项</Button><PermissionGate permission="FR3.CONFIGURATION.REQUEST" fallback={<Button type="link" disabled>申请变更</Button>}><Button type="link" onClick={() => openChangeRequest(record)}>申请变更</Button></PermissionGate></Space></div>
        </div>)}</div>
      </StateBoundary>
    </Card>
    <PermissionGate permission="FR3.CONFIGURATION.REQUEST" fallback={null}>
    <Card className="configuration-list-card" title={<Space size={8}><span>配置变更申请记录</span><span className="list-count">{changeRequests.length}</span></Space>} extra={<Typography.Text type="secondary">仅展示当前账号提交的申请</Typography.Text>}>
      <StateBoundary state={changeRequestsQuery.isPending ? 'loading' : changeRequestsQuery.isError ? 'error' : changeRequests.length ? 'ready' : 'empty'} emptyTitle="暂没有配置变更申请" onRetry={() => void changeRequestsQuery.refetch()}>
        <div className="desktop-configuration-table"><Table<ConfigurationChangeReceipt> rowKey="requestId" dataSource={changeRequests} pagination={false} scroll={{ x: 1080 }} columns={[
          { title: '申请编号', width: 180, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.requestId}</Typography.Text><small>{changeTypeLabel[record.changeType]}</small></div> },
          { title: '配置版本', width: 210, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.configurationId}</Typography.Text><small>{record.subscriptionId} · {record.instanceId}</small></div> },
          { title: '变更说明', width: 260, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.changeSummary}</Typography.Text><small>{changeReasonLabel[record.reasonCode] ?? record.reasonCode}</small></div> },
          { title: '环境 / 重测', width: 160, render: (_, record) => <div className="configuration-cell"><span>{environmentLabel[record.targetEnvironment]}环境</span><small>{record.requiresRequalification ? '审批后必须重新联合测试' : '需按审批结果确认'}</small></div> },
          { title: '状态', width: 110, render: () => <Tag color="blue">待审批</Tag> },
          { title: '提交时间', width: 180, dataIndex: 'submittedAt' },
          { title: '操作', width: 100, fixed: 'right', render: (_, record) => <Button type="link" onClick={() => { changeMutation.reset(); setChangeReceipt(record); setChangeTarget(allItems.find((item) => item.configurationId === record.configurationId) ?? null); setChangeOpen(true); }}>查看回执</Button> },
        ]} /></div>
        <div className="mobile-configuration-list">{changeRequests.map((record) => <div className="mobile-configuration-card" key={record.requestId}>
          <div className="mobile-configuration-head"><div><strong>{record.requestId}</strong><span>{changeTypeLabel[record.changeType]}</span></div><Tag color="blue">待审批</Tag></div>
          <div className="mobile-configuration-meta">{record.configurationId} · {record.subscriptionId} · {record.instanceId}</div>
          <div className="mobile-configuration-meta">{record.changeSummary} · {changeReasonLabel[record.reasonCode] ?? record.reasonCode}</div>
          <div className="mobile-configuration-status">{environmentLabel[record.targetEnvironment]}环境 · {record.requiresRequalification ? '审批后必须重新联合测试' : '需按审批结果确认'}</div>
          <div className="mobile-configuration-footer"><span>{record.submittedAt}</span><Button type="link" onClick={() => { changeMutation.reset(); setChangeReceipt(record); setChangeTarget(allItems.find((item) => item.configurationId === record.configurationId) ?? null); setChangeOpen(true); }}>查看回执</Button></div>
        </div>)}</div>
      </StateBoundary>
    </Card>
    </PermissionGate>
    <Drawer title={selected ? '配置详情 · ' + selected.configurationId : '配置详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={660}>
      {selected ? <>
        <div className="drawer-status-line"><StatusTag value={selected.status} /><Typography.Text type="secondary">V{selected.revision} · {selected.updatedAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="所属订阅"><Link to={`/fr2/subscriptions/${selected.subscriptionId}?instanceId=${selected.instanceId}`} onClick={() => setSelected(null)}>{selected.subscriptionId}</Link></Descriptions.Item>
          <Descriptions.Item label="目标实例">{selected.instanceId}</Descriptions.Item>
          <Descriptions.Item label="服务名称">{selected.serviceName}</Descriptions.Item>
          <Descriptions.Item label="接入应用">{selected.applicationName}</Descriptions.Item>
          <Descriptions.Item label="环境 / 范围">{environmentLabel[selected.environment]}环境 · {selected.coverageSummary}</Descriptions.Item>
          <Descriptions.Item label="参数数量">{selected.parameterCount} 项</Descriptions.Item>
          <Descriptions.Item label="待补参数">{selected.pendingRequiredFields ? selected.pendingRequiredFields + ' 项' : '无'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{selected.ownerName}</Descriptions.Item>
        </Descriptions>
        {detailQuery.isPending ? <Typography.Paragraph type="secondary">配置参数加载中…</Typography.Paragraph> : detailQuery.isError ? <Alert type="error" showIcon title="配置参数加载失败" description="请稍后重试；当前列表摘要仍然可用。" /> : detailQuery.data ? <ConfigurationParameterDetail detail={detailQuery.data} /> : null}
        <div className="data-notice configuration-drawer-notice"><InfoCircleOutlined /><span>{selected.status === 'BLOCKED' ? '当前配置存在阻断项，不能进入联合测试。' : '参数修改需提交申请，审批后生成新版本，再执行校验、联合测试和发布。配置生效状态以配置服务回执为准。'}</span></div>
      </> : null}
    </Drawer>
    <Drawer title="申请配置变更" open={changeOpen} onClose={() => { if (!changeMutation.isPending) setChangeOpen(false); }} width={640}>
      {changeReceipt ? <Result status="info" title="申请已进入待审批" subTitle="审批通过前不会修改当前配置版本；后续需要生成新版本并重新执行配置校验和联合测试。" extra={<Button type="primary" onClick={() => openChangeRequest()}>继续申请</Button>}>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="申请编号">{changeReceipt.requestId}</Descriptions.Item>
          <Descriptions.Item label="申请状态">待审批</Descriptions.Item>
          <Descriptions.Item label="变更类型">{changeTypeLabel[changeReceipt.changeType]}</Descriptions.Item>
          <Descriptions.Item label="配置版本">{changeReceipt.configurationId}（基线 V{changeReceipt.baseRevision}）</Descriptions.Item>
          <Descriptions.Item label="订阅 / 实例">{changeReceipt.subscriptionId} · {changeReceipt.instanceId}</Descriptions.Item>
          <Descriptions.Item label="目标环境">{environmentLabel[changeReceipt.targetEnvironment]}环境</Descriptions.Item>
          <Descriptions.Item label="变更说明">{changeReceipt.changeSummary}</Descriptions.Item>
          <Descriptions.Item label="申请原因">{changeReasonLabel[changeReceipt.reasonCode] ?? changeReceipt.reasonCode}</Descriptions.Item>
          <Descriptions.Item label="重新测试">{changeReceipt.requiresRequalification ? '审批后必须重新联合测试' : '按审批结果确认'}</Descriptions.Item>
          <Descriptions.Item label="提交时间">{changeReceipt.submittedAt}</Descriptions.Item>
          <Descriptions.Item label="下一步">{changeReceipt.nextStep}</Descriptions.Item>
          <Descriptions.Item label="请求流水号">{changeReceipt.idempotencyKey}</Descriptions.Item>
        </Descriptions>
      </Result> : <>
        <Alert type="info" showIcon title="这是配置变更申请，不会直接修改参数" description="申请提交后由配置负责人审批。审批通过才可创建新配置版本；生产环境还需按门禁完成校验、联合测试、发布和车端证据确认。" className="section-gap-bottom" />
        {changeMutation.isError ? <Alert type="error" showIcon title="申请提交失败" description={configurationChangeErrorMessage(changeMutation.error)} className="section-gap-bottom" /> : null}
        <Form<ConfigurationChangeFormValues> form={changeForm} layout="vertical" initialValues={{ changeType: 'UPDATE', targetEnvironment: 'SANDBOX', requiresRequalification: true, reasonCode: 'PARAMETER_CORRECTION' }} onValuesChange={(changed) => { if (changed.changeType) setChangeType(changed.changeType as ConfigurationChangeInput['changeType']); }} onFinish={() => changeMutation.mutate()}>
          <Form.Item name="configurationId" label="目标配置版本" rules={[{ required: true, message: '请选择目标配置版本' }]}><Select placeholder="选择要变更的配置版本" options={allItems.map((item) => ({ value: item.configurationId, label: item.configurationId + ' · ' + item.serviceName + ' · V' + item.revision }))} onChange={(value: string) => { const target = allItems.find((item) => item.configurationId === value) ?? null; setChangeTarget(target); if (target) changeForm.setFieldsValue({ targetEnvironment: target.environment }); }} /></Form.Item>
          <Space size={12} style={{ display: 'flex' }}>
            <Form.Item name="changeType" label="变更类型" rules={[{ required: true, message: '请选择变更类型' }]} style={{ flex: 1 }}><Select options={Object.entries(changeTypeLabel).map(([value, label]) => ({ value, label }))} /></Form.Item>
            <Form.Item name="targetEnvironment" label="目标环境" rules={[{ required: true, message: '请选择目标环境' }]} style={{ flex: 1 }}><Select options={[{ value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} /></Form.Item>
          </Space>
          <Form.Item name="changeSummary" label="变更说明" rules={[{ required: true, min: 5, message: '请填写至少5个字的变更说明' }]}><Input placeholder="例如：补齐车端展示证据回传字段" maxLength={120} showCount /></Form.Item>
          <Form.Item name="reasonCode" label="申请原因" rules={[{ required: true, message: '请选择与变更类型匹配的申请原因' }]}><Select options={[...changeReasonsByType[changeType]]} /></Form.Item>
          <Form.Item name="justification" label="申请说明" rules={[{ required: true, min: 10, message: '请填写不少于10个字的具体说明' }]}><Input.TextArea rows={4} maxLength={500} showCount placeholder="说明变更背景、影响范围、验证方式和回退依据" /></Form.Item>
          <Form.Item name="requiresRequalification" label="联合测试要求" rules={[{ required: true, message: '请选择联合测试要求' }]}><Select options={[{ value: true, label: '审批后必须重新联合测试' }, { value: false, label: '由审批人确认是否重新测试' }]} /></Form.Item>
          {changeTarget ? <Typography.Paragraph type="secondary">当前基线：{changeTarget.configurationId} · V{changeTarget.revision} · {changeTarget.subscriptionId} · {changeTarget.instanceId}</Typography.Paragraph> : null}
          <Space><Button onClick={() => setChangeOpen(false)} disabled={changeMutation.isPending}>取消</Button><Button type="primary" htmlType="submit" loading={changeMutation.isPending}>提交变更申请</Button></Space>
        </Form>
      </>}
    </Drawer>
  </>;
}

function ConfigurationParameterDetail({ detail }: { detail: ConfigurationDetail }) {
  const groups = [...new Set(detail.parameters.map((item) => item.groupName))];
  const pendingCount = detail.parameters.filter((item) => item.required && item.status !== 'SET').length;
  return <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 16 }}>
    <Card size="small" title="版本与门禁">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="数据结构版本">{detail.schemaVersion}</Descriptions.Item>
        <Descriptions.Item label="继承基线">{detail.baseRevision}</Descriptions.Item>
        <Descriptions.Item label="服务范围校验码"><Typography.Text copyable>{detail.scopeHash}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="变更说明">{detail.changeSummary}</Descriptions.Item>
        <Descriptions.Item label="必填项状态">{pendingCount ? <StatusTag value="MISSING" /> : <StatusTag value="SET" />} {pendingCount ? pendingCount + ' 项待处理' : '均已登记'}</Descriptions.Item>
      </Descriptions>
    </Card>
    {groups.map((group) => <Card size="small" title={group} key={group}>
      <Table<ConfigurationParameterSummary> rowKey="parameterId" size="small" pagination={false} dataSource={detail.parameters.filter((item) => item.groupName === group)} scroll={{ x: 560 }} columns={[
        { title: '参数', width: 150, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.label}</Typography.Text><small>{record.parameterId}</small></div> },
        { title: '当前值', width: 170, dataIndex: 'value' },
        { title: '状态', width: 100, render: (_, record) => <StatusTag value={record.status} /> },
        { title: '来源 / 校验', width: 220, render: (_, record) => <div className="configuration-cell"><span>{record.source}</span><small>{record.validationMessage}</small></div> },
      ]} />
    </Card>)}
  </Space>;
}
