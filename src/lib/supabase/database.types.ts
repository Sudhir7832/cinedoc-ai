export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<{
        id: string; email: string; name: string; role: string; credits: number; reserved_credits: number;
        total_documentaries_created: number; created_at: string; updated_at: string;
      }>;
      documentary_jobs: Table<{
        id: string; user_id: string; status: string; data: Json; created_at: string; updated_at: string;
      }>;
      payment_transactions: Table<{
        id: string; user_id: string; user_email: string; pack_id: string; pack_name: string; amount: number;
        currency: string; credits_added: number; gateway: string; status: string; payment_id: string | null;
        provider_payment_id: string | null; created_at: string;
      }>;
      credit_ledger: Table<{
        id: string; user_id: string; amount: number; balance_after: number | null; type: string;
        description: string; reference_id: string | null; created_at: string;
      }>;
      saas_settings: Table<{
        id: string; welcome_credits: number; credits_per_scene: number; enable_test_mode: boolean;
        enable_stripe: boolean; enable_razorpay: boolean; stripe_publishable_key: string | null;
        stripe_secret_key: string | null; razorpay_key_id: string | null; razorpay_key_secret: string | null;
        enable_dodo: boolean; dodo_api_key: string | null; dodo_webhook_key: string | null; dodo_mode: string;
        pricing_packs: Json; runtime_config: Json; updated_at: string;
      }>;
      testimonials: Table<{
        id: string; title: string; description: string; video_url: string; poster_url: string | null;
        format: string; quote: string | null; attribution: string | null; published: boolean; created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      reserve_job_credits: { Args: { p_user_id: string; p_cost: number }; Returns: Database['public']['Tables']['profiles']['Row'] };
      release_job_credits: { Args: { p_user_id: string; p_cost: number }; Returns: Database['public']['Tables']['profiles']['Row'] };
      charge_job_credits: { Args: { p_user_id: string; p_cost: number; p_job_id: string; p_topic: string }; Returns: Database['public']['Tables']['profiles']['Row'] };
      is_admin: { Args: { check_user?: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
