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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          access_level: string
          code: string
          created_at: string
          expires_at: string
          id: string
        }
        Insert: {
          access_level?: string
          code: string
          created_at?: string
          expires_at: string
          id?: string
        }
        Update: {
          access_level?: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      iptv_channels: {
        Row: {
          category: string
          created_at: string
          group_name: string | null
          id: string
          logo_url: string | null
          name: string
          type: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          group_name?: string | null
          id?: string
          logo_url?: string | null
          name: string
          type?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          group_name?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          type?: string
          url?: string
        }
        Relationships: []
      }
      m3u_playlists: {
        Row: {
          content: string | null
          created_at: string
          id: string
          name: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          name: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          url?: string | null
        }
        Relationships: []
      }
      mac_portals: {
        Row: {
          created_at: string
          id: string
          mac_address: string
          name: string
          portal_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          mac_address: string
          name: string
          portal_url: string
        }
        Update: {
          created_at?: string
          id?: string
          mac_address?: string
          name?: string
          portal_url?: string
        }
        Relationships: []
      }
      streams: {
        Row: {
          acestream_id: string
          category: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          acestream_id: string
          category?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          acestream_id?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      visitor_logs: {
        Row: {
          access_level: string | null
          city: string | null
          country: string | null
          id: string
          ip_address: string
          region: string | null
          user_agent: string | null
          visited_at: string
        }
        Insert: {
          access_level?: string | null
          city?: string | null
          country?: string | null
          id?: string
          ip_address: string
          region?: string | null
          user_agent?: string | null
          visited_at?: string
        }
        Update: {
          access_level?: string | null
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string
          region?: string | null
          user_agent?: string | null
          visited_at?: string
        }
        Relationships: []
      }
      xtream_codes: {
        Row: {
          created_at: string
          id: string
          name: string
          password: string
          server_url: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          password: string
          server_url: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          password?: string
          server_url?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
