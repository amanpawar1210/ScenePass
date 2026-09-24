import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Sends visitors to sign in, remembering where they were going (e.g. a group invite link). */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).user()) return true;
  try {
    if (state.url && state.url !== '/') sessionStorage.setItem('scenepass_redirect', state.url);
  } catch {}
  return inject(Router).parseUrl('/login');
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.user()) return true;
  return inject(Router).parseUrl(auth.isAdmin() ? '/studio' : '/discover');
};

/** Organizers only see the studio and their profile. */
export const customerGuard: CanActivateFn = () =>
  inject(AuthService).isAdmin() ? inject(Router).parseUrl('/studio') : true;

export const adminGuard: CanActivateFn = () =>
  inject(AuthService).isAdmin() ? true : inject(Router).parseUrl('/discover');
