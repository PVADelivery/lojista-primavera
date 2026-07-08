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
      addresses: {
        Row: {
          city: string | null
          complement: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          number: string | null
          reference: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
          zipcode: string | null
        }
        Insert: {
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
          zipcode?: string | null
        }
        Update: {
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
          zipcode?: string | null
        }
        Relationships: []
      }
      chat_message_logs: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          delivery_id: string | null
          id: string
          read: boolean
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          business_hours: string | null
          category: string | null
          city_id: string | null
          commission_percentage: number
          cover_url: string | null
          created_at: string
          description: string | null
          full_name: string | null
          id: string
          is_active: boolean
          is_open: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          region_id: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_hours?: string | null
          category?: string | null
          city_id?: string | null
          commission_percentage?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          region_id?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_hours?: string | null
          category?: string | null
          city_id?: string | null
          commission_percentage?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          region_id?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      company_cash_flow: {
        Row: {
          amount: number
          category: string | null
          company_id: string
          created_at: string
          date: string
          description: string
          id: string
          type: string
        }
        Insert: {
          amount?: number
          category?: string | null
          company_id: string
          created_at?: string
          date?: string
          description: string
          id?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cash_flow_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          company_id: string | null
          created_at: string
          delivery_id: string | null
          id: string
          order_id: string | null
          participants: string[]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          order_id?: string | null
          participants?: string[]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          order_id?: string | null
          participants?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      coupon_products: {
        Row: {
          coupon_id: string
          id: string
          product_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          product_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_products_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          max_discount_value: number | null
          min_order_value: number | null
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_discount_value?: number | null
          min_order_value?: number | null
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_discount_value?: number | null
          min_order_value?: number | null
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company_id: string
          cpf: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          company_id: string
          cpf?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          company_id?: string
          cpf?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          address: string
          company_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          driver_id: string | null
          id: string
          is_paid: boolean | null
          notes: string | null
          order_id: string | null
          pickup_address: string | null
          price: number
          region_id: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
          value: number
        }
        Insert: {
          address: string
          company_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          driver_id?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          order_id?: string | null
          pickup_address?: string | null
          price?: number
          region_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          value?: number
        }
        Update: {
          address?: string
          company_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          driver_id?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          order_id?: string | null
          pickup_address?: string | null
          price?: number
          region_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "motoboys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          full_name: string
          id: string
          is_online: boolean
          phone: string | null
          plate: string | null
          rating: number | null
          updated_at: string
          user_id: string
          vehicle: string | null
        }
        Insert: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          full_name: string
          id?: string
          is_online?: boolean
          phone?: string | null
          plate?: string | null
          rating?: number | null
          updated_at?: string
          user_id: string
          vehicle?: string | null
        }
        Update: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          full_name?: string
          id?: string
          is_online?: boolean
          phone?: string | null
          plate?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
          vehicle?: string | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          delivery_id: string | null
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          delivery_id?: string | null
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_id?: string | null
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: []
      }
      motoboys: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          name: string
          phone: string | null
          rating: number | null
          user_id: string | null
          vehicle: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          name: string
          phone?: string | null
          rating?: number | null
          user_id?: string | null
          vehicle?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          name?: string
          phone?: string | null
          rating?: number | null
          user_id?: string | null
          vehicle?: string | null
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          created_at: string
          delivery_id: string
          description: string | null
          driver_id: string | null
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          description?: string | null
          driver_id?: string | null
          id?: string
          type: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          description?: string | null
          driver_id?: string | null
          id?: string
          type?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          price?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_id: string | null
          id: string
          notes: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: Json | null
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: Json | null
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: Json | null
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          document: string | null
          full_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          document?: string | null
          full_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          document?: string | null
          full_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          active: boolean
          city: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          polygon: Json | null
          price: number
        }
        Insert: {
          active?: boolean
          city?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          polygon?: Json | null
          price?: number
        }
        Update: {
          active?: boolean
          city?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          polygon?: Json | null
          price?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_region_for_point: {
        Args: { _lat: number; _lng: number }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_delivery_status_safe: {
        Args: { _delivery_id: string; _status: string }
        Returns: undefined
      }
      user_owns_company: { Args: { _company_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "company" | "driver" | "customer"
      delivery_status:
        | "pending"
        | "broadcasted"
        | "accepted"
        | "collecting"
        | "in_route"
        | "in_transit"
        | "completed"
        | "delivered"
        | "cancelled"
      discount_type: "percentage" | "fixed"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "in_route"
        | "delivered"
        | "cancelled"
      profile_status: "pending" | "active" | "rejected"
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
      app_role: ["admin", "company", "driver", "customer"],
      delivery_status: [
        "pending",
        "broadcasted",
        "accepted",
        "collecting",
        "in_route",
        "in_transit",
        "completed",
        "delivered",
        "cancelled",
      ],
      discount_type: ["percentage", "fixed"],
      order_status: [
        "pending",
        "preparing",
        "ready",
        "in_route",
        "delivered",
        "cancelled",
      ],
      profile_status: ["pending", "active", "rejected"],
    },
  },
} as const
