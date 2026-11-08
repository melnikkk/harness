import { useMutation } from '@tanstack/react-query';
import type { SubmitTaskRequest } from '@shared/events';
import { postJson } from './client';

type ApproveVariables = { workflowId: string; approved: boolean };

export function useSubmitTask() {
  return useMutation({
    mutationFn: (request: SubmitTaskRequest) => postJson<{ workflowID: string }>('/tasks', request),
  });
}

export function useClearEventLog() {
  return useMutation({
    mutationFn: () => postJson<void>('/clear'),
  });
}

export function useApprove() {
  return useMutation({
    mutationFn: ({ workflowId, approved }: ApproveVariables) =>
      postJson<void>(`/approve/${workflowId}`, { approved }),
  });
}
