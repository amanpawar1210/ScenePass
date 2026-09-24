import { EventEmitter } from "node:events";

// In-process pub/sub for live updates (Server-Sent Events). Topics look like
// "event:<id>", "room:<code>" and "user:<id>". Single-instance only; clients also
// poll slowly, so multi-instance or serverless deployments still converge.
const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publish(topic, payload = {}) {
  bus.emit(topic, { topic, ...payload, at: Date.now() });
}

export function subscribe(topics, listener) {
  for (const t of topics) bus.on(t, listener);
  return () => topics.forEach((t) => bus.off(t, listener));
}
