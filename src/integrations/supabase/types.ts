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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      channels: {
        Row: {
          cons: string | null
          created_at: string
          guide: string | null
          id: string
          is_primary: boolean
          name: string
          project_id: string
          pros: string | null
          rationale: string | null
        }
        Insert: {
          cons?: string | null
          created_at?: string
          guide?: string | null
          id?: string
          is_primary?: boolean
          name: string
          project_id: string
          pros?: string | null
          rationale?: string | null
        }
        Update: {
          cons?: string | null
          created_at?: string
          guide?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          project_id?: string
          pros?: string | null
          rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["chat_role"]
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["chat_role"]
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["chat_role"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pieces: {
        Row: {
          created_at: string
          id: string
          project_id: string
          seo_version: string | null
          source_text: string | null
          thread_frames: Json
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          seo_version?: string | null
          source_text?: string | null
          thread_frames?: Json
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          seo_version?: string | null
          source_text?: string | null
          thread_frames?: Json
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_pieces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_cards: {
        Row: {
          created_at: string
          difficulty: string | null
          id: string
          persona: string | null
          problem: string | null
          project_id: string
          status: Database["public"]["Enums"]["gap_status"]
          title: string
          why_gap: string | null
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          id?: string
          persona?: string | null
          problem?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["gap_status"]
          title: string
          why_gap?: string | null
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          id?: string
          persona?: string | null
          problem?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["gap_status"]
          title?: string
          why_gap?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gap_cards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      identity: {
        Row: {
          chosen_domain: string | null
          chosen_name: string | null
          created_at: string
          domain_options: Json
          id: string
          name_options: Json
          positioning: string | null
          project_id: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          chosen_domain?: string | null
          chosen_name?: string | null
          created_at?: string
          domain_options?: Json
          id?: string
          name_options?: Json
          positioning?: string | null
          project_id: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          chosen_domain?: string | null
          chosen_name?: string | null
          created_at?: string
          domain_options?: Json
          id?: string
          name_options?: Json
          positioning?: string | null
          project_id?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      money_settings: {
        Row: {
          created_at: string
          currency: string
          hours_per_week: number | null
          id: string
          income_target: number | null
          price_per_unit: number | null
          project_id: string
          scenarios: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          hours_per_week?: number | null
          id?: string
          income_target?: number | null
          price_per_unit?: number | null
          project_id: string
          scenarios?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          hours_per_week?: number | null
          id?: string
          income_target?: number | null
          price_per_unit?: number | null
          project_id?: string
          scenarios?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_briefs: {
        Row: {
          angle: string | null
          business_model: string | null
          created_at: string
          id: string
          persona: string | null
          problem: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          angle?: string | null
          business_model?: string | null
          created_at?: string
          id?: string
          persona?: string | null
          problem?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          angle?: string | null
          business_model?: string | null
          created_at?: string
          id?: string
          persona?: string | null
          problem?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          mode: Database["public"]["Enums"]["user_mode"] | null
          onboarding_completed: boolean
          profile_answers: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["user_mode"] | null
          onboarding_completed?: boolean
          profile_answers?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["user_mode"] | null
          onboarding_completed?: boolean
          profile_answers?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          id: string
          tagline: string | null
          updated_at: string
          user_id: string
          working_name: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          tagline?: string | null
          updated_at?: string
          user_id: string
          working_name?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          tagline?: string | null
          updated_at?: string
          user_id?: string
          working_name?: string
        }
        Relationships: []
      }
      simulations: {
        Row: {
          created_at: string
          hooks: string | null
          id: string
          idea: string | null
          objections: string | null
          persona: string | null
          project_id: string
          reactions: Json
          recommendation: string | null
          verdict: Database["public"]["Enums"]["simulation_verdict"] | null
        }
        Insert: {
          created_at?: string
          hooks?: string | null
          id?: string
          idea?: string | null
          objections?: string | null
          persona?: string | null
          project_id: string
          reactions?: Json
          recommendation?: string | null
          verdict?: Database["public"]["Enums"]["simulation_verdict"] | null
        }
        Update: {
          created_at?: string
          hooks?: string | null
          id?: string
          idea?: string | null
          objections?: string | null
          persona?: string | null
          project_id?: string
          reactions?: Json
          recommendation?: string | null
          verdict?: Database["public"]["Enums"]["simulation_verdict"] | null
        }
        Relationships: [
          {
            foreignKeyName: "simulations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          column_name: Database["public"]["Enums"]["task_column"]
          created_at: string
          id: string
          notes: string | null
          position: number
          project_id: string
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          column_name?: Database["public"]["Enums"]["task_column"]
          created_at?: string
          id?: string
          notes?: string | null
          position?: number
          project_id: string
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          column_name?: Database["public"]["Enums"]["task_column"]
          created_at?: string
          id?: string
          notes?: string | null
          position?: number
          project_id?: string
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_project: { Args: { _project_id: string }; Returns: boolean }
    }
    Enums: {
      chat_role: "user" | "assistant" | "system"
      gap_status: "suggested" | "selected" | "dismissed"
      simulation_verdict: "strong" | "needs_work" | "kill"
      task_column: "later" | "this_week" | "in_progress" | "done"
      user_mode: "solo_founder" | "freelancer" | "existing_business" | "developer"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      chat_role: ["user", "assistant", "system"],
      gap_status: ["suggested", "selected", "dismissed"],
      simulation_verdict: ["strong", "needs_work", "kill"],
      task_column: ["later", "this_week", "in_progress", "done"],
      user_mode: ["solo_founder", "freelancer", "existing_business", "developer"],
    },
  },
} as const
