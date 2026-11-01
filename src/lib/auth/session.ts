import { NextRequest } from 'next/server';
import { DbManager } from '../db';
import { DocumentaryJob, SafeUser } from '../types';
import { createRouteSupabase } from '../supabase/server';

export class SessionManager {
  public static async getCurrentUser(req: NextRequest): Promise<SafeUser | null> {
    const { client } = createRouteSupabase(req);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    const profile = await DbManager.getUserById(data.user.id);
    return profile ? DbManager.toSafeUser(profile) : null;
  }

  public static async requireAuth(req: NextRequest): Promise<SafeUser> {
    const user = await this.getCurrentUser(req);
    if (!user) throw new Error('Authentication required. Please sign in.');
    return user;
  }

  public static async requireAdmin(req: NextRequest): Promise<SafeUser> {
    const user = await this.requireAuth(req);
    if (user.role !== 'admin') throw new Error('Forbidden: Admin access required.');
    return user;
  }

  public static canAccessJob(user: SafeUser, job: DocumentaryJob): boolean {
    return user.role === 'admin' || (Boolean(job.userId) && job.userId === user.id);
  }

  public static async requireJobAccess(req: NextRequest, job: DocumentaryJob): Promise<SafeUser> {
    const user = await this.requireAuth(req);
    if (!this.canAccessJob(user, job)) throw new Error('Forbidden: You do not have access to this job.');
    return user;
  }
}
