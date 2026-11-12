// Hand-written types matching supabase/migrations/0001_init.sql.
// Once you have a live Supabase project, prefer regenerating this with:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'error';
export type OrgRole = 'owner' | 'admin' | 'member';
export type MessageRole = 'user' | 'assistant';
export type MessageFeedback = 1 | -1;
export type OrgPlan = 'free' | 'solo' | 'pme' | 'metier';
export type OrgOverageMode = 'block' | 'auto_bill';
export type SourceRefreshFrequency = 'off' | 'daily' | 'weekly';
export type FileExtractionStatus = 'ok' | 'empty' | 'failed';
export type OverageChargeStatus = 'succeeded' | 'failed';
export type ChatbotUseCase = 'site_widget' | 'second_cerveau' | 'contract_analyzer' | 'paperwork_digitizer';

// Structured clause extraction (lib/openai.ts ContractSummary), stored as
// jsonb on chatbots.contract_summary — kept loose here (not importing
// lib/openai.ts's richer ContractSummary type into this file) since this
// module only describes the DB shape, not the app-level contract.
export type ContractSummaryJson = Record<string, string | null>;

// Format choisi à la création d'un digitaliseur de paperasse (item 24),
// oriente l'extraction (lib/openai.ts extractDocumentFields). Stocké sur
// chatbots.document_format, null pour les autres use_cases.
export type DocumentFormat = 'facture' | 'libre';

