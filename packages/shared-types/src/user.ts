export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  cover_url?: string | null;   // ← added
  created_at: string;
  updated_at: string;
}

export interface RegisterUserRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}