export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      back_bar_items: {
        Row: {
          added_at: string
          added_by: string | null
          bar_id: string
          from_name: string | null
          id: string
          item_id: string
          source: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          bar_id: string
          from_name?: string | null
          id?: string
          item_id: string
          source: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          bar_id?: string
          from_name?: string | null
          id?: string
          item_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "back_bar_items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "back_bar_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "back_bar_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_glassware: {
        Row: {
          count: number | null
          created_at: string
          designer: string | null
          glass: string
          id: string
          is_default: boolean
          maker: string | null
          maker_profile_id: string | null
          model_id: string | null
          name: string | null
          profile_id: string
          series: string | null
          shape_note: string | null
          sort_order: number
          source: string | null
          source_urls: string[]
          supplier_id: string | null
          updated_at: string
          variant: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string
          designer?: string | null
          glass: string
          id?: string
          is_default?: boolean
          maker?: string | null
          maker_profile_id?: string | null
          model_id?: string | null
          name?: string | null
          profile_id: string
          series?: string | null
          shape_note?: string | null
          sort_order?: number
          source?: string | null
          source_urls?: string[]
          supplier_id?: string | null
          updated_at?: string
          variant?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string
          designer?: string | null
          glass?: string
          id?: string
          is_default?: boolean
          maker?: string | null
          maker_profile_id?: string | null
          model_id?: string | null
          name?: string | null
          profile_id?: string
          series?: string | null
          shape_note?: string | null
          sort_order?: number
          source?: string | null
          source_urls?: string[]
          supplier_id?: string | null
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_glassware_maker_profile_id_fkey"
            columns: ["maker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_glassware_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "glass_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_glassware_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_glassware_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          bar_id: string
          created_at: string
          email: string
          id: string
          invited_by: string | null
          name: string | null
          role_level: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          bar_id: string
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          name?: string | null
          role_level: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          bar_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          role_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_invites_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_kit: {
        Row: {
          bar_id: string
          count: number | null
          created_at: string
          id: string
          key: string | null
          kind: string
          location: string | null
          name: string | null
          note: string | null
          sort_order: number
          source: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          bar_id: string
          count?: number | null
          created_at?: string
          id?: string
          key?: string | null
          kind?: string
          location?: string | null
          name?: string | null
          note?: string | null
          sort_order?: number
          source?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          bar_id?: string
          count?: number | null
          created_at?: string
          id?: string
          key?: string | null
          kind?: string
          location?: string | null
          name?: string | null
          note?: string | null
          sort_order?: number
          source?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_kit_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_kit_supplier_id_bar_id_fkey"
            columns: ["supplier_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      bar_off_menu: {
        Row: {
          bar_id: string
          item_id: string
          sort_rank: number | null
        }
        Insert: {
          bar_id: string
          item_id: string
          sort_rank?: number | null
        }
        Update: {
          bar_id?: string
          item_id?: string
          sort_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_off_menu_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_off_menu_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_off_menu_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_zones: {
        Row: {
          bar_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["bar_zone_kind"]
          name: string
          photo_url: string | null
          plan_h: number | null
          plan_w: number | null
          plan_x: number | null
          plan_y: number | null
          sort_order: number
        }
        Insert: {
          bar_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["bar_zone_kind"]
          name: string
          photo_url?: string | null
          plan_h?: number | null
          plan_w?: number | null
          plan_x?: number | null
          plan_y?: number | null
          sort_order?: number
        }
        Update: {
          bar_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["bar_zone_kind"]
          name?: string
          photo_url?: string | null
          plan_h?: number | null
          plan_w?: number | null
          plan_x?: number | null
          plan_y?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_zones_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bars: {
        Row: {
          accent_light_color: string | null
          accent_text: string | null
          created_at: string
          currency: string | null
          default_generic_ingredient_level: number
          default_measurement_level: number
          default_prep_level: number
          default_publish_mode: Database["public"]["Enums"]["item_publish_mode"]
          default_specific_brand_level: number
          default_visibility_level: number
          dilution_defaults: Json | null
          display_face: Database["public"]["Enums"]["venue_display_face"]
          enabled_features: string[]
          ground_tint: string | null
          icon_background: string | null
          icon_url: string | null
          id: string
          logo_url: string | null
          min_profit_minor: number | null
          name: string
          page_visibility: Database["public"]["Enums"]["bar_page_visibility"]
          page_visibility_changed_at: string | null
          prices_include_tax: boolean
          primary_color: string | null
          secondary_color: string | null
          short_name: string | null
          show_spec_changes: boolean
          slug: string
          target_gp: number | null
          tax_rate: number
        }
        Insert: {
          accent_light_color?: string | null
          accent_text?: string | null
          created_at?: string
          currency?: string | null
          default_generic_ingredient_level?: number
          default_measurement_level?: number
          default_prep_level?: number
          default_publish_mode?: Database["public"]["Enums"]["item_publish_mode"]
          default_specific_brand_level?: number
          default_visibility_level?: number
          dilution_defaults?: Json | null
          display_face?: Database["public"]["Enums"]["venue_display_face"]
          enabled_features?: string[]
          ground_tint?: string | null
          icon_background?: string | null
          icon_url?: string | null
          id?: string
          logo_url?: string | null
          min_profit_minor?: number | null
          name: string
          page_visibility?: Database["public"]["Enums"]["bar_page_visibility"]
          page_visibility_changed_at?: string | null
          prices_include_tax?: boolean
          primary_color?: string | null
          secondary_color?: string | null
          short_name?: string | null
          show_spec_changes?: boolean
          slug: string
          target_gp?: number | null
          tax_rate?: number
        }
        Update: {
          accent_light_color?: string | null
          accent_text?: string | null
          created_at?: string
          currency?: string | null
          default_generic_ingredient_level?: number
          default_measurement_level?: number
          default_prep_level?: number
          default_publish_mode?: Database["public"]["Enums"]["item_publish_mode"]
          default_specific_brand_level?: number
          default_visibility_level?: number
          dilution_defaults?: Json | null
          display_face?: Database["public"]["Enums"]["venue_display_face"]
          enabled_features?: string[]
          ground_tint?: string | null
          icon_background?: string | null
          icon_url?: string | null
          id?: string
          logo_url?: string | null
          min_profit_minor?: number | null
          name?: string
          page_visibility?: Database["public"]["Enums"]["bar_page_visibility"]
          page_visibility_changed_at?: string | null
          prices_include_tax?: boolean
          primary_color?: string | null
          secondary_color?: string | null
          short_name?: string | null
          show_spec_changes?: boolean
          slug?: string
          target_gp?: number | null
          tax_rate?: number
        }
        Relationships: []
      }
      bring_in_batches: {
        Row: {
          bar_id: string | null
          created_at: string
          id: string
          item_ids: string[]
          menu_id: string | null
          prices: Json
          shelf_ids: string[]
          source: string
          summary: Json
          title: string
          undone_at: string | null
          user_id: string
        }
        Insert: {
          bar_id?: string | null
          created_at?: string
          id?: string
          item_ids?: string[]
          menu_id?: string | null
          prices?: Json
          shelf_ids?: string[]
          source: string
          summary?: Json
          title: string
          undone_at?: string | null
          user_id?: string
        }
        Update: {
          bar_id?: string | null
          created_at?: string
          id?: string
          item_ids?: string[]
          menu_id?: string | null
          prices?: Json
          shelf_ids?: string[]
          source?: string
          summary?: Json
          title?: string
          undone_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bring_in_batches_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bring_in_batches_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sources: {
        Row: {
          bar_id: string
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          skipped_uids: string[]
          starts_public: boolean
          url: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          skipped_uids?: string[]
          starts_public?: boolean
          url: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          skipped_uids?: string[]
          starts_public?: boolean
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sources_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          domain: Database["public"]["Enums"]["item_domain"] | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain?: Database["public"]["Enums"]["item_domain"] | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: Database["public"]["Enums"]["item_domain"] | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      classic_aliases: {
        Row: {
          alias: string
          alias_key: string
          classic_id: string
          source: string
        }
        Insert: {
          alias: string
          alias_key?: string
          classic_id: string
          source: string
        }
        Update: {
          alias?: string
          alias_key?: string
          classic_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "classic_aliases_classic_id_fkey"
            columns: ["classic_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classic_aliases_classic_id_fkey"
            columns: ["classic_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      collected_items: {
        Row: {
          bar_name: string | null
          collected_at: string
          had_on: string | null
          id: string
          image_url: string | null
          item_id: string | null
          name: string | null
          note: string | null
          release_id: string | null
          user_id: string
        }
        Insert: {
          bar_name?: string | null
          collected_at?: string
          had_on?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          name?: string | null
          note?: string | null
          release_id?: string | null
          user_id?: string
        }
        Update: {
          bar_name?: string | null
          collected_at?: string
          had_on?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          name?: string | null
          note?: string | null
          release_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collected_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collected_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collected_items_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      collected_releases: {
        Row: {
          bar_name: string | null
          collected_at: string
          cover_url: string | null
          id: string
          name: string | null
          release_date: string | null
          release_id: string | null
          user_id: string
        }
        Insert: {
          bar_name?: string | null
          collected_at?: string
          cover_url?: string | null
          id?: string
          name?: string | null
          release_date?: string | null
          release_id?: string | null
          user_id?: string
        }
        Update: {
          bar_name?: string | null
          collected_at?: string
          cover_url?: string | null
          id?: string
          name?: string | null
          release_date?: string | null
          release_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collected_releases_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      credited_drink_details: {
        Row: {
          dilution_pct: number | null
          item_id: string
          price: string | null
          serve_abv: number | null
          serve_ml: number | null
        }
        Insert: {
          dilution_pct?: number | null
          item_id: string
          price?: string | null
          serve_abv?: number | null
          serve_ml?: number | null
        }
        Update: {
          dilution_pct?: number | null
          item_id?: string
          price?: string | null
          serve_abv?: number | null
          serve_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credited_drink_details_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credited_drink_details_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      credited_drink_notes: {
        Row: {
          item_id: string
          notes: string
        }
        Insert: {
          item_id: string
          notes: string
        }
        Update: {
          item_id?: string
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "credited_drink_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credited_drink_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_drink_facts: {
        Row: {
          bar_profile_id: string
          base_rank: number
          haystack: string
          item_id: string
          name: string
          notes: string[]
          refreshed_at: string
          spirits: string[]
          styles: string[]
        }
        Insert: {
          bar_profile_id: string
          base_rank: number
          haystack: string
          item_id: string
          name: string
          notes?: string[]
          refreshed_at?: string
          spirits?: string[]
          styles?: string[]
        }
        Update: {
          bar_profile_id?: string
          base_rank?: number
          haystack?: string
          item_id?: string
          name?: string
          notes?: string[]
          refreshed_at?: string
          spirits?: string[]
          styles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "discover_drink_facts_bar_profile_id_fkey"
            columns: ["bar_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_drink_facts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_drink_facts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          bar_id: string | null
          created_at: string | null
          draft_data: Json
          entity_type: string
          id: string
          slot: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bar_id?: string | null
          created_at?: string | null
          draft_data: Json
          entity_type: string
          id?: string
          slot?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bar_id?: string | null
          created_at?: string | null
          draft_data?: Json
          entity_type?: string
          id?: string
          slot?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_photos: {
        Row: {
          created_at: string
          id: string
          image_id: string
          item_id: string
          moderated_at: string | null
          rank_entry_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_id: string
          item_id: string
          moderated_at?: string | null
          rank_entry_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_id?: string
          item_id?: string
          moderated_at?: string | null
          rank_entry_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drink_photos_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_photos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_photos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_photos_rank_entry_id_fkey"
            columns: ["rank_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_photos_rank_entry_id_fkey"
            columns: ["rank_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entry_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_styles: {
        Row: {
          created_at: string
          family: string
          id: string
          key: string
          name: string
          parent_style_id: string | null
          summary: string | null
          year: number | null
          year_approx: boolean
        }
        Insert: {
          created_at?: string
          family: string
          id?: string
          key: string
          name: string
          parent_style_id?: string | null
          summary?: string | null
          year?: number | null
          year_approx?: boolean
        }
        Update: {
          created_at?: string
          family?: string
          id?: string
          key?: string
          name?: string
          parent_style_id?: string | null
          summary?: string | null
          year?: number | null
          year_approx?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "drink_styles_parent_style_id_fkey"
            columns: ["parent_style_id"]
            isOneToOne: false
            referencedRelation: "drink_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          guest_name: string | null
          id: string
          profile_id: string | null
          sort_order: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          guest_name?: string | null
          id?: string
          profile_id?: string | null
          sort_order?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          guest_name?: string | null
          id?: string
          profile_id?: string | null
          sort_order?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          bar_id: string
          covers_estimate: number | null
          created_at: string
          created_by: string | null
          description: string | null
          duplicate_of: string | null
          ends_at: string | null
          external_uid: string | null
          guest_name: string | null
          guest_profile_id: string | null
          guest_role_id: string | null
          house_menu_on: boolean
          id: string
          is_public: boolean
          kind: string
          menu_id: string | null
          name: string
          notes: string | null
          reviewed_at: string | null
          source_id: string | null
          starts_at: string
          ticket_url: string | null
        }
        Insert: {
          bar_id: string
          covers_estimate?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duplicate_of?: string | null
          ends_at?: string | null
          external_uid?: string | null
          guest_name?: string | null
          guest_profile_id?: string | null
          guest_role_id?: string | null
          house_menu_on?: boolean
          id?: string
          is_public?: boolean
          kind?: string
          menu_id?: string | null
          name: string
          notes?: string | null
          reviewed_at?: string | null
          source_id?: string | null
          starts_at: string
          ticket_url?: string | null
        }
        Update: {
          bar_id?: string
          covers_estimate?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duplicate_of?: string | null
          ends_at?: string | null
          external_uid?: string | null
          guest_name?: string | null
          guest_profile_id?: string | null
          guest_role_id?: string | null
          house_menu_on?: boolean
          id?: string
          is_public?: boolean
          kind?: string
          menu_id?: string | null
          name?: string
          notes?: string | null
          reviewed_at?: string | null
          source_id?: string | null
          starts_at?: string
          ticket_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_guest_profile_id_fkey"
            columns: ["guest_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_guest_role_id_bar_id_fkey"
            columns: ["guest_role_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "venue_roles"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "calendar_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_notes: {
        Row: {
          app_version: string | null
          bar_id: string | null
          body: string
          created_at: string
          device: string | null
          drink_name: string | null
          id: string
          kind: string
          photo_path: string | null
          screen: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          bar_id?: string | null
          body?: string
          created_at?: string
          device?: string | null
          drink_name?: string | null
          id?: string
          kind: string
          photo_path?: string | null
          screen: string
          user_id?: string
        }
        Update: {
          app_version?: string | null
          bar_id?: string | null
          body?: string
          created_at?: string
          device?: string | null
          drink_name?: string | null
          id?: string
          kind?: string
          photo_path?: string | null
          screen?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_notes_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_models: {
        Row: {
          aliases: string[]
          capacity_as_stated: string | null
          capacity_ml: number | null
          created_at: string
          designer: string | null
          discontinued: boolean
          glass: string
          height_mm: number | null
          id: string
          maker_profile_id: string
          material: string | null
          model_code: string | null
          name: string
          outline: Json | null
          product_url: string | null
          rim_mm: number | null
          series: string | null
          shape_item_id: string | null
          source_urls: string[]
          updated_at: string
          variant: string | null
        }
        Insert: {
          aliases?: string[]
          capacity_as_stated?: string | null
          capacity_ml?: number | null
          created_at?: string
          designer?: string | null
          discontinued?: boolean
          glass: string
          height_mm?: number | null
          id?: string
          maker_profile_id: string
          material?: string | null
          model_code?: string | null
          name: string
          outline?: Json | null
          product_url?: string | null
          rim_mm?: number | null
          series?: string | null
          shape_item_id?: string | null
          source_urls: string[]
          updated_at?: string
          variant?: string | null
        }
        Update: {
          aliases?: string[]
          capacity_as_stated?: string | null
          capacity_ml?: number | null
          created_at?: string
          designer?: string | null
          discontinued?: boolean
          glass?: string
          height_mm?: number | null
          id?: string
          maker_profile_id?: string
          material?: string | null
          model_code?: string | null
          name?: string
          outline?: Json | null
          product_url?: string | null
          rim_mm?: number | null
          series?: string | null
          shape_item_id?: string | null
          source_urls?: string[]
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glass_models_maker_profile_id_fkey"
            columns: ["maker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glass_models_shape_item_id_fkey"
            columns: ["shape_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glass_models_shape_item_id_fkey"
            columns: ["shape_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_bars: {
        Row: {
          hidden_at: string
          profile_id: string
          user_id: string
        }
        Insert: {
          hidden_at?: string
          profile_id: string
          user_id?: string
        }
        Update: {
          hidden_at?: string
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_bars_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      home_bar_finished: {
        Row: {
          bought_at: string | null
          finished_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          bought_at?: string | null
          finished_at?: string
          id?: string
          item_id: string
          user_id?: string
        }
        Update: {
          bought_at?: string | null
          finished_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_bar_finished_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_bar_finished_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      home_bar_items: {
        Row: {
          added_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          item_id: string
          user_id?: string
        }
        Update: {
          added_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_bar_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_bar_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      home_glassware: {
        Row: {
          count: number | null
          created_at: string
          glass: string
          id: string
          is_default: boolean
          model_id: string | null
          name: string | null
          source: string | null
          user_id: string
          variant: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string
          glass: string
          id?: string
          is_default?: boolean
          model_id?: string | null
          name?: string | null
          source?: string | null
          user_id?: string
          variant?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string
          glass?: string
          id?: string
          is_default?: boolean
          model_id?: string | null
          name?: string | null
          source?: string | null
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_glassware_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "glass_models"
            referencedColumns: ["id"]
          },
        ]
      }
      home_ice: {
        Row: {
          clear: boolean | null
          created_at: string
          draw_as: string | null
          frozen_inside: string | null
          id: string
          length_mm: number | null
          machine: string | null
          name: string
          note: string | null
          shape: string
          size_mm: number | null
          source: string | null
          stamped: boolean
          user_id: string
        }
        Insert: {
          clear?: boolean | null
          created_at?: string
          draw_as?: string | null
          frozen_inside?: string | null
          id?: string
          length_mm?: number | null
          machine?: string | null
          name: string
          note?: string | null
          shape: string
          size_mm?: number | null
          source?: string | null
          stamped?: boolean
          user_id?: string
        }
        Update: {
          clear?: boolean | null
          created_at?: string
          draw_as?: string | null
          frozen_inside?: string | null
          id?: string
          length_mm?: number | null
          machine?: string | null
          name?: string
          note?: string | null
          shape?: string
          size_mm?: number | null
          source?: string | null
          stamped?: boolean
          user_id?: string
        }
        Relationships: []
      }
      home_kit_items: {
        Row: {
          added_at: string
          equipment_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          equipment_id: string
          user_id?: string
        }
        Update: {
          added_at?: string
          equipment_id?: string
          user_id?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          created_at: string
          credit: string | null
          id: string
          is_generated: boolean
          palette: Json | null
          source_url: string | null
          spec_fingerprint: string | null
          url: string
        }
        Insert: {
          created_at?: string
          credit?: string | null
          id?: string
          is_generated?: boolean
          palette?: Json | null
          source_url?: string | null
          spec_fingerprint?: string | null
          url: string
        }
        Update: {
          created_at?: string
          credit?: string | null
          id?: string
          is_generated?: boolean
          palette?: Json | null
          source_url?: string | null
          spec_fingerprint?: string | null
          url?: string
        }
        Relationships: []
      }
      ingredient_aliases: {
        Row: {
          created_at: string
          item_id: string
          key: string
        }
        Insert: {
          created_at?: string
          item_id: string
          key: string
        }
        Update: {
          created_at?: string
          item_id?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_aliases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_pair_notes: {
        Row: {
          a_id: string
          b_id: string
          created_at: string
          note: string
          source: string
        }
        Insert: {
          a_id: string
          b_id: string
          created_at?: string
          note: string
          source?: string
        }
        Update: {
          a_id?: string
          b_id?: string
          created_at?: string
          note?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_pair_notes_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_pair_notes_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_pair_notes_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_pair_notes_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_pair_totals: {
        Row: {
          drinks: number
          era: string
          item_id: string
        }
        Insert: {
          drinks: number
          era: string
          item_id: string
        }
        Update: {
          drinks?: number
          era?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_pair_totals_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_pair_totals_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_pairs: {
        Row: {
          a_id: string
          b_id: string
          era: string
          lift: number
          score: number
          together: number
        }
        Insert: {
          a_id: string
          b_id: string
          era: string
          lift: number
          score: number
          together: number
        }
        Update: {
          a_id?: string
          b_id?: string
          era?: string
          lift?: number
          score?: number
          together?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_pairs_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_pairs_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_pairs_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_pairs_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_allergen_checks: {
        Row: {
          bar_id: string | null
          checked_at: string
          checked_by: string | null
          item_id: string
        }
        Insert: {
          bar_id?: string | null
          checked_at?: string
          checked_by?: string | null
          item_id: string
        }
        Update: {
          bar_id?: string | null
          checked_at?: string
          checked_by?: string | null
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_allergen_checks_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_allergen_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_allergen_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_allergens: {
        Row: {
          allergen: Database["public"]["Enums"]["allergen"]
          bar_id: string | null
          item_id: string
        }
        Insert: {
          allergen: Database["public"]["Enums"]["allergen"]
          bar_id?: string | null
          item_id: string
        }
        Update: {
          allergen?: Database["public"]["Enums"]["allergen"]
          bar_id?: string | null
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_allergens_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_allergens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_allergens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          category_id: string
          is_primary: boolean | null
          item_id: string
        }
        Insert: {
          category_id: string
          is_primary?: boolean | null
          item_id: string
        }
        Update: {
          category_id?: string
          is_primary?: boolean | null
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_co_creators: {
        Row: {
          created_at: string
          item_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_co_creators_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_co_creators_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_co_creators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_comments: {
        Row: {
          author_id: string | null
          author_name: string | null
          bar_id: string
          body: string
          created_at: string
          id: string
          item_id: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          bar_id: string
          body: string
          created_at?: string
          id?: string
          item_id: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          bar_id?: string
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_comments_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_costs: {
        Row: {
          bar_id: string
          item_id: string
          pack_cost_minor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bar_id: string
          item_id: string
          pack_cost_minor: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bar_id?: string
          item_id?: string
          pack_cost_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_costs_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_costs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_costs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_flavors: {
        Row: {
          bitter: number
          botanical: number
          coverage: number
          creamy: number
          fruity: number
          herbal: number
          item_id: string
          rules_version: number
          savory: number
          smoky: number
          sour: number
          source: string
          spec_fingerprint: string
          spiced: number
          spicy: number
          strong: number
          sweet: number
          updated_at: string
        }
        Insert: {
          bitter: number
          botanical?: number
          coverage: number
          creamy: number
          fruity: number
          herbal: number
          item_id: string
          rules_version: number
          savory?: number
          smoky: number
          sour: number
          source: string
          spec_fingerprint: string
          spiced?: number
          spicy: number
          strong: number
          sweet: number
          updated_at?: string
        }
        Update: {
          bitter?: number
          botanical?: number
          coverage?: number
          creamy?: number
          fruity?: number
          herbal?: number
          item_id?: string
          rules_version?: number
          savory?: number
          smoky?: number
          sour?: number
          source?: string
          spec_fingerprint?: string
          spiced?: number
          spicy?: number
          strong?: number
          sweet?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_flavors_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_flavors_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_ice: {
        Row: {
          bar_id: string
          clear: boolean | null
          draw_as: string | null
          frozen_inside: string | null
          item_id: string
          length_mm: number | null
          machine: string | null
          note: string | null
          shape: string
          size_mm: number | null
          source: string | null
          stamped: boolean
          supplier_id: string | null
        }
        Insert: {
          bar_id: string
          clear?: boolean | null
          draw_as?: string | null
          frozen_inside?: string | null
          item_id: string
          length_mm?: number | null
          machine?: string | null
          note?: string | null
          shape: string
          size_mm?: number | null
          source?: string | null
          stamped?: boolean
          supplier_id?: string | null
        }
        Update: {
          bar_id?: string
          clear?: boolean | null
          draw_as?: string | null
          frozen_inside?: string | null
          item_id?: string
          length_mm?: number | null
          machine?: string | null
          note?: string | null
          shape?: string
          size_mm?: number | null
          source?: string | null
          stamped?: boolean
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_ice_item_id_bar_id_fkey"
            columns: ["item_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "item_ice_item_id_bar_id_fkey"
            columns: ["item_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "item_ice_supplier_id_bar_id_fkey"
            columns: ["supplier_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      item_images: {
        Row: {
          angle: Database["public"]["Enums"]["image_angle"]
          checked_at: string | null
          created_at: string
          id: string
          image_id: string | null
          is_generated: boolean
          is_picture: boolean
          item_id: string | null
          outdated_since: string | null
          sort_order: number | null
          spec_fingerprint: string | null
        }
        Insert: {
          angle?: Database["public"]["Enums"]["image_angle"]
          checked_at?: string | null
          created_at?: string
          id?: string
          image_id?: string | null
          is_generated?: boolean
          is_picture?: boolean
          item_id?: string | null
          outdated_since?: string | null
          sort_order?: number | null
          spec_fingerprint?: string | null
        }
        Update: {
          angle?: Database["public"]["Enums"]["image_angle"]
          checked_at?: string | null
          created_at?: string
          id?: string
          image_id?: string | null
          is_generated?: boolean
          is_picture?: boolean
          item_id?: string | null
          outdated_since?: string | null
          sort_order?: number | null
          spec_fingerprint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_images_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_locations: {
        Row: {
          bar_id: string
          container: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          par_amount: number | null
          par_unit: string | null
          photo_url: string | null
          shelf: string | null
          sort_order: number
          zone_id: string
        }
        Insert: {
          bar_id: string
          container?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          par_amount?: number | null
          par_unit?: string | null
          photo_url?: string | null
          shelf?: string | null
          sort_order?: number
          zone_id: string
        }
        Update: {
          bar_id?: string
          container?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          par_amount?: number | null
          par_unit?: string | null
          photo_url?: string | null
          shelf?: string | null
          sort_order?: number
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_locations_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_locations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_locations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_locations_zone_id_bar_id_fkey"
            columns: ["zone_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "bar_zones"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      item_maker_credits: {
        Row: {
          confirmed_at: string | null
          created_at: string
          item_id: string
          makes: string
          profile_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          item_id: string
          makes: string
          profile_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          item_id?: string
          makes?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_maker_credits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_maker_credits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_maker_credits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_methods: {
        Row: {
          item_id: string
          method_item_id: string
          sort_order: number | null
        }
        Insert: {
          item_id: string
          method_item_id: string
          sort_order?: number | null
        }
        Update: {
          item_id?: string
          method_item_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_methods_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_methods_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_methods_method_item_id_fkey"
            columns: ["method_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_methods_method_item_id_fkey"
            columns: ["method_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_prep: {
        Row: {
          actions: string[]
          item_id: string
          lead_time_minutes: number | null
          lead_time_note: string | null
          shelf_life_hours: number | null
          storage: string | null
          updated_at: string
          updated_by: string | null
          yield_amount: number | null
          yield_unit: string | null
        }
        Insert: {
          actions?: string[]
          item_id: string
          lead_time_minutes?: number | null
          lead_time_note?: string | null
          shelf_life_hours?: number | null
          storage?: string | null
          updated_at?: string
          updated_by?: string | null
          yield_amount?: number | null
          yield_unit?: string | null
        }
        Update: {
          actions?: string[]
          item_id?: string
          lead_time_minutes?: number | null
          lead_time_note?: string | null
          shelf_life_hours?: number | null
          storage?: string | null
          updated_at?: string
          updated_by?: string | null
          yield_amount?: number | null
          yield_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_prep_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prep_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_private_notes: {
        Row: {
          body: string
          item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          item_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_private_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_private_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_purchasing: {
        Row: {
          bar_id: string
          item_id: string
          order_code: string | null
          pack_size_amount: number | null
          pack_size_unit: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          bar_id: string
          item_id: string
          order_code?: string | null
          pack_size_amount?: number | null
          pack_size_unit?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          bar_id?: string
          item_id?: string
          order_code?: string | null
          pack_size_amount?: number | null
          pack_size_unit?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_purchasing_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchasing_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchasing_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchasing_supplier_id_bar_id_fkey"
            columns: ["supplier_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      item_service_notes: {
        Row: {
          bar_id: string
          garnish: string | null
          handoff: string[]
          item_id: string
          sell_it_as: string | null
          talking_point: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bar_id: string
          garnish?: string | null
          handoff?: string[]
          item_id: string
          sell_it_as?: string | null
          talking_point?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bar_id?: string
          garnish?: string | null
          handoff?: string[]
          item_id?: string
          sell_it_as?: string | null
          talking_point?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_service_notes_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_service_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_service_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_sketches: {
        Row: {
          inputs: Json
          item_id: string
          rules_version: number
          source: string
          spec_fingerprint: string
          updated_at: string
        }
        Insert: {
          inputs: Json
          item_id: string
          rules_version: number
          source: string
          spec_fingerprint: string
          updated_at?: string
        }
        Update: {
          inputs?: Json
          item_id?: string
          rules_version?: number
          source?: string
          spec_fingerprint?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_sketches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_sketches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_sources: {
        Row: {
          checked_on: string
          created_at: string
          field: string
          id: string
          item_id: string
          kind: string
          note: string | null
          url: string
        }
        Insert: {
          checked_on: string
          created_at?: string
          field: string
          id?: string
          item_id: string
          kind: string
          note?: string | null
          url: string
        }
        Update: {
          checked_on?: string
          created_at?: string
          field?: string
          id?: string
          item_id?: string
          kind?: string
          note?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_sources_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_sources_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_spellings: {
        Row: {
          created_at: string
          item_id: string
          saved_by: string | null
          spelling: string
        }
        Insert: {
          created_at?: string
          item_id: string
          saved_by?: string | null
          spelling: string
        }
        Update: {
          created_at?: string
          item_id?: string
          saved_by?: string | null
          spelling?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_spellings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_spellings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_steps: {
        Row: {
          body: string
          equipment: string[]
          item_id: string
          position: number
          timer_seconds: number | null
        }
        Insert: {
          body: string
          equipment?: string[]
          item_id: string
          position: number
          timer_seconds?: number | null
        }
        Update: {
          body?: string
          equipment?: string[]
          item_id?: string
          position?: number
          timer_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_steps_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_steps_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_versions: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          item_id: string
          note: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          item_id: string
          note?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          item_id?: string
          note?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          abv: number | null
          abv_source: string
          bar_id: string | null
          brand_maker: string | null
          capacity_ml: number | null
          created_at: string
          created_by: string | null
          creator_profile_id: string | null
          credit_status: Database["public"]["Enums"]["credit_status"] | null
          density_g_ml: number | null
          description: string | null
          dilution_pct: number | null
          family_id: string | null
          generic_id: string | null
          gi: string | null
          glass_model_id: string | null
          glassware_id: string | null
          hide_from_search: boolean
          ice_build: Json | null
          ice_id: string | null
          ice_per_serve_g: number | null
          iced_capacity_ml: number | null
          icon_key: string | null
          icon_url: string | null
          id: string
          ingredient_role: string | null
          is_catalog: boolean
          is_core: boolean
          item_type: Database["public"]["Enums"]["entity_type"]
          lineage_family: string | null
          lineage_note: string | null
          lineage_parent_id: string | null
          lineage_style_id: string | null
          made_from_id: string | null
          maker_profile_id: string | null
          method_ice_id: string | null
          moderated_at: string | null
          name: string
          notes: string | null
          origin: string | null
          origin_bar_profile_id: string | null
          origin_country: string | null
          origin_year: number | null
          origin_year_approx: boolean
          origin_year_guess: string | null
          override_generic_ingredient_level: number | null
          override_measurement_level: number | null
          override_prep_level: number | null
          override_specific_brand_level: number | null
          override_visibility_level: number | null
          picture: Database["public"]["Enums"]["item_picture"]
          price: string | null
          publish_mode: Database["public"]["Enums"]["item_publish_mode"] | null
          published_at: string | null
          riff_of_id: string | null
          serve_abv: number | null
          serve_ml: number | null
          service_style: string | null
          sketch_liquid: string | null
          sketch_variant: string | null
          spec_from_id: string | null
          spec_source: string
          status: string | null
        }
        Insert: {
          abv?: number | null
          abv_source?: string
          bar_id?: string | null
          brand_maker?: string | null
          capacity_ml?: number | null
          created_at?: string
          created_by?: string | null
          creator_profile_id?: string | null
          credit_status?: Database["public"]["Enums"]["credit_status"] | null
          density_g_ml?: number | null
          description?: string | null
          dilution_pct?: number | null
          family_id?: string | null
          generic_id?: string | null
          gi?: string | null
          glass_model_id?: string | null
          glassware_id?: string | null
          hide_from_search?: boolean
          ice_build?: Json | null
          ice_id?: string | null
          ice_per_serve_g?: number | null
          iced_capacity_ml?: number | null
          icon_key?: string | null
          icon_url?: string | null
          id?: string
          ingredient_role?: string | null
          is_catalog?: boolean
          is_core?: boolean
          item_type: Database["public"]["Enums"]["entity_type"]
          lineage_family?: string | null
          lineage_note?: string | null
          lineage_parent_id?: string | null
          lineage_style_id?: string | null
          made_from_id?: string | null
          maker_profile_id?: string | null
          method_ice_id?: string | null
          moderated_at?: string | null
          name: string
          notes?: string | null
          origin?: string | null
          origin_bar_profile_id?: string | null
          origin_country?: string | null
          origin_year?: number | null
          origin_year_approx?: boolean
          origin_year_guess?: string | null
          override_generic_ingredient_level?: number | null
          override_measurement_level?: number | null
          override_prep_level?: number | null
          override_specific_brand_level?: number | null
          override_visibility_level?: number | null
          picture?: Database["public"]["Enums"]["item_picture"]
          price?: string | null
          publish_mode?: Database["public"]["Enums"]["item_publish_mode"] | null
          published_at?: string | null
          riff_of_id?: string | null
          serve_abv?: number | null
          serve_ml?: number | null
          service_style?: string | null
          sketch_liquid?: string | null
          sketch_variant?: string | null
          spec_from_id?: string | null
          spec_source?: string
          status?: string | null
        }
        Update: {
          abv?: number | null
          abv_source?: string
          bar_id?: string | null
          brand_maker?: string | null
          capacity_ml?: number | null
          created_at?: string
          created_by?: string | null
          creator_profile_id?: string | null
          credit_status?: Database["public"]["Enums"]["credit_status"] | null
          density_g_ml?: number | null
          description?: string | null
          dilution_pct?: number | null
          family_id?: string | null
          generic_id?: string | null
          gi?: string | null
          glass_model_id?: string | null
          glassware_id?: string | null
          hide_from_search?: boolean
          ice_build?: Json | null
          ice_id?: string | null
          ice_per_serve_g?: number | null
          iced_capacity_ml?: number | null
          icon_key?: string | null
          icon_url?: string | null
          id?: string
          ingredient_role?: string | null
          is_catalog?: boolean
          is_core?: boolean
          item_type?: Database["public"]["Enums"]["entity_type"]
          lineage_family?: string | null
          lineage_note?: string | null
          lineage_parent_id?: string | null
          lineage_style_id?: string | null
          made_from_id?: string | null
          maker_profile_id?: string | null
          method_ice_id?: string | null
          moderated_at?: string | null
          name?: string
          notes?: string | null
          origin?: string | null
          origin_bar_profile_id?: string | null
          origin_country?: string | null
          origin_year?: number | null
          origin_year_approx?: boolean
          origin_year_guess?: string | null
          override_generic_ingredient_level?: number | null
          override_measurement_level?: number | null
          override_prep_level?: number | null
          override_specific_brand_level?: number | null
          override_visibility_level?: number | null
          picture?: Database["public"]["Enums"]["item_picture"]
          price?: string | null
          publish_mode?: Database["public"]["Enums"]["item_publish_mode"] | null
          published_at?: string | null
          riff_of_id?: string | null
          serve_abv?: number | null
          serve_ml?: number | null
          service_style?: string | null
          sketch_liquid?: string | null
          sketch_variant?: string | null
          spec_from_id?: string | null
          spec_source?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_generic_id_fkey"
            columns: ["generic_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_generic_id_fkey"
            columns: ["generic_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_glass_model_id_fkey"
            columns: ["glass_model_id"]
            isOneToOne: false
            referencedRelation: "glass_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_glassware_id_fkey"
            columns: ["glassware_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_glassware_id_fkey"
            columns: ["glassware_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_ice_id_fkey"
            columns: ["ice_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_ice_id_fkey"
            columns: ["ice_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_lineage_parent_id_fkey"
            columns: ["lineage_parent_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_lineage_parent_id_fkey"
            columns: ["lineage_parent_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_lineage_style_id_fkey"
            columns: ["lineage_style_id"]
            isOneToOne: false
            referencedRelation: "drink_styles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_made_from_id_fkey"
            columns: ["made_from_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_made_from_id_fkey"
            columns: ["made_from_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_maker_profile_id_fkey"
            columns: ["maker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_method_ice_id_fkey"
            columns: ["method_ice_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_method_ice_id_fkey"
            columns: ["method_ice_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_origin_bar_profile_id_fkey"
            columns: ["origin_bar_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_riff_of_id_fkey"
            columns: ["riff_of_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_riff_of_id_fkey"
            columns: ["riff_of_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_spec_from_id_fkey"
            columns: ["spec_from_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_spec_from_id_fkey"
            columns: ["spec_from_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      loved_bars: {
        Row: {
          alerts: string
          loved_at: string
          profile_id: string
          user_id: string
        }
        Insert: {
          alerts?: string
          loved_at?: string
          profile_id: string
          user_id?: string
        }
        Update: {
          alerts?: string
          loved_at?: string
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loved_bars_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      made_drinks: {
        Row: {
          compared: string | null
          created_at: string
          id: string
          image_id: string | null
          item_id: string
          made_on: string
          note: string | null
          on_profile: boolean
          rank_entry_id: string | null
          swaps: Json
          user_id: string
        }
        Insert: {
          compared?: string | null
          created_at?: string
          id?: string
          image_id?: string | null
          item_id: string
          made_on?: string
          note?: string | null
          on_profile?: boolean
          rank_entry_id?: string | null
          swaps?: Json
          user_id?: string
        }
        Update: {
          compared?: string | null
          created_at?: string
          id?: string
          image_id?: string | null
          item_id?: string
          made_on?: string
          note?: string | null
          on_profile?: boolean
          rank_entry_id?: string | null
          swaps?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "made_drinks_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "made_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "made_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "made_drinks_rank_entry_id_fkey"
            columns: ["rank_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "made_drinks_rank_entry_id_fkey"
            columns: ["rank_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entry_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_drinks: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          menu_id: string | null
          menu_section_id: string | null
          party_id: string | null
          price: string | null
          serves: number | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          menu_id?: string | null
          menu_section_id?: string | null
          party_id?: string | null
          price?: string | null
          serves?: number | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          menu_id?: string | null
          menu_section_id?: string | null
          party_id?: string | null
          price?: string | null
          serves?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_drinks_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_drinks_menu_section_id_fkey"
            columns: ["menu_section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_drinks_party_fkey"
            columns: ["party_id", "menu_id"]
            isOneToOne: false
            referencedRelation: "menu_run_parties"
            referencedColumns: ["id", "menu_id"]
          },
        ]
      }
      menu_run_owners: {
        Row: {
          item_id: string
          menu_id: string
          party_id: string | null
          updated_at: string
        }
        Insert: {
          item_id: string
          menu_id: string
          party_id?: string | null
          updated_at?: string
        }
        Update: {
          item_id?: string
          menu_id?: string
          party_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_run_owners_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_owners_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_owners_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_owners_party_id_menu_id_fkey"
            columns: ["party_id", "menu_id"]
            isOneToOne: false
            referencedRelation: "menu_run_parties"
            referencedColumns: ["id", "menu_id"]
          },
        ]
      }
      menu_run_parties: {
        Row: {
          created_at: string
          id: string
          is_venue: boolean
          kind: string
          menu_id: string
          name: string
          profile_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_venue?: boolean
          kind: string
          menu_id: string
          name: string
          profile_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_venue?: boolean
          kind?: string
          menu_id?: string
          name?: string
          profile_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_run_parties_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_parties_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_run_swaps: {
        Row: {
          created_at: string
          from_item_id: string
          id: string
          menu_drink_id: string
          to_item_id: string
        }
        Insert: {
          created_at?: string
          from_item_id: string
          id?: string
          menu_drink_id: string
          to_item_id: string
        }
        Update: {
          created_at?: string
          from_item_id?: string
          id?: string
          menu_drink_id?: string
          to_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_run_swaps_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_swaps_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_swaps_menu_drink_id_fkey"
            columns: ["menu_drink_id"]
            isOneToOne: false
            referencedRelation: "menu_drinks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_swaps_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_run_swaps_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          allowed_types: string[]
          created_at: string
          id: string
          max_items: number | null
          menu_id: string
          min_items: number
          name: string
          sort_order: number
        }
        Insert: {
          allowed_types?: string[]
          created_at?: string
          id?: string
          max_items?: number | null
          menu_id: string
          min_items?: number
          name: string
          sort_order?: number
        }
        Update: {
          allowed_types?: string[]
          created_at?: string
          id?: string
          max_items?: number | null
          menu_id?: string
          min_items?: number
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      menus: {
        Row: {
          bar_id: string | null
          cover_position: number | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          guest_count: number | null
          id: string
          is_active: boolean | null
          kind: string
          menu_date: string | null
          name: string
          planned_ends_at: string | null
          planned_starts_at: string | null
          publish_mode: Database["public"]["Enums"]["item_publish_mode"] | null
          shared_at: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          bar_id?: string | null
          cover_position?: number | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          guest_count?: number | null
          id?: string
          is_active?: boolean | null
          kind?: string
          menu_date?: string | null
          name: string
          planned_ends_at?: string | null
          planned_starts_at?: string | null
          publish_mode?: Database["public"]["Enums"]["item_publish_mode"] | null
          shared_at?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          bar_id?: string | null
          cover_position?: number | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          guest_count?: number | null
          id?: string
          is_active?: boolean | null
          kind?: string
          menu_date?: string | null
          name?: string
          planned_ends_at?: string | null
          planned_starts_at?: string | null
          publish_mode?: Database["public"]["Enums"]["item_publish_mode"] | null
          shared_at?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_awards: {
        Row: {
          added_by: string | null
          award: string
          bar_profile_id: string | null
          created_at: string
          id: string
          is_finalist: boolean
          on_profile: boolean | null
          position: number | null
          profile_id: string
          source_url: string | null
          status: string
          title: string | null
          year: number
        }
        Insert: {
          added_by?: string | null
          award: string
          bar_profile_id?: string | null
          created_at?: string
          id?: string
          is_finalist?: boolean
          on_profile?: boolean | null
          position?: number | null
          profile_id: string
          source_url?: string | null
          status?: string
          title?: string | null
          year: number
        }
        Update: {
          added_by?: string | null
          award?: string
          bar_profile_id?: string | null
          created_at?: string
          id?: string
          is_finalist?: boolean
          on_profile?: boolean | null
          position?: number | null
          profile_id?: string
          source_url?: string | null
          status?: string
          title?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_awards_bar_profile_id_fkey"
            columns: ["bar_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_awards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_claims: {
        Row: {
          bar_id: string | null
          code: string | null
          created_at: string
          decline_reason: string | null
          evidence: Json | null
          id: string
          message: string | null
          method: Database["public"]["Enums"]["claim_method"]
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          setup: Json | null
          status: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        Insert: {
          bar_id?: string | null
          code?: string | null
          created_at?: string
          decline_reason?: string | null
          evidence?: Json | null
          id?: string
          message?: string | null
          method?: Database["public"]["Enums"]["claim_method"]
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          setup?: Json | null
          status?: Database["public"]["Enums"]["claim_status"]
          user_id?: string
        }
        Update: {
          bar_id?: string | null
          code?: string | null
          created_at?: string
          decline_reason?: string | null
          evidence?: Json | null
          id?: string
          message?: string | null
          method?: Database["public"]["Enums"]["claim_method"]
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          setup?: Json | null
          status?: Database["public"]["Enums"]["claim_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_claims_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_menu_edition_drinks: {
        Row: {
          edition_id: string
          item_id: string
          sort_order: number
        }
        Insert: {
          edition_id: string
          item_id: string
          sort_order: number
        }
        Update: {
          edition_id?: string
          item_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_menu_edition_drinks_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "profile_menu_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_menu_edition_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_menu_edition_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_menu_editions: {
        Row: {
          created_at: string
          end_month: number | null
          end_year: number | null
          id: string
          is_current: boolean
          month: number | null
          name: string
          profile_id: string
          source_url: string | null
          theme: string | null
          year: number
        }
        Insert: {
          created_at?: string
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          month?: number | null
          name: string
          profile_id: string
          source_url?: string | null
          theme?: string | null
          year: number
        }
        Update: {
          created_at?: string
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          month?: number | null
          name?: string
          profile_id?: string
          source_url?: string | null
          theme?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_menu_editions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_picks: {
        Row: {
          created_at: string
          profile_id: string
          section: string
          shown: boolean
          target_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          section: string
          shown: boolean
          target_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          section?: string
          shown?: boolean
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_picks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_positions: {
        Row: {
          added_in_app: boolean
          bar_accepted: boolean
          bar_profile_id: string
          created_at: string
          end_month: number | null
          end_year: number | null
          id: string
          is_current: boolean
          is_hidden: boolean
          is_shown: boolean
          person_accepted: boolean
          person_profile_id: string
          source_url: string | null
          start_month: number | null
          start_year: number | null
          title: string
        }
        Insert: {
          added_in_app?: boolean
          bar_accepted?: boolean
          bar_profile_id: string
          created_at?: string
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          is_hidden?: boolean
          is_shown?: boolean
          person_accepted?: boolean
          person_profile_id: string
          source_url?: string | null
          start_month?: number | null
          start_year?: number | null
          title: string
        }
        Update: {
          added_in_app?: boolean
          bar_accepted?: boolean
          bar_profile_id?: string
          created_at?: string
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          is_hidden?: boolean
          is_shown?: boolean
          person_accepted?: boolean
          person_profile_id?: string
          source_url?: string | null
          start_month?: number | null
          start_year?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_positions_bar_profile_id_fkey"
            columns: ["bar_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_positions_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_worked_menu_drinks: {
        Row: {
          created_at: string
          item_id: string
          worked_menu_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          worked_menu_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          worked_menu_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_worked_menu_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_worked_menu_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_worked_menu_drinks_worked_menu_id_fkey"
            columns: ["worked_menu_id"]
            isOneToOne: false
            referencedRelation: "profile_worked_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_worked_menus: {
        Row: {
          bar_profile_id: string
          created_at: string
          id: string
          name: string
          person_profile_id: string
          year: number | null
        }
        Insert: {
          bar_profile_id: string
          created_at?: string
          id?: string
          name: string
          person_profile_id: string
          year?: number | null
        }
        Update: {
          bar_profile_id?: string
          created_at?: string
          id?: string
          name?: string
          person_profile_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_worked_menus_bar_profile_id_fkey"
            columns: ["bar_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_worked_menus_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line: string | null
          avatar_url: string | null
          awards_mode: string
          bar_id: string | null
          bar_type: string | null
          bars_mode: string
          bio: string | null
          city: string | null
          claimed_at: string | null
          closed_year: number | null
          country_code: string | null
          created_at: string
          created_by: string | null
          display_name: string
          had_mode: string
          handle: string
          headline_position_id: string | null
          hours: Json | null
          hours_updated_at: string | null
          id: string
          instagram: string | null
          is_claimed: boolean | null
          is_closed: boolean
          is_public: boolean
          kind: Database["public"]["Enums"]["profile_kind"]
          latitude: number | null
          locality: string | null
          longitude: number | null
          made_mode: string
          makes: string[]
          moderated_at: string | null
          opened_year: number | null
          page_visibility:
            | Database["public"]["Enums"]["bar_page_visibility"]
            | null
          part_of_profile_id: string | null
          phone: string | null
          postcode: string | null
          region: string | null
          serves: string[]
          shares_bars: boolean
          shares_made: boolean
          shares_rankings: boolean
          shows_city: boolean
          shows_dates: boolean
          shows_photo: boolean
          social_links: string[] | null
          supplies: string[]
          tagline: string | null
          timezone: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          address_line?: string | null
          avatar_url?: string | null
          awards_mode?: string
          bar_id?: string | null
          bar_type?: string | null
          bars_mode?: string
          bio?: string | null
          city?: string | null
          claimed_at?: string | null
          closed_year?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          had_mode?: string
          handle: string
          headline_position_id?: string | null
          hours?: Json | null
          hours_updated_at?: string | null
          id?: string
          instagram?: string | null
          is_claimed?: boolean | null
          is_closed?: boolean
          is_public: boolean
          kind: Database["public"]["Enums"]["profile_kind"]
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          made_mode?: string
          makes?: string[]
          moderated_at?: string | null
          opened_year?: number | null
          page_visibility?:
            | Database["public"]["Enums"]["bar_page_visibility"]
            | null
          part_of_profile_id?: string | null
          phone?: string | null
          postcode?: string | null
          region?: string | null
          serves?: string[]
          shares_bars?: boolean
          shares_made?: boolean
          shares_rankings?: boolean
          shows_city?: boolean
          shows_dates?: boolean
          shows_photo?: boolean
          social_links?: string[] | null
          supplies?: string[]
          tagline?: string | null
          timezone?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address_line?: string | null
          avatar_url?: string | null
          awards_mode?: string
          bar_id?: string | null
          bar_type?: string | null
          bars_mode?: string
          bio?: string | null
          city?: string | null
          claimed_at?: string | null
          closed_year?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          had_mode?: string
          handle?: string
          headline_position_id?: string | null
          hours?: Json | null
          hours_updated_at?: string | null
          id?: string
          instagram?: string | null
          is_claimed?: boolean | null
          is_closed?: boolean
          is_public?: boolean
          kind?: Database["public"]["Enums"]["profile_kind"]
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          made_mode?: string
          makes?: string[]
          moderated_at?: string | null
          opened_year?: number | null
          page_visibility?:
            | Database["public"]["Enums"]["bar_page_visibility"]
            | null
          part_of_profile_id?: string | null
          phone?: string | null
          postcode?: string | null
          region?: string | null
          serves?: string[]
          shares_bars?: boolean
          shares_made?: boolean
          shares_rankings?: boolean
          shows_city?: boolean
          shows_dates?: boolean
          shows_photo?: boolean
          social_links?: string[] | null
          supplies?: string[]
          tagline?: string | null
          timezone?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_headline_position_id_fkey"
            columns: ["headline_position_id"]
            isOneToOne: false
            referencedRelation: "profile_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_part_of_profile_id_fkey"
            columns: ["part_of_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_comparisons: {
        Row: {
          created_at: string
          id: number
          is_tie: boolean
          loser_entry_id: string
          user_id: string
          winner_entry_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          is_tie?: boolean
          loser_entry_id: string
          user_id?: string
          winner_entry_id: string
        }
        Update: {
          created_at?: string
          id?: never
          is_tie?: boolean
          loser_entry_id?: string
          user_id?: string
          winner_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_comparisons_loser_entry_id_fkey"
            columns: ["loser_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_comparisons_loser_entry_id_fkey"
            columns: ["loser_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entry_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_comparisons_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_comparisons_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "rank_entry_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_entries: {
        Row: {
          created_at: string
          had_on: string | null
          id: string
          item_id: string
          on_profile: boolean | null
          profile_pin: number | null
          rank_key: number
          ranked_as_item_id: string
          says_where: boolean
          sentiment: Database["public"]["Enums"]["rank_sentiment"]
          user_id: string
          venue_profile_id: string | null
        }
        Insert: {
          created_at?: string
          had_on?: string | null
          id?: string
          item_id: string
          on_profile?: boolean | null
          profile_pin?: number | null
          rank_key: number
          ranked_as_item_id: string
          says_where?: boolean
          sentiment: Database["public"]["Enums"]["rank_sentiment"]
          user_id?: string
          venue_profile_id?: string | null
        }
        Update: {
          created_at?: string
          had_on?: string | null
          id?: string
          item_id?: string
          on_profile?: boolean | null
          profile_pin?: number | null
          rank_key?: number
          ranked_as_item_id?: string
          says_where?: boolean
          sentiment?: Database["public"]["Enums"]["rank_sentiment"]
          user_id?: string
          venue_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rank_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_ranked_as_item_id_fkey"
            columns: ["ranked_as_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_ranked_as_item_id_fkey"
            columns: ["ranked_as_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_venue_profile_id_fkey"
            columns: ["venue_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          amount: number | null
          at_service: boolean | null
          created_at: string
          id: string
          ingredient_item_id: string | null
          is_optional: boolean | null
          parent_ingredient_id: string | null
          preparation_notes: string | null
          recipe_item_id: string | null
          sort_order: number
          unit: string | null
        }
        Insert: {
          amount?: number | null
          at_service?: boolean | null
          created_at?: string
          id?: string
          ingredient_item_id?: string | null
          is_optional?: boolean | null
          parent_ingredient_id?: string | null
          preparation_notes?: string | null
          recipe_item_id?: string | null
          sort_order?: number
          unit?: string | null
        }
        Update: {
          amount?: number | null
          at_service?: boolean | null
          created_at?: string
          id?: string
          ingredient_item_id?: string | null
          is_optional?: boolean | null
          parent_ingredient_id?: string | null
          preparation_notes?: string | null
          recipe_item_id?: string | null
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_ingredient_item_id_fkey"
            columns: ["ingredient_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_ingredient_item_id_fkey"
            columns: ["ingredient_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_parent_ingredient_id_fkey"
            columns: ["parent_ingredient_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_parent_ingredient_id_fkey"
            columns: ["parent_ingredient_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_recipe_item_id_fkey"
            columns: ["recipe_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_recipe_item_id_fkey"
            columns: ["recipe_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      release_items: {
        Row: {
          bar_id: string
          item_id: string
          release_id: string
          sort_order: number
        }
        Insert: {
          bar_id: string
          item_id: string
          release_id: string
          sort_order?: number
        }
        Update: {
          bar_id?: string
          item_id?: string
          release_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "release_items_item_id_bar_id_fkey"
            columns: ["item_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "release_items_item_id_bar_id_fkey"
            columns: ["item_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "release_items_release_id_bar_id_fkey"
            columns: ["release_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      releases: {
        Row: {
          bar_id: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          moderated_at: string | null
          name: string
          published_at: string | null
          release_date: string
        }
        Insert: {
          bar_id: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          moderated_at?: string | null
          name: string
          published_at?: string | null
          release_date: string
        }
        Update: {
          bar_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          moderated_at?: string | null
          name?: string
          published_at?: string | null
          release_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          comment_id: string | null
          created_at: string
          details: string | null
          id: string
          item_id: string | null
          photo_id: string | null
          profile_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          release_id: string | null
          reporter_id: string | null
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_kind: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          item_id?: string | null
          photo_id?: string | null
          profile_id?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          release_id?: string | null
          reporter_id?: string | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_kind: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          item_id?: string | null
          photo_id?: string | null
          profile_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          release_id?: string | null
          reporter_id?: string | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_kind?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "drink_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_menu_editions: {
        Row: {
          edition_id: string | null
          id: string
          menu_id: string | null
          saved_at: string
          user_id: string
        }
        Insert: {
          edition_id?: string | null
          id?: string
          menu_id?: string | null
          saved_at?: string
          user_id?: string
        }
        Update: {
          edition_id?: string | null
          id?: string
          menu_id?: string | null
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_menu_editions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "profile_menu_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_menu_editions_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      source_recipe_lines: {
        Row: {
          amount_ml: number | null
          amount_text: string | null
          id: string
          ingredient_item_id: string | null
          ingredient_text: string
          note: string | null
          sort_order: number
          source_recipe_id: string
        }
        Insert: {
          amount_ml?: number | null
          amount_text?: string | null
          id?: string
          ingredient_item_id?: string | null
          ingredient_text: string
          note?: string | null
          sort_order?: number
          source_recipe_id: string
        }
        Update: {
          amount_ml?: number | null
          amount_text?: string | null
          id?: string
          ingredient_item_id?: string | null
          ingredient_text?: string
          note?: string | null
          sort_order?: number
          source_recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_recipe_lines_ingredient_item_id_fkey"
            columns: ["ingredient_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_recipe_lines_ingredient_item_id_fkey"
            columns: ["ingredient_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_recipe_lines_source_recipe_id_fkey"
            columns: ["source_recipe_id"]
            isOneToOne: false
            referencedRelation: "source_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      source_recipes: {
        Row: {
          created_at: string
          id: string
          item_id: string
          method: string | null
          notes: string | null
          page_label: string | null
          page_url: string | null
          printed_name: string | null
          quote: string | null
          relation: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          method?: string | null
          notes?: string | null
          page_label?: string | null
          page_url?: string | null
          printed_name?: string | null
          quote?: string | null
          relation: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          method?: string | null
          notes?: string | null
          page_label?: string | null
          page_url?: string | null
          printed_name?: string | null
          quote?: string | null
          relation?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_recipes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_recipes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_recipes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          archive_url: string | null
          author: string | null
          city: string | null
          created_at: string
          edition: string | null
          euvs_url: string | null
          id: string
          key: string
          kind: string
          rights: string
          summary: string | null
          title: string
          url: string | null
          year: number | null
        }
        Insert: {
          archive_url?: string | null
          author?: string | null
          city?: string | null
          created_at?: string
          edition?: string | null
          euvs_url?: string | null
          id?: string
          key: string
          kind: string
          rights: string
          summary?: string | null
          title: string
          url?: string | null
          year?: number | null
        }
        Update: {
          archive_url?: string | null
          author?: string | null
          city?: string | null
          created_at?: string
          edition?: string | null
          euvs_url?: string | null
          id?: string
          key?: string
          kind?: string
          rights?: string
          summary?: string | null
          title?: string
          url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      stock_count_lines: {
        Row: {
          amount: number
          count_id: string
          id: string
          item_id: string
          location_id: string | null
          unit: string
        }
        Insert: {
          amount: number
          count_id: string
          id?: string
          item_id: string
          location_id?: string | null
          unit: string
        }
        Update: {
          amount?: number
          count_id?: string
          id?: string
          item_id?: string
          location_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "item_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          bar_id: string
          counted_at: string
          counted_by: string | null
          counted_by_name: string | null
          id: string
          note: string | null
          zone_id: string | null
        }
        Insert: {
          bar_id: string
          counted_at?: string
          counted_by?: string | null
          counted_by_name?: string | null
          id?: string
          note?: string | null
          zone_id?: string | null
        }
        Update: {
          bar_id?: string
          counted_at?: string
          counted_by?: string | null
          counted_by_name?: string | null
          id?: string
          note?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "bar_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_lines: {
        Row: {
          created_at: string
          id: string
          maker_profile_id: string
          region: string
          source_url: string | null
          supplier_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          maker_profile_id: string
          region: string
          source_url?: string | null
          supplier_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          maker_profile_id?: string
          region?: string
          source_url?: string | null
          supplier_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_lines_maker_profile_id_fkey"
            columns: ["maker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_lines_supplier_profile_id_fkey"
            columns: ["supplier_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          bar_id: string
          created_at: string
          cuts_to_order: boolean
          delivers: string | null
          id: string
          name: string
          order_by: string | null
          order_notes: string | null
          profile_id: string | null
          supplies: string[]
          website: string | null
        }
        Insert: {
          bar_id: string
          created_at?: string
          cuts_to_order?: boolean
          delivers?: string | null
          id?: string
          name: string
          order_by?: string | null
          order_notes?: string | null
          profile_id?: string | null
          supplies?: string[]
          website?: string | null
        }
        Update: {
          bar_id?: string
          created_at?: string
          cuts_to_order?: boolean
          delivers?: string | null
          id?: string
          name?: string
          order_by?: string | null
          order_notes?: string | null
          profile_id?: string | null
          supplies?: string[]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sections: {
        Row: {
          allowed_types: string[]
          created_at: string | null
          id: string
          max_items: number | null
          min_items: number | null
          name: string
          sort_order: number
          template_id: string
        }
        Insert: {
          allowed_types?: string[]
          created_at?: string | null
          id?: string
          max_items?: number | null
          min_items?: number | null
          name: string
          sort_order?: number
          template_id: string
        }
        Update: {
          allowed_types?: string[]
          created_at?: string | null
          id?: string
          max_items?: number | null
          min_items?: number | null
          name?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "menu_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bars: {
        Row: {
          bar_id: string
          created_at: string
          id: string
          role_level: number
          role_since: string
          user_id: string
          venue_role_id: string | null
        }
        Insert: {
          bar_id: string
          created_at?: string
          id?: string
          role_level?: number
          role_since?: string
          user_id: string
          venue_role_id?: string | null
        }
        Update: {
          bar_id?: string
          created_at?: string
          id?: string
          role_level?: number
          role_since?: string
          user_id?: string
          venue_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_bars_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bars_venue_role_fkey"
            columns: ["venue_role_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "venue_roles"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_prefs: {
        Row: {
          taste_answers: Json | null
          user_id: string
          view_as_role_level: number | null
        }
        Insert: {
          taste_answers?: Json | null
          user_id: string
          view_as_role_level?: number | null
        }
        Update: {
          taste_answers?: Json | null
          user_id?: string
          view_as_role_level?: number | null
        }
        Relationships: []
      }
      venue_calendar_settings: {
        Row: {
          bar_id: string
          team_words: string[]
          updated_at: string
        }
        Insert: {
          bar_id: string
          team_words?: string[]
          updated_at?: string
        }
        Update: {
          bar_id?: string
          team_words?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_calendar_settings_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_feature_events: {
        Row: {
          at: string
          bar_id: string
          by_user: string | null
          enabled: boolean
          feature: string
          id: string
        }
        Insert: {
          at?: string
          bar_id: string
          by_user?: string | null
          enabled: boolean
          feature: string
          id?: string
        }
        Update: {
          at?: string
          bar_id?: string
          by_user?: string | null
          enabled?: boolean
          feature?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_feature_events_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_join_requests: {
        Row: {
          bar_id: string
          created_at: string
          declined_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          declined_at?: string | null
          id?: string
          user_id?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          declined_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_join_requests_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_level_overrides: {
        Row: {
          bar_id: string
          base_level: number
          granted: Database["public"]["Enums"]["venue_capability"][]
          revoked: Database["public"]["Enums"]["venue_capability"][]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bar_id: string
          base_level: number
          granted?: Database["public"]["Enums"]["venue_capability"][]
          revoked?: Database["public"]["Enums"]["venue_capability"][]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bar_id?: string
          base_level?: number
          granted?: Database["public"]["Enums"]["venue_capability"][]
          revoked?: Database["public"]["Enums"]["venue_capability"][]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_level_overrides_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_roles: {
        Row: {
          bar_id: string
          base_level: number
          created_at: string
          created_by: string | null
          ends_at: string | null
          granted: Database["public"]["Enums"]["venue_capability"][]
          id: string
          name: string
          revoked: Database["public"]["Enums"]["venue_capability"][]
        }
        Insert: {
          bar_id: string
          base_level: number
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          granted?: Database["public"]["Enums"]["venue_capability"][]
          id?: string
          name: string
          revoked?: Database["public"]["Enums"]["venue_capability"][]
        }
        Update: {
          bar_id?: string
          base_level?: number
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          granted?: Database["public"]["Enums"]["venue_capability"][]
          id?: string
          name?: string
          revoked?: Database["public"]["Enums"]["venue_capability"][]
        }
        Relationships: [
          {
            foreignKeyName: "venue_roles_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      app_item_presentation: {
        Row: {
          abv: number | null
          abv_source: string | null
          bar_id: string | null
          brand_maker: string | null
          capacity_ml: number | null
          created_at: string | null
          created_by: string | null
          creator_profile_id: string | null
          density_g_ml: number | null
          description: string | null
          dilution_pct: number | null
          family_id: string | null
          generic_id: string | null
          glassware_id: string | null
          hide_from_search: boolean | null
          ice_build: Json | null
          ice_id: string | null
          ice_per_serve_g: number | null
          iced_capacity_ml: number | null
          icon_key: string | null
          icon_url: string | null
          id: string | null
          ingredient_role: string | null
          is_core: boolean | null
          item_type: Database["public"]["Enums"]["entity_type"] | null
          made_from_id: string | null
          method_ice_id: string | null
          name: string | null
          notes: string | null
          origin: string | null
          origin_bar_profile_id: string | null
          picture: Database["public"]["Enums"]["item_picture"] | null
          picture_url: string | null
          price: string | null
          serve_abv: number | null
          serve_ml: number | null
          service_style: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_generic_id_fkey"
            columns: ["generic_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_generic_id_fkey"
            columns: ["generic_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_glassware_id_fkey"
            columns: ["glassware_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_glassware_id_fkey"
            columns: ["glassware_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_ice_id_fkey"
            columns: ["ice_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_ice_id_fkey"
            columns: ["ice_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_made_from_id_fkey"
            columns: ["made_from_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_made_from_id_fkey"
            columns: ["made_from_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_method_ice_id_fkey"
            columns: ["method_ice_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_method_ice_id_fkey"
            columns: ["method_ice_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_origin_bar_profile_id_fkey"
            columns: ["origin_bar_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_recipe_presentation: {
        Row: {
          amount: number | null
          at_service: boolean | null
          created_at: string | null
          display_ingredient_id: string | null
          id: string | null
          ingredient_item_id: string | null
          is_optional: boolean | null
          parent_ingredient_id: string | null
          preparation_notes: string | null
          recipe_item_id: string | null
          sort_order: number | null
          unit: string | null
          display_ingredient: {
            abv: number | null
            abv_source: string
            bar_id: string | null
            brand_maker: string | null
            capacity_ml: number | null
            created_at: string
            created_by: string | null
            creator_profile_id: string | null
            credit_status: Database["public"]["Enums"]["credit_status"] | null
            density_g_ml: number | null
            description: string | null
            dilution_pct: number | null
            family_id: string | null
            generic_id: string | null
            gi: string | null
            glass_model_id: string | null
            glassware_id: string | null
            hide_from_search: boolean
            ice_build: Json | null
            ice_id: string | null
            ice_per_serve_g: number | null
            iced_capacity_ml: number | null
            icon_key: string | null
            icon_url: string | null
            id: string
            ingredient_role: string | null
            is_catalog: boolean
            is_core: boolean
            item_type: Database["public"]["Enums"]["entity_type"]
            lineage_family: string | null
            lineage_note: string | null
            lineage_parent_id: string | null
            lineage_style_id: string | null
            made_from_id: string | null
            maker_profile_id: string | null
            method_ice_id: string | null
            moderated_at: string | null
            name: string
            notes: string | null
            origin: string | null
            origin_bar_profile_id: string | null
            origin_country: string | null
            origin_year: number | null
            origin_year_approx: boolean
            origin_year_guess: string | null
            override_generic_ingredient_level: number | null
            override_measurement_level: number | null
            override_prep_level: number | null
            override_specific_brand_level: number | null
            override_visibility_level: number | null
            picture: Database["public"]["Enums"]["item_picture"]
            price: string | null
            publish_mode:
              | Database["public"]["Enums"]["item_publish_mode"]
              | null
            published_at: string | null
            riff_of_id: string | null
            serve_abv: number | null
            serve_ml: number | null
            service_style: string | null
            sketch_liquid: string | null
            sketch_variant: string | null
            spec_from_id: string | null
            spec_source: string
            status: string | null
          } | null
          published_ingredient: {
            abv: number | null
            bar_id: string | null
            creator_profile_id: string | null
            credit_status: Database["public"]["Enums"]["credit_status"] | null
            description: string | null
            family_id: string | null
            glassware_id: string | null
            ice_id: string | null
            icon_key: string | null
            icon_url: string | null
            id: string | null
            image_is_generated: boolean | null
            image_url: string | null
            is_reference: boolean | null
            is_shared: boolean | null
            item_type: Database["public"]["Enums"]["entity_type"] | null
            name: string | null
            origin: string | null
            origin_bar_profile_id: string | null
            origin_year: number | null
            publish_mode:
              | Database["public"]["Enums"]["item_publish_mode"]
              | null
            published_at: string | null
            riff_of_id: string | null
          } | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_recipe_item_id_fkey"
            columns: ["recipe_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_recipe_item_id_fkey"
            columns: ["recipe_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_drink_runs: {
        Row: {
          edition_id: string | null
          edition_name: string | null
          editions: number | null
          end_month: number | null
          end_year: number | null
          is_current: boolean | null
          item_id: string | null
          profile_id: string | null
          start_month: number | null
          start_year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_menu_edition_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_menu_edition_drinks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_menu_editions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      published_items: {
        Row: {
          abv: number | null
          bar_id: string | null
          creator_profile_id: string | null
          credit_status: Database["public"]["Enums"]["credit_status"] | null
          description: string | null
          family_id: string | null
          glassware_id: string | null
          ice_id: string | null
          icon_key: string | null
          icon_url: string | null
          id: string | null
          image_is_generated: boolean | null
          image_url: string | null
          is_reference: boolean | null
          is_shared: boolean | null
          item_type: Database["public"]["Enums"]["entity_type"] | null
          name: string | null
          origin: string | null
          origin_bar_profile_id: string | null
          origin_year: number | null
          publish_mode: Database["public"]["Enums"]["item_publish_mode"] | null
          published_at: string | null
          riff_of_id: string | null
        }
        Relationships: []
      }
      rank_entry_scores: {
        Row: {
          created_at: string | null
          had_on: string | null
          id: string | null
          item_id: string | null
          rank_key: number | null
          ranked_as_item_id: string | null
          score: number | null
          sentiment: Database["public"]["Enums"]["rank_sentiment"] | null
          user_id: string | null
          venue_profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rank_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_ranked_as_item_id_fkey"
            columns: ["ranked_as_item_id"]
            isOneToOne: false
            referencedRelation: "app_item_presentation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_ranked_as_item_id_fkey"
            columns: ["ranked_as_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_entries_venue_profile_id_fkey"
            columns: ["venue_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_bar_invite: {
        Args: { p_bar_id: string }
        Returns: {
          bar_id: string
          created_at: string
          id: string
          role_level: number
          role_since: string
          user_id: string
          venue_role_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_bars"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_profile_position: {
        Args: { p_id: string }
        Returns: {
          added_in_app: boolean
          bar_accepted: boolean
          bar_profile_id: string
          created_at: string
          end_month: number | null
          end_year: number | null
          id: string
          is_current: boolean
          is_hidden: boolean
          is_shown: boolean
          person_accepted: boolean
          person_profile_id: string
          source_url: string | null
          start_month: number | null
          start_year: number | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "profile_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_user_to_bar_by_email: {
        Args: {
          p_bar_id: string
          p_email: string
          p_name?: string
          p_role_level: number
        }
        Returns: {
          bar_id: string
          created_at: string
          id: string
          role_level: number
          role_since: string
          user_id: string
          venue_role_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_bars"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_venue: {
        Args: {
          p_address_line: string
          p_city: string
          p_country_code: string
          p_latitude: number
          p_locality?: string
          p_longitude: number
          p_name: string
          p_postcode?: string
          p_region?: string
        }
        Returns: {
          address_line: string | null
          avatar_url: string | null
          awards_mode: string
          bar_id: string | null
          bar_type: string | null
          bars_mode: string
          bio: string | null
          city: string | null
          claimed_at: string | null
          closed_year: number | null
          country_code: string | null
          created_at: string
          created_by: string | null
          display_name: string
          had_mode: string
          handle: string
          headline_position_id: string | null
          hours: Json | null
          hours_updated_at: string | null
          id: string
          instagram: string | null
          is_claimed: boolean | null
          is_closed: boolean
          is_public: boolean
          kind: Database["public"]["Enums"]["profile_kind"]
          latitude: number | null
          locality: string | null
          longitude: number | null
          made_mode: string
          makes: string[]
          moderated_at: string | null
          opened_year: number | null
          page_visibility:
            | Database["public"]["Enums"]["bar_page_visibility"]
            | null
          part_of_profile_id: string | null
          phone: string | null
          postcode: string | null
          region: string | null
          serves: string[]
          shares_bars: boolean
          shares_made: boolean
          shares_rankings: boolean
          shows_city: boolean
          shows_dates: boolean
          shows_photo: boolean
          social_links: string[] | null
          supplies: string[]
          tagline: string | null
          timezone: string | null
          user_id: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      am_i_moderator: { Args: never; Returns: boolean }
      answer_join_request: {
        Args: { p_accept: boolean; p_id: string }
        Returns: undefined
      }
      approve_profile_claim: {
        Args: { p_claim_id: string; p_code?: string }
        Returns: {
          address_line: string | null
          avatar_url: string | null
          awards_mode: string
          bar_id: string | null
          bar_type: string | null
          bars_mode: string
          bio: string | null
          city: string | null
          claimed_at: string | null
          closed_year: number | null
          country_code: string | null
          created_at: string
          created_by: string | null
          display_name: string
          had_mode: string
          handle: string
          headline_position_id: string | null
          hours: Json | null
          hours_updated_at: string | null
          id: string
          instagram: string | null
          is_claimed: boolean | null
          is_closed: boolean
          is_public: boolean
          kind: Database["public"]["Enums"]["profile_kind"]
          latitude: number | null
          locality: string | null
          longitude: number | null
          made_mode: string
          makes: string[]
          moderated_at: string | null
          opened_year: number | null
          page_visibility:
            | Database["public"]["Enums"]["bar_page_visibility"]
            | null
          part_of_profile_id: string | null
          phone: string | null
          postcode: string | null
          region: string | null
          serves: string[]
          shares_bars: boolean
          shares_made: boolean
          shares_rankings: boolean
          shows_city: boolean
          shows_dates: boolean
          shows_photo: boolean
          social_links: string[] | null
          supplies: string[]
          tagline: string | null
          timezone: string | null
          user_id: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_generated_item_image: {
        Args: {
          p_item_id: string
          p_job_revision?: number
          p_spec_fingerprint?: string
          p_url: string
        }
        Returns: string
      }
      bar_brands: {
        Args: { p_profile_ids: string[] }
        Returns: {
          accent_light_color: string
          display_face: Database["public"]["Enums"]["venue_display_face"]
          logo_url: string
          primary_color: string
          profile_id: string
          short_name: string
        }[]
      }
      bar_claim_verified: { Args: { p_bar_id: string }; Returns: boolean }
      bar_week: {
        Args: { p_bar_id: string; p_days?: number; p_from: string }
        Returns: {
          bar_color: string
          bar_id: string
          bar_name: string
          bar_profile_id: string
          description: string
          drink_count: number
          ends_at: string
          event_kind: string
          glass_key: string
          guest_count: number
          guest_name: string
          guest_profile_id: string
          house_menu_on: boolean
          id: string
          image_url: string
          is_public: boolean
          kind: string
          menu_id: string
          name: string
          starts_at: string
          ticket_url: string
        }[]
      }
      can_edit_item: { Args: { p_item_id: string }; Returns: boolean }
      check_maker_photo: {
        Args: { p_item_id: string; p_keep: boolean }
        Returns: undefined
      }
      claim_item_flavor_job: {
        Args: never
        Returns: {
          item_id: string
          revision: number
          spec_fingerprint: string
        }[]
      }
      claim_item_image_job: {
        Args: never
        Returns: {
          item_id: string
          revision: number
          spec_fingerprint: string
        }[]
      }
      confirm_age: {
        Args: { p_birth_date: string; p_country_code: string }
        Returns: number
      }
      confirm_item_photos: { Args: { p_item_id: string }; Returns: undefined }
      confirm_maker_credit: {
        Args: { p_item_id: string; p_makes: string; p_profile_id: string }
        Returns: string
      }
      confirm_person_claim: {
        Args: { p_claim_id: string }
        Returns: {
          address_line: string | null
          avatar_url: string | null
          awards_mode: string
          bar_id: string | null
          bar_type: string | null
          bars_mode: string
          bio: string | null
          city: string | null
          claimed_at: string | null
          closed_year: number | null
          country_code: string | null
          created_at: string
          created_by: string | null
          display_name: string
          had_mode: string
          handle: string
          headline_position_id: string | null
          hours: Json | null
          hours_updated_at: string | null
          id: string
          instagram: string | null
          is_claimed: boolean | null
          is_closed: boolean
          is_public: boolean
          kind: Database["public"]["Enums"]["profile_kind"]
          latitude: number | null
          locality: string | null
          longitude: number | null
          made_mode: string
          makes: string[]
          moderated_at: string | null
          opened_year: number | null
          page_visibility:
            | Database["public"]["Enums"]["bar_page_visibility"]
            | null
          part_of_profile_id: string | null
          phone: string | null
          postcode: string | null
          region: string | null
          serves: string[]
          shares_bars: boolean
          shares_made: boolean
          shares_rankings: boolean
          shows_city: boolean
          shows_dates: boolean
          shows_photo: boolean
          social_links: string[] | null
          supplies: string[]
          tagline: string | null
          timezone: string | null
          user_id: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_ai_quota: {
        Args: { p_daily_limit: number; p_fn: string; p_user_id: string }
        Returns: boolean
      }
      consume_item_ai_quota: {
        Args: {
          p_fn: string
          p_item_id: string
          p_user_daily_limit: number
          p_venue_daily_limit: number
        }
        Returns: string
      }
      create_new_bar: {
        Args: {
          p_generic: number
          p_measurement: number
          p_name: string
          p_prep: number
          p_specific: number
          p_visibility: number
        }
        Returns: {
          accent_light_color: string | null
          accent_text: string | null
          created_at: string
          currency: string | null
          default_generic_ingredient_level: number
          default_measurement_level: number
          default_prep_level: number
          default_publish_mode: Database["public"]["Enums"]["item_publish_mode"]
          default_specific_brand_level: number
          default_visibility_level: number
          dilution_defaults: Json | null
          display_face: Database["public"]["Enums"]["venue_display_face"]
          enabled_features: string[]
          ground_tint: string | null
          icon_background: string | null
          icon_url: string | null
          id: string
          logo_url: string | null
          min_profit_minor: number | null
          name: string
          page_visibility: Database["public"]["Enums"]["bar_page_visibility"]
          page_visibility_changed_at: string | null
          prices_include_tax: boolean
          primary_color: string | null
          secondary_color: string | null
          short_name: string | null
          show_spec_changes: boolean
          slug: string
          target_gp: number | null
          tax_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "bars"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_profile_position: { Args: { p_id: string }; Returns: undefined }
      discover_bars: {
        Args: {
          p_city?: string
          p_country_code?: string
          p_east?: number
          p_latitude?: number
          p_longitude?: number
          p_north?: number
          p_notes?: string[]
          p_on_now?: boolean
          p_query?: string
          p_radius_km?: number
          p_south?: number
          p_spirits?: string[]
          p_styles?: string[]
          p_west?: number
        }
        Returns: {
          avatar_url: string
          brand_accent: string
          brand_face: string
          city: string
          closed_year: number
          country_code: string
          display_name: string
          drinks: number
          handle: string
          id: string
          is_closed: boolean
          latitude: number
          locality: string
          longitude: number
          on_now: number
        }[]
      }
      discover_drink_rankings: {
        Args: {
          p_city?: string
          p_country_code?: string
          p_latitude?: number
          p_limit?: number
          p_longitude?: number
          p_radius_km?: number
          p_ranked_as_item_id: string
        }
        Returns: {
          city: string
          display_name: string
          distance_km: number
          handle: string
          is_early: boolean
          latitude: number
          locality: string
          longitude: number
          position: number
          rankers: number
          score: number
          venue_profile_id: string
        }[]
      }
      discover_drinks: {
        Args: {
          p_after?: string
          p_before?: string
          p_city?: string
          p_country_code?: string
          p_latitude?: number
          p_limit?: number
          p_longitude?: number
          p_query?: string
          p_radius_km?: number
        }
        Returns: {
          bar_profile_id: string
          description: string
          id: string
          image_url: string
          ingredients: string[]
          menu_run: number[]
          name: string
          notes: string[]
          riff_of: string
        }[]
      }
      discover_fold: { Args: { p_text: string }; Returns: string }
      discover_list: {
        Args: {
          p_after_distance?: number
          p_after_id?: string
          p_after_name?: string
          p_after_pos?: number
          p_after_rank?: number
          p_bar_id?: string
          p_city?: string
          p_country_code?: string
          p_from_latitude?: number
          p_from_longitude?: number
          p_latitude?: number
          p_limit?: number
          p_longitude?: number
          p_mix?: boolean
          p_notes?: string[]
          p_on_now?: boolean
          p_query?: string
          p_radius_km?: number
          p_spirits?: string[]
          p_styles?: string[]
        }
        Returns: {
          bar_city: string
          bar_handle: string
          bar_locality: string
          bar_logo: string
          bar_name: string
          bar_profile_id: string
          description: string
          distance_m: number
          id: string
          image_url: string
          match_kind: string
          match_text: string
          menu_run: number[]
          mix_pos: number
          name: string
          rank: number
          styles: string[]
          total_bars: number
          total_drinks: number
        }[]
      }
      discover_top_bars: {
        Args: {
          p_city?: string
          p_country_code?: string
          p_latitude?: number
          p_limit?: number
          p_longitude?: number
          p_radius_km?: number
        }
        Returns: {
          city: string
          display_name: string
          distance_km: number
          drinks: number
          handle: string
          is_early: boolean
          latitude: number
          locality: string
          longitude: number
          position: number
          rankers: number
          score: number
          venue_profile_id: string
        }[]
      }
      display_ingredient: {
        Args: {
          "": Database["public"]["Views"]["app_recipe_presentation"]["Row"]
        }
        Returns: {
          abv: number | null
          abv_source: string
          bar_id: string | null
          brand_maker: string | null
          capacity_ml: number | null
          created_at: string
          created_by: string | null
          creator_profile_id: string | null
          credit_status: Database["public"]["Enums"]["credit_status"] | null
          density_g_ml: number | null
          description: string | null
          dilution_pct: number | null
          family_id: string | null
          generic_id: string | null
          gi: string | null
          glass_model_id: string | null
          glassware_id: string | null
          hide_from_search: boolean
          ice_build: Json | null
          ice_id: string | null
          ice_per_serve_g: number | null
          iced_capacity_ml: number | null
          icon_key: string | null
          icon_url: string | null
          id: string
          ingredient_role: string | null
          is_catalog: boolean
          is_core: boolean
          item_type: Database["public"]["Enums"]["entity_type"]
          lineage_family: string | null
          lineage_note: string | null
          lineage_parent_id: string | null
          lineage_style_id: string | null
          made_from_id: string | null
          maker_profile_id: string | null
          method_ice_id: string | null
          moderated_at: string | null
          name: string
          notes: string | null
          origin: string | null
          origin_bar_profile_id: string | null
          origin_country: string | null
          origin_year: number | null
          origin_year_approx: boolean
          origin_year_guess: string | null
          override_generic_ingredient_level: number | null
          override_measurement_level: number | null
          override_prep_level: number | null
          override_specific_brand_level: number | null
          override_visibility_level: number | null
          picture: Database["public"]["Enums"]["item_picture"]
          price: string | null
          publish_mode: Database["public"]["Enums"]["item_publish_mode"] | null
          published_at: string | null
          riff_of_id: string | null
          serve_abv: number | null
          serve_ml: number | null
          service_style: string | null
          sketch_liquid: string | null
          sketch_variant: string | null
          spec_from_id: string | null
          spec_source: string
          status: string | null
        }
        SetofOptions: {
          from: "app_recipe_presentation"
          to: "items"
          isOneToOne: true
          isSetofReturn: true
        }
      }
      drink_allergens: { Args: { p_item_id: string }; Returns: Json }
      drink_cost: { Args: { p_bar: string; p_item: string }; Returns: Json }
      effective_bar_role: { Args: { real_role: number }; Returns: number }
      end_menu: { Args: { p_menu_id: string }; Returns: undefined }
      finish_bar_item: { Args: { p_item_id: string }; Returns: undefined }
      flavor_baseline: {
        Args: never
        Returns: {
          bitter: number
          botanical: number
          creamy: number
          drinks: number
          fruity: number
          herbal: number
          savory: number
          smoky: number
          sour: number
          spiced: number
          spicy: number
          strong: number
          sweet: number
        }[]
      }
      get_bar_classics: {
        Args: { p_bar_id: string }
        Returns: {
          ask_name: string
          classic_name: string
          open_id: string
          sort_rank: number
        }[]
      }
      get_bar_members: {
        Args: { p_bar_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          email: string
          joined_at: string
          role_ends_at: string
          role_level: number
          role_since: string
          user_id: string
          venue_role_id: string
          venue_role_name: string
        }[]
      }
      get_bar_top_drinks: {
        Args: { p_limit?: number; p_profile_id: string }
        Returns: {
          bar_id: string
          image_is_generated: boolean
          image_url: string
          item_id: string
          menu: string
          menu_from: number
          menu_to: number
          name: string
          position: number
          ranked_as_item_id: string
          ranked_as_name: string
          rankers: number
          score: number
        }[]
      }
      get_drink_photos: {
        Args: { p_item_id: string; p_limit?: number }
        Returns: {
          created_at: string
          id: string
          image_url: string
          is_mine: boolean
          poster_avatar_url: string
          poster_handle: string
          poster_name: string
          score: number
        }[]
      }
      get_drink_rankings: {
        Args: {
          p_city?: string
          p_country_code?: string
          p_limit?: number
          p_postcode?: string
          p_ranked_as_item_id: string
        }
        Returns: {
          city: string
          display_name: string
          handle: string
          locality: string
          position: number
          rankers: number
          score: number
          venue_profile_id: string
        }[]
      }
      get_item_flavor_spec: { Args: { p_item_id: string }; Returns: Json }
      get_item_scores: {
        Args: { p_item_ids: string[] }
        Returns: {
          item_id: string
          rankers: number
          score: number
        }[]
      }
      get_item_sketch_context: { Args: { p_item_id: string }; Returns: Json }
      get_menu_editions: {
        Args: { p_profile_id: string }
        Returns: {
          drinks: Json
          end_month: number
          end_year: number
          from_venue: boolean
          id: string
          is_current: boolean
          month: number
          name: string
          source_url: string
          theme: string
          year: number
        }[]
      }
      get_my_age_check: { Args: never; Returns: string }
      get_my_blocks: {
        Args: never
        Returns: {
          avatar_url: string
          blocked_at: string
          blocked_id: string
          display_name: string
          handle: string
          profile_id: string
        }[]
      }
      get_pair_drinks: {
        Args: { p_a: string; p_b: string; p_limit?: number }
        Returns: {
          id: string
          is_catalog: boolean
          name: string
        }[]
      }
      get_pair_note: { Args: { p_a: string; p_b: string }; Returns: string }
      get_pairings: {
        Args: { p_era?: string; p_ids: string[]; p_limit?: number }
        Returns: {
          drinks: number
          item_id: string
          name: string
          score: number
          together: number[]
        }[]
      }
      get_people_heroes: {
        Args: { p_item_ids: string[] }
        Returns: {
          image_url: string
          item_id: string
        }[]
      }
      get_profile_bars: {
        Args: { p_profile_id: string }
        Returns: {
          average: number
          best_name: string
          best_score: number
          drinks: number
          venue_avatar_url: string
          venue_city: string
          venue_handle: string
          venue_id: string
          venue_locality: string
          venue_name: string
        }[]
      }
      get_profile_drinks: {
        Args: { p_profile_id: string }
        Returns: {
          at_bar: boolean
          created_at: string
          had_on: string
          id: string
          image_is_generated: boolean
          image_url: string
          item_id: string
          list_name: string
          name: string
          pin: number
          score: number
          sentiment: Database["public"]["Enums"]["rank_sentiment"]
          venue_avatar_url: string
          venue_city: string
          venue_handle: string
          venue_id: string
          venue_locality: string
          venue_name: string
        }[]
      }
      get_profile_made: {
        Args: { p_profile_id: string }
        Returns: {
          id: string
          image_is_generated: boolean
          image_url: string
          item_id: string
          made_on: string
          name: string
          note: string
          photo_url: string
        }[]
      }
      get_profile_name_credits: {
        Args: { p_profile_id: string }
        Returns: {
          bar_handle: string
          bar_name: string
          bar_profile_id: string
          item_id: string
          name: string
        }[]
      }
      get_report_queue: {
        Args: { p_limit?: number; p_open?: boolean }
        Returns: {
          comment_id: string
          created_at: string
          details: string
          id: string
          item_id: string
          photo_id: string
          photo_url: string
          profile_id: string
          reason: Database["public"]["Enums"]["report_reason"]
          release_id: string
          resolution: string
          reviewed_at: string
          status: Database["public"]["Enums"]["report_status"]
          target_detail: string
          target_hidden: boolean
          target_kind: Database["public"]["Enums"]["report_target"]
          target_name: string
        }[]
      }
      get_venue_branding: {
        Args: { p_slug: string }
        Returns: {
          accent_light_color: string
          display_face: Database["public"]["Enums"]["venue_display_face"]
          ground_tint: string
          icon_background: string
          icon_url: string
          id: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          short_name: string
          slug: string
        }[]
      }
      get_venue_role_matrix: {
        Args: { p_bar_id: string }
        Returns: {
          base_level: number
          capabilities: Database["public"]["Enums"]["venue_capability"][]
          ends_at: string
          granted: Database["public"]["Enums"]["venue_capability"][]
          name: string
          revoked: Database["public"]["Enums"]["venue_capability"][]
          role_id: string
          starts_with: Database["public"]["Enums"]["venue_capability"][]
        }[]
      }
      get_venue_score: {
        Args: { p_venue_profile_id: string }
        Returns: {
          drinks: number
          is_early: boolean
          rankers: number
          score: number
        }[]
      }
      ingredient_key: { Args: { p_name: string }; Returns: string }
      ingredient_used_in: {
        Args: { p_ingredient_id: string; p_limit?: number }
        Returns: {
          id: string
          image_is_generated: boolean
          image_url: string
          name: string
        }[]
      }
      is_card_public: { Args: { p_item_id: string }; Returns: boolean }
      is_made_log_shown: { Args: { p_made_id: string }; Returns: boolean }
      is_spec_locked: { Args: { p_item_id: string }; Returns: boolean }
      join_requests: {
        Args: { p_bar_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          id: string
          name: string
          profile_handle: string
          user_id: string
        }[]
      }
      maker_bottle_photos: {
        Args: { p_profile_id: string }
        Returns: {
          checked: boolean
          item_id: string
          url: string
        }[]
      }
      maker_credit_requests: {
        Args: { p_bar_id: string }
        Returns: {
          created_at: string
          credited_by: string
          drink_name: string
          item_id: string
          makes: string
          profile_id: string
        }[]
      }
      maker_photos_waiting: {
        Args: never
        Returns: {
          added_at: string
          item_id: string
          maker_handle: string
          maker_id: string
          maker_name: string
          name: string
          url: string
        }[]
      }
      menu_name_key: { Args: { p_name: string }; Returns: string }
      merge_ingredients: {
        Args: { p_from: string; p_into: string }
        Returns: undefined
      }
      merged_profile_handle: { Args: { p_ref: string }; Returns: string }
      my_bar_drinks: {
        Args: {
          p_after_id?: string
          p_after_name?: string
          p_limit?: number
          p_two_away?: boolean
        }
        Returns: {
          from_logo: string
          from_name: string
          glassware_id: string
          id: string
          image_url: string
          missing_id: string
          missing_name: string
          missing2_id: string
          missing2_name: string
          name: string
          served_at: Json
          served_count: number
          spec_match: string
          spec_note: Json
          uses: string[]
        }[]
      }
      my_bar_invites: {
        Args: never
        Returns: {
          bar_color: string
          bar_display_face: string
          bar_ground_tint: string
          bar_id: string
          bar_logo_url: string
          bar_name: string
          bar_profile_id: string
          bar_slug: string
          created_at: string
          held: boolean
          id: string
          invited_by_name: string
          name: string
          role_level: number
        }[]
      }
      my_bar_preps: {
        Args: never
        Returns: {
          drinks: string[]
          id: string
          name: string
        }[]
      }
      my_bar_preps_short: {
        Args: never
        Returns: {
          drinks: string[]
          id: string
          missing_id: string
          missing_name: string
          name: string
        }[]
      }
      my_capabilities: {
        Args: { p_bar_id: string }
        Returns: Database["public"]["Enums"]["venue_capability"][]
      }
      my_hidden_city: { Args: never; Returns: string }
      my_ranked_drink_names: {
        Args: { p_item_ids: string[] }
        Returns: {
          item_id: string
          name: string
        }[]
      }
      my_saved_venue_menus: {
        Args: never
        Returns: {
          display_name: string
          drinks: Json
          end_month: number
          end_year: number
          handle: string
          is_current: boolean
          menu_id: string
          month: number
          name: string
          profile_id: string
          saved_at: string
          year: number
        }[]
      }
      my_week: {
        Args: { p_days?: number; p_from: string }
        Returns: {
          bar_color: string
          bar_id: string
          bar_name: string
          bar_profile_id: string
          description: string
          drink_count: number
          ends_at: string
          event_kind: string
          glass_key: string
          guest_count: number
          guest_name: string
          guest_profile_id: string
          house_menu_on: boolean
          id: string
          image_url: string
          is_public: boolean
          kind: string
          menu_id: string
          name: string
          starts_at: string
          ticket_url: string
        }[]
      }
      near_score: { Args: { p_name: string; p_query: string }; Returns: number }
      next_pair_notes: {
        Args: { p_limit?: number }
        Returns: {
          a_id: string
          a_name: string
          b_id: string
          b_name: string
          drinks: string[]
          together: number
        }[]
      }
      person_claims_to_confirm: {
        Args: { p_bar_id: string }
        Returns: {
          claimant_handle: string
          claimant_name: string
          created_at: string
          id: string
          page_handle: string
          page_id: string
          page_name: string
        }[]
      }
      pin_profile_drink: {
        Args: { p_entry_id: string; p_pin: boolean }
        Returns: string
      }
      position_requests: {
        Args: never
        Returns: {
          bar_name: string
          bar_profile_id: string
          created_at: string
          id: string
          is_current: boolean
          person_avatar_url: string
          person_handle: string
          person_is_public: boolean
          person_name: string
          person_profile_id: string
          title: string
          venue_id: string
        }[]
      }
      prepare_account_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      public_drink_ingredients: {
        Args: { p_item_ids: string[] }
        Returns: {
          brand: boolean
          item_id: string
          name: string
          sort_order: number
        }[]
      }
      public_lineage_parent: { Args: { p_item_id: string }; Returns: string }
      public_spec_changes: {
        Args: { p_item: string }
        Returns: {
          created_at: string
          snapshot: Json
          version: number
        }[]
      }
      published_ingredient: {
        Args: {
          "": Database["public"]["Views"]["app_recipe_presentation"]["Row"]
        }
        Returns: {
          abv: number | null
          bar_id: string | null
          creator_profile_id: string | null
          credit_status: Database["public"]["Enums"]["credit_status"] | null
          description: string | null
          family_id: string | null
          glassware_id: string | null
          ice_id: string | null
          icon_key: string | null
          icon_url: string | null
          id: string | null
          image_is_generated: boolean | null
          image_url: string | null
          is_reference: boolean | null
          is_shared: boolean | null
          item_type: Database["public"]["Enums"]["entity_type"] | null
          name: string | null
          origin: string | null
          origin_bar_profile_id: string | null
          origin_year: number | null
          publish_mode: Database["public"]["Enums"]["item_publish_mode"] | null
          published_at: string | null
          riff_of_id: string | null
        }
        SetofOptions: {
          from: "app_recipe_presentation"
          to: "published_items"
          isOneToOne: true
          isSetofReturn: true
        }
      }
      refresh_my_profile_photo: { Args: never; Returns: undefined }
      refund_ai_quota: {
        Args: { p_bar_id: string; p_fn: string; p_user_id: string }
        Returns: undefined
      }
      refund_item_ai_quota: {
        Args: { p_fn: string; p_item_id: string }
        Returns: undefined
      }
      release_item_flavor_job: {
        Args: {
          p_error?: string
          p_item_id: string
          p_outcome: string
          p_revision: number
        }
        Returns: undefined
      }
      release_item_image_job: {
        Args: {
          p_error?: string
          p_item_id: string
          p_outcome: string
          p_revision: number
        }
        Returns: undefined
      }
      remove_venue_ice: { Args: { p_id: string }; Returns: undefined }
      replace_recipe_lines: {
        Args: { p_item: string; p_lines: Json }
        Returns: undefined
      }
      request_to_join_venue: {
        Args: { p_bar_profile_id: string }
        Returns: {
          bar_id: string
          created_at: string
          declined_at: string | null
          id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "venue_join_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_ingredient: { Args: { p_name: string }; Returns: string }
      resolve_report: {
        Args: {
          p_hide?: boolean
          p_report_id: string
          p_resolution?: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: {
          comment_id: string | null
          created_at: string
          details: string | null
          id: string
          item_id: string | null
          photo_id: string | null
          profile_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          release_id: string | null
          reporter_id: string | null
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_kind: Database["public"]["Enums"]["report_target"]
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_drink_version: {
        Args: { p_item: string; p_version: number }
        Returns: number
      }
      save_claim_setup: {
        Args: { p_claim_id: string; p_setup: Json }
        Returns: {
          bar_id: string | null
          code: string | null
          created_at: string
          decline_reason: string | null
          evidence: Json | null
          id: string
          message: string | null
          method: Database["public"]["Enums"]["claim_method"]
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          setup: Json | null
          status: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profile_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_drink_spec:
        | {
            Args: {
              p_item: string
              p_lines: Json
              p_method_id: string
              p_note: string
            }
            Returns: number
          }
        | {
            Args: {
              p_item: string
              p_lines: Json
              p_method_ids: string[]
              p_note: string
            }
            Returns: number
          }
      save_item_flavor: {
        Args: {
          p_coverage: number
          p_ingredients?: Json
          p_item_id: string
          p_job_revision?: number
          p_profile: Json
          p_rules_version: number
          p_source: string
          p_spec_fingerprint: string
        }
        Returns: undefined
      }
      save_item_sketch: {
        Args: {
          p_ai_answer?: Json
          p_ai_basis?: string
          p_inputs: Json
          p_item_id: string
          p_rules_version: number
          p_source: string
          p_spec_fingerprint: string
        }
        Returns: undefined
      }
      save_maker_sketch: {
        Args: { p_inputs: Json; p_item_id: string }
        Returns: boolean
      }
      save_menu: {
        Args: {
          p_cover_position: number
          p_cover_url: string
          p_menu_id: string
          p_name: string
          p_sections: Json
        }
        Returns: undefined
      }
      save_pair_notes: { Args: { p_notes: Json }; Returns: number }
      save_spelling: {
        Args: { p_item_id: string; p_typed: string }
        Returns: boolean
      }
      save_venue_ice: {
        Args: {
          p_bar_id: string
          p_clear?: boolean
          p_draw_as?: string
          p_frozen_inside?: string
          p_id?: string
          p_length_mm?: number
          p_machine?: string
          p_name: string
          p_note?: string
          p_shape: string
          p_size_mm?: number
          p_source?: string
          p_stamped?: boolean
          p_supplier_id?: string
        }
        Returns: string
      }
      schedule_menu: {
        Args: {
          p_menu_id: string
          p_replace_menu_ids?: string[]
          p_starts_at?: string
        }
        Returns: undefined
      }
      search_bar_drinks: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          credit: string
          edition_id: string
          edition_name: string
          end_month: number
          end_year: number
          is_current: boolean
          item_id: string
          start_month: number
          start_year: number
        }[]
      }
      search_glass_models: {
        Args: { p_glass?: string; p_limit?: number; p_query: string }
        Returns: {
          aliases: string[]
          capacity_as_stated: string | null
          capacity_ml: number | null
          created_at: string
          designer: string | null
          discontinued: boolean
          glass: string
          height_mm: number | null
          id: string
          maker_profile_id: string
          material: string | null
          model_code: string | null
          name: string
          outline: Json | null
          product_url: string | null
          rim_mm: number | null
          series: string | null
          shape_item_id: string | null
          source_urls: string[]
          updated_at: string
          variant: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "glass_models"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_near: {
        Args: {
          p_city?: string
          p_country_code?: string
          p_kinds?: string[]
          p_latitude?: number
          p_limit?: number
          p_longitude?: number
          p_query: string
          p_radius_km?: number
        }
        Returns: {
          handle: string
          id: string
          kind: string
          known: boolean
          name: string
          place: string
          score: number
        }[]
      }
      set_content_hidden: {
        Args: {
          p_hidden: boolean
          p_id: string
          p_kind: Database["public"]["Enums"]["report_target"]
        }
        Returns: undefined
      }
      set_item_picture: {
        Args: {
          p_image_id?: string
          p_item_id: string
          p_picture: Database["public"]["Enums"]["item_picture"]
        }
        Returns: undefined
      }
      set_maker_bottle_picture: {
        Args: {
          p_image_id?: string
          p_item_id: string
          p_picture: Database["public"]["Enums"]["item_picture"]
        }
        Returns: undefined
      }
      set_role_capability: {
        Args: {
          p_bar_id: string
          p_capability: Database["public"]["Enums"]["venue_capability"]
          p_level: number
          p_on: boolean
          p_role_id: string
        }
        Returns: undefined
      }
      set_spec_match: {
        Args: { p_item_id: string; p_spec_match: string }
        Returns: undefined
      }
      set_staff_list_order: {
        Args: { p_bar_id: string; p_item_ids: string[] }
        Returns: undefined
      }
      share_slug: { Args: { p_id: string; p_kind: string }; Returns: string }
      share_target: {
        Args: { p_kind: string; p_slug: string }
        Returns: string
      }
      shared_menu: { Args: { p_menu_id: string }; Returns: Json }
      spec_matches: {
        Args: { p_item_ids: string[] }
        Returns: {
          classic_id: string
          item_id: string
          notes: Json
          spec_match: string
        }[]
      }
      start_bar_claim: {
        Args: {
          p_bar_id?: string
          p_code?: string
          p_instagram?: string
          p_method: Database["public"]["Enums"]["claim_method"]
          p_note?: string
          p_phone?: string
          p_profile_id: string
          p_website?: string
        }
        Returns: {
          bar_id: string | null
          code: string | null
          created_at: string
          decline_reason: string | null
          evidence: Json | null
          id: string
          message: string | null
          method: Database["public"]["Enums"]["claim_method"]
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          setup: Json | null
          status: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profile_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_person_claim: {
        Args: {
          p_code?: string
          p_confirm_bar?: string
          p_method?: Database["public"]["Enums"]["claim_method"]
          p_note?: string
          p_profile_id: string
        }
        Returns: {
          bar_id: string | null
          code: string | null
          created_at: string
          decline_reason: string | null
          evidence: Json | null
          id: string
          message: string | null
          method: Database["public"]["Enums"]["claim_method"]
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          setup: Json | null
          status: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profile_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stock_on_hand: {
        Args: { p_bar: string }
        Returns: {
          amount: number
          counted_at: string
          item_id: string
          location_id: string
          unit: string
        }[]
      }
      take_invite_email_slot: {
        Args: { p_bar_id: string; p_email: string; p_sender: string }
        Returns: string
      }
      top_ranked_classics: {
        Args: { p_limit?: number }
        Returns: {
          item_id: string
          rankers: number
        }[]
      }
      undo_bring_in: { Args: { p_batch: string }; Returns: Json }
      update_bar_settings: {
        Args: {
          p_bar_id: string
          p_generic: number
          p_logo_url?: string
          p_measurement: number
          p_name: string
          p_prep: number
          p_primary_color?: string
          p_secondary_color?: string
          p_specific: number
          p_visibility: number
        }
        Returns: {
          accent_light_color: string | null
          accent_text: string | null
          created_at: string
          currency: string | null
          default_generic_ingredient_level: number
          default_measurement_level: number
          default_prep_level: number
          default_publish_mode: Database["public"]["Enums"]["item_publish_mode"]
          default_specific_brand_level: number
          default_visibility_level: number
          dilution_defaults: Json | null
          display_face: Database["public"]["Enums"]["venue_display_face"]
          enabled_features: string[]
          ground_tint: string | null
          icon_background: string | null
          icon_url: string | null
          id: string
          logo_url: string | null
          min_profit_minor: number | null
          name: string
          page_visibility: Database["public"]["Enums"]["bar_page_visibility"]
          page_visibility_changed_at: string | null
          prices_include_tax: boolean
          primary_color: string | null
          secondary_color: string | null
          short_name: string | null
          show_spec_changes: boolean
          slug: string
          target_gp: number | null
          tax_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "bars"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      venue_ice: {
        Args: { p_bar_id: string }
        Returns: {
          clear: boolean
          draw_as: string
          frozen_inside: string
          id: string
          length_mm: number
          machine: string
          name: string
          note: string
          shape: string
          size_mm: number
          source: string
          stamped: boolean
          supplier_id: string
          supplier_name: string
        }[]
      }
      week_event: {
        Args: { p_event_id: string }
        Returns: {
          bar_color: string
          bar_id: string
          bar_name: string
          bar_profile_id: string
          description: string
          drink_count: number
          ends_at: string
          event_kind: string
          glass_key: string
          guest_count: number
          guest_name: string
          guest_profile_id: string
          house_menu_on: boolean
          id: string
          image_url: string
          is_public: boolean
          kind: string
          menu_id: string
          name: string
          starts_at: string
          ticket_url: string
        }[]
      }
      week_event_brand: {
        Args: { p_event_id: string }
        Returns: {
          guest_accent: string
          guest_face: string
          guest_tint: string
          host_accent: string
          host_face: string
          host_tint: string
        }[]
      }
      week_event_drinks: {
        Args: { p_event_id: string }
        Returns: {
          description: string
          glass_key: string
          id: string
          image_url: string
          name: string
        }[]
      }
      week_event_staff: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          id: string
          is_guest: boolean
          name: string
          profile_handle: string
          profile_id: string
          sort_order: number
          user_id: string
        }[]
      }
    }
    Enums: {
      allergen:
        | "celery"
        | "gluten"
        | "crustaceans"
        | "eggs"
        | "fish"
        | "lupin"
        | "milk"
        | "molluscs"
        | "mustard"
        | "tree_nuts"
        | "peanuts"
        | "sesame"
        | "soya"
        | "sulphites"
      bar_page_visibility: "private" | "locked" | "description" | "open"
      bar_zone_kind:
        | "shelf"
        | "fridge"
        | "freezer"
        | "speed_rail"
        | "well"
        | "garnish"
        | "glass_rack"
        | "sink"
        | "bar_top"
        | "storeroom"
        | "other"
      claim_method: "note" | "email" | "instagram" | "phone"
      claim_status: "pending" | "approved" | "rejected"
      credit_status: "suggested" | "claimed" | "verified"
      entity_type:
        | "cocktail"
        | "ingredient"
        | "beer"
        | "wine"
        | "glassware"
        | "method"
        | "ice"
        | "family"
      image_angle: "hero" | "side" | "top" | "garnish" | "handoff"
      item_domain:
        | "beer"
        | "wine"
        | "spirit"
        | "ingredient"
        | "cocktail_family"
        | "glassware_style"
      item_picture: "drawing" | "photo" | "none"
      item_publish_mode: "private" | "description" | "spec"
      profile_kind: "person" | "bar" | "maker" | "supplier"
      rank_sentiment: "loved" | "fine" | "disliked"
      report_reason:
        | "spam"
        | "harassment"
        | "hate"
        | "sexual"
        | "violence"
        | "self_harm"
        | "under_age"
        | "impersonation"
        | "misleading"
        | "fake_rankings"
        | "other"
      report_status: "open" | "actioned" | "dismissed"
      report_target:
        | "profile"
        | "item"
        | "release"
        | "comment"
        | "ranking"
        | "photo"
      venue_capability:
        | "menu"
        | "talking_points"
        | "specs"
        | "house_made"
        | "locations"
        | "costs"
        | "edit_drinks"
        | "prep"
        | "photos"
        | "menus"
        | "publish"
        | "staff"
        | "brand"
      venue_display_face:
        | "instrument_serif"
        | "fraunces"
        | "bricolage_grotesque"
        | "playfair_display"
        | "josefin_sans"
        | "tenor_sans"
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
      allergen: [
        "celery",
        "gluten",
        "crustaceans",
        "eggs",
        "fish",
        "lupin",
        "milk",
        "molluscs",
        "mustard",
        "tree_nuts",
        "peanuts",
        "sesame",
        "soya",
        "sulphites",
      ],
      bar_page_visibility: ["private", "locked", "description", "open"],
      bar_zone_kind: [
        "shelf",
        "fridge",
        "freezer",
        "speed_rail",
        "well",
        "garnish",
        "glass_rack",
        "sink",
        "bar_top",
        "storeroom",
        "other",
      ],
      claim_method: ["note", "email", "instagram", "phone"],
      claim_status: ["pending", "approved", "rejected"],
      credit_status: ["suggested", "claimed", "verified"],
      entity_type: [
        "cocktail",
        "ingredient",
        "beer",
        "wine",
        "glassware",
        "method",
        "ice",
        "family",
      ],
      image_angle: ["hero", "side", "top", "garnish", "handoff"],
      item_domain: [
        "beer",
        "wine",
        "spirit",
        "ingredient",
        "cocktail_family",
        "glassware_style",
      ],
      item_picture: ["drawing", "photo", "none"],
      item_publish_mode: ["private", "description", "spec"],
      profile_kind: ["person", "bar", "maker", "supplier"],
      rank_sentiment: ["loved", "fine", "disliked"],
      report_reason: [
        "spam",
        "harassment",
        "hate",
        "sexual",
        "violence",
        "self_harm",
        "under_age",
        "impersonation",
        "misleading",
        "fake_rankings",
        "other",
      ],
      report_status: ["open", "actioned", "dismissed"],
      report_target: [
        "profile",
        "item",
        "release",
        "comment",
        "ranking",
        "photo",
      ],
      venue_capability: [
        "menu",
        "talking_points",
        "specs",
        "house_made",
        "locations",
        "costs",
        "edit_drinks",
        "prep",
        "photos",
        "menus",
        "publish",
        "staff",
        "brand",
      ],
      venue_display_face: [
        "instrument_serif",
        "fraunces",
        "bricolage_grotesque",
        "playfair_display",
        "josefin_sans",
        "tenor_sans",
      ],
    },
  },
} as const

