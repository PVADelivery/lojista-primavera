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
          city: string
          complement: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          number: string | null
          region_id: string | null
          state: string
          street: string
          zip_code: string | null
        }
        Insert: {
          city?: string
          complement?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          region_id?: string | null
          state?: string
          street: string
          zip_code?: string | null
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          region_id?: string | null
          state?: string
          street?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          event: string
          http_status: number | null
          id: string
          payload: Json | null
          request_id: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          event: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          request_id: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          event?: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          request_id?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_ips_log: {
        Row: {
          email_tentativa: string | null
          id: number
          ip_address: string | null
          tentado_em: string | null
        }
        Insert: {
          email_tentativa?: string | null
          id?: number
          ip_address?: string | null
          tentado_em?: string | null
        }
        Update: {
          email_tentativa?: string | null
          id?: number
          ip_address?: string | null
          tentado_em?: string | null
        }
        Relationships: []
      }
      business_directory: {
        Row: {
          address: string | null
          card_image_url: string | null
          card_style: string | null
          category: string
          created_at: string
          featured: boolean
          hours: string | null
          id: string
          name: string
          phone: string | null
          rating: number | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          card_image_url?: string | null
          card_style?: string | null
          category?: string
          created_at?: string
          featured?: boolean
          hours?: string | null
          id?: string
          name: string
          phone?: string | null
          rating?: number | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          card_image_url?: string | null
          card_style?: string | null
          category?: string
          created_at?: string
          featured?: boolean
          hours?: string | null
          id?: string
          name?: string
          phone?: string | null
          rating?: number | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          company_id: string
          created_at: string | null
          customer_id: string | null
          id: string
          status: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          status?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          status?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean | null
          address: string | null
          banner_url: string | null
          business_hours: Json | null
          category: string | null
          city: string | null
          city_id: string | null
          commission_percentage: number | null
          cover_url: string | null
          created_at: string
          created_by_admin_id: string | null
          delivery_fee: number | null
          delivery_mode: string | null
          delivery_regions_pricing: Json | null
          description: string | null
          document: string | null
          email: string | null
          gallery: Json | null
          id: string
          is_active: boolean
          is_open: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          phone: string | null
          prep_time: number | null
          prep_time_max: number | null
          prep_time_min: number | null
          pricing_table_id: string | null
          rating: number | null
          region_id: string | null
          show_in_marketplace: boolean | null
          state: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          banner_url?: string | null
          business_hours?: Json | null
          category?: string | null
          city?: string | null
          city_id?: string | null
          commission_percentage?: number | null
          cover_url?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          delivery_fee?: number | null
          delivery_mode?: string | null
          delivery_regions_pricing?: Json | null
          description?: string | null
          document?: string | null
          email?: string | null
          gallery?: Json | null
          id?: string
          is_active?: boolean
          is_open?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          prep_time?: number | null
          prep_time_max?: number | null
          prep_time_min?: number | null
          pricing_table_id?: string | null
          rating?: number | null
          region_id?: string | null
          show_in_marketplace?: boolean | null
          state?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          banner_url?: string | null
          business_hours?: Json | null
          category?: string | null
          city?: string | null
          city_id?: string | null
          commission_percentage?: number | null
          cover_url?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          delivery_fee?: number | null
          delivery_mode?: string | null
          delivery_regions_pricing?: Json | null
          description?: string | null
          document?: string | null
          email?: string | null
          gallery?: Json | null
          id?: string
          is_active?: boolean
          is_open?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          prep_time?: number | null
          prep_time_max?: number | null
          prep_time_min?: number | null
          pricing_table_id?: string | null
          rating?: number | null
          region_id?: string | null
          show_in_marketplace?: boolean | null
          state?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_pricing_table_id_fkey"
            columns: ["pricing_table_id"]
            isOneToOne: false
            referencedRelation: "pricing_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          participants: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          participants?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          participants?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_companies: {
        Row: {
          company_id: string
          coupon_id: string
          created_at: string
        }
        Insert: {
          company_id: string
          coupon_id: string
          created_at?: string
        }
        Update: {
          company_id?: string
          coupon_id?: string
          created_at?: string
        }
        Relationships: []
      }
      coupon_products: {
        Row: {
          coupon_id: string
          created_at: string | null
          product_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string | null
          product_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string | null
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
          active: boolean | null
          code: string
          created_at: string | null
          expiration_date: string | null
          id: string
          max_discount: number | null
          min_purchase: number | null
          scope: string | null
          type: string
          usage_limit: number | null
          used_count: number | null
          value: number
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          max_discount?: number | null
          min_purchase?: number | null
          scope?: string | null
          type?: string
          usage_limit?: number | null
          used_count?: number | null
          value: number
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          max_discount?: number | null
          min_purchase?: number | null
          scope?: string | null
          type?: string
          usage_limit?: number | null
          used_count?: number | null
          value?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          cpf: string | null
          created_at: string
          fcm_token: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          fcm_token?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          fcm_token?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          address: string
          assignment_type: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          change_for: number | null
          city_id: string | null
          collected_at: string | null
          commission: number
          company_id: string
          completed_at: string | null
          created_at: string
          customer_address_complement: string | null
          customer_address_number: string | null
          customer_cpf: string | null
          customer_name: string
          customer_neighborhood: string | null
          customer_phone: string | null
          difficulty: string | null
          distance_km: number | null
          driver_id: string | null
          estimated_time_minutes: number | null
          estimated_value: number | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          order_id: string | null
          order_value: number | null
          payment_method: string | null
          proof_photo_url: string | null
          region_id: string | null
          short_id: string | null
          signature_url: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
          value: number
          vehicle_type: string | null
        }
        Insert: {
          accepted_at?: string | null
          address: string
          assignment_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          change_for?: number | null
          city_id?: string | null
          collected_at?: string | null
          commission?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          customer_address_complement?: string | null
          customer_address_number?: string | null
          customer_cpf?: string | null
          customer_name: string
          customer_neighborhood?: string | null
          customer_phone?: string | null
          difficulty?: string | null
          distance_km?: number | null
          driver_id?: string | null
          estimated_time_minutes?: number | null
          estimated_value?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string | null
          order_value?: number | null
          payment_method?: string | null
          proof_photo_url?: string | null
          region_id?: string | null
          short_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          value?: number
          vehicle_type?: string | null
        }
        Update: {
          accepted_at?: string | null
          address?: string
          assignment_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          change_for?: number | null
          city_id?: string | null
          collected_at?: string | null
          commission?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          customer_address_complement?: string | null
          customer_address_number?: string | null
          customer_cpf?: string | null
          customer_name?: string
          customer_neighborhood?: string | null
          customer_phone?: string | null
          difficulty?: string | null
          distance_km?: number | null
          driver_id?: string | null
          estimated_time_minutes?: number | null
          estimated_value?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string | null
          order_value?: number | null
          payment_method?: string | null
          proof_photo_url?: string | null
          region_id?: string | null
          short_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          value?: number
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "delivery_drivers"
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
          city_id: string | null
          commission_rate: number
          created_at: string
          fcm_token: string | null
          id: string
          is_online: boolean
          latitude: number | null
          license_plate: string | null
          longitude: number | null
          rating: number
          service_types: string[] | null
          status: string | null
          updated_at: string
          user_id: string
          vehicle: string
        }
        Insert: {
          city_id?: string | null
          commission_rate?: number
          created_at?: string
          fcm_token?: string | null
          id?: string
          is_online?: boolean
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
          rating?: number
          service_types?: string[] | null
          status?: string | null
          updated_at?: string
          user_id: string
          vehicle?: string
        }
        Update: {
          city_id?: string | null
          commission_rate?: number
          created_at?: string
          fcm_token?: string | null
          id?: string
          is_online?: boolean
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
          rating?: number
          service_types?: string[] | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vehicle?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_occurrences: {
        Row: {
          created_at: string | null
          delivery_id: string
          description: string
          driver_id: string
          id: string
          photo_url: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_id: string
          description: string
          driver_id: string
          id?: string
          photo_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_id?: string
          description?: string
          driver_id?: string
          id?: string
          photo_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          type?: string | null
        }
        Relationships: []
      }
      delivery_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          delivery_id: string
          driver_id: string
          id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          delivery_id: string
          driver_id: string
          id?: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          delivery_id?: string
          driver_id?: string
          id?: string
          rating?: number
        }
        Relationships: []
      }
      driver_earnings: {
        Row: {
          amount: number
          created_at: string | null
          delivery_id: string
          description: string | null
          driver_id: string
          id: string
          paid: boolean | null
          paid_at: string | null
          type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          delivery_id: string
          description?: string | null
          driver_id: string
          id?: string
          paid?: boolean | null
          paid_at?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          delivery_id?: string
          description?: string | null
          driver_id?: string
          id?: string
          paid?: boolean | null
          paid_at?: string | null
          type?: string | null
        }
        Relationships: []
      }
      driver_location_history: {
        Row: {
          created_at: string | null
          delivery_id: string
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string | null
          speed: number | null
        }
        Insert: {
          created_at?: string | null
          delivery_id: string
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string | null
          speed?: number | null
        }
        Update: {
          created_at?: string | null
          delivery_id?: string
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string | null
          speed?: number | null
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          app_name: string
          created_at: string
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          app_name: string
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          app_name?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          related_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          related_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          related_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: []
      }
      merchant_invoices: {
        Row: {
          company_id: string
          created_at: string | null
          deliveries_amount: number | null
          id: string
          notes: string | null
          reference_month: string
          status: string | null
          subscription_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          deliveries_amount?: number | null
          id?: string
          notes?: string | null
          reference_month: string
          status?: string | null
          subscription_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deliveries_amount?: number | null
          id?: string
          notes?: string | null
          reference_month?: string
          status?: string | null
          subscription_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          created_at: string
          delivery_id: string | null
          description: string
          driver_id: string
          id: string
          status: string
          type: Database["public"]["Enums"]["occurrence_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          description: string
          driver_id: string
          id?: string
          status?: string
          type: Database["public"]["Enums"]["occurrence_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          description?: string
          driver_id?: string
          id?: string
          status?: string
          type?: Database["public"]["Enums"]["occurrence_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string
          product_name: string | null
          quantity: number
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id: string
          product_name?: string | null
          quantity?: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          product_name?: string | null
          quantity?: number
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
          delivery_address: string | null
          delivery_fee: number
          delivery_id: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_id?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_id?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string | null
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
          {
            foreignKeyName: "orders_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          paid_at: string | null
          payment_method: string
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method: string
          status: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method?: string
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_cash_flow: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          type: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description: string
          id?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          base_value: number
          created_at: string
          destination_region_id: string
          id: string
          origin_region_id: string
          pricing_table_id: string
          return_value: number
          updated_at: string
        }
        Insert: {
          base_value?: number
          created_at?: string
          destination_region_id: string
          id?: string
          origin_region_id: string
          pricing_table_id: string
          return_value?: number
          updated_at?: string
        }
        Update: {
          base_value?: number
          created_at?: string
          destination_region_id?: string
          id?: string
          origin_region_id?: string
          pricing_table_id?: string
          return_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_destination_region_id_fkey"
            columns: ["destination_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_origin_region_id_fkey"
            columns: ["origin_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_pricing_table_id_fkey"
            columns: ["pricing_table_id"]
            isOneToOne: false
            referencedRelation: "pricing_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tables: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_option_groups: {
        Row: {
          created_at: string
          id: string
          max_options: number
          min_options: number
          name: string
          product_id: string
          required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_options: number
          min_options: number
          name: string
          product_id: string
          required: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_options?: number
          min_options?: number
          name?: string
          product_id?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_active: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
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
          full_name: string
          id: string
          phone: string | null
          role: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          document?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          document?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          color: string
          created_at: string
          geometry: Json | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          geometry?: Json | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          geometry?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          company_id: string
          created_at: string
          delivery_id: string
          driver_id: string
          id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          company_id: string
          created_at?: string
          delivery_id: string
          driver_id: string
          id?: string
          rating: number
        }
        Update: {
          comment?: string | null
          company_id?: string
          created_at?: string
          delivery_id?: string
          driver_id?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          driver_id: string | null
          dropoff_address: string
          id: string
          notes: string | null
          pickup_address: string
          price: number | null
          status: string
          updated_at: string | null
          user_id: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          driver_id?: string | null
          dropoff_address: string
          id?: string
          notes?: string | null
          pickup_address: string
          price?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          driver_id?: string | null
          dropoff_address?: string
          id?: string
          notes?: string | null
          pickup_address?: string
          price?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      system_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          status: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role: string
          status?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string | null
          token?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          level: string
          message: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      user_coupons: {
        Row: {
          coupon_id: string
          created_at: string | null
          id: string
          order_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
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
      withdrawals: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          pix_key: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          pix_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          pix_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_admin_user:
        | {
            Args: {
              address?: string
              commission_rate?: number
              company_name?: string
              document: string
              email: string
              full_name: string
              latitude?: number
              license_plate?: string
              longitude?: number
              password: string
              phone: string
              region_id?: string
              role: string
              vehicle?: string
            }
            Returns: Json
          }
        | {
            Args: {
              address: string
              company_name: string
              document: string
              email: string
              full_name: string
              latitude: number
              longitude: number
              password: string
              phone: string
              region_id: string
              role: string
            }
            Returns: Json
          }
        | { Args: { payload: Json }; Returns: Json }
      create_invitation: {
        Args: {
          _email: string
          _expires_at: string
          _invited_by: string
          _role: string
          _token: string
        }
        Returns: undefined
      }
      create_order_v3: {
        Args: {
          p_address_id: string
          p_change_for?: number
          p_company_id: string
          p_coupon_code?: string
          p_delivery_fee?: number
          p_idempotency_key?: string
          p_items: Json
          p_needs_change?: boolean
          p_notes?: string
          p_payment_method: string
        }
        Returns: Json
      }
      get_driver_id: { Args: { _user_id: string }; Returns: string }
      get_invitation_by_token: { Args: { _token: string }; Returns: Json }
      get_my_roles: {
        Args: never
        Returns: {
          role: string
        }[]
      }
      has_profile_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin_safe: { Args: never; Returns: boolean }
      is_company_safe: { Args: never; Returns: boolean }
      is_driver: { Args: { _user_id: string }; Returns: boolean }
      update_delivery_status_safe: {
        Args: { p_delivery_id: string; p_driver_id?: string; p_status: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "company" | "driver" | "customer"
      delivery_status:
        | "pending"
        | "broadcasted"
        | "accepted"
        | "collecting"
        | "in_route"
        | "completed"
        | "cancelled"
      invitation_status: "pending" | "accepted" | "expired"
      occurrence_type: "motorcycle_issue" | "accident" | "robbery" | "other"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "in_route"
        | "delivered"
        | "cancelled"
      profile_status: "pending" | "active" | "rejected"
      user_status: "pending" | "active" | "suspended" | "rejected"
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
        "completed",
        "cancelled",
      ],
      invitation_status: ["pending", "accepted", "expired"],
      occurrence_type: ["motorcycle_issue", "accident", "robbery", "other"],
      order_status: [
        "pending",
        "preparing",
        "ready",
        "in_route",
        "delivered",
        "cancelled",
      ],
      profile_status: ["pending", "active", "rejected"],
      user_status: ["pending", "active", "suspended", "rejected"],
    },
  },
} as const
