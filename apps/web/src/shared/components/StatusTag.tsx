import { Tag } from 'antd';
import { statusLabel, statusTone } from '../../core/status/status-registry';

const colorByTone = {
  default: 'default',
  processing: 'processing',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const;

export function StatusTag({ value }: { value: string }) {
  return <Tag color={colorByTone[statusTone(value)]}>{statusLabel(value)}</Tag>;
}
