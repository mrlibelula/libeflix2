export interface CommentUser {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Comment {
  id: number;
  content: string;
  user: CommentUser;
  created_at: string;
  updated_at: string;
  parent_id?: number;
  replies?: Comment[];
  likes_count?: number;
  is_liked?: boolean;
  is_owner?: boolean;
  diff_for_humans?: string;
}

export interface CommentsResponse {
  comments: {
    data: Comment[];
    links: {
      first: string;
      last: string;
      prev: string | null;
      next: string | null;
    };
    meta: {
      current_page: number;
      from: number;
      last_page: number;
      path: string;
      per_page: number;
      to: number;
      total: number;
    };
  };
  total_comments: number;
}

export interface CreateCommentRequest {
  content: string;
  commentable_type: string;
  commentable_id: number;
  parent_id?: number;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CommentContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
} 