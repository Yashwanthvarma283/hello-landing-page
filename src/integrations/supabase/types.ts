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
          id: string
          status: string
          username: string
        }
        Insert: {
          ban_until?: string | null
          created_at?: string
          id: string
          status?: string
          username: string
        }
        Update: {
          ban_until?: string | null
          created_at?: string
          id?: string
          status?: string
          username?: string
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
      [_ in never]: never
    }
    Functions: {
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
