import { Card, Result } from 'antd';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../shared/components/PageHeader';

export interface ScaffoldPageProps {
  deliveryId?: string;
  title: string;
  description: string;
  slice: 'SHELL' | 'S1' | 'S1-F' | 'S2' | 'S3' | 'P1';
}

/** 保留深链和模块位置，但不把占位页包装成可办理功能。 */
export function ScaffoldPage({ title, description }: ScaffoldPageProps) {
  return <>
    <PageHeader eyebrow="功能建设中" title={title} description={description} badges={['暂未开放']} />
    <Card>
      <Result status="info" title="当前不可办理" subTitle="该功能尚未接入业务系统。请从已开放的工作台、申请管理或订阅实例继续查看已接入模块。" extra={<Link className="ant-btn ant-btn-primary" to="/workbench">返回工作台</Link>} />
    </Card>
  </>;
}
