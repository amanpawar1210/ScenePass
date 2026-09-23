import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChevronRight, LucideAngularModule, ShieldCheck, UserRound } from 'lucide-angular';
import { errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Role } from '../../core/models';
import { StoreService } from '../../core/store.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-login',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <main class="auth-shell">
      <section class="auth-visual">
        <div class="auth-brand"><span>S</span>SCENE<em>PASS</em></div>
        <div>
          <span class="auth-kicker">THE CITY, LIVE</span>
          <h1>Don't just watch.<br /><em>Be there.</em></h1>
          <p>Discover the night. Pick your seat. Keep every memory close.</p>
        </div>
        <div class="auth-proof"><span>CURATED EVENTS</span><span>GROUP BOOKING</span><span>INSTANT TICKETS</span></div>
      </section>
      <section class="auth-form">
        <span class="auth-kicker">WELCOME TO SCENEPASS</span>
        <h2>Your next night starts here.</h2>
        <p>Choose a demo account type to explore the experience.</p>
        <div class="role-switch">
          <button [class.active]="role() === 'customer'" (click)="role.set('customer')">
            <lucide-icon [img]="icons.UserRound" [size]="19" /> Customer
          </button>
          <button [class.active]="role() === 'admin'" (click)="role.set('admin')">
            <lucide-icon [img]="icons.ShieldCheck" [size]="19" /> Organizer
          </button>
        </div>
        <label>Your name<input [(ngModel)]="name" placeholder="Aditya Sharma" /></label>
        <label>
          Email address
          <input [(ngModel)]="email" (keydown.enter)="signIn()" placeholder="you@example.com" type="email" />
        </label>
        <button class="auth-submit" [disabled]="busy()" (click)="signIn()">
          Continue as {{ role() }}<lucide-icon [img]="icons.ChevronRight" [size]="19" />
        </button>
        <small><lucide-icon [img]="icons.ShieldCheck" [size]="14" /> Demo sign-in · no password required</small>
      </section>
    </main>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private store = inject(StoreService);
  private router = inject(Router);
  protected readonly icons = { ChevronRight, ShieldCheck, UserRound };
  protected readonly role = signal<Role>('customer');
  protected readonly busy = signal(false);
  protected name = '';
  protected email = '';

  protected async signIn(): Promise<void> {
    if (!EMAIL_RE.test(this.email.trim())) {
      this.store.notify('Enter a valid email address');
      return;
    }
    this.busy.set(true);
    try {
      const user = await this.auth.signIn(this.name.trim(), this.email.trim(), this.role());
      this.store.reset();
      this.router.navigateByUrl(user.role === 'admin' ? '/studio' : '/discover');
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
