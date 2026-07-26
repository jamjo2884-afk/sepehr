import { supabase } from '@/lib/supabase';

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}


export async function getProjects(workspaceId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', {
      ascending: false,
    })
    .returns<Project[]>();

  if (error) throw error;

  return data ?? [];
}


export async function createProject(input: {
  workspaceId: string;
  name: string;
  description?: string;
  userId: string;
}) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      description: input.description ?? null,
      created_by: input.userId,
      status: 'active',
    })
    .select()
    .single<Project>();

  if (error) throw error;

  return data;
}