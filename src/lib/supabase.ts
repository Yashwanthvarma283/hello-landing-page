import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export { supabase };

export interface Profile {
  id: string;
  username: string;
  created_at: string;
}

export interface DbProblem {
  id: string;
  user_id: string;
  title: string;
  code: string;
  created_at: string;
  updated_at: string;
  bookmarked?: boolean;
  notes?: string;
  difficulty?: string;
  topic?: string;
  solved?: boolean;
  time_spent_seconds?: number;
}

export interface DbAnalysis {
  id: string;
  user_id: string;
  problem_id: string;
  algorithm: string | null;
  time_complexity: string | null;
  space_complexity: string | null;
  summary: string | null;
  optimizations: string[] | null;
  created_at: string;
}

export interface DbHint {
  id: string;
  user_id: string;
  problem_id: string;
  hint_level: number;
  hint_text: string;
  created_at: string;
}

export interface DbSolution {
  id: string;
  user_id: string;
  problem_id: string;
  solution_type: string;
  solution_code: string;
  explanation: string | null;
  time_complexity: string | null;
  space_complexity: string | null;
  created_at: string;
}

export interface DbTestCase {
  id: string;
  user_id: string;
  problem_id: string;
  input: string;
  expected_output: string;
  variable_name: string;
  inputs: Record<string, string>;
  created_at: string;
}

export interface DbIssue {
  id: string;
  user_id: string;
  user_email?: string;
  page_url: string;
  page_title: string;
  comment: string;
  admin_reply?: string;
  status: 'open' | 'resolved' | 'closed';
  created_at: string;
}

export interface DbIssueMessage {
  id: string;
  issue_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  message: string;
  created_at: string;
}

export interface DbDirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_username?: string;
  receiver_username?: string;
  subject: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface PublicProfile {
  user_id: string;
  username: string;
  display_id: number;
  created_at: string;
  solved_count: number;
  attempted_count: number;
  last_active: string | null;
}

// ── Auth ──────────────────────────────────────────────────

export async function signUp(email: string, password: string, username: string, requestedRole: 'user' | 'admin' = 'user') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { 
      emailRedirectTo: window.location.origin,
      data: { 
        username,
        requested_role: requestedRole
      } 
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data as Profile | null;
}

// ── Problems ──────────────────────────────────────────────

export async function fetchProblems(userId: string): Promise<DbProblem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbProblem[];
}

export async function createProblem(userId: string, title: string, code: string): Promise<DbProblem> {
  const { data, error } = await supabase
    .from('problems')
    .insert({ user_id: userId, title, code })
    .select()
    .single();
  if (error) throw error;
  return data as DbProblem;
}

export async function updateProblem(id: string, updates: Partial<Pick<DbProblem, 'title' | 'code'>>): Promise<DbProblem | null> {
  const { data, error } = await supabase
    .from('problems')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as DbProblem;
}

export async function deleteProblem(id: string): Promise<void> {
  const { error } = await supabase.from('problems').delete().eq('id', id);
  if (error) throw error;
}

// ── Analyses ──────────────────────────────────────────────

export async function fetchAnalysis(problemId: string): Promise<DbAnalysis | null> {
  const { data } = await supabase
    .from('analyses')
    .select('*')
    .eq('problem_id', problemId)
    .maybeSingle();
  return data as DbAnalysis | null;
}

export async function upsertAnalysis(userId: string, problemId: string, analysis: {
  algorithm?: string; time_complexity?: string; space_complexity?: string; summary?: string; optimizations?: string[];
}): Promise<DbAnalysis> {
  const existing = await fetchAnalysis(problemId);
  if (existing) {
    const { data, error } = await supabase
      .from('analyses')
      .update({ ...analysis })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as DbAnalysis;
  }
  const { data, error } = await supabase
    .from('analyses')
    .insert({ user_id: userId, problem_id: problemId, ...analysis })
    .select()
    .single();
  if (error) throw error;
  return data as DbAnalysis;
}

// ── Hints ─────────────────────────────────────────────────

export async function fetchHints(problemId: string): Promise<DbHint[]> {
  const { data } = await supabase
    .from('hints')
    .select('*')
    .eq('problem_id', problemId)
    .order('hint_level', { ascending: true });
  return (data ?? []) as DbHint[];
}

export async function insertHint(userId: string, problemId: string, hintLevel: number, hintText: string): Promise<DbHint> {
  const { data, error } = await supabase
    .from('hints')
    .insert({ user_id: userId, problem_id: problemId, hint_level: hintLevel, hint_text: hintText })
    .select()
    .single();
  if (error) throw error;
  return data as DbHint;
}

// ── Solutions ─────────────────────────────────────────────

export async function fetchSolutions(problemId: string): Promise<DbSolution[]> {
  const { data } = await supabase
    .from('solutions')
    .select('*')
    .eq('problem_id', problemId);
  return (data ?? []) as DbSolution[];
}

