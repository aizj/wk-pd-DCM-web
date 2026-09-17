import type { ReactElement, ReactNode } from 'react';
import { Tooltip } from 'antd';
import type { PermissionCode } from '@vrc/contracts';
import { authorizationReasonLabel, type AuthorizationInput } from '../../core/auth/permissions';
import { useAuth } from '../../core/auth/AuthProvider';

interface PermissionGateProps {
  permission: PermissionCode;
  input?: Omit<AuthorizationInput, 'permission'>;
  children: ReactElement;
  fallback?: ReactNode;
}

/** 动作级权限守卫：路由守卫之外，写操作必须再次经过同一策略。 */
export function PermissionGate({ permission, input, children, fallback }: PermissionGateProps) {
  const { authorize } = useAuth();
  const decision = authorize({ permission, ...input });
  if (decision.allowed) return children;
  if (fallback) return <Tooltip title={authorizationReasonLabel(decision.reason)}><span className="permission-gate-disabled">{fallback}</span></Tooltip>;
  return <Tooltip title={authorizationReasonLabel(decision.reason)}><span className="permission-gate-disabled">{children}</span></Tooltip>;
}
