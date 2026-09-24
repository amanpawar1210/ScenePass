import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ChevronRight, Heart, LogOut, LucideAngularModule, MapPin, Pencil, ShieldCheck, Ticket, Wallet } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { StoreService } from '../../core/store.service';
import { initialsOf, inr } from '../../core/format';
import { EventCard } from '../../shared/event-card';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, LucideAngularModule, EventCard],
  template: `
    @if (auth.user(); as user) {
      <section class="simple-page profile-page">
        <div class="profile-hero">
          <div class="profile-avatar">{{ initials() }}</div>
          <div>
            <span class="page-kicker">{{ user.role === 'admin' ? 'ORGANIZER' : 'CUSTOMER' }} ACCOUNT</span>
            @if (editing()) {
              <div class="profile-edit">
                <input [(ngModel)]="nameDraft" aria-label="Your name" maxlength="60" />
                <select [(ngModel)]="cityDraft" aria-label="Home city">
                  @for (c of store.cities(); track c) {
                    <option [value]="c">{{ c }}</option>
                  }
                </select>
                <button (click)="saveProfile()" [disabled]="saving()">Save</button>
                <button class="ghost" (click)="editing.set(false)">Cancel</button>
              </div>
            } @else {
              <h1>{{ user.name }}</h1>
              <p>{{ user.email }} · {{ user.city }}</p>
            }
          </div>
          <div class="profile-hero-actions">
            @if (!editing()) {
              <button (click)="startEdit()"><lucide-icon [img]="icons.Pencil" [size]="16" /> Edit profile</button>
            }
            <button (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="17" /> Log out</button>
          </div>
        </div>

        <div class="profile-grid">
          @if (!auth.isAdmin()) {
            <article>
              <lucide-icon [img]="icons.Ticket" />
              <b>{{ upcomingCount() }}</b><span>Upcoming bookings</span>
              <button (click)="router.navigateByUrl('/tickets')">Open wallet <lucide-icon [img]="icons.ChevronRight" [size]="15" /></button>
            </article>
            <article>
              <lucide-icon [img]="icons.Wallet" />
              <b>{{ spent() }}</b><span>Spent on {{ ticketCount() }} tickets</span>
              <button (click)="router.navigateByUrl('/discover')">Find your next night <lucide-icon [img]="icons.ChevronRight" [size]="15" /></button>
            </article>
            <article>
              <lucide-icon [img]="icons.Heart" />
              <b>{{ store.favourites().length }}</b><span>Saved experiences</span>
              <button (click)="viewSaved()">View saved <lucide-icon [img]="icons.ChevronRight" [size]="15" /></button>
            </article>
          } @else {
            <article>
              <lucide-icon [img]="icons.Ticket" />
              <b>{{ store.events().length }}</b><span>Events you manage</span>
              <button (click)="router.navigateByUrl('/studio')">Open studio <lucide-icon [img]="icons.ChevronRight" [size]="15" /></button>
            </article>
            <article>
              <lucide-icon [img]="icons.MapPin" />
              <b>{{ user.city }}</b><span>Home city</span>
              <button (click)="startEdit()">Change <lucide-icon [img]="icons.ChevronRight" [size]="15" /></button>
            </article>
          }
        </div>

        @if (!auth.isAdmin() && savedEvents().length) {
          <section class="event-section">
            <header><div><span>SAVED FOR LATER</span><h2>Your shortlist.</h2></div></header>
            <div class="event-grid">
              @for (e of savedEvents(); track e.id) {
                <app-event-card [event]="e" />
              }
            </div>
          </section>
        }

        <div class="profile-note">
          <lucide-icon [img]="icons.ShieldCheck" [size]="18" /> Demo account · sign-in does not use a password and payments are simulated.
        </div>
      </section>
    }
  `,
})
export class ProfilePage {
  protected auth = inject(AuthService);
  protected store = inject(StoreService);
  protected router = inject(Router);
  private api = inject(ApiService);
  protected readonly icons = { ChevronRight, Heart, LogOut, MapPin, Pencil, ShieldCheck, Ticket, Wallet };
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected nameDraft = '';
  protected cityDraft = '';

  protected readonly initials = computed(() => initialsOf(this.auth.user()?.name ?? ''));
  private readonly confirmed = computed(() => this.store.orders().filter((o) => o.status === 'confirmed'));
  protected readonly upcomingCount = computed(
    () => this.confirmed().filter((o) => Date.parse(o.event.startsAt) > Date.now()).length,
  );
  protected readonly ticketCount = computed(() => this.confirmed().reduce((n, o) => n + o.seats.length, 0));
  protected readonly spent = computed(() => inr(this.confirmed().reduce((n, o) => n + o.total, 0)));
  protected readonly savedEvents = computed(() =>
    this.store.liveEvents().filter((e) => this.store.favourites().includes(e.id)),
  );

  protected startEdit(): void {
    const user = this.auth.user()!;
    this.nameDraft = user.name;
    this.cityDraft = user.city;
    this.editing.set(true);
  }

  protected async saveProfile(): Promise<void> {
    this.saving.set(true);
    try {
      const { user } = await firstValueFrom(this.api.updateMe({ name: this.nameDraft.trim(), city: this.cityDraft }));
      this.auth.user.set(user);
      this.editing.set(false);
      this.store.notify('Profile updated');
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected viewSaved(): void {
    this.store.category.set('Saved');
    this.router.navigateByUrl('/discover');
  }

  protected signOut(): void {
    this.store.signOut();
    this.router.navigateByUrl('/login');
  }
}
