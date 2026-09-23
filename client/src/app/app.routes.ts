import { Routes } from '@angular/router';
import { adminGuard, authGuard, customerGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
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
        path: 'events/:id/seats',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/seats/seats').then((m) => m.SeatsPage),
      },
      {
        path: 'room',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/room/room').then((m) => m.RoomPage),
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
