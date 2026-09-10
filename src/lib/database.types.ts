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
      admin_metrics_daily: {
        Row: {
          active_users_count: number
          anonymous_users_count: number
          content_views_count: number
          created_at: string
          day: string
          events_count: number
          new_users_count: number
          reports_count: number
          screen_views_count: number
          searches_count: number
          sessions_count: number
          updated_at: string
        }
        Insert: {
          active_users_count?: number
          anonymous_users_count?: number
          content_views_count?: number
          created_at?: string
          day: string
          events_count?: number
          new_users_count?: number
          reports_count?: number
          screen_views_count?: number
          searches_count?: number
          sessions_count?: number
          updated_at?: string
        }
        Update: {
          active_users_count?: number
          anonymous_users_count?: number
          content_views_count?: number
          created_at?: string
          day?: string
          events_count?: number
          new_users_count?: number
          reports_count?: number
          screen_views_count?: number
          searches_count?: number
          sessions_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      analytics_content_daily: {
        Row: {
          avg_watch_seconds: number
          clicks_count: number
          comments_count: number
          created_at: string
          day: string
          entity_id: string
          entity_type: string
          hides_count: number
          impressions_count: number
          likes_count: number
          reports_count: number
          route_completions_count: number
          route_starts_count: number
          saves_count: number
          shares_count: number
          total_watch_seconds: number
          unique_users_count: number
          updated_at: string
          views_count: number
        }
        Insert: {
          avg_watch_seconds?: number
          clicks_count?: number
          comments_count?: number
          created_at?: string
          day: string
          entity_id: string
          entity_type: string
          hides_count?: number
          impressions_count?: number
          likes_count?: number
          reports_count?: number
          route_completions_count?: number
          route_starts_count?: number
          saves_count?: number
          shares_count?: number
          total_watch_seconds?: number
          unique_users_count?: number
          updated_at?: string
          views_count?: number
        }
        Update: {
          avg_watch_seconds?: number
          clicks_count?: number
          comments_count?: number
          created_at?: string
          day?: string
          entity_id?: string
          entity_type?: string
          hides_count?: number
          impressions_count?: number
          likes_count?: number
          reports_count?: number
          route_completions_count?: number
          route_starts_count?: number
          saves_count?: number
          shares_count?: number
          total_watch_seconds?: number
          unique_users_count?: number
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      analytics_event_dead_letters: {
        Row: {
          anonymous_id: string | null
          created_at: string
          event_id: string | null
          id: string
          payload: Json
          reason: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          payload: Json
          reason: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          payload?: Json
          reason?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          anonymous_id: string | null
          app_version: string | null
          build_number: string | null
          city: string | null
          context: Json
          country: string | null
          created_at: string
          device_os: string | null
          entity_id: string | null
          entity_type: string | null
          event_id: string
          event_name: string
          event_version: number
          id: string
          locale: string | null
          occurred_at: string
          platform: string | null
          properties: Json
          received_at: string
          region: string | null
          session_id: string
          source: string
          timezone: string | null
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string | null
          app_version?: string | null
          build_number?: string | null
          city?: string | null
          context?: Json
          country?: string | null
          created_at?: string
          device_os?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id: string
          event_name: string
          event_version?: number
          id?: string
          locale?: string | null
          occurred_at: string
          platform?: string | null
          properties?: Json
          received_at?: string
          region?: string | null
          session_id: string
          source?: string
          timezone?: string | null
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string | null
          app_version?: string | null
          build_number?: string | null
          city?: string | null
          context?: Json
          country?: string | null
          created_at?: string
          device_os?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id?: string
          event_name?: string
          event_version?: number
          id?: string
          locale?: string | null
          occurred_at?: string
          platform?: string | null
          properties?: Json
          received_at?: string
          region?: string | null
          session_id?: string
          source?: string
          timezone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_search_daily: {
        Row: {
          created_at: string
          day: string
          no_results_count: number
          normalized_query: string | null
          query_hash: string
          result_clicks_count: number
          searches_count: number
          top_clicked_entity_id: string | null
          top_clicked_entity_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          no_results_count?: number
          normalized_query?: string | null
          query_hash: string
          result_clicks_count?: number
          searches_count?: number
          top_clicked_entity_id?: string | null
          top_clicked_entity_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          no_results_count?: number
          normalized_query?: string | null
          query_hash?: string
          result_clicks_count?: number
          searches_count?: number
          top_clicked_entity_id?: string | null
          top_clicked_entity_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      analytics_session_daily: {
        Row: {
          anonymous_id: string | null
          created_at: string
          day: string
          duration_seconds: number
          ended_at: string | null
          events_count: number
          platform: string | null
          screen_views_count: number
          session_id: string
          source: string | null
          started_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string | null
          created_at?: string
          day: string
          duration_seconds?: number
          ended_at?: string | null
          events_count?: number
          platform?: string | null
          screen_views_count?: number
          session_id: string
          source?: string | null
          started_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string | null
          created_at?: string
          day?: string
          duration_seconds?: number
          ended_at?: string | null
          events_count?: number
          platform?: string | null
          screen_views_count?: number
          session_id?: string
          source?: string | null
          started_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_user_daily: {
        Row: {
          day: string
          events_count: number
          first_seen_at: string | null
          follows_count: number
          last_seen_at: string | null
          likes_count: number
          place_views_count: number
          reports_count: number
          route_views_count: number
          saves_count: number
          screen_views_count: number
          searches_count: number
          sessions_count: number
          user_id: string
          video_views_count: number
        }
        Insert: {
          day: string
          events_count?: number
          first_seen_at?: string | null
          follows_count?: number
          last_seen_at?: string | null
          likes_count?: number
          place_views_count?: number
          reports_count?: number
          route_views_count?: number
          saves_count?: number
          screen_views_count?: number
          searches_count?: number
          sessions_count?: number
          user_id: string
          video_views_count?: number
        }
        Update: {
          day?: string
          events_count?: number
          first_seen_at?: string | null
          follows_count?: number
          last_seen_at?: string | null
          likes_count?: number
          place_views_count?: number
          reports_count?: number
          route_views_count?: number
          saves_count?: number
          screen_views_count?: number
          searches_count?: number
          sessions_count?: number
          user_id?: string
          video_views_count?: number
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_validity_config: {
        Row: {
          anti_farm_min_distance_m: number
          id: number
          updated_at: string
        }
        Insert: {
          anti_farm_min_distance_m?: number
          id?: number
          updated_at?: string
        }
        Update: {
          anti_farm_min_distance_m?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      challenge_zones: {
        Row: {
          active: boolean
          center: unknown
          created_at: string
          id: string
          name_i18n_key: string
          radius_m: number
          slug: string
        }
        Insert: {
          active?: boolean
          center: unknown
          created_at?: string
          id?: string
          name_i18n_key: string
          radius_m: number
          slug: string
        }
        Update: {
          active?: boolean
          center?: unknown
          created_at?: string
          id?: string
          name_i18n_key?: string
          radius_m?: number
          slug?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          active_from: string
          active_to: string | null
          badge_id: string
          created_at: string
          description_i18n_key: string
          id: string
          metric: Database["public"]["Enums"]["challenge_metric"]
          points: number
          slug: string
          sort_order: number
          target: number
          title_i18n_key: string
          updated_at: string
          window: Database["public"]["Enums"]["challenge_window"]
          zone_scope: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          badge_id: string
          created_at?: string
          description_i18n_key: string
          id?: string
          metric: Database["public"]["Enums"]["challenge_metric"]
          points: number
          slug: string
          sort_order?: number
          target: number
          title_i18n_key: string
          updated_at?: string
          window: Database["public"]["Enums"]["challenge_window"]
          zone_scope?: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Update: {
          active_from?: string
          active_to?: string | null
          badge_id?: string
          created_at?: string
          description_i18n_key?: string
          id?: string
          metric?: Database["public"]["Enums"]["challenge_metric"]
          points?: number
          slug?: string
          sort_order?: number
          target?: number
          title_i18n_key?: string
          updated_at?: string
          window?: Database["public"]["Enums"]["challenge_window"]
          zone_scope?: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          created_at: string
          id: string
          parent_id: string | null
          text: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id?: string | null
          text: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string | null
          text?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_by: string
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_by: string
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          collection_id: string | null
          created_at: string
          id: string
          place_id: string | null
          route_id: string | null
          user_id: string
          video_id: string | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          id?: string
          place_id?: string | null
          route_id?: string | null
          user_id: string
          video_id?: string | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          id?: string
          place_id?: string | null
          route_id?: string | null
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_favorites_place"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_favorites_route"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_favorites_video"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_segments: {
        Row: {
          created_at: string
          id: string
          order: number
          points: Json
          route_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order: number
          points: Json
          route_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order?: number
          points?: Json
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_segments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_uploads_log: {
        Row: {
          id: string
          place_id: string | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          place_id?: string | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          place_id?: string | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_uploads_log_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_uploads_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      place_impressions: {
        Row: {
          place_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          place_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          place_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_impressions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      place_photos: {
        Row: {
          created_at: string
          id: string
          place_id: string
          position: number
          review_id: string | null
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          position?: number
          review_id?: string | null
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          position?: number
          review_id?: string | null
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          average_rating: number
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          location: unknown
          moderation_status: string
          name: string
          state: Database["public"]["Enums"]["place_state"]
          total_ratings: number
          updated_at: string
        }
        Insert: {
          average_rating?: number
          category?: Database["public"]["Enums"]["place_category"]
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          location: unknown
          moderation_status?: string
          name: string
          state?: Database["public"]["Enums"]["place_state"]
          total_ratings?: number
          updated_at?: string
        }
        Update: {
          average_rating?: number
          category?: Database["public"]["Enums"]["place_category"]
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          location?: unknown
          moderation_status?: string
          name?: string
          state?: Database["public"]["Enums"]["place_state"]
          total_ratings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          challenge_id: string
          created_at: string
          delta: number
          id: string
          reason: string
          source_ref: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          delta: number
          id?: string
          reason: string
          source_ref: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          source_ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          place_id: string
          rating: number
          text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          rating: number
          text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          rating?: number
          text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      route_completions: {
        Row: {
          completed_at: string
          distance_m: number | null
          duration_sec: number | null
          id: string
          places_reached: number
          places_total: number
          route_id: string
          user_id: string
          verified: boolean
        }
        Insert: {
          completed_at?: string
          distance_m?: number | null
          duration_sec?: number | null
          id?: string
          places_reached: number
          places_total: number
          route_id: string
          user_id: string
          verified?: boolean
        }
        Update: {
          completed_at?: string
          distance_m?: number | null
          duration_sec?: number | null
          id?: string
          places_reached?: number
          places_total?: number
          route_id?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "route_completions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_places: {
        Row: {
          place_id: string
          position: number
          route_id: string
        }
        Insert: {
          place_id: string
          position: number
          route_id: string
        }
        Update: {
          place_id?: string
          position?: number
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_places_new_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_places_new_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          route_id: string
          text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          route_id: string
          text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          route_id?: string
          text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_ratings_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          average_rating: number
          category: Database["public"]["Enums"]["route_category"]
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["route_difficulty"]
          distance_m: number
          elevation_gain: number
          estimated_duration: string | null
          fork_of: string | null
          id: string
          is_public: boolean
          name: string
          path: unknown
          state: Database["public"]["Enums"]["route_state"]
          total_ratings: number
          updated_at: string
        }
        Insert: {
          average_rating?: number
          category?: Database["public"]["Enums"]["route_category"]
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["route_difficulty"]
          distance_m?: number
          elevation_gain?: number
          estimated_duration?: string | null
          fork_of?: string | null
          id?: string
          is_public?: boolean
          name: string
          path?: unknown
          state?: Database["public"]["Enums"]["route_state"]
          total_ratings?: number
          updated_at?: string
        }
        Update: {
          average_rating?: number
          category?: Database["public"]["Enums"]["route_category"]
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["route_difficulty"]
          distance_m?: number
          elevation_gain?: number
          estimated_duration?: string | null
          fork_of?: string | null
          id?: string
          is_public?: boolean
          name?: string
          path?: unknown
          state?: Database["public"]["Enums"]["route_state"]
          total_ratings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_forked_from_fkey"
            columns: ["fork_of"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          challenge_id: string
          granted_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          challenge_id: string
          granted_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          challenge_id?: string
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_category_affinity: {
        Row: {
          category_key: string
          last_event_at: string | null
          negative_score: number
          positive_score: number
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_key: string
          last_event_at?: string | null
          negative_score?: number
          positive_score?: number
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_key?: string
          last_event_at?: string | null
          negative_score?: number
          positive_score?: number
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_content_affinity: {
        Row: {
          entity_id: string
          entity_type: string
          last_event_at: string | null
          negative_score: number
          positive_score: number
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          last_event_at?: string | null
          negative_score?: number
          positive_score?: number
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          last_event_at?: string | null
          negative_score?: number
          positive_score?: number
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_hidden_content: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_legal_consent: {
        Row: {
          accepted_at: string
          community_guidelines_accepted: boolean
          data_ads_policy_accepted: boolean
          locale: string
          platform: string
          policy_version: string
          privacy_accepted: boolean
          terms_accepted: boolean
          user_id: string
        }
        Insert: {
          accepted_at?: string
          community_guidelines_accepted?: boolean
          data_ads_policy_accepted?: boolean
          locale?: string
          platform: string
          policy_version: string
          privacy_accepted?: boolean
          terms_accepted?: boolean
          user_id: string
        }
        Update: {
          accepted_at?: string
          community_guidelines_accepted?: boolean
          data_ads_policy_accepted?: boolean
          locale?: string
          platform?: string
          policy_version?: string
          privacy_accepted?: boolean
          terms_accepted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_legal_consent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_privacy_preferences: {
        Row: {
          ad_measurement: boolean
          aggregated_insights: boolean
          do_not_sell_or_share: boolean
          personalized_ads: boolean
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          ad_measurement?: boolean
          aggregated_insights?: boolean
          do_not_sell_or_share?: boolean
          personalized_ads?: boolean
          updated_at?: string
          user_id: string
          version: string
        }
        Update: {
          ad_measurement?: boolean
          aggregated_insights?: boolean
          do_not_sell_or_share?: boolean
          personalized_ads?: boolean
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_privacy_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_safety_consent: {
        Row: {
          accepted_at: string
          route_safety_accepted: boolean
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          route_safety_accepted?: boolean
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          route_safety_accepted?: boolean
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_safety_consent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          categories_preferred: string[] | null
          created_at: string
          deletion_requested_at: string | null
          deletion_scheduled_at: string | null
          display_name: string
          email: string | null
          email_verified: boolean
          handle: string
          handle_changed_at: string | null
          id: string
          is_deactivated: boolean
          is_ghost: boolean
          language: string
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          categories_preferred?: string[] | null
          created_at?: string
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          display_name: string
          email?: string | null
          email_verified?: boolean
          handle: string
          handle_changed_at?: string | null
          id?: string
          is_deactivated?: boolean
          is_ghost?: boolean
          language?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          categories_preferred?: string[] | null
          created_at?: string
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          display_name?: string
          email?: string | null
          email_verified?: boolean
          handle?: string
          handle_changed_at?: string | null
          id?: string
          is_deactivated?: boolean
          is_ghost?: boolean
          language?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      video_impressions: {
        Row: {
          user_id: string
          video_id: string
          viewed_at: string
        }
        Insert: {
          user_id: string
          video_id: string
          viewed_at?: string
        }
        Update: {
          user_id?: string
          video_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_impressions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_places: {
        Row: {
          place_id: string
          video_id: string
        }
        Insert: {
          place_id: string
          video_id: string
        }
        Update: {
          place_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_places_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          reported_by: string
          video_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reported_by: string
          video_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reported_by?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_reports_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          cloudflare_uid: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          duration_seconds: number
          id: string
          location: unknown
          moderation_status: string
          place_id: string | null
          publish_to_feed: boolean
          route_id: string | null
          state: Database["public"]["Enums"]["video_state"]
          tags: string[] | null
          thumbnail_url: string | null
          total_comments: number
          total_likes: number
          updated_at: string
          video_url: string
        }
        Insert: {
          cloudflare_uid?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds: number
          id?: string
          location: unknown
          moderation_status?: string
          place_id?: string | null
          publish_to_feed?: boolean
          route_id?: string | null
          state?: Database["public"]["Enums"]["video_state"]
          tags?: string[] | null
          thumbnail_url?: string | null
          total_comments?: number
          total_likes?: number
          updated_at?: string
          video_url: string
        }
        Update: {
          cloudflare_uid?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number
          id?: string
          location?: unknown
          moderation_status?: string
          place_id?: string | null
          publish_to_feed?: boolean
          route_id?: string | null
          state?: Database["public"]["Enums"]["video_state"]
          tags?: string[] | null
          thumbnail_url?: string | null
          total_comments?: number
          total_likes?: number
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_analytics_overview_daily: {
        Row: {
          active_users_count: number | null
          anonymous_users_count: number | null
          content_hides_count: number | null
          content_impressions_count: number | null
          content_likes_count: number | null
          content_saves_count: number | null
          content_shares_count: number | null
          content_views_count: number | null
          day: string | null
          events_count: number | null
          new_users_count: number | null
          reports_count: number | null
          screen_views_count: number | null
          searches_count: number | null
          sessions_count: number | null
        }
        Relationships: []
      }
      admin_search_insights_daily: {
        Row: {
          click_through_rate: number | null
          day: string | null
          no_results_count: number | null
          no_results_rate: number | null
          normalized_query: string | null
          query_hash: string | null
          result_clicks_count: number | null
          searches_count: number | null
          top_clicked_entity_id: string | null
          top_clicked_entity_type: string | null
        }
        Insert: {
          click_through_rate?: never
          day?: string | null
          no_results_count?: number | null
          no_results_rate?: never
          normalized_query?: string | null
          query_hash?: string | null
          result_clicks_count?: number | null
          searches_count?: number | null
          top_clicked_entity_id?: string | null
          top_clicked_entity_type?: string | null
        }
        Update: {
          click_through_rate?: never
          day?: string | null
          no_results_count?: number | null
          no_results_rate?: never
          normalized_query?: string | null
          query_hash?: string | null
          result_clicks_count?: number | null
          searches_count?: number | null
          top_clicked_entity_id?: string | null
          top_clicked_entity_type?: string | null
        }
        Relationships: []
      }
      admin_top_content_daily: {
        Row: {
          avg_watch_seconds: number | null
          clicks_count: number | null
          comments_count: number | null
          day: string | null
          engagement_score: number | null
          entity_id: string | null
          entity_type: string | null
          hides_count: number | null
          impressions_count: number | null
          likes_count: number | null
          reports_count: number | null
          route_completions_count: number | null
          route_starts_count: number | null
          saves_count: number | null
          shares_count: number | null
          total_watch_seconds: number | null
          unique_users_count: number | null
          views_count: number | null
        }
        Insert: {
          avg_watch_seconds?: number | null
          clicks_count?: number | null
          comments_count?: number | null
          day?: string | null
          engagement_score?: never
          entity_id?: string | null
          entity_type?: string | null
          hides_count?: number | null
          impressions_count?: number | null
          likes_count?: number | null
          reports_count?: number | null
          route_completions_count?: number | null
          route_starts_count?: number | null
          saves_count?: number | null
          shares_count?: number | null
          total_watch_seconds?: number | null
          unique_users_count?: number | null
          views_count?: number | null
        }
        Update: {
          avg_watch_seconds?: number | null
          clicks_count?: number | null
          comments_count?: number | null
          day?: string | null
          engagement_score?: never
          entity_id?: string | null
          entity_type?: string | null
          hides_count?: number | null
          impressions_count?: number | null
          likes_count?: number | null
          reports_count?: number | null
          route_completions_count?: number | null
          route_starts_count?: number | null
          saves_count?: number | null
          shares_count?: number | null
          total_watch_seconds?: number | null
          unique_users_count?: number | null
          views_count?: number | null
        }
        Relationships: []
      }
      admin_user_growth_daily: {
        Row: {
          active_users_count: number | null
          day: string | null
          events_count: number | null
          first_seen_at: string | null
          last_seen_at: string | null
          new_users_count: number | null
          screen_views_count: number | null
          searches_count: number | null
          sessions_count: number | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      aggregate_analytics_events_for_day: {
        Args: { target_day: string }
        Returns: undefined
      }
      append_points_ledger: {
        Args: {
          p_challenge_id: string
          p_delta: number
          p_reason: string
          p_source_ref: string
          p_user_id: string
        }
        Returns: {
          challenge_id: string
          created_at: string
          delta: number
          id: string
          reason: string
          source_ref: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "points_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_route_place: {
        Args: { p_place_id: string; p_route_id: string }
        Returns: undefined
      }
      auth_email_registered: { Args: { p_email: string }; Returns: boolean }
      auth_email_signup_state: { Args: { p_email: string }; Returns: string }
      award_challenge_points: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["challenge_award_result"]
        SetofOptions: {
          from: "*"
          to: "challenge_award_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      challenge_anti_farm_min_distance_m: { Args: never; Returns: number }
      challenge_award_source_ref: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: string
      }
      challenge_clawback_source_ref: {
        Args: {
          p_challenge_id: string
          p_trigger_id: string
          p_trigger_kind: string
          p_user_id: string
        }
        Returns: string
      }
      challenge_content_moderation_active: {
        Args: { p_status: string }
        Returns: boolean
      }
      challenge_metric_count: {
        Args: {
          p_metric: Database["public"]["Enums"]["challenge_metric"]
          p_user_id: string
          p_window: Database["public"]["Enums"]["challenge_window"]
          p_zone_scope: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Returns: number
      }
      challenge_place_is_countable: {
        Args: { p_place: Database["public"]["Tables"]["places"]["Row"] }
        Returns: boolean
      }
      challenge_place_was_countable: {
        Args: { p_place: Database["public"]["Tables"]["places"]["Row"] }
        Returns: boolean
      }
      challenge_route_was_countable: {
        Args: { p_route: Database["public"]["Tables"]["routes"]["Row"] }
        Returns: boolean
      }
      challenge_video_was_countable: {
        Args: { p_video: Database["public"]["Tables"]["videos"]["Row"] }
        Returns: boolean
      }
      challenge_window_since: {
        Args: { p_window: Database["public"]["Enums"]["challenge_window"] }
        Returns: string
      }
      clawback_after_place_dedup: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: number
      }
      clawback_challenge_award: {
        Args: {
          p_challenge_id: string
          p_clawback_source_ref: string
          p_reason: string
          p_user_id: string
        }
        Returns: {
          challenge_id: string
          created_at: string
          delta: number
          id: string
          reason: string
          source_ref: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "points_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_old_upload_logs: { Args: never; Returns: undefined }
      count_route_completions: { Args: { p_route_id: string }; Returns: number }
      count_user_uploads_in_window: {
        Args: { uid: string; window_seconds?: number }
        Returns: number
      }
      count_valid_places_for_challenge: {
        Args: {
          p_since: string
          p_user_id: string
          p_zone_scope: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Returns: number
      }
      delete_own_review: { Args: { p_review_id: string }; Returns: string[] }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      explore_bayesian_rating: {
        Args: { avg: number; cnt: number; global_avg: number; m: number }
        Returns: number
      }
      explore_creator_publications_total: {
        Args: { creator: string }
        Returns: number
      }
      explore_local_creators: {
        Args: {
          as_of?: string
          filter_place_category?: Database["public"]["Enums"]["place_category"]
          filter_video_tag?: string
          in_lat: number
          in_lng: number
          max_results?: number
          offset_param?: number
          radius_m: number
        }
        Returns: {
          accent_color: string
          avatar_url: string
          creator_id: string
          display_name: string
          engagement_received: number
          handle: string
          last_publication: string
          publications_in_zone: number
          publications_total: number
          score: number
        }[]
      }
      explore_norm_log: { Args: { k: number; value: number }; Returns: number }
      explore_proximity_score: {
        Args: { dist_m: number; radius_m: number }
        Returns: number
      }
      explore_recency_decay: {
        Args: { as_of: string; half_life_hours: number; ts: string }
        Returns: number
      }
      explore_trending_creators_global: {
        Args: {
          as_of?: string
          filter_place_category?: Database["public"]["Enums"]["place_category"]
          filter_video_tag?: string
          max_results?: number
          offset_param?: number
        }
        Returns: {
          accent_color: string
          avatar_url: string
          creator_id: string
          display_name: string
          engagement_received: number
          handle: string
          last_publication: string
          publications_in_zone: number
          publications_total: number
          score: number
        }[]
      }
      finalize_account_deletion_server: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      finalize_own_expired_account: { Args: never; Returns: undefined }
      finalize_user_account_pii: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      geography_in_challenge_zone: {
        Args: {
          p_geog: unknown
          p_zone_scope: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Returns: boolean
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_challenge_progress: {
        Args: { p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["challenge_progress_row"][]
        SetofOptions: {
          from: "*"
          to: "challenge_progress_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_leaderboard: {
        Args: {
          p_limit?: number
          p_window?: Database["public"]["Enums"]["challenge_window"]
          p_zone_scope?: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Returns: Database["public"]["CompositeTypes"]["leaderboard_row"][]
        SetofOptions: {
          from: "*"
          to: "leaderboard_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      gettransactionid: { Args: never; Returns: unknown }
      grant_user_badge: {
        Args: { p_badge_id: string; p_challenge_id: string; p_user_id: string }
        Returns: {
          badge_id: string
          challenge_id: string
          granted_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_badges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hard_delete_expired_content: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          deleted_places: number
          deleted_routes: number
          deleted_videos: number
        }[]
      }
      increment_video_comments: {
        Args: { p_delta: number; p_video_id: string }
        Returns: undefined
      }
      increment_video_likes: {
        Args: { p_delta: number; p_video_id: string }
        Returns: undefined
      }
      is_valid_challenge_geography: {
        Args: { p_geog: unknown }
        Returns: boolean
      }
      list_expired_deleted_videos: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          cloudflare_uid: string
          id: string
          video_url: string
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_place_reported: { Args: { p_place_id: string }; Returns: boolean }
      mark_video_reported: { Args: { p_video_id: string }; Returns: boolean }
      place_valid_for_challenge_progress: {
        Args: {
          p_place: Database["public"]["Tables"]["places"]["Row"]
          p_zone_scope: Database["public"]["Enums"]["challenge_zone_scope"]
        }
        Returns: boolean
      }
      places_hidden_gems: {
        Args: {
          filter_category?: Database["public"]["Enums"]["place_category"]
          in_lat: number
          in_lng: number
          max_results?: number
          radius_m: number
        }
        Returns: {
          average_rating: number
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          location: unknown
          moderation_status: string
          name: string
          state: Database["public"]["Enums"]["place_state"]
          total_ratings: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "places"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      places_in_bbox: {
        Args: {
          category_filter?: string
          lat1: number
          lat2: number
          lng1: number
          lng2: number
        }
        Returns: {
          average_rating: number
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          location: unknown
          moderation_status: string
          name: string
          state: Database["public"]["Enums"]["place_state"]
          total_ratings: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "places"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      places_recent_nearby: {
        Args: {
          filter_category?: Database["public"]["Enums"]["place_category"]
          in_lat: number
          in_lng: number
          max_results?: number
          radius_m: number
        }
        Returns: {
          average_rating: number
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          location: unknown
          moderation_status: string
          name: string
          state: Database["public"]["Enums"]["place_state"]
          total_ratings: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "places"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      places_within_radius: {
        Args: {
          lat_param: number
          lng_param: number
          max_results?: number
          radius_meters: number
        }
        Returns: {
          average_rating: number
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          location: unknown
          moderation_status: string
          name: string
          state: Database["public"]["Enums"]["place_state"]
          total_ratings: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "places"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      purge_community_user_data: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      purge_community_user_data_service: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      purge_places_user_data: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      purge_routes_user_data: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      reassign_route_place: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      reevaluate_challenge_awards_for_metric: {
        Args: {
          p_metric: Database["public"]["Enums"]["challenge_metric"]
          p_reason?: string
          p_trigger_id: string
          p_trigger_kind: string
          p_user_id: string
        }
        Returns: number
      }
      reorder_place_photos: {
        Args: { p_ids: string[]; p_positions: number[] }
        Returns: undefined
      }
      request_account_deletion: {
        Args: never
        Returns: {
          accent_color: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          categories_preferred: string[] | null
          created_at: string
          deletion_requested_at: string | null
          deletion_scheduled_at: string | null
          display_name: string
          email: string | null
          email_verified: boolean
          handle: string
          handle_changed_at: string | null
          id: string
          is_deactivated: boolean
          is_ghost: boolean
          language: string
          onboarding_completed: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_account: {
        Args: never
        Returns: {
          accent_color: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          categories_preferred: string[] | null
          created_at: string
          deletion_requested_at: string | null
          deletion_scheduled_at: string | null
          display_name: string
          email: string | null
          email_verified: boolean
          handle: string
          handle_changed_at: string | null
          id: string
          is_deactivated: boolean
          is_ghost: boolean
          language: string
          onboarding_completed: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_user_badge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: boolean
      }
      routes_community_favorites: {
        Args: {
          as_of?: string
          cursor_id?: string
          cursor_score?: number
          filter_category?: Database["public"]["Enums"]["route_category"]
          in_lat: number
          in_lng: number
          max_results?: number
          radius_m: number
        }
        Returns: {
          category: Database["public"]["Enums"]["route_category"]
          created_by: string
          difficulty: Database["public"]["Enums"]["route_difficulty"]
          distance_m: number
          distance_to_start_m: number
          id: string
          name: string
          path: Json
          score: number
          video_count: number
        }[]
      }
      routes_nearby: {
        Args: {
          filter_category?: Database["public"]["Enums"]["route_category"]
          in_lat: number
          in_lng: number
          radius_m?: number
          result_limit?: number
        }
        Returns: {
          category: Database["public"]["Enums"]["route_category"]
          created_by: string
          difficulty: Database["public"]["Enums"]["route_difficulty"]
          distance_m: number
          distance_to_start_m: number
          id: string
          name: string
          path: Json
        }[]
      }
      routes_trending_weekly: {
        Args: {
          as_of?: string
          filter_category?: Database["public"]["Enums"]["route_category"]
          in_lat: number
          in_lng: number
          max_results?: number
          radius_m: number
        }
        Returns: {
          category: Database["public"]["Enums"]["route_category"]
          created_by: string
          difficulty: Database["public"]["Enums"]["route_difficulty"]
          distance_m: number
          distance_to_start_m: number
          id: string
          name: string
          path: Json
          score: number
        }[]
      }
      search_places_for_map: {
        Args: {
          category_filter?: Database["public"]["Enums"]["place_category"]
          center_lat?: number
          center_lng?: number
          result_limit?: number
          search_query: string
        }
        Returns: {
          average_rating: number
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          created_by: string
          description: string
          distance_m: number
          id: string
          latitude: number
          location: unknown
          longitude: number
          name: string
          primary_photo_url: string
          state: Database["public"]["Enums"]["place_state"]
          total_ratings: number
          updated_at: string
        }[]
      }
      search_routes_discover: {
        Args: {
          category_filter?: Database["public"]["Enums"]["route_category"]
          q: string
          result_limit?: number
        }
        Returns: {
          category: Database["public"]["Enums"]["route_category"]
          created_by: string
          creator_avatar_url: string
          creator_display_name: string
          creator_handle: string
          description: string
          distance_meters: number
          id: string
          name: string
        }[]
      }
      search_users_discover: {
        Args: { q: string; result_limit?: number }
        Returns: {
          accent_color: string
          avatar_url: string
          display_name: string
          handle: string
          id: string
          trips_count: number
        }[]
      }
      search_videos_discover: {
        Args: { q: string; result_limit?: number; tag_filter?: string }
        Returns: {
          author_avatar_url: string
          author_display_name: string
          author_handle: string
          created_by: string
          description: string
          id: string
          tags: string[]
          thumbnail_url: string
          total_likes: number
        }[]
      }
      set_route_places: {
        Args: { p_place_ids: string[]; p_route_id: string }
        Returns: undefined
      }
      soft_delete_place_cascade: {
        Args: { p_place_id: string }
        Returns: string[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sweep_expired_account_deletions: {
        Args: { p_limit?: number }
        Returns: number
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_video_links: {
        Args: { p_place_ids: string[]; p_route_id?: string; p_video_id: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      user_points_balance: { Args: { p_user_id: string }; Returns: number }
      videos_from_following: {
        Args: {
          cursor_at?: string
          max_results?: number
          p_follower_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          description: string
          duration_seconds: number
          id: string
          lat: number
          lng: number
          place_ids: string[]
          route_id: string
          state: string
          tags: string[]
          thumbnail_url: string
          total_comments: number
          total_likes: number
          updated_at: string
          video_url: string
        }[]
      }
      videos_recent_nearby: {
        Args: {
          filter_tag?: string
          in_lat: number
          in_lng: number
          max_results?: number
          radius_m: number
        }
        Returns: {
          created_at: string
          created_by: string
          description: string
          duration_seconds: number
          id: string
          lat: number
          lng: number
          place_ids: string[]
          route_id: string
          state: string
          tags: string[]
          thumbnail_url: string
          total_comments: number
          total_likes: number
          updated_at: string
          video_url: string
        }[]
      }
      videos_recycled_nearby: {
        Args: {
          lat_param: number
          lng_param: number
          max_results?: number
          offset_param?: number
          radius_meters: number
          uid_param: string
        }
        Returns: {
          created_at: string
          created_by: string
          description: string
          duration_seconds: number
          id: string
          last_viewed_at: string
          lat: number
          lng: number
          place_ids: string[]
          route_id: string
          state: string
          tags: string[]
          thumbnail_url: string
          total_comments: number
          total_likes: number
          updated_at: string
          video_url: string
        }[]
      }
      videos_trending_weekly: {
        Args: {
          as_of?: string
          filter_tag?: string
          in_lat: number
          in_lng: number
          max_results?: number
          radius_m: number
        }
        Returns: {
          created_at: string
          created_by: string
          description: string
          duration_seconds: number
          id: string
          lat: number
          lng: number
          place_ids: string[]
          route_id: string
          score: number
          state: string
          tags: string[]
          thumbnail_url: string
          total_comments: number
          total_likes: number
          updated_at: string
          video_url: string
        }[]
      }
      videos_within_radius: {
        Args: {
          as_of?: string
          cursor_id?: string
          cursor_score?: number
          exclude_seen_since?: string
          filter_tag?: string
          lat_param: number
          lng_param: number
          max_results?: number
          radius_meters: number
          uid_param?: string
        }
        Returns: {
          created_at: string
          created_by: string
          description: string
          duration_seconds: number
          id: string
          lat: number
          lng: number
          place_ids: string[]
          route_id: string
          score: number
          state: string
          tags: string[]
          thumbnail_url: string
          total_comments: number
          total_likes: number
          updated_at: string
          video_url: string
        }[]
      }
    }
    Enums: {
      challenge_metric:
        | "places_created"
        | "routes_published"
        | "videos_published"
        | "route_completed"
        | "loop_completed"
      challenge_window: "once" | "weekly" | "all_time"
      challenge_zone_scope: "global" | "local"
      place_category:
        | "hiking"
        | "gastronomy"
        | "beach"
        | "urban"
        | "nature"
        | "nightlife"
        | "culture"
        | "history"
        | "shopping"
        | "wellness"
        | "adventure"
        | "camping"
        | "events"
        | "family"
        | "other"
      place_state: "draft" | "published" | "reported" | "deleted"
      route_category:
        | "hiking"
        | "urban"
        | "gastronomy"
        | "cycling"
        | "nature"
        | "nightlife"
        | "culture"
        | "history"
        | "shopping"
        | "wellness"
        | "adventure"
        | "camping"
        | "events"
        | "family"
        | "other"
      route_difficulty: "easy" | "moderate" | "hard" | "expert"
      route_state: "recording" | "draft" | "published" | "deleted"
      video_state:
        | "processing"
        | "published"
        | "reported"
        | "deleted"
        | "private"
        | "draft"
    }
    CompositeTypes: {
      challenge_award_result: {
        user_id: string | null
        challenge_id: string | null
        awarded: boolean | null
        already_awarded: boolean | null
        gate_passed: boolean | null
        points_delta: number | null
        badge_id: string | null
        source_ref: string | null
        message: string | null
      }
      challenge_progress_row: {
        challenge_id: string | null
        slug: string | null
        metric: Database["public"]["Enums"]["challenge_metric"] | null
        current_count: number | null
        target: number | null
        completed: boolean | null
        points: number | null
        badge_id: string | null
        title_i18n_key: string | null
        description_i18n_key: string | null
        sort_order: number | null
        window: Database["public"]["Enums"]["challenge_window"] | null
        zone_scope: Database["public"]["Enums"]["challenge_zone_scope"] | null
      }
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      leaderboard_row: {
        rank: number | null
        user_id: string | null
        handle: string | null
        display_name: string | null
        points: number | null
        zone_scope: Database["public"]["Enums"]["challenge_zone_scope"] | null
        window: Database["public"]["Enums"]["challenge_window"] | null
        window_start: string | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      challenge_metric: [
        "places_created",
        "routes_published",
        "videos_published",
        "route_completed",
        "loop_completed",
      ],
      challenge_window: ["once", "weekly", "all_time"],
      challenge_zone_scope: ["global", "local"],
      place_category: [
        "hiking",
        "gastronomy",
        "beach",
        "urban",
        "nature",
        "nightlife",
        "culture",
        "history",
        "shopping",
        "wellness",
        "adventure",
        "camping",
        "events",
        "family",
        "other",
      ],
      place_state: ["draft", "published", "reported", "deleted"],
      route_category: [
        "hiking",
        "urban",
        "gastronomy",
        "cycling",
        "nature",
        "nightlife",
        "culture",
        "history",
        "shopping",
        "wellness",
        "adventure",
        "camping",
        "events",
        "family",
        "other",
      ],
      route_difficulty: ["easy", "moderate", "hard", "expert"],
      route_state: ["recording", "draft", "published", "deleted"],
      video_state: [
        "processing",
        "published",
        "reported",
        "deleted",
        "private",
        "draft",
      ],
    },
  },
} as const

