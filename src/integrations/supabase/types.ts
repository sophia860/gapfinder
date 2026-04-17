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
      backstage_insights: {
        Row: {
          body: string | null
          created_at: string
          due_at: string | null
          id: string
          kind: Database["public"]["Enums"]["backstage_kind"]
          payload: Json
          project_id: string
          status: Database["public"]["Enums"]["backstage_status"]
          title: string
          updated_at: string
          weirdness: number
        }
        Insert: {
          body?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["backstage_kind"]
          payload?: Json
          project_id: string
          status?: Database["public"]["Enums"]["backstage_status"]
          title: string
          updated_at?: string
          weirdness?: number
        }
        Update: {
          body?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["backstage_kind"]
          payload?: Json
          project_id?: string
          status?: Database["public"]["Enums"]["backstage_status"]
          title?: string
          updated_at?: string
          weirdness?: number
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          category: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          currency: string
          deadline_at: string | null
          goal_amount: number | null
          id: string
          pitch: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          story: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          currency?: string
          deadline_at?: string | null
          goal_amount?: number | null
          id?: string
          pitch?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          story?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deadline_at?: string | null
          goal_amount?: number | null
          id?: string
          pitch?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          story?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
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
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["comment_target"]
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["comment_target"]
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["comment_target"]
        }
        Relationships: []
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
      follows: {
        Row: {
          created_at: string
          followee_campaign_id: string | null
          followee_user_id: string | null
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          followee_campaign_id?: string | null
          followee_user_id?: string | null
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          followee_campaign_id?: string | null
          followee_user_id?: string | null
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_campaign_id_fkey"
            columns: ["followee_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
      pledges: {
        Row: {
          amount: number
          backer_user_id: string
          campaign_id: string
          created_at: string
          id: string
          message: string | null
        }
        Insert: {
          amount: number
          backer_user_id: string
          campaign_id: string
          created_at?: string
          id?: string
          message?: string | null
        }
        Update: {
          amount?: number
          backer_user_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pledges_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          campaign_id: string | null
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          campaign_id?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
          parked_at: string | null
          resume_note: string | null
          resume_note_updated_at: string | null
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
          parked_at?: string | null
          resume_note?: string | null
          resume_note_updated_at?: string | null
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
          parked_at?: string | null
          resume_note?: string | null
          resume_note_updated_at?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          working_name?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["reaction_kind"]
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["reaction_kind"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["reaction_target"]
          user_id?: string
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
      vibe_files: {
        Row: {
          content: string
          created_at: string
          id: string
          mime: string
          path: string
          version_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mime?: string
          path: string
          version_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mime?: string
          path?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_files_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "vibe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          vibe_project_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          vibe_project_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          vibe_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_messages_vibe_project_id_fkey"
            columns: ["vibe_project_id"]
            isOneToOne: false
            referencedRelation: "vibe_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_projects: {
        Row: {
          created_at: string
          current_version_id: string | null
          id: string
          kind: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          kind?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          kind?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      vibe_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          prompt: string | null
          summary: string | null
          vibe_project_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          prompt?: string | null
          summary?: string | null
          vibe_project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          prompt?: string | null
          summary?: string | null
          vibe_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_versions_vibe_project_id_fkey"
            columns: ["vibe_project_id"]
            isOneToOne: false
            referencedRelation: "vibe_projects"
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
      backstage_kind:
        | "wild_niche"
        | "redesign"
        | "bug"
        | "reminder"
        | "observation"
      backstage_status: "open" | "snoozed" | "dismissed" | "acted"
      campaign_status: "draft" | "live" | "funded" | "closed"
      chat_role: "user" | "assistant" | "system"
      comment_target: "campaign" | "post"
      gap_status: "suggested" | "selected" | "dismissed"
      reaction_kind: "like" | "love" | "fire" | "clap" | "heart"
      reaction_target: "campaign" | "post" | "comment"
      simulation_verdict: "strong" | "needs_work" | "kill"
      task_column: "later" | "this_week" | "in_progress" | "done"
      user_mode:
        | "solo_founder"
        | "freelancer"
        | "existing_business"
        | "developer"
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
      backstage_kind: [
        "wild_niche",
        "redesign",
        "bug",
        "reminder",
        "observation",
      ],
      backstage_status: ["open", "snoozed", "dismissed", "acted"],
      campaign_status: ["draft", "live", "funded", "closed"],
      chat_role: ["user", "assistant", "system"],
      comment_target: ["campaign", "post"],
      gap_status: ["suggested", "selected", "dismissed"],
      reaction_kind: ["like", "love", "fire", "clap", "heart"],
      reaction_target: ["campaign", "post", "comment"],
      simulation_verdict: ["strong", "needs_work", "kill"],
      task_column: ["later", "this_week", "in_progress", "done"],
      user_mode: [
        "solo_founder",
        "freelancer",
        "existing_business",
        "developer",
      ],
    },
  },
} as const