export async function upsertSolution(userId: string, problemId: string, sol: {
  solution_type: string; solution_code: string; explanation?: string; time_complexity?: string; space_complexity?: string;
}): Promise<DbSolution> {
  const { data: existing } = await supabase
    .from('solutions')
    .select('*')
    .eq('problem_id', problemId)
    .eq('solution_type', sol.solution_type)
    .maybeSingle();
  if (existing) {
    const { data, error } = await supabase
      .from('solutions')
      .update(sol)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as DbSolution;
  }
  const { data, error } = await supabase
    .from('solutions')
    .insert({ user_id: userId, problem_id: problemId, ...sol })
    .select()
    .single();
  if (error) throw error;
  return data as DbSolution;
}

// ── Test Cases ────────────────────────────────────────────

export async function fetchTestCases(problemId: string): Promise<DbTestCase[]> {
  const { data } = await supabase
    .from('test_cases')
    .select('*')
    .eq('problem_id', problemId)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as DbTestCase[];
}

export async function insertTestCase(userId: string, problemId: string, inputs: Record<string, string>, expectedOutput: string): Promise<DbTestCase> {
  // Also store in legacy columns for backward compat
  const keys = Object.keys(inputs);
  const legacyVarName = keys[0] || 'arr';
  const legacyInput = keys.length === 1 ? inputs[legacyVarName] : JSON.stringify(inputs);
  const { data, error } = await supabase
    .from('test_cases')
    .insert({ user_id: userId, problem_id: problemId, input: legacyInput, expected_output: expectedOutput, variable_name: legacyVarName, inputs } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DbTestCase;
}

export async function updateTestCase(id: string, updates: { inputs?: Record<string, string>; expected_output?: string }): Promise<void> {
  const dbUpdates: any = {};
  if (updates.expected_output !== undefined) dbUpdates.expected_output = updates.expected_output;
  if (updates.inputs !== undefined) {
    dbUpdates.inputs = updates.inputs;
    const keys = Object.keys(updates.inputs);
    dbUpdates.variable_name = keys[0] || 'arr';
    dbUpdates.input = keys.length === 1 ? updates.inputs[keys[0]] : JSON.stringify(updates.inputs);
  }
  const { error } = await supabase.from('test_cases').update(dbUpdates).eq('id', id);
  if (error) throw error;
}

export async function deleteTestCase(id: string): Promise<void> {
  const { error } = await supabase.from('test_cases').delete().eq('id', id);
  if (error) throw error;
}

// ── Issues ────────────────────────────────────────────────

export async function fetchIssues(): Promise<DbIssue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbIssue[];
}

export async function fetchUserIssues(userId: string): Promise<DbIssue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbIssue[];
}

export async function createIssue(userId: string, email: string, pageUrl: string, pageTitle: string, comment: string): Promise<DbIssue> {
  const { data, error } = await supabase
    .from('issues')
    .insert({
      user_id: userId,
      user_email: email,
      page_url: pageUrl,
      page_title: pageTitle,
      comment,
      status: 'open'
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbIssue;
}

export async function updateIssueStatus(id: string, status: DbIssue['status']): Promise<void> {
  const { error } = await supabase
    .from('issues')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function updateIssueReply(id: string, reply: string): Promise<void> {
  const { error } = await supabase
    .from('issues')
    .update({ admin_reply: reply, status: 'resolved' })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchIssueMessages(issueId: string): Promise<DbIssueMessage[]> {
  const { data, error } = await supabase
    .from('issue_messages')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbIssueMessage[];
}

export async function addIssueMessage(issueId: string, userId: string, role: 'user' | 'admin', message: string): Promise<DbIssueMessage> {
  const { data, error } = await supabase
    .from('issue_messages')
    .insert({
      issue_id: issueId,
      sender_id: userId,
      sender_role: role,
      message
    })
    .select()
    .single();
  if (error) throw error;

  // If admin is replying, we might want to update issue status to resolved
  // but let's keep it 'open' if we want multiple messages.
  // We'll let the admin explicitly resolve it if they want.
  
  if (error) throw error;
  
  return data as DbIssueMessage;
}

export async function searchUsers(query: string): Promise<PublicProfile[]> {
  const isNumeric = !isNaN(Number(query)) && query.trim() !== "";
  
  // Construct the OR filter
  let filter = `username.ilike.%${query}%`;
  if (isNumeric) {
    filter += `,display_id.eq.${query}`;
  }

  const { data, error } = await supabase
    .from('public_profile_stats')
    .select('*')
    .or(filter)
    .order('solved_count', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as PublicProfile[];
}

export async function fetchDirectMessages(userId: string): Promise<DbDirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select(`
      *,
      sender:profiles!sender_id(username),
      receiver:profiles!receiver_id(username)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  
  return (data || []).map(msg => ({
    ...msg,
    sender_username: msg.sender?.username,
    receiver_username: msg.receiver?.username
  })) as DbDirectMessage[];
}

export async function sendDirectMessage(senderId: string, receiverId: string, subject: string, content: string): Promise<DbDirectMessage> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      subject,
      content
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbDirectMessage;
}

export async function fetchUserPublicStats(userId: string) {
  const { data: progress, error: pError } = await supabase
    .from('user_problem_progress')
    .select('problem_key, solved, attempts, last_attempted')
    .eq('user_id', userId);
  
  if (pError) throw pError;
  return progress ?? [];
}

export const DEFAULT_CODE = `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your DSA solution here
        System.out.println("Hello, DSA!");
    }
}
`;