// Paires label/valeur extraites d'un document (lib/openai.ts
// ExtractedField), stockées telles quelles sur documents.extracted_fields —
// un tableau plutôt qu'un objet pour autoriser des labels non uniques et
// préserver l'ordre produit par le modèle.
export type ExtractedFieldsJson = { label: string; value: string }[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          plan: OrgPlan;
          overage_mode: OrgOverageMode;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_subscription_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          plan?: OrgPlan;
          overage_mode?: OrgOverageMode;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          plan?: OrgPlan;
          overage_mode?: OrgOverageMode;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_status?: string | null;
          created_at?: string;
        };
      };
      users_organizations: {
        Row: {
          user_id: string;
          organization_id: string;
          role: OrgRole;
          created_at: string;
        };
        Insert: {
          user_id: string;
          organization_id: string;
          role?: OrgRole;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          organization_id?: string;
          role?: OrgRole;
          created_at?: string;
        };
      };
      chatbots: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          system_prompt_template: string;
          is_public: boolean;
          allowed_origins: string[];
          use_documents: boolean;
          use_ai_indexing: boolean;
          allow_email_tool: boolean;
          notification_email: string | null;
          allow_visitor_uploads: boolean;
          show_loading_steps: boolean;
          loading_messages: string[] | null;
          use_case: ChatbotUseCase;
          contract_summary: ContractSummaryJson | null;
          document_format: DocumentFormat | null;
          allow_lead_qualification: boolean;
          lead_qualification_criteria: string | null;
          meeting_link: string | null;
          bot_name: string | null;
          welcome_message: string | null;
          suggested_questions: string[] | null;
          logo_path: string | null;
          lead_webhook_url: string | null;
          lead_webhook_secret: string | null;
          source_refresh: SourceRefreshFrequency;
          analyze_visitor_files: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          system_prompt_template?: string;
          is_public?: boolean;
          allowed_origins?: string[];
          use_documents?: boolean;
          use_ai_indexing?: boolean;
          allow_email_tool?: boolean;
          notification_email?: string | null;
          allow_visitor_uploads?: boolean;
          show_loading_steps?: boolean;
          loading_messages?: string[] | null;
          use_case?: ChatbotUseCase;
          contract_summary?: ContractSummaryJson | null;
          document_format?: DocumentFormat | null;
          allow_lead_qualification?: boolean;
          lead_qualification_criteria?: string | null;
          meeting_link?: string | null;
          bot_name?: string | null;
          welcome_message?: string | null;
          suggested_questions?: string[] | null;
          logo_path?: string | null;
          lead_webhook_url?: string | null;
          lead_webhook_secret?: string | null;
          source_refresh?: SourceRefreshFrequency;
          analyze_visitor_files?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          system_prompt_template?: string;
          is_public?: boolean;
          allowed_origins?: string[];
          use_documents?: boolean;
          use_ai_indexing?: boolean;
          allow_email_tool?: boolean;
          notification_email?: string | null;
          allow_visitor_uploads?: boolean;
          show_loading_steps?: boolean;
          loading_messages?: string[] | null;
          use_case?: ChatbotUseCase;
          contract_summary?: ContractSummaryJson | null;
          document_format?: DocumentFormat | null;
          allow_lead_qualification?: boolean;
          lead_qualification_criteria?: string | null;
          meeting_link?: string | null;
          bot_name?: string | null;
          welcome_message?: string | null;
          suggested_questions?: string[] | null;
          logo_path?: string | null;
          lead_webhook_url?: string | null;
          lead_webhook_secret?: string | null;
          source_refresh?: SourceRefreshFrequency;
          analyze_visitor_files?: boolean;
          created_at?: string;
        };
      };
      custom_templates: {
        Row: {
          id: string;
          organization_id: string;
          label: string;
          template: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          label: string;
          template: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          label?: string;
          template?: string;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          chatbot_id: string;
          filename: string;
          file_type: string;
          storage_path: string | null;
          source_url: string | null;
          status: DocumentStatus;
          error_message: string | null;
          chunk_count: number | null;
          extracted_fields: ExtractedFieldsJson | null;
          content_hash: string | null;
          last_checked_at: string | null;
          uploaded_at: string;
          indexed_at: string | null;
        };
        Insert: {
          id?: string;
          chatbot_id: string;
          filename: string;
          file_type: string;
          storage_path?: string | null;
          source_url?: string | null;
          status?: DocumentStatus;
          error_message?: string | null;
          chunk_count?: number | null;
          extracted_fields?: ExtractedFieldsJson | null;
          content_hash?: string | null;
          last_checked_at?: string | null;
          uploaded_at?: string;
          indexed_at?: string | null;
        };
        Update: {
          id?: string;
          chatbot_id?: string;
          filename?: string;
          file_type?: string;
          storage_path?: string | null;
          source_url?: string | null;
          status?: DocumentStatus;
          error_message?: string | null;
          chunk_count?: number | null;
          extracted_fields?: ExtractedFieldsJson | null;
          content_hash?: string | null;
          last_checked_at?: string | null;
          uploaded_at?: string;
          indexed_at?: string | null;
        };
      };
      conversations: {
        Row: {
          id: string;
          chatbot_id: string;
          user_id: string | null;
          visitor_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chatbot_id: string;
          user_id?: string | null;
          visitor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chatbot_id?: string;
          user_id?: string | null;
          visitor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: MessageRole;
          content: string;
          sources: string[] | null;
          feedback: MessageFeedback | null;
          no_context: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: MessageRole;
          content: string;
          sources?: string[] | null;
          feedback?: MessageFeedback | null;
          no_context?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: MessageRole;
          content?: string;
          sources?: string[] | null;
          feedback?: MessageFeedback | null;
          no_context?: boolean;
          created_at?: string;
        };
      };
      conversation_files: {
        Row: {
          id: string;
          chatbot_id: string;
          conversation_id: string;
          message_id: string;
          filename: string;
          size_bytes: number;
          storage_path: string;
          extracted_text: string | null;
          extraction_status: FileExtractionStatus | null;
          extraction_truncated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          chatbot_id: string;
          conversation_id: string;
          message_id: string;
          filename: string;
          size_bytes: number;
          storage_path: string;
          extracted_text?: string | null;
          extraction_status?: FileExtractionStatus | null;
          extraction_truncated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          chatbot_id?: string;
          conversation_id?: string;
          message_id?: string;
          filename?: string;
          size_bytes?: number;
          storage_path?: string;
          extracted_text?: string | null;
          extraction_status?: FileExtractionStatus | null;
          extraction_truncated?: boolean;
          created_at?: string;
        };
      };
      overage_charges: {
        Row: {
          id: string;
          organization_id: string;
          period_start: string;
          blocks_charged: number;
          amount_cents: number;
          stripe_payment_intent_id: string | null;
          status: OverageChargeStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          period_start: string;
          blocks_charged: number;
          amount_cents: number;
          stripe_payment_intent_id?: string | null;
          status: OverageChargeStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          period_start?: string;
          blocks_charged?: number;
          amount_cents?: number;
          stripe_payment_intent_id?: string | null;
          status?: OverageChargeStatus;
          created_at?: string;
        };
      };
    };
    Functions: {
      create_organization: {
        Args: { org_name: string };
        Returns: Database['public']['Tables']['organizations']['Row'];
      };
      is_org_member: {
        Args: { org_id: string };
        Returns: boolean;
      };
      is_org_admin: {
        Args: { org_id: string };
        Returns: boolean;
      };
      chatbot_stats_messages: {
        Args: { p_chatbot_id: string; p_since: string; p_visitors_only: boolean; p_limit?: number };
        Returns: {
          id: string;
          conversation_id: string;
          role: MessageRole;
          content: string;
          no_context: boolean;
          feedback: MessageFeedback | null;
          created_at: string;
        }[];
      };
    };
  };
}
