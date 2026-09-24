import { DestroyRef, Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Live updates over Server-Sent Events. Components call `listen(topics, onMessage)`
 * and the subscription closes automatically when the component is destroyed.
 * Callers keep a slow polling fallback for hosts that can't stream (e.g. serverless).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);

  listen(topics: string[], onMessage: (msg: { topic: string; type: string }) => void, destroyRef?: DestroyRef): () => void {
    if (typeof EventSource === 'undefined' || !topics.length) return () => {};
    const params = new URLSearchParams({ topics: topics.join(',') });
    if (this.auth.token) params.set('token', this.auth.token);
    const source = new EventSource(`/api/stream?${params}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (e) => {
      // Coalesce bursts (e.g. several seats held at once) into one refresh.
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          onMessage(JSON.parse(e.data));
        } catch {}
      }, 150);
    };
    const close = () => {
      clearTimeout(timer);
      source.close();
    };
    destroyRef?.onDestroy(close);
    return close;
  }
}
