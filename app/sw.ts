/// <reference lib="webworker" />

import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist"
import { NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, sameOrigin }) =>
      sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: "app-pages",
      networkTimeoutSeconds: 3,
    }),
  },
  {
    matcher: ({ request, sameOrigin }) =>
      sameOrigin &&
      (request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker"),
    handler: new StaleWhileRevalidate({
      cacheName: "app-static-assets",
    }),
  },
  {
    matcher: ({ request, sameOrigin }) =>
      sameOrigin && request.destination === "image",
    handler: new StaleWhileRevalidate({
      cacheName: "app-images",
    }),
  },
]

const serwist = new Serwist({
  clientsClaim: true,
  navigationPreload: true,
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching,
  skipWaiting: true,
})

serwist.addEventListeners()
