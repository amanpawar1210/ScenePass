import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () =>
  inject(AuthService).user() ? true : inject(Router).parseUrl('/login');

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
