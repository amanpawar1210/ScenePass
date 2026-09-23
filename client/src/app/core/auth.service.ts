import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Role, User } from './models';

const TOKEN_KEY = 'scenepass_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** Restores the session from a stored token; runs once at app start. */
  async restore(): Promise<void> {
    if (!this.token) return;
    try {
      const { user } = await firstValueFrom(this.api.me());
      this.user.set(user);
    } catch {
      this.clear();
    }
  }

  async signIn(name: string, email: string, role: Role): Promise<User> {
    const res = await firstValueFrom(this.api.login({ name, email, role }));
    localStorage.setItem(TOKEN_KEY, res.token);
    this.user.set(res.user);
    return res.user;
  }

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    this.user.set(null);
  }
}
