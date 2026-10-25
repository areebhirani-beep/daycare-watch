export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alert_detail: { Args: { p_event_id: number }; Returns: Json }
      area_compare: { Args: { p_operation_id: number }; Returns: Json }
      daycare_record: { Args: { p_operation_id: number }; Returns: Json }
      daycare_search: {
        Args: { q: string }
        Returns: {
          address: string
          capacity: number
          city: string
          county: string
          distance_km: number
          district_basis: string
          findings_24mo: number
          geocode_quality: string
          geocode_source: string
          in_district: boolean
          last_inspection_date: string
          lat: number
          lng: number
          name: string
          operation_id: number
          operation_type: string
          visits_24mo: Json
          zip: string
        }[]
      }
      daycares_near: {
        Args: { filters?: Json; km?: number; lat: number; lng: number }
        Returns: {
          city: string
          distance_km: number
          district_basis: string
          findings_24mo: number
          geocode_quality: string
          in_district: boolean
          last_inspection_date: string
          lat: number
          lng: number
          name: string
          operation_id: number
          operation_type: string
          visits_24mo: Json
        }[]
      }
      district_pulse: { Args: { week_start?: string }; Returns: Json }
      district_recent_visits: {
        Args: { p_limit?: number }
        Returns: {
          activity_id: number
          categories: Database["public"]["Enums"]["violation_category"][]
          city: string
          date: string
          display_name: string
          findings_posted_so_far: number
          is_home: boolean
          name: string
          operation_id: number
          operation_type: string
        }[]
      }
      last_sync: { Args: never; Returns: Json }
      my_watches: {
        Args: never
        Returns: {
          address: string
          capacity: number
          city: string
          county: string
          distance_km: number
          district_basis: string
          findings_24mo: number
          geocode_quality: string
          geocode_source: string
          in_district: boolean
          last_inspection_date: string
          lat: number
          lng: number
          name: string
          operation_id: number
          operation_type: string
          visits_24mo: Json
          zip: string
        }[]
      }
      register_device: {
        Args: { p_expo_push_token: string; p_platform: string }
        Returns: undefined
      }
      unwatch: { Args: { p_operation_id: number }; Returns: undefined }
      watch: { Args: { p_operation_id: number }; Returns: undefined }
    }
    Enums: {
      change_kind:
        | "new_violation"
        | "status_change"
        | "corrective_action"
        | "adverse_action"
        | "closure"
        | "capacity_change"
        | "permit_conditions"
      device_platform: "ios" | "android"
      risk_level: "High" | "Medium High" | "Medium" | "Medium Low" | "Low"
      violation_category:
        | "supervision"
        | "background_checks"
        | "staff_ratio"
        | "safety_hazards"
        | "health_medication"
        | "discipline"
        | "parent_communication"
        | "paperwork_admin"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      change_kind: [
        "new_violation",
        "status_change",
        "corrective_action",
        "adverse_action",
        "closure",
        "capacity_change",
        "permit_conditions",
      ],
      device_platform: ["ios", "android"],
      risk_level: ["High", "Medium High", "Medium", "Medium Low", "Low"],
      violation_category: [
        "supervision",
        "background_checks",
        "staff_ratio",
        "safety_hazards",
        "health_medication",
        "discipline",
        "parent_communication",
        "paperwork_admin",
        "other",
      ],
    },
  },
} as const

