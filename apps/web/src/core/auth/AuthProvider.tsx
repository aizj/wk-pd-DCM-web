import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { ActorContext, PermissionCode } from '@vrc/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { actorProfiles, authorize, effectivePermissions, mockActor, type AuthorizationDecision, type AuthorizationInput } from './permissions';
import { setDataScopeContext } from './data-scope';

interface AuthContextValue {
  actor: ActorContext;
  authorize: (input: AuthorizationInput) => AuthorizationDecision;
  effectivePermissions: ReadonlySet<PermissionCode>;
  availableActors: readonly ActorContext[];
  availableEnvironments: readonly ActorContext['environment'][];
  switchActor: (actorId: string) => void;
  switchEnvironment: (environment: ActorContext['environment']) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, actor = mockActor }: PropsWithChildren<{ actor?: ActorContext }>) {
  const queryClient = useQueryClient();
  const availableActors = useMemo<readonly ActorContext[]>(() => actor === mockActor ? actorProfiles : [actor], [actor]);
  const [activeActorId, setActiveActorId] = useState(actor.actorId);
  const baseActor = availableActors.find((item) => item.actorId === activeActorId) ?? actor;
  const [activeEnvironment, setActiveEnvironment] = useState<ActorContext['environment']>(baseActor.environment);
  useEffect(() => {
    // 统一身份平台刷新会话后，前端上下文必须回到服务端返回的主体和默认环境。
    setActiveActorId(actor.actorId);
    setActiveEnvironment(actor.environment);
  }, [actor.actorId, actor.environment]);
  const activeActor = useMemo<ActorContext>(() => (
    baseActor.environment === activeEnvironment ? baseActor : { ...baseActor, environment: activeEnvironment }
  ), [activeEnvironment, baseActor]);
  useEffect(() => {
    setDataScopeContext(activeActor);
    // 身份或环境变化后，所有业务查询必须重新从当前数据范围读取，避免旧租户/旧环境残留在页面缓存中。
    void queryClient.invalidateQueries();
    return () => setDataScopeContext(null);
  }, [activeActor, queryClient]);
  const availableEnvironments = useMemo<readonly ActorContext['environment'][]>(() => (
    (['SANDBOX', 'TEST', 'PRODUCTION'] as const).filter((environment) => (
      baseActor.scopes.some((scope) => scope === 'ENV:*' || scope === `ENV:${environment}`)
    ))
  ), [baseActor]);
  const value = useMemo<AuthContextValue>(() => ({
    actor: activeActor,
    authorize: (input) => authorize(activeActor, input),
    effectivePermissions: effectivePermissions(activeActor),
    availableActors,
    availableEnvironments,
    switchActor: (actorId) => {
      const nextActor = availableActors.find((item) => item.actorId === actorId);
      if (nextActor) {
        setActiveActorId(nextActor.actorId);
        setActiveEnvironment(nextActor.environment);
      }
    },
    switchEnvironment: (environment) => {
      if (availableEnvironments.includes(environment)) setActiveEnvironment(environment);
    },
  }), [activeActor, availableActors, availableEnvironments]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
