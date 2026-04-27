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
      communication_profiles: {
        Row: {
          confidence: number
          created_at: string
          detail_level: number
          directness: number
          energy: number
          formality: number
          updated_at: string
          user_id: string
          values_text: string | null
          voice_summary: string | null
          warmth: number
        }
        Insert: {
          confidence: number
          created_at?: string
          detail_level: number
          directness: number
          energy: number
          formality: number
          updated_at?: string
          user_id: string
          values_text?: string | null
          voice_summary?: string | null
          warmth: number
        }
        Update: {
          confidence?: number
          created_at?: string
          detail_level?: number
          directness?: number
          energy?: number
          formality?: number
          updated_at?: string
          user_id?: string
          values_text?: string | null
          voice_summary?: string | null
          warmth?: number
        }
        Relationships: []
      }
      cover_letters: {
        Row: {
          company: string
          content: string
          created_at: string
          cv_id: string | null
          extra_context: string | null
          id: string
          job_description: string
          job_id: string | null
          job_title: string
          match_analysis: Json | null
          tone_overrides: Json | null
          user_id: string
        }
        Insert: {
          company: string
          content: string
          created_at?: string
          cv_id?: string | null
          extra_context?: string | null
          id?: string
          job_description: string
          job_id?: string | null
          job_title: string
          match_analysis?: Json | null
          tone_overrides?: Json | null
          user_id: string
        }
        Update: {
          company?: string
          content?: string
          created_at?: string
          cv_id?: string | null
          extra_context?: string | null
          id?: string
          job_description?: string
          job_id?: string | null
          job_title?: string
          match_analysis?: Json | null
          tone_overrides?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cover_letters_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_letters_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_advice: {
        Row: {
          created_at: string
          cv_id: string
          edits: Json
          fit_score: number
          gaps: Json
          id: string
          job_id: string
          keywords_to_add: Json
          strengths: Json
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_id: string
          edits: Json
          fit_score: number
          gaps: Json
          id?: string
          job_id: string
          keywords_to_add: Json
          strengths: Json
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          cv_id?: string
          edits?: Json
          fit_score?: number
          gaps?: Json
          id?: string
          job_id?: string
          keywords_to_add?: Json
          strengths?: Json
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_advice_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cvs: {
        Row: {
          created_at: string
          extracted_text: string | null
          id: string
          original_filename: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          original_filename: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          original_filename?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          apply_url: string | null
          category: Database["public"]["Enums"]["job_category"]
          company: string
          created_at: string
          deadline: string | null
          description: string
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          location: string
          requirements: string | null
          role_title: string
          salary: string | null
          short_summary: string
        }
        Insert: {
          apply_url?: string | null
          category: Database["public"]["Enums"]["job_category"]
          company: string
          created_at?: string
          deadline?: string | null
          description: string
          id?: string
          job_type: Database["public"]["Enums"]["job_type"]
          location: string
          requirements?: string | null
          role_title: string
          salary?: string | null
          short_summary: string
        }
        Update: {
          apply_url?: string | null
          category?: Database["public"]["Enums"]["job_category"]
          company?: string
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          location?: string
          requirements?: string | null
          role_title?: string
          salary?: string | null
          short_summary?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          notes: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_status:
        | "saved"
        | "applying"
        | "applied"
        | "interviewing"
        | "offer"
        | "rejected"
      job_category: "finance" | "technology" | "law" | "graduate"
      job_type: "internship" | "placement" | "graduate"
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
      application_status: [
        "saved",
        "applying",
        "applied",
        "interviewing",
        "offer",
        "rejected",
      ],
      job_category: ["finance", "technology", "law", "graduate"],
      job_type: ["internship", "placement", "graduate"],
    },
  },
} as const
