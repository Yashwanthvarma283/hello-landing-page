export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          attempts: number
          created_at: string
          error_type: string | null
          final_code: string
          finished_at: string | null
          id: string
          key_usage: Json
          logs: Json
          passed_count: number
          phase: string
          problem_key: string
          started_at: string
          title: string
          total_count: number
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_type?: string | null
          final_code?: string
          finished_at?: string | null
          id?: string
          key_usage?: Json
          logs?: Json
          passed_count?: number
          phase: string
          problem_key: string
          started_at?: string
          title: string
          total_count?: number
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_type?: string | null
          final_code?: string
          finished_at?: string | null
          id?: string
          key_usage?: Json
          logs?: Json
          passed_count?: number
          phase?: string
          problem_key?: string
          started_at?: string
          title?: string
          total_count?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_api_keys: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          enabled: boolean
          error_count: number
          id: string
          label: string
          last_error: string | null
          last_used_at: string | null
          model: string
          provider: string
          status: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          api_key?: string
          base_url?: string
          created_at?: string
          enabled?: boolean
          error_count?: number
          id?: string
          label: string
          last_error?: string | null
          last_used_at?: string | null
          model?: string
          provider?: string
          status?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          enabled?: boolean
          error_count?: number
          id?: string
          label?: string
          last_error?: string | null
          last_used_at?: string | null
          model?: string
          provider?: string
          status?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      ai_feature_config: {
        Row: {
          enabled: boolean
          feature_key: string
          key_ids: Json
          model: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          key_ids?: Json
          model?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          key_ids?: Json
          model?: string
          updated_at?: string
        }
        Relationships: []
      }
      analyses: {
        Row: {
          algorithm: string | null
          created_at: string
          id: string
          optimizations: string[] | null
          problem_id: string
          space_complexity: string | null
          summary: string | null
          time_complexity: string | null
          user_id: string
        }
        Insert: {
          algorithm?: string | null
          created_at?: string
          id?: string
          optimizations?: string[] | null
          problem_id: string
          space_complexity?: string | null
          summary?: string | null
          time_complexity?: string | null
          user_id: string
        }
        Update: {
          algorithm?: string | null
          created_at?: string
          id?: string
          optimizations?: string[] | null
          problem_id?: string
          space_complexity?: string | null
          summary?: string | null
          time_complexity?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_results: {
        Row: {
          contest_type: string
          created_at: string
          id: string
          problem_keys: string[]
          problems_attempted: number
          problems_solved: number
          score: number
          total_time_seconds: number
          user_id: string
        }
        Insert: {
          contest_type?: string
          created_at?: string
          id?: string
          problem_keys?: string[]
          problems_attempted?: number
          problems_solved?: number
          score?: number
          total_time_seconds?: number
          user_id: string
        }
        Update: {
          contest_type?: string
          created_at?: string
          id?: string
          problem_keys?: string[]
          problems_attempted?: number
          problems_solved?: number
          score?: number
          total_time_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      custom_problems: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          id: string
          is_public: boolean
          starter_code: string
          test_cases: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty?: string
          id?: string
          is_public?: boolean
          starter_code?: string
          test_cases?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          id?: string
          is_public?: boolean
          starter_code?: string
          test_cases?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          receiver_id: string | null
          sender_id: string | null
          subject: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          subject?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profile_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      discussion_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          likes: number
          parent_id: string | null
          problem_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          likes?: number
          parent_id?: string | null
          problem_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes?: number
          parent_id?: string | null
          problem_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_history: {
        Row: {
          code_snapshot: string
          created_at: string
          execution_time_ms: number | null
          id: string
          language: string
          passed: boolean
          problem_id: string
          test_results: Json
          user_id: string
        }
        Insert: {
          code_snapshot?: string
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          language?: string
          passed?: boolean
          problem_id: string
          test_results?: Json
          user_id: string
        }
        Update: {
          code_snapshot?: string
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          language?: string
          passed?: boolean
          problem_id?: string
          test_results?: Json
          user_id?: string
        }
        Relationships: []
      }
      hints: {
        Row: {
          created_at: string
          hint_level: number
          hint_text: string
          id: string
          problem_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hint_level?: number
          hint_text: string
          id?: string
          problem_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hint_level?: number
          hint_text?: string
          id?: string
          problem_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hints_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_lobbies: {
        Row: {
          closed_at: string | null
          code: string
          created_at: string
          current_code: string | null
          guest_id: string | null
          host_id: string
          id: string
          last_activity: string
          max_participants: number | null
          problem_key: string | null
          status: string
          time_limit: number | null
        }
        Insert: {
          closed_at?: string | null
          code: string
          created_at?: string
          current_code?: string | null
          guest_id?: string | null
          host_id: string
          id?: string
          last_activity?: string
          max_participants?: number | null
          problem_key?: string | null
          status?: string
          time_limit?: number | null
        }
        Update: {
          closed_at?: string | null
          code?: string
          created_at?: string
          current_code?: string | null
          guest_id?: string | null
          host_id?: string
          id?: string
          last_activity?: string
          max_participants?: number | null
          problem_key?: string | null
          status?: string
          time_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_lobbies_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_lobbies_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "public_profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "interview_lobbies_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_lobbies_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "public_profile_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      interview_results: {
        Row: {
          ai_feedback: string | null
          code_snapshot: string
          created_at: string
          difficulty: string
          id: string
          problem_title: string
          score: number
          time_taken_seconds: number
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          code_snapshot?: string
          created_at?: string
          difficulty?: string
          id?: string
          problem_title: string
          score?: number
          time_taken_seconds?: number
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          code_snapshot?: string
          created_at?: string
          difficulty?: string
          id?: string
          problem_title?: string
          score?: number
          time_taken_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      issue_messages: {
        Row: {
          created_at: string | null
          id: string
          issue_id: string | null
          message: string
          sender_id: string | null
          sender_role: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          issue_id?: string | null
          message: string
          sender_id?: string | null
          sender_role: string
        }
        Update: {
          created_at?: string | null
          id?: string
          issue_id?: string | null
          message?: string
          sender_id?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_messages_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          admin_reply: string | null
          comment: string
          created_at: string | null
          id: string
          page_title: string | null
          page_url: string
          status: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          comment: string
          created_at?: string | null
          id?: string
          page_title?: string | null
          page_url: string
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          comment?: string
          created_at?: string | null
          id?: string
          page_title?: string | null
          page_url?: string
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      learning_history: {
        Row: {
          algorithm: string
          completed: boolean
          created_at: string
          difficulty: string
          id: string
          time_spent_seconds: number
          topic: string
          user_id: string
        }
        Insert: {
          algorithm: string
          completed?: boolean
          created_at?: string
          difficulty?: string
          id?: string
          time_spent_seconds?: number
          topic: string
          user_id: string
        }
        Update: {
          algorithm?: string
          completed?: boolean
          created_at?: string
          difficulty?: string
          id?: string
          time_spent_seconds?: number
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      lobby_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lobby_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lobby_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lobby_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobby_messages_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "interview_lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profile_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lobby_participants: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          lobby_id: string
          role: string
          status: string
          user_id: string
          username: string | null
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          lobby_id: string
          role?: string
          status?: string
          user_id: string
          username?: string | null
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          lobby_id?: string
          role?: string
          status?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lobby_participants_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "interview_lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      problem_test_cases: {
        Row: {
          constraints: Json
          created_at: string
          description: string
          difficulty: string
          examples: Json
          function_name: string
          generated_by: string | null
          hints: Json
          id: string
          params: Json
          problem_key: string
          return_type: string
          starter_code: string
          test_cases: Json
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          constraints?: Json
          created_at?: string
          description?: string
          difficulty?: string
          examples?: Json
          function_name?: string
          generated_by?: string | null
          hints?: Json
          id?: string
          params?: Json
          problem_key: string
          return_type?: string
          starter_code?: string
          test_cases?: Json
          title?: string
          topic?: string
          updated_at?: string
        }
        Update: {
          constraints?: Json
          created_at?: string
          description?: string
          difficulty?: string
          examples?: Json
          function_name?: string
          generated_by?: string | null
          hints?: Json
          id?: string
          params?: Json
          problem_key?: string
          return_type?: string
          starter_code?: string
          test_cases?: Json
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      problems: {
        Row: {
          bookmarked: boolean
          code: string
          created_at: string
          difficulty: string
          id: string
          notes: string
          solved: boolean
          time_spent_seconds: number
          title: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bookmarked?: boolean
          code?: string
          created_at?: string
          difficulty?: string
          id?: string
          notes?: string
          solved?: boolean
          time_spent_seconds?: number
          title?: string
          topic?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bookmarked?: boolean
          code?: string
          created_at?: string
          difficulty?: string
          id?: string
          notes?: string
          solved?: boolean
          time_spent_seconds?: number
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ban_until: string | null
          created_at: string
          display_id: number
          email: string | null
          github_auto_push: boolean | null
          github_repo: string | null
          github_token: string | null
          id: string
          requested_role: string | null
          status: string
          username: string
          xp: number | null
        }
        Insert: {
          ban_until?: string | null
          created_at?: string
          display_id?: number
          email?: string | null
          github_auto_push?: boolean | null
          github_repo?: string | null
          github_token?: string | null
          id: string
          requested_role?: string | null
          status?: string
          username: string
          xp?: number | null
        }
        Update: {
          ban_until?: string | null
          created_at?: string
          display_id?: number
          email?: string | null
          github_auto_push?: boolean | null
          github_repo?: string | null
          github_token?: string | null
          id?: string
          requested_role?: string | null
          status?: string
          username?: string
          xp?: number | null
        }
        Relationships: []
      }
      shared_solutions: {
        Row: {
          approach: string
          code: string
          created_at: string
          id: string
          language: string
          likes: number
          problem_key: string
          user_id: string
        }
        Insert: {
          approach?: string
          code: string
          created_at?: string
          id?: string
          language?: string
          likes?: number
          problem_key: string
          user_id: string
        }
        Update: {
          approach?: string
          code?: string
          created_at?: string
          id?: string
          language?: string
          likes?: number
          problem_key?: string
          user_id?: string
        }
        Relationships: []
      }
      solutions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          problem_id: string
          solution_code: string
          solution_type: string
          space_complexity: string | null
          time_complexity: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          problem_id: string
          solution_code: string
          solution_type: string
          space_complexity?: string | null
          time_complexity?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          problem_id?: string
          solution_code?: string
          solution_type?: string
          space_complexity?: string | null
          time_complexity?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solutions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      system_patch_proposals: {
        Row: {
          context_snippet: string | null
          created_at: string
          diff: string
          error_summary: string
          error_type: string
          explanation: string
          id: string
          problem_key: string | null
          proposed_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_files: string[]
        }
        Insert: {
          context_snippet?: string | null
          created_at?: string
          diff: string
          error_summary: string
          error_type: string
          explanation: string
          id?: string
          problem_key?: string | null
          proposed_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_files?: string[]
        }
        Update: {
          context_snippet?: string | null
          created_at?: string
          diff?: string
          error_summary?: string
          error_type?: string
          explanation?: string
          id?: string
          problem_key?: string | null
          proposed_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_files?: string[]
        }
        Relationships: []
      }
      test_cases: {
        Row: {
          content: string
          created_at: string
          expected_output: string
          id: string
          input: string
          inputs: Json
          problem_id: string
          user_id: string
          variable_name: string
        }
        Insert: {
          content: string
          created_at?: string
          expected_output?: string
          id?: string
          input?: string
          inputs?: Json
          problem_id: string
          user_id: string
          variable_name?: string
        }
        Update: {
          content?: string
          created_at?: string
          expected_output?: string
          id?: string
          input?: string
          inputs?: Json
          problem_id?: string
          user_id?: string
          variable_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_code_saves: {
        Row: {
          code: string
          created_at: string
          id: string
          language: string
          problem_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          language?: string
          problem_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          language?: string
          problem_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_problem_progress: {
        Row: {
          attempts: number
          created_at: string
          ease_factor: number
          id: string
          last_attempted: string | null
          marked_for_revision: boolean
          next_review_at: string | null
          problem_key: string
          review_count: number
          review_interval: number
          solved: boolean
          solved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          ease_factor?: number
          id?: string
          last_attempted?: string | null
          marked_for_revision?: boolean
          next_review_at?: string | null
          problem_key: string
          review_count?: number
          review_interval?: number
          solved?: boolean
          solved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          ease_factor?: number
          id?: string
          last_attempted?: string | null
          marked_for_revision?: boolean
          next_review_at?: string | null
          problem_key?: string
          review_count?: number
          review_interval?: number
          solved?: boolean
          solved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profile_stats: {
        Row: {
          attempted_count: number | null
          created_at: string | null
          display_id: number | null
          last_active: string | null
          solved_count: number | null
          user_id: string | null
          username: string | null
          xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      admin_reset_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: undefined
      }
      admin_reset_username: {
        Args: { new_username: string; target_user_id: string }
        Returns: undefined
      }
      admin_update_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      ai_pool_track_key_usage: {
        Args: { p_key_id: string; p_patch: Json }
        Returns: undefined
      }
      get_user_status: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "moderator"],
    },
  },
} as const
