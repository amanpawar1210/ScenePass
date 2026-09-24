import { Routes } from '@angular/router';
import { adminGuard, authGuard, customerGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    // Public: this is what a ticket's QR code opens on any phone.
    path: 'verify/:code',
    loadComponent: () => import('./pages/verify/verify').then((m) => m.VerifyPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'discover' },
      {
        path: 'discover',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/discover/discover').then((m) => m.DiscoverPage),
      },
      {
        path: 'events/:id',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/event/event-detail').then((m) => m.EventDetailPage),
      },
      {
        path: 'events/:id/seats',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/seats/seats').then((m) => m.SeatsPage),
      },
      { path: 'room', redirectTo: 'rooms' },
      {
        path: 'rooms',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/rooms/rooms').then((m) => m.RoomsPage),
      },
      {
        path: 'rooms/:code',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/rooms/room').then((m) => m.RoomPage),
      },
      {
        path: 'venues',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/venues/venues').then((m) => m.VenuesPage),
      },
      {
        path: 'venues/:slug',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/venues/venue').then((m) => m.VenuePage),
      },
      {
        path: 'tickets',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/tickets/tickets').then((m) => m.TicketsPage),
      },
      {
        path: 'studio',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/studio/studio').then((m) => m.StudioPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
