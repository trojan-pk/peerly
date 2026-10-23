import { DefaultSession } from "next-auth";
import { UserRole } from "@/types/user";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      isProfileComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: UserRole;
    isProfileComplete?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
    isProfileComplete?: boolean;
  }
}
