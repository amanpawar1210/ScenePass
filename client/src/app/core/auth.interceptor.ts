import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err) => {
      // A rejected token means the session is gone; send the visitor back to sign in.
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !req.url.endsWith('/auth/me')) {
        auth.clear();
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
