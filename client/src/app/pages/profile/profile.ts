import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ChevronRight, Heart, LogOut, LucideAngularModule, MapPin, ShieldCheck, Ticket } from 'lucide-angular';
import { AuthService } from '../../core/auth.service';
import { StoreService } from '../../core/store.service';

@Component({
  selector: 'app-profile',
  imports: [LucideAngularModule],
  template: `
    @if (auth.user(); as user) {
      <section class="simple-page profile-page">
        <div class="profile-hero">
          <div class="profile-avatar">{{ initials() }}</div>
          <div>
            <span class="page-kicker">{{ user.role.toUpperCase() }} ACCOUNT</span>
            <h1>{{ user.name }}</h1>
            <p>{{ user.email }} · Bengaluru</p>
          </div>
          <button (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="17" /> Log out</button>
        </div>
        <div class="profile-grid">
          <article>
            <lucide-icon [img]="icons.Heart" />
            <b>{{ store.favourites().length }}</b><span>Saved experiences</span>
            <button (click)="viewSaved()">View saved <lucide-icon [img]="icons.ChevronRight" [size]="15" /></button>
          </article>
          <article>
            <lucide-icon [img]="icons.Ticket" />
            <b>{{ store.orders().length }}</b><span>Confirmed bookings</span>
            <button (click)="router.navigateByUrl(auth.isAdmin() ? '/studio' : '/tickets')">
              {{ auth.isAdmin() ? 'Open studio' : 'Open wallet' }} <lucide-icon [img]="icons.ChevronRight" [size]="15" />
            </button>
          </article>
          <article>
            <lucide-icon [img]="icons.MapPin" />
            <b>Bengaluru</b><span>Your city</span>
            <button (click)="store.notify('More cities coming soon')">
              Location settings <lucide-icon [img]="icons.ChevronRight" [size]="15" />
            </button>
          </article>
        </div>
        <div class="profile-note">
          <lucide-icon [img]="icons.ShieldCheck" [size]="18" /> This is a demo profile. Sign-in does not use a password.
        </div>
      </section>
    }
  `,
})
export class ProfilePage {
  protected auth = inject(AuthService);
  protected store = inject(StoreService);
  protected router = inject(Router);
  protected readonly icons = { ChevronRight, Heart, LogOut, MapPin, ShieldCheck, Ticket };
  protected readonly initials = computed(() => this.auth.user()?.name.slice(0, 2).toUpperCase() ?? '');

  protected viewSaved(): void {
    if (this.auth.isAdmin()) {
      this.store.notify('Saved experiences are available to customers');
      return;
    }
    this.store.category.set('Saved');
    this.router.navigateByUrl('/discover');
  }

  protected signOut(): void {
    this.store.signOut();
    this.router.navigateByUrl('/login');
  }
}
