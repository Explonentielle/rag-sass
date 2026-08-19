// Hand-written types matching supabase/migrations/0001_init.sql.
// Once you have a live Supabase project, prefer regenerating this with:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'error';
export type OrgRole = 'owner' | 'admin' | 'member';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
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
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          system_prompt_template?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          system_prompt_template?: string;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          chatbot_id: string;
          filename: string;
          file_type: string;
          storage_path: string;
          status: DocumentStatus;
          error_message: string | null;
          chunk_count: number | null;
          uploaded_at: string;
          indexed_at: string | null;
        };
        Insert: {
          id?: string;
          chatbot_id: string;
          filename: string;
          file_type: string;
          storage_path: string;
          status?: DocumentStatus;
          error_message?: string | null;
          chunk_count?: number | null;
          uploaded_at?: string;
          indexed_at?: string | null;
        };
        Update: {
          id?: string;
          chatbot_id?: string;
          filename?: string;
          file_type?: string;
          storage_path?: string;
          status?: DocumentStatus;
          error_message?: string | null;
          chunk_count?: number | null;
          uploaded_at?: string;
          indexed_at?: string | null;
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
    };
  };
}
